import test from 'node:test'
import assert from 'node:assert/strict'
import { readRoute } from '../app/studio/navigation.ts'
import { imageUrl, usageExample } from '../app/studio/api-urls.ts'

test('API is home while saved editor and picker links keep their destination', () => {
  assert.equal(readRoute('', ''), 'api')
  assert.equal(readRoute('', '?avatar=mug&color=blue'), 'studio')
  assert.equal(readRoute('', '?def=shared-definition'), 'studio')
  assert.equal(readRoute('', '?collection=open-bot-avatar&avatar=mug'), 'api')
  assert.equal(readRoute('', '?v=5&seed=user-42'), 'api')
  assert.equal(readRoute('#/', ''), 'studio')
  assert.equal(readRoute('#/api', '?avatar=mug'), 'api')
  assert.equal(readRoute('#/docs', ''), 'docs')
})

test('integration examples preserve URLs and escape HTML and shell values', () => {
  const url = 'https://example.com/api/avatar?v=5&seed=user-42'
  assert.equal(usageExample('URL', url), url)
  assert.ok(usageExample('HTML', url).includes('&amp;seed=user-42'))
  assert.ok(usageExample('React', url).includes('src=' + JSON.stringify(url)))
  assert.equal(usageExample('cURL', url), `curl '${url}' --output avatar.png`)
  assert.ok(usageExample('HTML', 'https://example.com/"').includes('&quot;'))
  assert.ok(usageExample('cURL', "https://example.com/it's").includes("it'\\''s"))
})

test('image URLs use v5 and safely encode public seeds and exact selections', () => {
  assert.equal(imageUrl(), '/api/avatar?v=5')
  const seeded = new URL(imageUrl('bot-avatars', 'original', '', 'user & #42/☀'), 'http://localhost')
  assert.equal(seeded.searchParams.get('seed'), 'user & #42/☀')
  assert.equal(seeded.searchParams.get('v'), '5')
  assert.equal(seeded.searchParams.get('style'), 'original')
  assert.equal(seeded.searchParams.has('avatar'), false)
  const exact = new URL(imageUrl('open-bot-avatar', 'flat', 'mug'), 'http://localhost')
  assert.equal(exact.searchParams.get('avatar'), 'mug')
  assert.equal(exact.searchParams.has('seed'), false)
})
