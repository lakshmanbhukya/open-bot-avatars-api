import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'
import { createCanvas, loadImage } from '@napi-rs/canvas'

// Isolated feasibility bake; never writes published API assets or imports renderer internals.
const require = createRequire(import.meta.url)
const { webpack } = require('next/dist/compiled/webpack/webpack')
const expected = { node: 'v24.17.0', playwright: '1.58.2', chromium: '145.0.7632.6', renderer: '0.4.0' }
assert.equal(process.version, expected.node)
assert.equal(require('@playwright/test/package.json').version, expected.playwright)
assert.equal(require('open-bot-avatar/package.json').version, expected.renderer)
const root = process.cwd()
const output = path.join(root, 'experiments/fluffy-mug')
const tempRoot = path.resolve(os.tmpdir())
const temp = await fs.mkdtemp(path.join(tempRoot, 'fluffy-mug-'))
const upstream = JSON.parse(await fs.readFile('app/lib/upstream/open-bot-avatar.json', 'utf8'))
const report = { runtime: expected, platform: `${os.platform()} ${os.release()} ${os.arch()}`, color: upstream.colors.mug, captures: {} }
try {
  const entry = path.join(temp, 'entry.js')
  await fs.writeFile(entry, `
    import { mountAvatar } from 'open-bot-avatar/dom';
    import { examples } from 'open-bot-avatar';
    window.avatar = mountAvatar(document.getElementById('avatar'), {
      definition: examples.find(x => x.id === 'mug'), color: ${JSON.stringify(upstream.colors.mug)},
      material: 'fluffy', renderer: 'canvas', still: true, state: 'idle', mood: 'neutral',
      followPointer: false, lookAt: { x: 0, y: 0 }, view: { yaw: 0, pitch: 0 }, reducedMotion: true
    });
  `)
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: 'development', devtool: false, entry, output: { path: temp, filename: 'bundle.js' },
      resolve: { modules: [path.join(root, 'node_modules')] } })
    compiler.run((error, stats) => compiler.close(closeError => {
      if (error || closeError || stats.hasErrors()) reject(error || closeError || Error(stats.toString()))
      else resolve()
    }))
  })
  await fs.mkdir(output, { recursive: true })
  for (const [name, args] of [['fluffy', []], ['fallback', ['--disable-webgl']]]) {
    const browser = await chromium.launch({ channel: 'chromium', headless: true, args })
    try {
      assert.equal(browser.version(), expected.chromium)
      const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setContent('<style>body{margin:0}#avatar{width:512px;height:512px}</style><div id="avatar"></div>')
      const gpu = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2')
        const extension = gl?.getExtension('WEBGL_debug_renderer_info')
        window.strandDraws = 0
        const original = WebGL2RenderingContext.prototype.drawArraysInstanced
        WebGL2RenderingContext.prototype.drawArraysInstanced = function (...args) {
          window.strandDraws++
          return original.apply(this, args)
        }
        return { webgl2: !!gl, renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null }
      })
      await page.addScriptTag({ path: path.join(temp, 'bundle.js') })
      // Require painted, unchanged pixels for 750 ms, within a bounded 30-second timeout.
      await page.waitForFunction(() => {
        const canvas = document.querySelector('#avatar canvas')
        if (!canvas || !canvas.width || !canvas.height) return false
        // The public renderer positions an oversized canvas inside the host.
        const exportCanvas = document.createElement('canvas')
        exportCanvas.width = exportCanvas.height = 512
        const bounds = canvas.getBoundingClientRect()
        const host = document.getElementById('avatar').getBoundingClientRect()
        const context = exportCanvas.getContext('2d')
        context.drawImage(canvas, bounds.x - host.x, bounds.y - host.y, bounds.width, bounds.height)
        const pixels = context.getImageData(0, 0, 512, 512).data
        if (!pixels.some((value, index) => index % 4 === 3 && value > 0)) return false
        const data = exportCanvas.toDataURL('image/png')
        if (window.previous !== data) { window.previous = data; window.stableSince = performance.now() }
        return performance.now() - window.stableSince >= 750
      }, null, { timeout: 30_000, polling: 100 })
      const capture = await page.evaluate(() => ({ data: window.previous, strandDraws: window.strandDraws }))
      assert.deepEqual(errors, [], 'Renderer errors')
      const png = Buffer.from(capture.data.split(',')[1], 'base64')
      const image = await loadImage(png)
      const canvas = createCanvas(512, 512)
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, 512, 512).data
      let painted = 0, transparent = 0, edge = 0
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i]) painted++
        else transparent++
        const p = (i - 3) / 4, x = p % 512, y = Math.floor(p / 512)
        if ((x === 0 || x === 511 || y === 0 || y === 511) && pixels[i]) edge++
      }
      assert(painted > 1000 && transparent > 1000, 'Blank or opaque output')
      assert.equal(edge, 0, 'Clipped avatar at canvas boundary')
      await fs.writeFile(path.join(output, `${name}-512.png`), png)
      const small = createCanvas(64, 64)
      small.getContext('2d').drawImage(image, 0, 0, 64, 64)
      await fs.writeFile(path.join(output, `${name}-64.png`), small.toBuffer('image/png'))
      report.captures[name] = { args, ...gpu, strandDraws: capture.strandDraws,
        painted, transparent, edge, bytes: png.length, sha256: createHash('sha256').update(png).digest('hex') }
    } finally { await browser.close() }
  }
  assert(report.captures.fluffy.webgl2, 'WebGL2 unavailable: stop at feasibility checkpoint')
  assert(report.captures.fluffy.strandDraws > 0, 'Flat fallback: no GPU fur strands drawn')
  assert.equal(report.captures.fallback.webgl2, false)
  assert.equal(report.captures.fallback.strandDraws, 0)
  assert.notEqual(report.captures.fluffy.sha256, report.captures.fallback.sha256)
  report.result = 'PASS: painted transparent output, stable pixels, GPU strand draws, distinct disabled-WebGL control; visual review required.'
  console.log(report.result)
} catch (error) {
  report.result = `FAIL: ${error.message}`
  throw error
} finally {
  await fs.mkdir(output, { recursive: true })
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n')
  assert.equal(path.dirname(path.resolve(temp)), tempRoot, 'Cleanup must stay inside the temporary directory')
  assert(path.basename(temp).startsWith('fluffy-mug-'))
  await fs.rm(temp, { recursive: true, force: true })
}
