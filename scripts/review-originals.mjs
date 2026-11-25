import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, Path2D, loadImage } from '@napi-rs/canvas'
import { examples, validateAvatar, renderAvatarSvg } from 'open-bot-avatar'
import originals from '../app/lib/originals.json' with { type: 'json' }
import upstream from '../app/lib/upstream/open-bot-avatar.json' with { type: 'json' }
import v4 from '../app/lib/catalogs/v4.json' with { type: 'json' }

// This conservative face-envelope check supplements the public schema; it is not the upstream strict validator.
export function checkOriginals() {
  const ids = new Set([...examples, ...upstream.gallery].map(d => d.id))
  return originals.designs.map(({ definition }) => {
    assert(!ids.has(definition.id), `Duplicate ID: ${definition.id}`)
    ids.add(definition.id)
    const result = validateAvatar(definition)
    assert(result.ok, JSON.stringify(result))
    const ctx = createCanvas(100, 100).getContext('2d'), path = new Path2D(definition.body.path)
    const { x, y, spacing, scale } = definition.eyes
    // Full-size happy arcs, gaze travel, and 4.5 units around the enlarged neutral pills.
    const halfWidth = spacing / 2 + 5.9 * scale + 1.5 + 4.5
    const halfHeight = 8 * scale + 1.5 + 4.5
    for (let px = x - halfWidth; px <= x + halfWidth; px += .5) {
      for (let py = y - halfHeight; py <= y + halfHeight; py += .5) {
        assert(ctx.isPointInPath(path, px, py), `Face envelope outside fill: ${definition.id} at ${px.toFixed(1)},${py.toFixed(1)}`)
      }
    }
    return { id: definition.id, schema: 'PASS', faceEnvelope: 'PASS', upstreamStrict: 'SKIPPED: upstream checkout / avatar-validate.ts unavailable' }
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = checkOriginals()
  const dir = 'experiments/v5-originals'
  await fs.mkdir(dir, { recursive: true })
  const sheet = createCanvas(720, 6 * 84), ctx = sheet.getContext('2d')
  ctx.fillStyle = '#eeeeee'; ctx.fillRect(0, 0, sheet.width, sheet.height)
  const entries = [...originals.designs.map(d => ({ ...d.definition, fresh: true })), ...v4.map(entry => ({
    id: entry.id, name: entry.name, collection: entry.collection,
    ...[...examples, ...upstream.gallery].find(d => entry.collection === 'open-bot-avatar' && d.id === entry.id)
  }))]
  for (const [i, entry] of entries.entries()) {
    const x = (i % 8) * 90, y = Math.floor(i / 8) * 84
    if (entry.fresh) { ctx.fillStyle = '#d5eee3'; ctx.fillRect(x, y, 90, 84) }
    if (entry.body) {
      ctx.save(); ctx.translate(x + 29, y + 5); ctx.scale(.32, .32)
      ctx.fillStyle = '#151515'; ctx.fill(new Path2D(entry.body.path)); ctx.restore()
    } else {
      const image = await loadImage(`public/avatars/v4/${entry.collection}/${entry.id}.png`)
      const small = createCanvas(32, 32), c = small.getContext('2d'); c.drawImage(image, 0, 0, 32, 32)
      c.globalCompositeOperation = 'source-in'; c.fillStyle = '#151515'; c.fillRect(0, 0, 32, 32)
      ctx.drawImage(small, x + 29, y + 5)
    }
    ctx.fillStyle = '#151515'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(entry.name, x + 45, y + 56, 88)
  }
  await fs.writeFile(`${dir}/silhouettes-32.png`, sheet.toBuffer('image/png'))
  await fs.writeFile(`${dir}/geometry-checks.json`, JSON.stringify(results, null, 2) + '\n')
  console.log(results)
  if (process.argv.includes('--finishes')) {
    const sheet = createCanvas(960, 6 * 340), ctx = sheet.getContext('2d')
    ctx.fillStyle = '#eee'; ctx.fillRect(0, 0, sheet.width, sheet.height)
    for (const [i, { definition, color }] of originals.designs.entries()) {
      ctx.fillStyle = '#151515'; ctx.font = '14px sans-serif'
      ctx.fillText(definition.name, 8, i * 340 + 18)
      for (const [column, size] of [32, 64, 128].entries()) {
        for (const [row, suffix] of ['', '-fluffy'].entries()) {
          const image = await loadImage(`public/avatars/v5/open-bot-avatar/${definition.id}${suffix}.png`)
          ctx.drawImage(image, column * 160 + 8, i * 340 + 25 + row * 150, size, size)
        }
      }
      for (const [j, [mood, gaze, yaw]] of [['happy', { x: -1, y: -1 }, -.6], ['happy', { x: 1, y: 1 }, .6], ['neutral', { x: 0, y: 0 }, 0]].entries()) {
        const svg = renderAvatarSvg(definition, { size: 128, color, mood, gaze, view: { yaw, pitch: .1 }, reducedMotion: true })
        const image = await loadImage(Buffer.from(svg))
        ctx.drawImage(image, 490 + j * 150, i * 340 + 25, 128, 128)
      }
    }
    await fs.writeFile(`${dir}/sizes-and-gaze.png`, sheet.toBuffer('image/png'))
  }
}
