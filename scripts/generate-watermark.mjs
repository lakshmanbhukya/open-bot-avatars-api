import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createCanvas, GlobalFonts, SvgExportFlag } from '@napi-rs/canvas'

const text = 'OpenBot Avatars API'
const size = 13
const row = 28
const fontPath = new URL('../node_modules/@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff', import.meta.url)
assert.ok(GlobalFonts.registerFromPath(fileURLToPath(fontPath), 'Watermark Mono'), 'Geist Mono font must load')

const measure = createCanvas(1, 1).getContext('2d')
measure.font = `${size}px "Watermark Mono"`
const period = Math.round(measure.measureText(text).width + 34)
const canvas = createCanvas(period, row * 2, SvgExportFlag.ConvertTextToPaths)
const context = canvas.getContext('2d')
context.font = measure.font
context.fillStyle = '#fff'
context.globalAlpha = 0.024
context.fillText(text, 0, row * 0.5 + size * 0.35)
context.fillText(text, period / 2, row * 1.5 + size * 0.35)
context.fillText(text, -period / 2, row * 1.5 + size * 0.35)

// SVG background images cannot load the page's fonts; keep the letters as paths.
const svg = canvas.getContent().toString().replace(/(<svg\b[^>]*>)/, `$1<title>${text}</title>`)
assert.ok(svg.includes('<path') && !svg.includes('<text'), 'Watermark must contain font-independent outlines')
writeFileSync(new URL('../public/studio/watermark.svg', import.meta.url), svg)
console.log(`Generated ${text} watermark (${period} × ${row * 2})`)
