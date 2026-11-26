import test from 'node:test'
import assert from 'node:assert/strict'
import { readRoute, href } from '../app/studio/navigation.ts'
import { retryDelaySeconds } from '../app/studio/api-urls.ts'
import { avatarAsset } from '../app/lib/avatar-assets.js'
import { GET as avatar } from '../app/api/avatar/route.js'
import { GET as list } from '../app/api/avatars/route.js'
import { validateCatalog } from '../scripts/validate-catalog.mjs'
import v5 from '../app/lib/catalogs/v5.json' with { type: 'json' }
import frozenV5 from './fixtures/v5-compatibility.json' with { type: 'json' }
import { readFile } from 'node:fs/promises'
import { avatarFilename, supportsVariant } from '../app/lib/avatar-catalog.js'

test('normal page paths and legacy links keep their destinations', () => {
  assert.equal(readRoute('', '', '/docs'), 'docs')
  assert.equal(readRoute('', '?avatar=mug', '/editor'), 'studio')
  assert.equal(readRoute('#/', ''), 'studio')
  assert.equal(readRoute('#/docs', ''), 'docs')
  assert.equal(readRoute('', '?avatar=mug'), 'studio')
  assert.equal(readRoute('', '?collection=open-bot-avatar&avatar=mug'), 'api')
  assert.equal(readRoute('#avatar-options', ''), 'api')
  assert.deepEqual(href, { api: '/', studio: '/editor', docs: '/docs' })
})

test('retry delays accept seconds and HTTP dates without negative or invalid countdowns', () => {
  const now = Date.parse('2026-01-01T00:00:00Z')
  assert.equal(retryDelaySeconds('5', now), 5)
  assert.equal(retryDelaySeconds('1.5', now), 2)
  assert.equal(retryDelaySeconds('Thu, 01 Jan 2026 00:00:05 GMT', now), 5)
  assert.equal(retryDelaySeconds('Wed, 31 Dec 2025 23:59:59 GMT', now), 0)
  assert.equal(retryDelaySeconds('-1', now), 0)
  assert.equal(retryDelaySeconds('invalid', now), 0)
  assert.equal(retryDelaySeconds(null, now), 0)
})

test('concurrent image requests reuse the loaded bytes and ETag', async () => {
  const [first, second] = await Promise.all([
    avatarAsset('open-bot-avatar', 'mug.png'),
    avatarAsset('open-bot-avatar', 'mug.png')
  ])
  assert.strictEqual(first, second)
  assert.strictEqual(await avatarAsset('open-bot-avatar', 'mug.png'), first)
  assert.equal(first.data.subarray(1, 4).toString(), 'PNG')
  assert.match(first.etag, /^"[a-f0-9]{64}"$/)
})

test('unversioned catalog, seeded, exact, and fluffy requests default to v5', async () => {
  const implicit = await list(new Request('http://localhost/api/avatars'))
  const explicit = await list(new Request('http://localhost/api/avatars?v=5'))
  assert.deepEqual(await implicit.json(), await explicit.json())
  for (const query of ['seed=user-42', 'seed=user-42&style=fluffy', 'collection=open-bot-avatar&avatar=teapot&style=fluffy']) {
    const image = await avatar(new Request('http://localhost/api/avatar?' + query))
    const versioned = await avatar(new Request('http://localhost/api/avatar?v=5&' + query))
    assert.equal(image.status, 200)
    assert.equal(image.headers.get('content-location'), versioned.headers.get('content-location'))
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from(await versioned.arrayBuffer()))
  }
})

test('retired, unpublished, empty, and duplicate versions return readable errors', async () => {
  for (const query of ['v=1', 'v=2', 'v=3', 'v=4', 'v=6', 'v=', 'v=5&v=5']) {
    for (const endpoint of [avatar, list]) {
      const response = await endpoint(new Request('http://localhost/api/avatar?' + query))
      assert.equal(response.status, 400, query)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('access-control-allow-origin'), '*')
      assert.match((await response.json()).error, /[Vv]ersion|only one v/)
    }
  }
})

test('catalog validation checks every image and rejects damaged metadata, definitions, and missing assets', async () => {
  assert.deepEqual(await validateCatalog(v5), { designs: 47, images: 123, thumbnails: 94 })
  const mug = v5.find(entry => entry.id === 'mug')
  await assert.rejects(validateCatalog([mug, mug]), /Duplicate catalog entry/)
  await assert.rejects(validateCatalog([{ ...mug, color: '' }]), /Missing or invalid color/)
  await assert.rejects(validateCatalog([mug], { definitions: [{ id: 'mug', body: { path: '' } }] }), /Invalid or missing definition/)
  await assert.rejects(validateCatalog([{ ...mug, variants: [{ format: 'svg', style: 'fluffy' }] }]), /Unsupported format\/style/)
  await assert.rejects(validateCatalog([{ ...mug, variants: [{ format: 'png', style: 'flat' }] }]), /Format summaries disagree/)
  await assert.rejects(validateCatalog([mug], { assetRoot: 'test/fixtures/no-assets-here' }), /ENOENT/)
})

test('v5 advertises valid pairs and serves every variant from its own asset directory', async () => {
  const response = await list(new Request('http://localhost/api/avatars?v=5'))
  assert.deepEqual(await response.json(), frozenV5.catalogResponse)
  assert.equal(v5.length, 47)
  assert.deepEqual(await validateCatalog(v5, { version: '5' }), { designs: 47, images: 123, thumbnails: 94 })
  for (const entry of v5) {
    assert.equal(supportsVariant(entry, 'svg', 'fluffy'), false)
    assert.equal(supportsVariant(entry, 'png', 'fluffy'), entry.collection === 'open-bot-avatar')
    for (const { format, style } of entry.variants) {
      const params = new URLSearchParams({ v: '5', collection: entry.collection, avatar: entry.id, format, style })
      const image = await avatar(new Request('http://localhost/api/avatar?' + params))
      assert.equal(image.status, 200, params.toString())
      assert.equal(image.headers.get('content-location'), '/api/avatar?' + params)
      assert.equal(image.headers.get('access-control-allow-origin'), '*')
      assert.equal(image.headers.get('cache-control'), 'public, max-age=86400')
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), await readFile(`public/avatars/v5/${entry.collection}/${avatarFilename(entry.id, format, style)}`))
    }
  }
})

test('v5 rejects incompatible fluffy requests and preserves versioned caching and random no-store', async () => {
  for (const query of ['v=5&collection=open-bot-avatar&style=fluffy&format=svg', 'v=5&collection=bot-avatars&style=fluffy', 'v=5&style=fluffy&format=svg']) {
    const response = await avatar(new Request('http://localhost/api/avatar?' + query))
    assert.equal(response.status, 400, query)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert((await response.json()).error)
  }
  const url = 'http://localhost/api/avatar?v=5&collection=open-bot-avatar&avatar=mug&style=fluffy'
  const image = await avatar(new Request(url))
  const cached = await avatar(new Request(url, { headers: { 'If-None-Match': image.headers.get('etag') } }))
  assert.equal(cached.status, 304)
  assert.equal(await cached.text(), '')
  assert.match(cached.headers.get('content-location'), /v=5/)
  const random = await avatar(new Request('http://localhost/api/avatar?v=5&style=fluffy'))
  assert.equal(random.status, 200)
  assert.equal(random.headers.get('cache-control'), 'no-store')
  assert.strictEqual(await avatarAsset('open-bot-avatar', 'mug.png'), await avatarAsset('open-bot-avatar', 'mug.png', '5'))
})
