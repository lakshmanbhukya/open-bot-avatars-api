import { writeFile } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import catalog from '../app/lib/catalog.json' with { type: 'json' }

for (const entry of catalog) {
  for (const style of entry.styles) {
    const base = `public/avatars/v3/${entry.collection}/${entry.id}${style === 'original' ? '-original' : ''}`
    const canvas = createCanvas(224, 224)
    const context = canvas.getContext('2d')
    context.imageSmoothingQuality = 'high'
    context.drawImage(await loadImage(`${base}.png`), 0, 0, 224, 224)
    await writeFile(`${base}-thumb.webp`, await canvas.encode('webp', 75))
  }
}
console.log('Generated gallery thumbnails for every supported design and finish.')
