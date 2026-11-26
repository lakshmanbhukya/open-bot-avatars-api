import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { chromium, devices } from '@playwright/test'

// Run against a production build, in isolation from the ordinary WebGL-disabled E2E suite.
const require = createRequire(import.meta.url)
const output = path.resolve(process.argv[2] ?? 'experiments/performance-baseline')
const scenarios = process.argv[3]?.split(',') ?? ['editor-flat', 'editor-fluffy', 'api-flat', 'api-fluffy', 'api-fluffy-live']
assert(scenarios.length > 0 && scenarios.every(scenario => ['editor-flat', 'editor-fluffy', 'api-flat', 'api-fluffy', 'api-fluffy-live'].includes(scenario)), 'Unknown measurement scenario')
const existing = await fs.stat(path.join(output, 'result.json')).catch(error => {
  if (error.code !== 'ENOENT') throw error
  return null
})
assert(!existing, 'Results already exist; pass a new output directory to preserve the baseline')
const buildId = (await fs.readFile('.next/BUILD_ID', 'utf8')).trim()
const origin = 'http://127.0.0.1:3111'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3111'], {
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production', VERCEL: '0', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' }
})
let serverLog = ''
server.stdout.on('data', data => { serverLog += data })
server.stderr.on('data', data => { serverLog += data })
const report = {
  measuredAt: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  buildId, node: process.version,
  playwright: require('@playwright/test/package.json').version,
  renderer: require('open-bot-avatar/package.json').version,
  host: { platform: os.platform(), release: os.release(), cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem() },
  scenarios,
  methodology: 'Three fresh browser contexts per scenario with HTTP cache disabled, warm browser process and local production server; 3 s idle frame window, then 12 design switches (300 ms dwell), then post-GC heap/DOM measurement. Animated previews are the default. api-fluffy measures the on-demand returned PNG from the Preview PNG click; other scenarios measure the first nonblank live canvas from navigation start, including initial editor state before share options settle. PNG strand counts are reset after switching modes. Transfer sizes include document and loaded resources before switches. No performance pass/fail thresholds.',
  limitations: ['Mobile is Pixel 7 viewport/touch emulation on the desktop GPU, not a physical phone.', 'Loopback delivery is not deployment latency. Mobile uses 4x CPU slowdown, 1.6 Mbps down / 750 Kbps up, 150 ms configured latency.', 'CDP JS heap excludes GPU memory; three samples do not establish a leak or population performance.', 'rAF intervals measure browser scheduling, not individual avatar paint duration. GPU/shader caches can remain warm between contexts.'],
  samples: [], api: []
}
let browser
try {
  await fs.mkdir(output, { recursive: true })
  let ready = false
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw Error('Production server exited: ' + serverLog)
    try { ready = (await fetch(origin, { signal: AbortSignal.timeout(500) })).ok } catch {}
    if (ready) break
    await delay(200)
  }
  assert(ready, 'Production server did not become ready')
  browser = await chromium.launch({ channel: 'chromium', headless: true })
  report.chromium = browser.version()
  for (const profile of ['desktop', 'mobile-emulated']) {
    for (const scenario of scenarios) {
      for (let run = 1; run <= 3; run++) {
        const mobile = profile === 'mobile-emulated'
        const context = await browser.newContext({ ...(mobile ? devices['Pixel 7'] : { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }), reducedMotion: 'no-preference' })
        try {
          const page = await context.newPage()
          page.setDefaultTimeout(60_000)
          const errors = []
          page.on('pageerror', error => errors.push(error.message))
          const cdp = await context.newCDPSession(page)
          await cdp.send('Network.enable')
          await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
          if (mobile) {
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
            await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 })
          }
          await page.addInitScript(({ requireCanvas }) => {
            window.measurement = { firstAvatarMs: null, frames: [], longTasks: [], strands: 0, phase: 'load' }
            const m = window.measurement
            new PerformanceObserver(list => m.longTasks.push(...list.getEntries().map(x => ({ start: x.startTime, duration: x.duration, phase: m.phase })))).observe({ type: 'longtask', buffered: true })
            const original = WebGL2RenderingContext.prototype.drawArraysInstanced
            WebGL2RenderingContext.prototype.drawArraysInstanced = function (...args) { m.strands++; return original.apply(this, args) }
            let previous
            const probe = document.createElement('canvas')
            probe.width = probe.height = 16
            const ctx = probe.getContext('2d', { willReadFrequently: true })
            function tick(now) {
              if (m.phase === 'idle' && previous !== undefined) m.frames.push(now - previous)
              previous = now
              if (m.firstAvatarMs === null) {
                const canvas = document.querySelector('.stage-avatar canvas, .api-response-image canvas')
                const png = document.querySelector('.api-response-image img[src^="blob:"]')
                const source = requireCanvas ? (canvas?.width && canvas?.height ? canvas : null) : (png?.complete && png.naturalWidth > 0 ? png : null)
                if (source) {
                  ctx.clearRect(0, 0, 16, 16)
                  ctx.drawImage(source, 0, 0, 16, 16)
                  if (ctx.getImageData(0, 0, 16, 16).data.some((v, i) => i % 4 === 3 && v)) m.firstAvatarMs = now - (m.animationRequestedAt ?? 0)
                }
              }
              requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          }, { requireCanvas: scenario !== 'api-fluffy' })
          const api = scenario.startsWith('api-')
          const apiQuery = scenario === 'api-flat' ? '/?collection=open-bot-avatar&avatar=mug' : `/?v=5&collection=open-bot-avatar&avatar=mug&style=${scenario.startsWith('api-fluffy') ? 'fluffy' : 'flat'}`
          await page.goto(origin + (api ? apiQuery : `/editor?avatar=mug&material=${scenario === 'editor-flat' ? 'flat' : 'fluffy'}`), { waitUntil: 'networkidle', timeout: 90_000 })
          if (scenario === 'api-fluffy') {
            await page.evaluate(() => { window.measurement.firstAvatarMs = null; window.measurement.animationRequestedAt = performance.now() })
            await page.getByRole('button', { name: 'Preview PNG', exact: true }).click()
          }
          await page.waitForFunction(() => window.measurement.firstAvatarMs !== null)
          if (api) await page.getByRole('button', { name: 'Copy endpoint', exact: true }).waitFor()
          else assert.equal(await page.getByRole('radio', { name: scenario === 'editor-flat' ? 'Flat' : 'Fluffy', exact: true }).getAttribute('aria-checked'), 'true')
          const gpu = await page.evaluate(() => {
            const gl = document.createElement('canvas').getContext('webgl2')
            const debug = gl?.getExtension('WEBGL_debug_renderer_info')
            return { webgl2: !!gl, renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null }
          })
          assert(gpu.webgl2, 'GPU baseline requires WebGL2')
          if (scenario === 'editor-fluffy' || scenario === 'api-fluffy-live') assert(await page.evaluate(() => window.measurement.strands > 0), 'Fluffy baseline fell back to flat')
          if (scenario === 'api-fluffy') {
            assert.equal(await page.locator('.api-response-image canvas').count(), 0, 'PNG mode must use the returned image')
            await page.evaluate(() => { window.measurement.strands = 0 })
          }
          await cdp.send('Performance.enable')
          async function memory() {
            await cdp.send('HeapProfiler.collectGarbage')
            const { metrics } = await cdp.send('Performance.getMetrics')
            return { heapBytesAfterGC: metrics.find(x => x.name === 'JSHeapUsedSize').value, ...await cdp.send('Memory.getDOMCounters') }
          }
          const before = await memory()
          const initial = await page.evaluate(() => {
            const resources = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')]
            return { firstAvatarMs: window.measurement.firstAvatarMs, fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
              transferredBytes: resources.reduce((sum, x) => sum + x.transferSize, 0), encodedBodyBytes: resources.reduce((sum, x) => sum + x.encodedBodySize, 0), requests: resources.length,
              resources: resources.map(x => ({ url: new URL(x.name).pathname, transferBytes: x.transferSize, encodedBytes: x.encodedBodySize })) }
          })
          await page.evaluate(() => { window.measurement.phase = 'idle' })
          await delay(3000)
          await page.evaluate(() => { window.measurement.phase = 'switches' })
          for (const name of Array.from({ length: 3 }, () => ['Controller', 'Barbell', 'Lightbulb', 'Mug']).flat()) {
            const button = page.locator(api ? '.api-catalog' : '.bots').getByRole('button', { name, exact: true })
            await button.click()
            if (api) await page.waitForFunction(name => document.querySelector('.api-response-caption strong')?.textContent === name && document.querySelector('.api-response')?.getAttribute('aria-busy') === 'false', name)
            else await page.waitForFunction(name => document.querySelector('.stage h1')?.textContent === name, name)
            await delay(300)
          }
          await page.evaluate(() => { window.measurement.phase = 'done' })
          const after = await memory()
          const measurements = await page.evaluate(() => window.measurement)
          assert.deepEqual(errors, [], 'Browser errors')
          const sorted = measurements.frames.toSorted((a, b) => a - b)
          assert(sorted.length > 10, 'Insufficient frame samples')
          const sample = { profile, scenario, run, gpu, ...initial, idleFrames: { count: sorted.length, medianMs: sorted[Math.floor(sorted.length * .5)], p95Ms: sorted[Math.floor(sorted.length * .95)], over33ms: sorted.filter(x => x > 33.34).length },
            longTasks: measurements.longTasks, memoryBefore: before, memoryAfter12Switches: after, strandDraws: measurements.strands }
          report.samples.push(sample)
          if (run === 1) await page.screenshot({ path: path.join(output, `${profile}-${scenario}.png`) })
          await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n')
          console.log(`${profile} ${scenario} ${run}/3: avatar ${initial.firstAvatarMs.toFixed(0)} ms; idle p95 ${sample.idleFrames.p95Ms.toFixed(1)} ms`)
        } finally { await context.close() }
      }
    }
  }
  const context = await browser.newContext()
  try {
    for (const query of ['/api/avatars', '/api/avatar?v=5&collection=open-bot-avatar&avatar=mug', '/api/avatar?v=5&seed=baseline', '/api/avatar?v=5&collection=open-bot-avatar&avatar=mug&format=svg', '/api/avatar?v=5', '/api/avatars?v=5', '/api/avatar?v=5&collection=open-bot-avatar&avatar=mug&style=fluffy', '/api/avatar?v=5&style=fluffy&seed=baseline']) {
      for (let run = 1; run <= 3; run++) {
        const start = performance.now()
        const response = await context.request.get(origin + query)
        const body = await response.body()
        assert.equal(response.status(), 200, query)
        report.api.push({ query, run, durationMs: performance.now() - start, bytes: body.length, cacheControl: response.headers()['cache-control'] })
      }
    }
  } finally { await context.close() }
  assert.equal(report.samples.length, scenarios.length * 6)
  report.result = 'Completed desktop and mobile-emulated measurements for the selected production scenarios; physical mobile measurements pending.'
} catch (error) {
  report.result = `Failed: ${error.message}`
  throw error
} finally {
  await browser?.close()
  server.kill()
  await fs.mkdir(output, { recursive: true })
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n')
}
