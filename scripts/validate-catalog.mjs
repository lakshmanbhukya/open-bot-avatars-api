import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { examples, validateAvatar } from 'open-bot-avatar'
import { botAvatarTypes } from 'bot-avatars'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import v4 from '../app/lib/catalogs/v4.json' with { type: 'json' }
import v5 from '../app/lib/catalogs/v5.json' with { type: 'json' }
import originals from '../app/lib/originals.json' with { type: 'json' }
import { variantsFor, avatarFilename } from '../app/lib/avatar-catalog.js'
import upstream from '../app/lib/upstream/open-bot-avatar.json' with { type: 'json' }
import frozenV4 from '../test/fixtures/v4-compatibility.json' with { type: 'json' }
import frozenV5 from '../test/fixtures/v5-compatibility.json' with { type: 'json' }

export async function validateCatalog(entries, { version = '4', assetRoot = `public/avatars/v${version}`, definitions = [...examples, ...upstream.gallery, ...originals.designs.map(d => d.definition)] } = {}) {
  assert(Array.isArray(entries) && entries.length > 0, 'Catalog must contain entries')
  const seen = new Set()
  let images = 0, thumbnails = 0
  for (const entry of entries) {
    const key = `${entry.collection}/${entry.id}`
    assert(!seen.has(key), `Duplicate catalog entry: ${key}`)
    seen.add(key)
    assert(/^[a-z0-9-]+$/.test(entry.id), `Invalid ID: ${key}`)
    assert(typeof entry.name === 'string' && entry.name.trim(), `Missing name: ${key}`)
    assert(/^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(entry.color), `Missing or invalid color: ${key}`)
    assert(Array.isArray(entry.formats) && entry.formats.length && Array.isArray(entry.styles) && entry.styles.length, `Missing format/style summaries: ${key}`)
    if (entry.collection === 'open-bot-avatar') {
      const definition = definitions.find(item => item.id === entry.id)
      assert(definition && validateAvatar(definition).ok, `Invalid or missing definition: ${key}`)
      assert.equal(entry.color, upstream.colors[entry.id] ?? originals.designs.find(d => d.definition.id === entry.id)?.color, `Catalog color differs from definition color: ${key}`)
    } else {
      assert(entry.collection === 'bot-avatars' && botAvatarTypes.includes(entry.id), `Unknown collection or definition: ${key}`)
    }
    assert(Array.isArray(entry.variants), `Catalog requires explicit variants: ${key}`)
    if (version === '5') assert(['object', 'nature', 'food', 'abstract', 'robot'].includes(entry.category), `Invalid category: ${key}`)
    const pairs = variantsFor(entry)
    assert(Array.isArray(pairs) && pairs.length, `Missing variants: ${key}`)
    const pairKeys = pairs.map(({ format, style }) => `${format}/${style}`)
    assert.equal(new Set(pairKeys).size, pairs.length, `Duplicate variants: ${key}`)
    const allowed = entry.collection === 'open-bot-avatar' ? ['png/flat', 'svg/flat', 'png/fluffy'] : ['png/flat', 'png/original']
    assert(pairKeys.every(pair => allowed.includes(pair)), `Unsupported format/style: ${key}`)
    assert.deepEqual([...new Set(pairs.map(x => x.format))].sort(), [...entry.formats].sort(), `Format summaries disagree: ${key}`)
    assert.deepEqual([...new Set(pairs.map(x => x.style))].sort(), [...entry.styles].sort(), `Style summaries disagree: ${key}`)
    for (const { format, style } of pairs) {
      const base = avatarFilename(entry.id, 'png', style).replace(/\.png$/, '')
      const filename = path.join(assetRoot, entry.collection, avatarFilename(entry.id, format, style))
      const image = await loadImage(await readFile(filename))
      assert(image.width === 512 && image.height === 512, `Invalid dimensions: ${filename}`)
      const canvas = createCanvas(512, 512)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0)
      const pixels = ctx.getImageData(0, 0, 512, 512).data
      assert(pixels.some((value, i) => i % 4 === 3 && value > 0), `Blank image: ${filename}`)
      for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) {
        assert.equal(ctx.getImageData(x, y, 1, 1).data[3], 0, `Opaque background: ${filename}`)
      }
      if (style === 'fluffy') {
        for (let p = 0; p < 512; p++) {
          for (const [x, y] of [[p, 0], [p, 511], [0, p], [511, p]]) assert.equal(pixels[(y * 512 + x) * 4 + 3], 0, `Clipped fur: ${filename}`)
        }
      }
      images++
      if (format === 'png') {
        const thumbPath = path.join(assetRoot, entry.collection, `${base}-thumb.webp`)
        const thumbnail = await loadImage(await readFile(thumbPath))
        assert(thumbnail.width === 224 && thumbnail.height === 224, `Invalid thumbnail dimensions: ${thumbPath}`)
        const small = createCanvas(224, 224), context = small.getContext('2d')
        context.drawImage(thumbnail, 0, 0)
        assert(context.getImageData(0, 0, 224, 224).data.some((value, i) => i % 4 === 3 && value), `Blank thumbnail: ${thumbPath}`)
        for (const [x, y] of [[0, 0], [223, 0], [0, 223], [223, 223]]) assert.equal(context.getImageData(x, y, 1, 1).data[3], 0, `Opaque thumbnail: ${thumbPath}`)
        thumbnails++
      }
    }
  }
  return { designs: seen.size, images, thumbnails }
}

export async function validateFrozenAssets(version = '4') {
  assert(['4', '5'].includes(version), 'Unsupported frozen version')
  const fixture = version === '4' ? frozenV4 : frozenV5
  for (const [file, expected] of Object.entries(fixture.assets)) {
    const data = await readFile(path.join(`public/avatars/v${version}`, file))
    assert.equal(createHash('sha256').update(data).digest('hex'), expected, `Published v${version} asset changed: ${file}`)
  }
  return Object.keys(fixture.assets).length
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log({ v4: await validateCatalog(v4), v5: await validateCatalog(v5, { version: '5' }), frozenV4AssetHashes: await validateFrozenAssets(), frozenV5AssetHashes: await validateFrozenAssets('5') })
}
