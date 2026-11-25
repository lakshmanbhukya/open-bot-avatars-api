import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { examples, renderAvatarSvg, validateAvatar } from 'open-bot-avatar'
import v4 from '../app/lib/catalogs/v4.json' with { type: 'json' }
import upstream from '../app/lib/upstream/open-bot-avatar.json' with { type: 'json' }

import { thumbnailKey, THUMB_VIEW, THUMB_LOOK } from '../app/studio/studio/outline.ts'
import originals from '../app/lib/originals.json' with { type: 'json' }
import v5 from '../app/lib/catalogs/v5.json' with { type: 'json' }

const version = process.argv[2] ?? '4'
assert(['4', '5'].includes(version))
const catalog = version === '5' ? v5.filter(x => originals.designs.some(d => d.definition.id === x.id) && x.collection === 'open-bot-avatar') : v4
const require = createRequire(import.meta.url)
const runtime = { node: 'v24.17.0', playwright: '1.58.2', chromium: '145.0.7632.6', renderer: '0.4.0' }
assert.equal(process.version, runtime.node)
assert.equal(require('@playwright/test/package.json').version, runtime.playwright)
assert.equal(require('open-bot-avatar/package.json').version, runtime.renderer)
const root = process.cwd()
const stage = path.resolve(`out/v${version}-bake`)
const evidence = path.resolve(version === '5' ? 'experiments/v5-originals' : 'experiments/v4-fluffy')
const tempRoot = path.resolve(os.tmpdir())
const temp = await fs.mkdtemp(path.join(tempRoot, 'fluffy-v4-'))
const report = { runtime, platform: `${os.platform()} ${os.release()} ${os.arch()}`, captures: [], result: 'Running' }
const browsers = []
try {
  await fs.mkdir(stage, { recursive: true })
  await fs.mkdir(evidence, { recursive: true })
  // Work in staging; a failed or flat-fallback bake cannot replace published assets.
  if (version === '4') await import('./generate-avatars.mjs')
  else {
    await fs.cp('public/avatars/v4', stage, { recursive: true })
    for (const { definition, color } of originals.designs) {
      const dir = path.join(stage, 'open-bot-avatar')
      const svg = renderAvatarSvg(definition, { size: 512, color, reducedMotion: true })
      await fs.writeFile(path.join(dir, definition.id + '.svg'), svg)
      const canvas = createCanvas(512, 512)
      canvas.getContext('2d').drawImage(await loadImage(Buffer.from(svg)), 0, 0)
      await fs.writeFile(path.join(dir, definition.id + '.png'), canvas.toBuffer('image/png'))
      const thumb = createCanvas(224, 224)
      thumb.getContext('2d').drawImage(canvas, 0, 0, 224, 224)
      await fs.writeFile(path.join(dir, definition.id + '-thumb.webp'), await thumb.encode('webp', 75))
    }
  }
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
  async function waitForStablePixels(page) {
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
  }
  const sheets = []
  const smallSheet = createCanvas(960, 4 * 100)
  const smallContext = smallSheet.getContext('2d')
  smallContext.fillStyle = '#ddd'
  smallContext.fillRect(0, 0, 960, 400)
  let index = 0
  for (const entry of catalog.filter(x => x.collection === 'open-bot-avatar')) {
    const definition = [...examples, ...upstream.gallery, ...originals.designs.map(d => d.definition)].find(x => x.id === entry.id)
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
        await waitForStablePixels(page)
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
          if (version === '5') {
            await page.evaluate(({ view, lookAt }) => {
              window.previous = null
              window.avatar.update({ view, lookAt })
            }, { view: THUMB_VIEW, lookAt: THUMB_LOOK })
            await waitForStablePixels(page)
            const posed = Buffer.from((await page.evaluate(() => window.previous)).split(',')[1], 'base64')
            const thumb = createCanvas(224, 224)
            thumb.getContext('2d').drawImage(await loadImage(posed), 0, 0, 224, 224)
            await fs.writeFile(path.join(stage, entry.collection, entry.id + '-editor-thumb.webp'), await thumb.encode('webp', 75))
          }
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
    console.log(`Verified fur and fallback ${index}/${catalog.filter(x => x.collection === 'open-bot-avatar').length}: ${entry.id}`)
  }
  for (const [index, sheet] of sheets.entries()) await fs.writeFile(path.join(evidence, `coat-512-${index + 1}.png`), sheet.toBuffer('image/png'))
  await fs.writeFile(path.join(evidence, 'fluffy-vs-fallback-64.png'), smallSheet.toBuffer('image/png'))
  // Existing files must be byte-identical, so reruns cannot revise a release.
  async function publish(file, data) {
    const previous = await fs.readFile(file).catch(error => { if (error.code !== 'ENOENT') throw error; return null })
    if (previous) assert(previous.equals(Buffer.from(data)), `Refusing to change frozen v${version} file: ${file}`)
    else { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, data) }
  }
  for (const collection of ['open-bot-avatar', 'bot-avatars']) {
    for (const file of await fs.readdir(path.join(stage, collection))) await publish(path.join(`public/avatars/v${version}`, collection, file), await fs.readFile(path.join(stage, collection, file)))
  }
  if (version === '5') {
    const thumbs = Object.fromEntries(originals.designs.map(({ definition, color }) => [thumbnailKey(validateAvatar(definition).value, color), '/avatars/v5/open-bot-avatar/' + definition.id + '-editor-thumb.webp']))
    await fs.writeFile('app/studio/studio/original-thumbnails.json', JSON.stringify(thumbs, null, 2) + '\n')
  }
  report.result = `PASS: ${report.captures.length} GPU coats and disabled-WebGL controls verified; 512/64 px visual sheets saved for review.`
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
