import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import catalog from '../app/lib/catalogs/v5.json' with { type: 'json' }
import { avatarFilename } from '../app/lib/avatar-catalog.js'

let count = 0
for (const entry of catalog) {
  for (const { format, style } of entry.variants) {
    if (format !== 'png') continue
    const base = `public/avatars/v5/${entry.collection}`
    const filename = avatarFilename(entry.id, format, style)
    const original = await readFile(`${base}/${filename}`)
    const image = await loadImage(original)
    assert(image.width === 512 && image.height === 512, `Invalid source: ${filename}`)
    for (const size of [64, 128, 256]) {
      const canvas = createCanvas(size, size)
      const context = canvas.getContext('2d')
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, size, size)
      const data = await canvas.encode('png')
      assert(data.length < original.length, `Derivative must save bytes: ${filename}/${size}`)
      const directory = `${base}/sizes/${size}`
      const file = `${directory}/${filename}`
      const previous = await readFile(file).catch(error => { if (error.code !== 'ENOENT') throw error; return null })
      if (previous) assert(previous.equals(data), `Refusing to change existing derivative: ${file}`)
      else {
        await mkdir(directory, { recursive: true })
        await writeFile(file, data)
      }
      count++
    }
  }
}
console.log(`Verified/generated ${count} smaller PNGs without changing 512 px assets.`)
