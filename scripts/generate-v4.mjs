import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { examples, validateAvatar } from 'open-bot-avatar'
import v3 from '../app/lib/catalogs/v3.json' with { type: 'json' }
import upstream from '../app/lib/upstream/open-bot-avatar.json' with { type: 'json' }

const require = createRequire(import.meta.url)
const runtime = { node: 'v24.17.0', playwright: '1.58.2', chromium: '145.0.7632.6', renderer: '0.4.0' }
assert.equal(process.version, runtime.node)
assert.equal(require('@playwright/test/package.json').version, runtime.playwright)
assert.equal(require('open-bot-avatar/package.json').version, runtime.renderer)
const root = process.cwd()
const stage = path.resolve('out/v4-bake')
const evidence = path.resolve('experiments/v4-fluffy')
const tempRoot = path.resolve(os.tmpdir())
const temp = await fs.mkdtemp(path.join(tempRoot, 'fluffy-v4-'))
const report = { runtime, platform: `${os.platform()} ${os.release()} ${os.arch()}`, captures: [], result: 'Running' }
const browsers = []
try {
  await fs.mkdir(stage, { recursive: true })
  await fs.mkdir(evidence, { recursive: true })
  // Work in staging; a failed or flat-fallback bake cannot replace published assets.
  await fs.cp('public/avatars/v3', stage, { recursive: true })
  await fs.writeFile(path.join(temp, 'entry.js'), `import { mountAvatar } from 'open-bot-avatar/dom';
    window.mountDefinition = options => { window.avatar = mountAvatar(document.getElementById('avatar'), options) };`)
  const { webpack } = require('next/dist/compiled/webpack/webpack')
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: 'development', devtool: false, entry: path.join(temp, 'entry.js'),
      output: { path: temp, filename: 'bundle.js' }, resolve: { modules: [path.join(root, 'node_modules')] } })
    compiler.run((error, stats) => compiler.close(closeError => error || closeError || stats.hasErrors()
      ? reject(error || closeError || Error(stats.toString())) : resolve()))
  })
  for (const args of [[], ['--disable-webgl']]) {
    const browser = await chromium.launch({ channel: 'chromium', headless: true, args })
    browsers.push(browser)
    assert.equal(browser.version(), runtime.chromium)
  }
  const sheets = []
  const smallSheet = createCanvas(960, 4 * 100)
  const smallContext = smallSheet.getContext('2d')
  smallContext.fillStyle = '#ddd'
  smallContext.fillRect(0, 0, 960, 400)
  let index = 0
  for (const entry of v3.filter(x => x.collection === 'open-bot-avatar')) {
    const definition = [...examples, ...upstream.gallery].find(x => x.id === entry.id)
    assert(definition && validateAvatar(definition).ok, `Invalid definition: ${entry.id}`)
    const captures = []
    for (const [control, browser] of browsers.entries()) {
      const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 })
      try {
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.setContent('<style>body{margin:0}#avatar{width:512px;height:512px}</style><div id="avatar"></div>')
        const gpu = await page.evaluate(() => {
          const gl = document.createElement('canvas').getContext('webgl2')
          const debug = gl?.getExtension('WEBGL_debug_renderer_info')
          window.strands = 0
          const original = WebGL2RenderingContext.prototype.drawArraysInstanced
          WebGL2RenderingContext.prototype.drawArraysInstanced = function (...args) { window.strands++; return original.apply(this, args) }
          return { webgl2: !!gl, renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null }
        })
        await page.addScriptTag({ path: path.join(temp, 'bundle.js') })
        await page.evaluate(options => window.mountDefinition(options), { definition, color: entry.color,
          material: 'fluffy', renderer: 'canvas', still: true, state: 'idle', mood: 'neutral',
          followPointer: false, lookAt: { x: 0, y: 0 }, view: { yaw: 0, pitch: 0 }, reducedMotion: true })
        await page.waitForFunction(() => {
          const source = document.querySelector('#avatar canvas')
          if (!source?.width || !source.height) return false
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 512
          const rect = source.getBoundingClientRect(), host = document.getElementById('avatar').getBoundingClientRect()
          const ctx = canvas.getContext('2d')
          ctx.drawImage(source, rect.x - host.x, rect.y - host.y, rect.width, rect.height)
          if (!ctx.getImageData(0, 0, 512, 512).data.some((v, i) => i % 4 === 3 && v)) return false
          const data = canvas.toDataURL('image/png')
          if (window.previous !== data) { window.previous = data; window.since = performance.now() }
          return performance.now() - window.since >= 750
        }, null, { timeout: 30_000, polling: 100 })
        const capture = await page.evaluate(() => ({ data: window.previous, strandDraws: window.strands }))
        assert.deepEqual(errors, [], entry.id)
        assert.equal(gpu.webgl2, control === 0, `Wrong WebGL mode: ${entry.id}`)
        assert(control === 0 ? capture.strandDraws > 0 : capture.strandDraws === 0, `Flat fallback or invalid control: ${entry.id}`)
        const png = Buffer.from(capture.data.split(',')[1], 'base64')
        const image = await loadImage(png)
        const canvas = createCanvas(512, 512), ctx = canvas.getContext('2d')
        ctx.drawImage(image, 0, 0)
        const pixels = ctx.getImageData(0, 0, 512, 512).data
        let painted = 0, transparent = 0, edge = 0
        for (let p = 0; p < 512 * 512; p++) {
          if (pixels[p * 4 + 3]) {
            painted++
            if (p % 512 === 0 || p % 512 === 511 || p < 512 || p >= 511 * 512) edge++
          } else transparent++
        }
        assert(painted > 1000 && transparent > 1000, `Blank/opaque: ${entry.id}`)
        assert.equal(edge, 0, `Clipped fur: ${entry.id}`)
        const sha256 = createHash('sha256').update(png).digest('hex')
        captures.push({ mode: control ? 'fallback' : 'fluffy', ...gpu, strandDraws: capture.strandDraws, painted, transparent, edge, bytes: png.length, sha256 })
        if (control === 0) {
          await fs.writeFile(path.join(stage, entry.collection, `${entry.id}-fluffy.png`), png)
          const thumb = createCanvas(224, 224)
          thumb.getContext('2d').drawImage(image, 0, 0, 224, 224)
          await fs.writeFile(path.join(stage, entry.collection, `${entry.id}-fluffy-thumb.webp`), await thumb.encode('webp', 75))
          const sheetIndex = Math.floor(index / 6)
          if (!sheets[sheetIndex]) {
            const sheet = createCanvas(1536, 1088), context = sheet.getContext('2d')
            context.fillStyle = '#ddd'; context.fillRect(0, 0, 1536, 1088)
            sheets[sheetIndex] = sheet
          }
          const context = sheets[sheetIndex].getContext('2d'), cell = index % 6
          context.drawImage(image, (cell % 3) * 512, Math.floor(cell / 3) * 544)
          context.fillStyle = '#111'; context.font = '20px sans-serif'
          context.fillText(entry.id, (cell % 3) * 512 + 12, Math.floor(cell / 3) * 544 + 532)
        }
        smallContext.drawImage(image, (index % 6) * 160 + control * 72, Math.floor(index / 6) * 100, 64, 64)
      } finally { await page.close() }
    }
    assert.notEqual(captures[0].sha256, captures[1].sha256, `Flat fallback: ${entry.id}`)
    report.captures.push({ id: entry.id, color: entry.color, captures })
    smallContext.fillStyle = '#111'; smallContext.font = '12px sans-serif'
    smallContext.fillText(entry.id, (index % 6) * 160, Math.floor(index / 6) * 100 + 84)
    index++
    console.log(`Verified fur and fallback ${index}/23: ${entry.id}`)
  }
  for (const [index, sheet] of sheets.entries()) await fs.writeFile(path.join(evidence, `coat-512-${index + 1}.png`), sheet.toBuffer('image/png'))
  await fs.writeFile(path.join(evidence, 'fluffy-vs-fallback-64.png'), smallSheet.toBuffer('image/png'))
  const v4 = v3.map(entry => {
    const variants = entry.formats.flatMap(format => entry.styles.map(style => ({ format, style })))
    if (entry.collection === 'open-bot-avatar') variants.push({ format: 'png', style: 'fluffy' })
    return { ...entry, styles: [...new Set(variants.map(x => x.style))], variants }
  })
  // New version only. Existing files must be byte-identical, so reruns cannot revise a release.
  async function publish(file, data) {
    const previous = await fs.readFile(file).catch(error => { if (error.code !== 'ENOENT') throw error; return null })
    if (previous) assert(previous.equals(Buffer.from(data)), `Refusing to change frozen v4 file: ${file}`)
    else { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, data) }
  }
  for (const collection of ['open-bot-avatar', 'bot-avatars']) {
    for (const file of await fs.readdir(path.join(stage, collection))) await publish(path.join('public/avatars/v4', collection, file), await fs.readFile(path.join(stage, collection, file)))
  }
  await publish('app/lib/catalogs/v4.json', JSON.stringify(v4, null, 2) + '\n')
  await publish('app/lib/catalogs/v4-sources.json', await fs.readFile('app/lib/catalogs/v3-sources.json'))
  report.result = 'PASS: all 23 GPU coats and disabled-WebGL controls verified; 512/64 px visual sheets saved for review.'
} catch (error) {
  report.result = `FAIL: ${error.message}`
  throw error
} finally {
  for (const browser of browsers) await browser.close()
  await fs.mkdir(evidence, { recursive: true })
  await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify(report, null, 2) + '\n')
  assert.equal(path.dirname(path.resolve(temp)), tempRoot)
  assert(path.basename(temp).startsWith('fluffy-v4-'))
  await fs.rm(temp, { recursive: true, force: true })
}
