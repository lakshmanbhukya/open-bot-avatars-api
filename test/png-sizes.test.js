import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import catalog from '../app/lib/catalogs/v5.json' with { type: 'json' }
import { avatarFilename } from '../app/lib/avatar-catalog.js'
import { GET } from '../app/api/avatar/route.js'

const get = query => GET(new Request('http://localhost/api/avatar?v=5&' + query))

test('every PNG finish has smaller, visible, transparent derivatives at all three sizes', async () => {
  let count = 0
  for (const entry of catalog) {
    for (const { format, style } of entry.variants) {
      if (format !== 'png') continue
      const filename = avatarFilename(entry.id, format, style)
      const base = `public/avatars/v5/${entry.collection}`
      const original = await readFile(`${base}/${filename}`)
      for (const size of [64, 128, 256]) {
        const data = await readFile(`${base}/sizes/${size}/${filename}`)
        const image = await loadImage(data)
        assert.deepEqual([image.width, image.height], [size, size], filename)
        assert(data.length < original.length, filename)
        const context = createCanvas(size, size).getContext('2d')
        context.drawImage(image, 0, 0)
        assert(context.getImageData(0, 0, size, size).data.some((value, i) => i % 4 === 3 && value > 0), filename)
        for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
          assert.equal(context.getImageData(x, y, 1, 1).data[3], 0, filename)
        }
        count++
      }
    }
  }
  assert.equal(count, 282)
})

test('PNG sizes preserve default bytes, seeded identity, and separate canonical URLs and validators', async () => {
  const query = 'seed=user-42&style=fluffy'
  const original = await get(query)
  const explicit = await get(query + '&size=512')
  assert.equal(explicit.headers.get('content-location'), original.headers.get('content-location'))
  assert.deepEqual(Buffer.from(await explicit.arrayBuffer()), Buffer.from(await original.arrayBuffer()))
  const etags = new Set([original.headers.get('etag')])
  for (const size of ['64', '128', '256']) {
    const response = await get(query + '&size=' + size)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-avatar-id'), original.headers.get('x-avatar-id'))
    assert.equal(response.headers.get('x-avatar-collection'), original.headers.get('x-avatar-collection'))
    const canonical = response.headers.get('content-location')
    assert.equal(new URL(canonical, 'http://localhost').searchParams.get('size'), size)
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.equal(bytes.readUInt32BE(16), Number(size))
    const etag = response.headers.get('etag')
    assert(!etags.has(etag))
    etags.add(etag)
    const saved = await GET(new Request('http://localhost' + canonical))
    assert.deepEqual(Buffer.from(await saved.arrayBuffer()), bytes)
    const cached = await GET(new Request('http://localhost' + canonical, { headers: { 'If-None-Match': etag } }))
    assert.equal(cached.status, 304)
    assert.equal(await cached.text(), '')
    assert.equal(cached.headers.get('access-control-allow-origin'), '*')
  }
  const random = await get('size=64')
  assert.equal(random.headers.get('cache-control'), 'no-store')
})

test('invalid sizes, duplicates, and SVG size requests are rejected', async () => {
  for (const query of ['size=', 'size=0', 'size=65', 'size=064', 'size=64.0', 'size=../64', 'size=64&size=128', 'format=svg&size=512', 'format=svg&size=64']) {
    const response = await get(query)
    assert.equal(response.status, 400, query)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('access-control-allow-origin'), '*')
    assert.match((await response.json()).error, /[Ss]ize/)
  }
})
