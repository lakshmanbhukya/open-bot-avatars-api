import test from 'node:test'
import assert from 'node:assert/strict'
import { GET } from '../app/api/avatar/route.js'

const get = (path = '/api/avatar') => GET(new Request(new URL(path, 'http://localhost')))

test('random images can be retrieved again by their stable URL', async () => {
  const first = get()
  const svg = await first.text()
  assert.match(svg, /<svg\b/)
  assert.equal(first.headers.get('cache-control'), 'no-store')
  assert.equal(await get(first.headers.get('content-location')).text(), svg)
  assert.notEqual(first.headers.get('content-location'), get().headers.get('content-location'))
  assert.equal(get('/api/avatar?seed=').status, 400)
})

test('the expanded catalog serves new shapes and preserves older profile links', async () => {
  const legacy = await get('/api/avatar?seed=30').text()
  assert.match(legacy, /<title>Controller<\/title>/)
  const droid = get('/api/avatar?seed=30&v=2')
  const svg = await droid.text()
  assert.match(svg, /<title>Droid<\/title>/)
  assert.equal(await get(droid.headers.get('content-location')).text(), svg)
})
