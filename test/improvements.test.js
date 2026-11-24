import test from 'node:test'
import assert from 'node:assert/strict'
import { readRoute, href } from '../app/studio/navigation.ts'
import { retryDelaySeconds } from '../app/studio/api-urls.ts'
import { avatarAsset } from '../app/lib/avatar-assets.js'

test('normal page paths and legacy links keep their destinations', () => {
  assert.equal(readRoute('', '', '/docs'), 'docs')
  assert.equal(readRoute('', '?avatar=mug', '/editor'), 'studio')
  assert.equal(readRoute('#/', ''), 'studio')
  assert.equal(readRoute('#/docs', ''), 'docs')
  assert.equal(readRoute('', '?avatar=mug'), 'studio')
  assert.equal(readRoute('', '?collection=open-bot-avatar&avatar=mug'), 'api')
  assert.equal(readRoute('#avatar-options', ''), 'api')
  assert.deepEqual(href, { api: '/', studio: '/editor', docs: '/docs' })
})

test('retry delays accept seconds and HTTP dates without negative or invalid countdowns', () => {
  const now = Date.parse('2026-01-01T00:00:00Z')
  assert.equal(retryDelaySeconds('5', now), 5)
  assert.equal(retryDelaySeconds('1.5', now), 2)
  assert.equal(retryDelaySeconds('Thu, 01 Jan 2026 00:00:05 GMT', now), 5)
  assert.equal(retryDelaySeconds('Wed, 31 Dec 2025 23:59:59 GMT', now), 0)
  assert.equal(retryDelaySeconds('-1', now), 0)
  assert.equal(retryDelaySeconds('invalid', now), 0)
  assert.equal(retryDelaySeconds(null, now), 0)
})

test('concurrent image requests reuse the loaded bytes and ETag', async () => {
  const [first, second] = await Promise.all([
    avatarAsset('open-bot-avatar', 'mug.png'),
    avatarAsset('open-bot-avatar', 'mug.png')
  ])
  assert.strictEqual(first, second)
  assert.strictEqual(await avatarAsset('open-bot-avatar', 'mug.png'), first)
  assert.equal(first.data.subarray(1, 4).toString(), 'PNG')
  assert.match(first.etag, /^"[a-f0-9]{64}"$/)
})
