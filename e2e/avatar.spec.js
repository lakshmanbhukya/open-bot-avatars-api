import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const mug = '/?collection=open-bot-avatar&avatar=mug'
const nav = page => page.getByRole('navigation', { name: 'Site' })
const ready = page => expect(page.getByRole('button', { name: 'Copy endpoint', exact: true })).toBeEnabled()

test('Open Bot API previews jump and turn on click and keyboard, respecting reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/?v=5&collection=open-bot-avatar&avatar=teapot')
  await ready(page)
  const preview = page.getByRole('button', { name: 'Teapot: jump and turn', exact: true })
  await expect(preview.locator('canvas')).toBeVisible()
  await expect.poll(() => preview.evaluate(element => element.getAnimations().length)).toBe(0)
  const url = await page.locator('#api-image-url').inputValue()
  const inkPixels = () => preview.locator('canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    let ink = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 200 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 80) ink++
    return ink
  })
  const frontInk = await inkPixels()
  expect(frontInk).toBeGreaterThan(100)
  for (const activate of [() => preview.click(), () => preview.press('Enter'), () => preview.press('Space')]) {
    await activate()
    expect(await preview.evaluate(element => getComputedStyle(element).transform)).not.toBe('none')
    // Halfway through the real 3D turn, the eyes face away from the viewer.
    await expect.poll(inkPixels).toBeLessThan(frontInk / 2)
    await expect.poll(() => preview.evaluate(element => element.getAnimations().length)).toBe(0)
    await expect.poll(inkPixels).toBeGreaterThan(100)
    await expect(page.locator('#api-image-url')).toHaveValue(url)
  }
  await preview.click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('button', { name: 'Teapot: jump and turn', exact: true })).toHaveCount(0)
  expect(await page.locator('.api-response-image .api-preview').evaluate(element => element.getAnimations().length)).toBe(0)
})

for (const [collection, avatar] of [['open-bot-avatar', 'teapot'], ['bot-avatars', 'clover']]) {
test(`${collection} API previews automatically repeat every ten seconds and stop for reduced motion`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    window.previewJumps = []
    const animate = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      if (this.matches('.api-preview')) window.previewJumps.push(performance.now())
      return animate.apply(this, args)
    }
    const click = HTMLCanvasElement.prototype.click
    HTMLCanvasElement.prototype.click = function () {
      if (this.matches('[data-bot-avatar]')) window.previewJumps.push(performance.now())
      return click.call(this)
    }
  })
  await page.goto(`/?v=5&collection=${collection}&avatar=${avatar}`)
  await ready(page)
  await expect.poll(() => page.evaluate(() => window.previewJumps.length)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => window.previewJumps.length), { timeout: 12000 }).toBeGreaterThan(1)
  const times = await page.evaluate(() => window.previewJumps)
  expect(times[1] - times[0]).toBeGreaterThan(9700)
  expect(times[1] - times[0]).toBeLessThan(10600)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('button', { name: 'Teapot: jump and turn', exact: true })).toHaveCount(0)
  const stopped = await page.evaluate(() => window.previewJumps.length)
  await page.clock.install()
  await page.clock.runFor(20000)
  expect(await page.evaluate(() => window.previewJumps.length)).toBe(stopped)
})
}

test('v5 originals work in the picker, live editor, shares, and exports', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/?v=5&collection=open-bot-avatar&avatar=teapot&style=fluffy')
  await ready(page)
  const designs = [['Mushroom', 'mushroom'], ['Jellybean', 'jellybean'], ['Ringed Planet', 'ringed-planet'], ['Lighthouse', 'lighthouse'], ['Sailboat', 'sailboat'], ['Teapot', 'teapot']]
  for (const [name, id] of designs) {
    await page.locator('.api-catalog').getByRole('button', { name, exact: true }).click()
    await ready(page)
    await expect(page.locator('.api-response-caption strong')).toHaveText(name)
    await expect(page.locator('.api-response-image canvas')).toHaveCount(1)
    await expect(page.locator('#api-image-url')).toHaveValue(new RegExp(`v=5.*avatar=${id}.*style=fluffy`))
  }
  await page.getByRole('button', { name: 'Preview PNG', exact: true }).click()
  await page.screenshot({ path: `experiments/v5-originals/ui-${testInfo.project.name}.png`, fullPage: true })
  const selected = await page.locator('#api-image-url').inputValue()
  await page.getByRole('button', { name: 'Share avatar', exact: true }).click()
  const shared = new URL(await page.evaluate(() => navigator.clipboard.readText()))
  await page.goto('/?' + shared.searchParams)
  await ready(page)
  await expect(page.locator('#api-image-url')).toHaveValue(selected)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click()
  const saved = await download
  expect(saved.suggestedFilename()).toBe('teapot-fluffy-v5.png')
  expect(await readFile(await saved.path())).toEqual(await readFile('public/avatars/v5/open-bot-avatar/teapot-fluffy.png'))
  await page.getByRole('link', { name: 'Edit this avatar', exact: true }).click()
  await expect(page).toHaveURL(/\/editor/)
  for (const [name] of designs) {
    await page.getByRole('list', { name: 'Avatars', exact: true }).getByRole('button', { name, exact: true }).click()
    await expect(page.locator('.bot-cell.is-on')).toHaveAttribute('aria-label', name)
    await expect(page.locator('.stage-avatar canvas')).toBeVisible()
  }
  await page.getByRole('radio', { name: 'Fluffy', exact: true }).click()
  await expect(page.locator('.bots img[src$="-editor-thumb.webp"]')).toHaveCount(6)
  await page.getByRole('radio', { name: 'Happy', exact: true }).click()
  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  await page.getByRole('menuitem', { name: /Original-color API URL/ }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('v=5&collection=open-bot-avatar&avatar=teapot')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Download flat SVG/ }).click()
  expect(await readFile(await (await svgDownload).path(), 'utf8')).toContain('#14b3a5')
  await page.screenshot({ path: `experiments/v5-originals/editor-${testInfo.project.name}.png` })
})

test('home and docs have useful content without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('http://localhost:3100/')
  await expect(page.getByRole('heading', { name: 'One request. One avatar.' })).toBeVisible()
  await expect(page.getByAltText('Example bot avatar; your requested image will appear here')).toBeVisible()
  await expect(page.locator('.api-catalog-image img')).toHaveCount(47)
  await page.goto('http://localhost:3100/docs')
  await expect(page.getByRole('heading', { name: 'OpenBot Avatars API docs' })).toBeVisible()
  await expect(page.getByLabel('Shell example')).toContainText('curl')
  await context.close()
})

test('selection, snippets and focus survive navigation and browser back', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(mug)
  await ready(page)
  await page.locator('.api-catalog').getByRole('button', { name: 'Controller', exact: true }).click()
  await ready(page)
  await page.getByRole('radio', { name: 'React', exact: true }).click()
  const url = await page.getByLabel('SELECTED IMAGE URL').inputValue()
  expect(url).toMatch(/^https:\/\/open-bot-avatars-api\.vercel\.app\/api\/avatar\?/)
  await page.getByRole('button', { name: 'Copy URL', exact: true }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(url)
  await nav(page).getByRole('link', { name: 'Docs', exact: true }).click()
  await expect(page).toHaveURL(/\/docs$/)
  await expect(page.locator('#main-content')).toBeFocused()
  await expect(page).toHaveTitle('API docs | OpenBot Avatars API')
  await page.getByRole('button', { name: 'Copy example', exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('<img')
  await page.goBack()
  await ready(page)
  await expect(page.getByLabel('SELECTED IMAGE URL')).toHaveValue(url)
  await expect(page.locator('.api-catalog button[aria-pressed="true"]')).toHaveText('Controller')
  await expect(page.getByRole('radio', { name: 'React', exact: true })).toBeChecked()
})

test('share links use the deployed site and show a copied toast', async ({ page, context }) => {
  const wrongVersionThumbnails = []
  page.on('request', request => {
    if (/\/avatars\/v(?!5\/)[^/]+\/.*-thumb\.webp/.test(new URL(request.url()).pathname)) wrongVersionThumbnails.push(request.url())
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(mug)
  await ready(page)
  expect(wrongVersionThumbnails).toEqual([])
  await expect(page.locator('.api-endpoint')).toContainText('https://open-bot-avatars-api.vercel.app/')
  await expect(page.getByLabel('HTML usage example')).not.toContainText('localhost')
  await page.getByRole('button', { name: 'Share avatar', exact: true }).click()
  await expect(page.locator('.copy-toast')).toHaveText('Avatar link copied.')
  await expect(page.locator('.copy-toast')).toBeInViewport()
  await expect(page.locator('.copy-toast')).toHaveCSS('opacity', '1')
  const shared = new URL(await page.evaluate(() => navigator.clipboard.readText()))
  expect(shared.origin).toBe('https://open-bot-avatars-api.vercel.app')
  expect(shared.searchParams.get('collection')).toBe('open-bot-avatar')
  expect(shared.searchParams.get('avatar')).toBe('mug')
  expect(shared.searchParams.get('v')).toBe('5')
  await expect(page.locator('.copy-toast')).toHaveCSS('opacity', '0', { timeout: 5000 })
  await expect(page.locator('.copy-toast')).toBeHidden()
})

test('versioned seeded and exact picker links preserve selection on reload', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  for (const query of ['v=4&collection=open-bot-avatar&avatar=mug', 'v=4&collection=bot-avatars&seed=user-42&style=original', 'v=4&collection=open-bot-avatar&avatar=mug&style=fluffy', 'v=4&collection=open-bot-avatar&seed=user-42&style=fluffy']) {
    await page.goto('/?' + query)
    await ready(page)
    const image = await page.locator('#api-image-url').inputValue()
    await page.getByRole('button', { name: 'Share avatar', exact: true }).click()
    const shared = new URL(await page.evaluate(() => navigator.clipboard.readText()))
    expect(shared.searchParams.get('v')).toBe(new URLSearchParams(query).get('v'))
    expect(shared.searchParams.get('style')).toBe(new URLSearchParams(query).get('style') ?? 'flat')
    if (query.includes('seed=')) expect(shared.searchParams.get('seed')).toBe('user-42')
    else expect(shared.searchParams.get('avatar')).toBe('mug')
    await page.goto('/?' + shared.searchParams)
    await ready(page)
    await expect(page.locator('#api-image-url')).toHaveValue(image)
    await page.reload()
    await ready(page)
    await expect(page.locator('#api-image-url')).toHaveValue(image)
  }
})

test('v4 fluffy fallback, static response, copied URL and download keep the same coat', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/?v=4&collection=open-bot-avatar&avatar=mug&style=fluffy')
  await ready(page)
  await expect(page.locator('.api-response-caption')).toContainText('Fluffy PNG')
  await expect(page.locator('.api-response-caption')).toContainText('Animated demonstration')
  await expect(page.locator('.api-response-image canvas')).toHaveCount(1)
  await expect(page.locator('.api-fur-notice')).toContainText('WebGL2 is unavailable')
  await expect(page.getByRole('button', { name: 'Download SVG', exact: true })).toHaveCount(0)
  const url = await page.locator('#api-image-url').inputValue()
  expect(new URL(url).searchParams.get('v')).toBe('4')
  expect(new URL(url).searchParams.get('style')).toBe('fluffy')
  await page.getByRole('button', { name: 'Copy URL', exact: true }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(url)
  await page.getByRole('button', { name: 'Preview PNG', exact: true }).click()
  await expect(page.locator('.api-response-caption')).toContainText('Actual returned PNG')
  const png = await page.locator('.api-response-image img').evaluate(async image => Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())))
  const expected = await readFile('public/avatars/v4/open-bot-avatar/mug-fluffy.png')
  expect(Buffer.from(png)).toEqual(expected)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('mug-fluffy-v4.png')
  expect(await readFile(await file.path())).toEqual(expected)
  await expect(page.locator('#api-image-url')).toHaveValue(url)
  await page.locator('.api-hero').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('v4-fluffy-response.png') })
  await page.locator('.api-catalog').getByRole('button', { name: 'Controller', exact: true }).click()
  await ready(page)
  const switched = await page.locator('.api-response-image img').evaluate(async image => Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())))
  expect(Buffer.from(switched)).toEqual(await readFile('public/avatars/v4/open-bot-avatar/controller-fluffy.png'))
  expect(new URL(await page.locator('#api-image-url').inputValue()).searchParams.get('avatar')).toBe('controller')
  await page.getByRole('button', { name: 'Show animation', exact: true }).click()
  await expect(page.locator('.api-response-image canvas')).toHaveCount(1)
  await expect(page.locator('#api-image-url')).toHaveValue(/avatar=controller.*style=fluffy/)
})

test('finish choices follow the version, collection, and exact format/style pairs', async ({ page }) => {
  async function verifyStaticResponse() {
    const selected = new URL(await page.locator('#api-image-url').inputValue())
    const response = await page.request.get(new URL(selected.pathname + selected.search, page.url()).href)
    expect(response.status()).toBe(200)
    const shown = await page.locator('.api-response-image img').evaluate(async image => Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())))
    expect(Buffer.from(shown)).toEqual(await response.body())
  }
  await page.goto('/?v=4&collection=open-bot-avatar&avatar=mug')
  await ready(page)
  await page.getByRole('group', { name: 'Finish', exact: true }).getByRole('button').click()
  await page.getByRole('menuitem', { name: 'Fluffy', exact: true }).focus()
  await page.keyboard.press('Enter')
  await ready(page)
  await expect(page.locator('#api-image-url')).toHaveValue(/style=fluffy/)
  await expect(page.getByRole('button', { name: 'Download SVG', exact: true })).toHaveCount(0)
  await expect(page.locator('.api-catalog-image img').first()).toHaveAttribute('src', /v4.*fluffy-thumb\.webp/)
  await page.getByRole('button', { name: 'Preview PNG', exact: true }).click()
  await verifyStaticResponse()
  await page.getByRole('group', { name: 'Collection', exact: true }).getByRole('button').click()
  await page.getByRole('menuitem', { name: /^Libraries.dev Bot Avatars/ }).click()
  await ready(page)
  expect(new URL(await page.locator('#api-image-url').inputValue()).searchParams.get('style')).toBe('flat')
  await verifyStaticResponse()
  await page.getByRole('group', { name: 'Finish', exact: true }).getByRole('button').click()
  await expect(page.getByRole('menuitem', { name: 'Fluffy', exact: true })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Original plush', exact: true }).click()
  await ready(page)
  await expect(page.locator('.api-download-selection')).toContainText('Original plush')
  await verifyStaticResponse()
  await page.getByRole('radio', { name: 'Use a seed', exact: true }).click()
  await page.getByLabel('Public user ID or seed').fill('v4-preview-check')
  await page.getByRole('button', { name: 'Find avatar', exact: true }).click()
  await ready(page)
  await verifyStaticResponse()
  await page.goto('/')
  await ready(page)
  expect(new URL(await page.locator('#api-image-url').inputValue()).searchParams.get('v')).toBe('5')
})

test('picker does not silently replace an unpublished catalog version', async ({ page }) => {
  for (const version of ['1', '2', '3', '6']) {
    await page.goto(`/?v=${version}&collection=open-bot-avatar&avatar=mug`)
    await expect(page.locator('.api-call-status[role="alert"]')).toContainText('requested catalog version is not available')
    await expect(page.getByRole('button', { name: 'Copy endpoint', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Retry this request', exact: true })).toHaveCount(0)
  }
})

test('API previews animate by default and offer a PNG preview', async ({ page }) => {
  await page.goto(mug)
  await ready(page)
  await expect(page.getByRole('button', { name: 'Preview PNG', exact: true })).toBeVisible()
  await expect(page.locator('.api-response-image canvas')).toHaveCount(1)
  const animatedHeight = (await page.locator('.api-hero').boundingBox()).height
  await page.getByRole('button', { name: 'Preview PNG', exact: true }).click()
  await expect(page.locator('.api-response-image canvas')).toHaveCount(0)
  await expect(page.locator('.api-response-image img')).toHaveAttribute('src', /^blob:/)
  expect((await page.locator('.api-hero').boundingBox()).height).toBe(animatedHeight)
  await page.getByRole('button', { name: 'Show animation', exact: true }).click()
  await expect(page.locator('.api-response-image canvas')).toHaveCount(1)
})

test('PNG and SVG downloads keep the selected design without navigation', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  for (const choice of [null, 'Mug', 'Barbell']) {
    if (choice) {
      await page.locator('.api-catalog').getByRole('button', { name: choice, exact: true }).click()
      await ready(page)
    }
    const name = await page.locator('.api-response-caption strong').textContent()
    const selectedUrl = await page.getByLabel('SELECTED IMAGE URL').inputValue()
    const params = new URL(selectedUrl).searchParams
    const before = page.url()
    const formats = await page.getByRole('button', { name: 'Download SVG', exact: true }).count() ? ['png', 'svg'] : ['png']
    for (const format of formats) {
      const saved = page.waitForEvent('download')
      await page.getByRole('button', { name: `Download ${format.toUpperCase()}`, exact: true }).click()
      const file = await saved
      expect(file.suggestedFilename()).toBe(`${params.get('avatar')}-${params.get('style') ?? 'flat'}-v${params.get('v')}.${format}`)
      const expected = await readFile(`public/avatars/v${params.get('v')}/${params.get('collection')}/${params.get('avatar')}.${format}`)
      expect(await readFile(await file.path())).toEqual(expected)
      expect(page.url()).toBe(before)
      await expect(page.getByLabel('SELECTED IMAGE URL')).toHaveValue(selectedUrl)
      await expect(page.locator('.api-download-selection')).toContainText(name)
    }
  }
})

test('SVG download errors and mismatched avatars never save an incorrect image', async ({ page }) => {
  await page.goto(mug)
  await ready(page)
  const before = page.url()
  let attempts = 0
  await page.route('**/api/avatar?**', async route => {
    if (new URL(route.request().url()).searchParams.get('format') !== 'svg') return route.continue()
    attempts++
    if (attempts === 1) {
      await route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } })
    } else if (attempts === 2) {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'image/svg+xml', 'X-Avatar-Id': 'controller', 'X-Avatar-Collection': 'open-bot-avatar' }, body: await readFile('public/avatars/v4/open-bot-avatar/controller.svg') })
    } else await route.continue()
  })
  const downloads = []
  page.on('download', file => downloads.push(file.suggestedFilename()))
  await page.getByRole('button', { name: 'Download SVG', exact: true }).click()
  await expect(page.locator('.copy-toast')).toContainText('Could not download Mug (HTTP 503)')
  expect(downloads).toEqual([])
  expect(page.url()).toBe(before)
  await expect(page.locator('.api-catalog button[aria-pressed="true"]')).toHaveText('Mug')
  await page.getByRole('button', { name: 'Download SVG', exact: true }).click()
  await expect(page.locator('.copy-toast')).toContainText('The download did not match the selected avatar.')
  expect(downloads).toEqual([])
  const saved = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download SVG', exact: true }).click()
  expect((await saved).suggestedFilename()).toBe('mug-flat-v5.svg')
})

test('editing a selection preserves it across pages and exports the current PNG and flat SVG', async ({ page }) => {
  await page.goto(mug)
  await ready(page)
  await page.getByRole('link', { name: 'Edit this avatar', exact: true }).click()
  await expect(page).toHaveURL(/\/editor/)
  await expect(page.locator('.bot-cell.is-on')).toHaveAttribute('aria-label', 'Mug')
  await page.getByRole('button', { name: 'Blue', exact: true }).click()
  await page.getByRole('radio', { name: 'Happy', exact: true }).click()
  await nav(page).getByRole('link', { name: 'Docs', exact: true }).click()
  await nav(page).getByRole('link', { name: 'Editor', exact: true }).click()
  await expect(page.locator('.bot-cell.is-on')).toHaveAttribute('aria-label', 'Mug')
  await expect(page.getByRole('radio', { name: 'Happy', exact: true })).toBeChecked()
  await expect(page.getByRole('button', { name: 'Blue', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.stage-avatar canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const pngDownload = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Download current preview/ }).click()
  const png = await pngDownload
  expect(png.suggestedFilename()).toBe('mug.png')
  const image = await loadImage(await readFile(await png.path()))
  expect([image.width, image.height]).toEqual([512, 512])
  const canvas = createCanvas(512, 512)
  canvas.getContext('2d').drawImage(image, 0, 0)
  const pixels = canvas.getContext('2d').getImageData(0, 0, 512, 512).data
  expect(pixels.some((value, index) => index % 4 === 3 && value > 0)).toBe(true)
  expect(pixels[3]).toBe(0)
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Download flat SVG/ }).click()
  const svg = await readFile(await (await svgDownload).path(), 'utf8')
  expect(svg).toContain('#1f7cf2')
  await page.reload()
  await expect(page.locator('.bot-cell.is-on')).toHaveAttribute('aria-label', 'Mug')
  await expect(page.getByRole('radio', { name: 'Happy', exact: true })).toBeChecked()
})

test('seed tabs keep the current avatar until a seed is explicitly submitted', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const requests = []
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/avatar') requests.push(request.url())
  })
  await page.goto(mug)
  await ready(page)
  const originalUrl = await page.getByLabel('SELECTED IMAGE URL').inputValue()
  await page.getByRole('radio', { name: 'Use a seed', exact: true }).click()
  await expect(page.getByLabel('Public user ID or seed')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Find avatar', exact: true })).toBeDisabled()
  await expect(page.locator('.api-response-caption strong')).toHaveText('Mug')
  await expect(page.getByLabel('SELECTED IMAGE URL')).toHaveValue(originalUrl)
  await page.getByRole('button', { name: 'Share avatar', exact: true }).click()
  const shared = new URL(await page.evaluate(() => navigator.clipboard.readText()))
  expect(shared.searchParams.get('avatar')).toBe('mug')
  expect(shared.searchParams.has('seed')).toBe(false)
  await page.getByLabel('Public user ID or seed').fill('user-42')
  await page.getByRole('radio', { name: 'Choose an avatar', exact: true }).click()
  await page.getByRole('radio', { name: 'Use a seed', exact: true }).click()
  await expect(page.locator('.api-response-caption strong')).toHaveText('Mug')
  expect(requests).toHaveLength(1)
  await page.getByRole('button', { name: 'Find avatar', exact: true }).click()
  await ready(page)
  expect(requests).toHaveLength(2)
  expect(new URL(requests[1]).searchParams.get('seed')).toBe('user-42')
  const seededUrl = await page.getByLabel('REPEATABLE SEED URL').inputValue()
  const seededName = await page.locator('.api-response-caption strong').textContent()
  await page.getByRole('radio', { name: 'Choose an avatar', exact: true }).click()
  await expect(page.locator('.api-response-caption strong')).toHaveText(seededName)
  await expect(page.getByLabel('REPEATABLE SEED URL')).toHaveValue(seededUrl)
  expect(requests).toHaveLength(2)
})

test('rate-limit retry preserves the seed and waits for Retry-After', async ({ page }) => {
  const requests = []
  await page.route('**/api/avatar?**', async route => {
    requests.push(route.request().url())
    if (requests.length === 1) {
      await route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, json: { error: 'Too many avatar requests. Please try again shortly.' } })
    } else await route.continue()
  })
  await page.goto('/?v=4&collection=open-bot-avatar&seed=test-user')
  await expect(page.locator('.api-request').getByRole('button', { name: /Retry in/ })).toBeDisabled()
  await expect(page.getByLabel('Public user ID or seed')).toHaveValue('test-user')
  const retry = page.locator('.api-request').getByRole('button', { name: 'Retry this request', exact: true })
  await expect(retry).toBeEnabled()
  await retry.click()
  await ready(page)
  expect(requests).toHaveLength(2)
  expect(requests[1]).toBe(requests[0])
  await expect(page.getByLabel('REPEATABLE SEED URL')).toHaveValue(/seed=test-user/)
})

test('gallery selection, PNG download and narrow layouts remain usable', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 760 })
  await page.goto(mug)
  await ready(page)
  await page.locator('.api-catalog').getByRole('button', { name: 'Controller', exact: true }).click()
  await expect(page.locator('.api-selection-preview')).toContainText('Selected: Controller')
  await ready(page)
  if (testInfo.project.name === 'mobile') await expect(page.locator('.api-selection-preview')).toBeInViewport()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('controller-flat-v5.png')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (testInfo.project.name === 'mobile') {
    expect(await page.locator('.api-options-body').evaluate(element => getComputedStyle(element).overflowY)).toBe('visible')
    await page.screenshot({ path: testInfo.outputPath('mobile-gallery.png'), fullPage: true })
  }
})

test('legacy links still open the requested editor and docs pages', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/?avatar=mug&color=blue#/')
  await expect(page).toHaveURL(/\/editor/)
  await expect(page.locator('.bot-cell.is-on')).toHaveAttribute('aria-label', 'Mug')
  await expect(page.getByRole('button', { name: 'Blue', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/#/docs')
  await expect(page).toHaveURL(/\/docs$/)
  await expect(page.getByRole('heading', { name: 'OpenBot Avatars API docs' })).toBeVisible()
  await page.goto('/license')
  await expect(page.getByRole('heading', { name: 'License and credits' })).toBeVisible()
  await expect(page).toHaveTitle('License and credits | OpenBot Avatars API')
  expect(errors).toEqual([])
})
