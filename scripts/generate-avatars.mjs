import fs from 'node:fs/promises'
import path from 'node:path'
import { createCanvas, Path2D, ImageData, loadImage } from '@napi-rs/canvas'
import { examples, renderAvatarSvg, validateAvatar } from 'open-bot-avatar'
import { botAvatarTypes, botAvatarPresets, botAvatarShapes, botAvatarParts, autoInk,
  drawBotAvatarFrame, restPose, BOT_AVATAR_OVERSCAN } from 'bot-avatars'
import { shade, richer } from '../app/lib/upstream/bot-color.js'
import open from '../app/lib/upstream/open-bot-avatar.json' with { type: 'json' }
import sources from '../app/lib/upstream/sources.json' with { type: 'json' }

// The official canvas renderer uses the browser's canvas primitives.
globalThis.Path2D = Path2D
globalThis.ImageData = ImageData
globalThis.OffscreenCanvas = class {
  constructor(width, height) { return createCanvas(width, height) }
}

const root = path.resolve('public/avatars/v3')
const catalog = []
async function save(collection, file, data) {
  const dir = path.join(root, collection)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, file), data)
}
for (const definition of [...examples, ...open.gallery]) {
  const validation = validateAvatar(definition)
  if (!validation.ok) throw Error(JSON.stringify(validation.errors))
  const color = open.colors[definition.id]
  if (!color) throw Error('Missing upstream color: ' + definition.id)
  const svg = renderAvatarSvg(definition, { size: 512, color, reducedMotion: true })
  const canvas = createCanvas(512, 512)
  canvas.getContext('2d').drawImage(await loadImage(Buffer.from(svg)), 0, 0, 512, 512)
  await save('open-bot-avatar', definition.id + '.svg', svg)
  await save('open-bot-avatar', definition.id + '.png', canvas.toBuffer('image/png'))
  catalog.push({ collection: 'open-bot-avatar', id: definition.id, name: definition.name,
    color, formats: ['png', 'svg'], styles: ['flat'], version: sources.openBot.version })
}
for (const type of botAvatarTypes) {
  const preset = botAvatarPresets[type]
  const brightness = preset.brightness ?? 1
  const saturation = preset.saturation ?? 1.5
  const color = richer(brightness === 1 && saturation === 1 ? preset.color : shade(preset.color,
    (brightness - 1) * 0.35, (Math.min(1.5, saturation) - 1) * 0.5), Math.max(0, saturation - 1.5))
  const parts = botAvatarParts[type]?.split(/(?=M)/).filter(s => s.trim()).map(d => new Path2D(d))
  for (const style of ['flat', 'original']) {
    const full = 512 * BOT_AVATAR_OVERSCAN
    const canvas = createCanvas(full, full)
    drawBotAvatarFrame(canvas.getContext('2d'), 512, restPose('default'), {
      path: new Path2D(botAvatarShapes[type]), parts,
      face: preset.face, faceX: preset.faceX, faceY: preset.faceY, faceScale: preset.faceScale,
      color, ink: autoInk(color), shading: style === 'flat' ? 'flat' : 'fabric',
      ...(style === 'flat' ? { shadow: 0 } : {}),
      vivid: Math.max(0, saturation - 1.5), typeKey: type, dpr: 1, still: true,
      fur: { length: 1, density: 1.6, fuzz: 0.9, clumps: 0.4, curl: 0.7, gravity: 0.9 }
    })
    const output = createCanvas(512, 512)
    const context = output.getContext('2d')
    context.imageSmoothingQuality = 'high'
    context.drawImage(canvas, 0, 0, 512, 512)
    await save('bot-avatars', type + (style === 'original' ? '-original' : '') + '.png', output.toBuffer('image/png'))
  }
  catalog.push({ collection: 'bot-avatars', id: type, name: preset.label, color: preset.color,
    renderedColor: color, formats: ['png'], styles: ['flat', 'original'], version: sources.botAvatars.version })
}
await fs.writeFile('app/lib/catalog.json', JSON.stringify(catalog, null, 2) + '\n')
console.log(`Generated ${catalog.length} official designs, including Libraries.dev original and flat materials.`)
