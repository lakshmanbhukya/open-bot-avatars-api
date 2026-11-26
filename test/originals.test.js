import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { GET as avatar } from '../app/api/avatar/route.js'
import { GET as list } from '../app/api/avatars/route.js'
import { validateCatalog, validateFrozenAssets } from '../scripts/validate-catalog.mjs'
import { avatarFilename } from '../app/lib/avatar-catalog.js'
import frozenV5 from './fixtures/v5-compatibility.json' with { type: 'json' }
import v5 from '../app/lib/catalogs/v5.json' with { type: 'json' }
import originals from '../app/lib/originals.json' with { type: 'json' }
import thumbnails from '../app/studio/studio/original-thumbnails.json' with { type: 'json' }
import { thumbnailKey } from '../app/studio/studio/outline.ts'
import { checkOriginals } from '../scripts/review-originals.mjs'
import { validateAvatar, renderAvatarSvg } from 'open-bot-avatar'

test('v5 adds six unique original silhouettes with valid face room, categories, and posed editor thumbnails', async () => {
  assert.equal(v5.length, 47)
  assert.equal(checkOriginals().length, 6)
  assert.deepEqual(await validateCatalog(v5, { version: '5' }), { designs: 47, images: 123, thumbnails: 94 })
  for (const { definition, color, category } of originals.designs) {
    const entry = v5.find(e => e.collection === 'open-bot-avatar' && e.id === definition.id)
    assert.equal(entry.category, category)
    assert.equal(entry.origin, 'first-party')
    const normalized = validateAvatar(definition).value
    const thumbnail = thumbnails[thumbnailKey(normalized, color)]
    assert(thumbnail, `Missing posed thumbnail: ${definition.id}`)
    assert((await readFile('public' + thumbnail)).length > 1000)
    for (const { format, style } of entry.variants) {
      const params = new URLSearchParams({ v: '5', collection: entry.collection, avatar: entry.id, format, style })
      const response = await avatar(new Request('http://localhost/api/avatar?' + params))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-location'), '/api/avatar?' + params)
      const data = Buffer.from(await response.arrayBuffer())
      assert.deepEqual(data, await readFile(`public/avatars/v5/${entry.collection}/${avatarFilename(entry.id, format, style)}`))
      if (format === 'svg') assert.equal(data.toString(), renderAvatarSvg(definition, { size: 512, color, reducedMotion: true }))
    }
  }

})

test('v5 catalog, seed selections, and image bytes remain frozen', async () => {
  assert.deepEqual(await (await list(new Request('http://localhost/api/avatars?v=5'))).json(), frozenV5.catalogResponse)
  for (const fixture of frozenV5.requests) {
    const response = await avatar(new Request('http://localhost/api/avatar?' + fixture.query))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-location'), fixture.location)
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), fixture.sha256)
  }
  assert.equal(await validateFrozenAssets('5'), 223)
})
