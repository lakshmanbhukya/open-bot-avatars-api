import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import catalog from '../app/lib/catalogs/v4.json' with { type: 'json' }

for (const entry of catalog) {
  for (const style of entry.styles) {
    const base = `public/avatars/v4/${entry.collection}/${entry.id}${style === 'flat' ? '' : '-' + style}`
    const canvas = createCanvas(224, 224)
    const context = canvas.getContext('2d')
    context.imageSmoothingQuality = 'high'
    context.drawImage(await loadImage(`${base}.png`), 0, 0, 224, 224)
    const file = `${base}-thumb.webp`
    const data = await canvas.encode('webp', 75)
    const previous = await readFile(file).catch(error => { if (error.code !== 'ENOENT') throw error; return null })
    if (previous) assert(previous.equals(data), `Refusing to change frozen v4 thumbnail: ${file}`)
    else await writeFile(file, data)
  }
}
console.log('Generated gallery thumbnails for every supported design and finish.')
