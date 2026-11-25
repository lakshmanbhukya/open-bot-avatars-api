import test from 'node:test'
import assert from 'node:assert/strict'
import { readRoute, href } from '../app/studio/navigation.ts'
import { retryDelaySeconds } from '../app/studio/api-urls.ts'
import { avatarAsset } from '../app/lib/avatar-assets.js'
import { createHash } from 'node:crypto'
import { GET as avatar } from '../app/api/avatar/route.js'
import { GET as list } from '../app/api/avatars/route.js'
import catalog from '../app/lib/catalogs/v3.json' with { type: 'json' }
import frozen from './fixtures/v3-compatibility.json' with { type: 'json' }
import { validateCatalog, validateFrozenAssets } from '../scripts/validate-catalog.mjs'
import v4 from '../app/lib/catalogs/v4.json' with { type: 'json' }
import frozenV4 from './fixtures/v4-compatibility.json' with { type: 'json' }
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

test('frozen v3 catalog and legacy, exact, seeded, and unversioned responses retain their bytes', async () => {
  const response = await list(new Request('http://localhost/api/avatars'))
  assert.deepEqual(await response.json(), frozen.catalogResponse)
  assert.deepEqual(await (await list(new Request('http://localhost/api/avatars?v=3'))).json(), frozen.catalogResponse)
  for (const fixture of frozen.requests) {
    const image = await avatar(new Request('http://localhost/api/avatar?' + fixture.query))
    assert.equal(image.status, 200, fixture.query)
    assert.equal(image.headers.get('content-location'), fixture.location)
    assert.equal(image.headers.get('x-avatar-collection'), fixture.collection)
    assert.equal(image.headers.get('x-avatar-id'), fixture.id)
    assert.equal(createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex'), fixture.sha256, fixture.query)
  }
  assert.deepEqual(catalog, frozen.catalogResponse.avatars.map(({ url, originalUrl, ...entry }) => entry))
  assert.equal(await validateFrozenAssets(), 141)
})

test('unpublished versions and unsupported v3 finishes remain invalid', async () => {
  for (const query of ['v=5', 'v=3&v=3']) {
    const response = await list(new Request('http://localhost/api/avatars?' + query))
    assert.equal(response.status, 400)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('access-control-allow-origin'), '*')
  }
  for (const query of ['v=3&collection=open-bot-avatar&style=fluffy', 'v=3&collection=open-bot-avatar&style=original', 'v=3&collection=bot-avatars&format=svg']) {
    assert.equal((await avatar(new Request('http://localhost/api/avatar?' + query))).status, 400)
  }
})

test('catalog validation checks every image and rejects damaged metadata, definitions, and missing assets', async () => {
  assert.deepEqual(await validateCatalog(catalog), { designs: 41, images: 82, thumbnails: 59 })
  const mug = catalog.find(entry => entry.id === 'mug')
  await assert.rejects(validateCatalog([mug, mug]), /Duplicate catalog entry/)
  await assert.rejects(validateCatalog([{ ...mug, color: '' }]), /Missing or invalid color/)
  await assert.rejects(validateCatalog([mug], { definitions: [{ id: 'mug', body: { path: '' } }] }), /Invalid or missing definition/)
  await assert.rejects(validateCatalog([{ ...mug, variants: [{ format: 'svg', style: 'fluffy' }] }]), /Unsupported format\/style/)
  await assert.rejects(validateCatalog([{ ...mug, variants: [{ format: 'png', style: 'flat' }] }]), /Format summaries disagree/)
  await assert.rejects(validateCatalog([mug], { assetRoot: 'test/fixtures/no-assets-here' }), /ENOENT/)
})

test('v4 advertises valid pairs and serves every variant from its own asset directory', async () => {
  const response = await list(new Request('http://localhost/api/avatars?v=4'))
  assert.deepEqual(await response.json(), frozenV4.catalogResponse)
  assert.equal(v4.length, 41)
  assert.deepEqual(v4.map(({ collection, id }) => [collection, id]), catalog.map(({ collection, id }) => [collection, id]))
  assert.deepEqual(await validateCatalog(v4, { version: '4' }), { designs: 41, images: 105, thumbnails: 82 })
  for (const entry of v4) {
    assert.equal(supportsVariant(entry, 'svg', 'fluffy'), false)
    assert.equal(supportsVariant(entry, 'png', 'fluffy'), entry.collection === 'open-bot-avatar')
    for (const { format, style } of entry.variants) {
      const params = new URLSearchParams({ v: '4', collection: entry.collection, avatar: entry.id, format, style })
      const image = await avatar(new Request('http://localhost/api/avatar?' + params))
      assert.equal(image.status, 200, params.toString())
      assert.equal(image.headers.get('content-location'), '/api/avatar?' + params)
      assert.equal(image.headers.get('access-control-allow-origin'), '*')
      assert.equal(image.headers.get('cache-control'), 'public, max-age=86400')
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), await readFile(`public/avatars/v4/${entry.collection}/${avatarFilename(entry.id, format, style)}`))
    }
  }
})

test('v4 seeds, catalog, and all published assets are frozen for future catalog expansion', async () => {
  for (const fixture of frozenV4.requests) {
    const response = await avatar(new Request('http://localhost/api/avatar?' + fixture.query))
    assert.equal(response.status, 200, fixture.query)
    assert.equal(response.headers.get('content-location'), fixture.location)
    assert.equal(response.headers.get('x-avatar-id'), fixture.id)
    assert.equal(response.headers.get('x-avatar-collection'), fixture.collection)
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), fixture.sha256)
  }
  for (const [file, expected] of Object.entries(frozenV4.assets)) {
    assert.equal(createHash('sha256').update(await readFile('public/avatars/v4/' + file)).digest('hex'), expected, file)
  }
  for (const [file, expected] of Object.entries(frozen.assets)) {
    assert.equal(createHash('sha256').update(await readFile('public/avatars/v4/' + file)).digest('hex'), expected, `v4 reuses unchanged legacy variant: ${file}`)
  }
})

test('v4 rejects incompatible fluffy requests and preserves versioned caching and random no-store', async () => {
  for (const query of ['v=4&collection=open-bot-avatar&style=fluffy&format=svg', 'v=4&collection=bot-avatars&style=fluffy', 'v=4&style=fluffy&format=svg', 'style=fluffy&collection=open-bot-avatar']) {
    const response = await avatar(new Request('http://localhost/api/avatar?' + query))
    assert.equal(response.status, 400, query)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert((await response.json()).error)
  }
  const url = 'http://localhost/api/avatar?v=4&collection=open-bot-avatar&avatar=mug&style=fluffy'
  const image = await avatar(new Request(url))
  const cached = await avatar(new Request(url, { headers: { 'If-None-Match': image.headers.get('etag') } }))
  assert.equal(cached.status, 304)
  assert.equal(await cached.text(), '')
  assert.match(cached.headers.get('content-location'), /v=4/)
  const random = await avatar(new Request('http://localhost/api/avatar?v=4&style=fluffy'))
  assert.equal(random.status, 200)
  assert.equal(random.headers.get('cache-control'), 'no-store')
  const old = await avatarAsset('open-bot-avatar', 'mug.png', '3')
  const current = await avatarAsset('open-bot-avatar', 'mug.png', '4')
  assert.notStrictEqual(old, current, 'Asset cache separates versions even when bytes match')
  assert.equal(old.etag, current.etag)
})
