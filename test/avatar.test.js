import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { examples, renderAvatarSvg } from 'open-bot-avatar'
import { botAvatarPresets, parseColor } from 'bot-avatars'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { GET } from '../app/api/avatar/route.js'
import { GET as list } from '../app/api/avatars/route.js'
import catalog from '../app/lib/catalogs/v4.json' with { type: 'json' }
import upstream from '../app/lib/upstream/open-bot-avatar.json' with { type: 'json' }

const get = (query = '', headers) => GET(new Request('http://localhost/api/avatar' + query, { headers }))
const bytes = async response => Buffer.from(await response.arrayBuffer())

test('every catalog finish has a small, decodable gallery thumbnail', async () => {
  let thumbnailBytes = 0
  let originalBytes = 0
  for (const entry of catalog) {
    for (const style of entry.styles) {
      const base = `public/avatars/v4/${entry.collection}/${entry.id}${style === 'flat' ? '' : '-' + style}`
      const data = await readFile(`${base}-thumb.webp`)
      const image = await loadImage(data)
      assert.equal(image.width, 224, base)
      assert.equal(image.height, 224, base)
      thumbnailBytes += data.length
      originalBytes += (await readFile(`${base}.png`)).length
    }
  }
  assert.ok(thumbnailBytes < originalBytes / 5, 'Gallery thumbnails should save at least 80% of image bytes')
})

test('random endpoint serves a PNG and returns an exact reusable URL', async () => {
  const response = await get()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/png')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const location = response.headers.get('content-location')
  assert.ok(location.includes('v=5'))
  const saved = await GET(new Request('http://localhost' + location))
  assert.deepEqual(await bytes(saved), await bytes(response))
  assert.equal(saved.headers.get('cache-control'), 'public, max-age=86400')
})

test('the catalog exposes 41 original designs and every published format works', async () => {
  const response = await list(new Request('http://localhost/api/avatars?v=4'))
  const data = await response.json()
  assert.equal(data.total, 41)
  assert.equal(data.avatars.filter(entry => entry.collection === 'open-bot-avatar').length, 23)
  assert.equal(data.avatars.filter(entry => entry.collection === 'bot-avatars').length, 18)
  assert.equal(new Set(data.avatars.map(entry => entry.collection + '/' + entry.id)).size, 41)
  for (const entry of data.avatars) {
    for (const { format, style } of entry.variants) {
      const params = new URLSearchParams({ v: '4', collection: entry.collection, avatar: entry.id, style, format })
      const image = await get('?' + params)
      assert.equal(image.status, 200, params.toString())
      const body = await bytes(image)
      if (format === 'png') {
        assert.equal(body.subarray(1, 4).toString(), 'PNG')
        assert.equal(body.readUInt32BE(16), 512)
        assert.equal(body.readUInt32BE(20), 512)
        const canvas = createCanvas(512, 512)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(await loadImage(body), 0, 0)
        for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) {
          assert.equal(ctx.getImageData(x, y, 1, 1).data[3], 0, `Transparent PNG background: ${params}`)
        }
      } else assert.match(body.toString(), /<svg\b/)
    }
  }
})

test('Open Bot SVGs match the official renderer, definitions, and original colors', async () => {
  for (const definition of [...examples, ...upstream.gallery]) {
    const response = await get('?v=4&collection=open-bot-avatar&avatar=' + definition.id + '&format=svg')
    assert.equal(await response.text(), renderAvatarSvg(definition, {
      size: 512, color: upstream.colors[definition.id], reducedMotion: true
    }), definition.id)
  }
})

test('Libraries.dev uses official presets and its flat bodies have no white highlights', async () => {
  for (const entry of catalog.filter(entry => entry.collection === 'bot-avatars')) {
    assert.equal(entry.color, botAvatarPresets[entry.id].color)
  }
  const data = await bytes(await get('?v=4&collection=bot-avatars&avatar=clover'))
  const canvas = createCanvas(512, 512)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(await loadImage(data), 0, 0)
  const pixels = ctx.getImageData(0, 0, 512, 512).data
  const colors = new Map()
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] !== 255) continue
    assert.ok(!(pixels[i] > 230 && pixels[i + 1] > 230 && pixels[i + 2] > 230), 'No white body highlight')
    const rgb = pixels.slice(i, i + 3).join(',')
    colors.set(rgb, (colors.get(rgb) ?? 0) + 1)
  }
  const body = parseColor(catalog.find(entry => entry.collection === 'bot-avatars' && entry.id === 'clover').renderedColor).map(Math.round)
  const inks = [body, [30, 26, 51]]
  // Canvas resampling can round a channel by one; eye boundaries are antialiased.
  const solid = [...colors].filter(([rgb]) => inks.some(ink => rgb.split(',').every((value, i) => Math.abs(Number(value) - ink[i]) <= 2)))
    .reduce((sum, [, count]) => sum + count, 0)
  assert.ok(solid > [...colors.values()].reduce((a,b) => a+b,0) * .98, 'Solid body and eye ink')
  const original = await bytes(await get('?v=4&collection=bot-avatars&avatar=clover&style=original'))
  assert.notDeepEqual(original, data)
})

test('v4 seeds and collection filters choose repeatable original bots', async () => {
  const seed = 'a & b + / ? # = ' + String.fromCodePoint(0x1f916)
  for (const collection of ['open-bot-avatar', 'bot-avatars']) {
    const query = '?' + new URLSearchParams({ v: '4', seed, collection })
    const first = await get(query)
    const again = await get(query)
    assert.equal(first.headers.get('x-avatar-collection'), collection)
    assert.deepEqual(await bytes(first), await bytes(again))
    assert.equal(first.headers.get('content-location'), again.headers.get('content-location'))
  }
  assert.equal((await get('?v=4&seed=' + 'x'.repeat(128))).status, 200)
})

test('invalid, duplicate, incompatible, and unknown parameters return readable CORS errors', async () => {
  for (const query of ['seed=', 'seed=a&seed=b', 'seed=' + 'x'.repeat(129), 'v=6', 'v=4&v=2',
    'collection=missing', 'avatar=mug', 'collection=open-bot-avatar&avatar=missing',
    'collection=bot-avatars&format=svg', 'collection=open-bot-avatar&style=original',
    'format=jpeg', 'style=missing', 'v=2&collection=bot-avatars', 'width=50',
    'collection=open-bot-avatar&avatar=mug&seed=x', 'collection=../', 'collection=']) {
    const response = await get('?' + query)
    assert.equal(response.status, 400, query)
    assert.equal(response.headers.get('access-control-allow-origin'), '*')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.ok((await response.json()).error)
  }
})

test('saved images support conditional requests and expose their identity', async () => {
  const query = '?v=4&collection=bot-avatars&avatar=clover'
  const response = await get(query)
  const etag = response.headers.get('etag')
  assert.equal(response.headers.get('x-avatar-id'), 'clover')
  assert.match(response.headers.get('access-control-expose-headers'), /Content-Location/)
  const cached = await get(query, { 'If-None-Match': etag })
  assert.equal(cached.status, 304)
  assert.equal(await cached.text(), '')
  assert.equal((await get(query, { 'If-None-Match': '"different"' })).status, 200)
})

test('image, seeded, invalid and catalog requests share the public API rate limit', async () => {
  let response
  for (let i = 0; i <= 180; i++) {
    response = await get('?unknown=parameter')
    if (response.status === 429) break
    assert.equal(response.status, 400)
  }
  assert.equal(response.status, 429)
  assert.equal((await get('?v=4')).status, 429)
  assert.equal((await get('?seed=user-42')).status, 429)
  assert.equal((await list(new Request('http://localhost/api/avatars'))).status, 429)
})
