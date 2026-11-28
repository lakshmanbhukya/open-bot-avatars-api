import test from 'node:test'
import assert from 'node:assert/strict'
import { siteOrigin, SITE_URL } from '../app/lib/site-url.js'

test('public origin prefers configuration, otherwise follows the current deployment', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL
    assert.equal(siteOrigin('http://localhost:3100/editor?avatar=mug'), 'http://localhost:3100')
    assert.equal(siteOrigin('https://preview.example.com'), 'https://preview.example.com')
    assert.equal(siteOrigin(), SITE_URL)
    process.env.NEXT_PUBLIC_SITE_URL = 'https://avatars.example.com/'
    assert.equal(siteOrigin('http://localhost:3100'), 'https://avatars.example.com')
    for (const value of ['javascript:alert(1)', 'https://user:secret@example.com', 'invalid']) {
      process.env.NEXT_PUBLIC_SITE_URL = value
      assert.throws(() => siteOrigin())
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = previous
  }
})
