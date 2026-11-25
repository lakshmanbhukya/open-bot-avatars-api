import test from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter } from '../app/lib/rate-limit.js'

const request = (headers = {}) => new Request('https://example.com/api/avatar', { headers })

test('local limit counts requests, returns CORS retry guidance, and resets after expiry', async () => {
  let time = 0
  const limit = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => time, env: {} })
  assert.equal(await limit(request()), null)
  assert.equal(await limit(request()), null)
  time = 1001
  const response = await limit(request())
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('retry-after'), '59')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
  assert.equal(response.headers.get('access-control-expose-headers'), 'Retry-After')
  assert.ok((await response.json()).error)
  time = 60_000
  assert.equal(await limit(request()), null)
})

test('untrusted client-supplied IP headers cannot bypass the local shared quota', async () => {
  const limit = createRateLimiter({ limit: 1, env: {} })
  assert.equal(await limit(request({ 'x-forwarded-for': '192.0.2.1' })), null)
  assert.equal((await limit(request({ 'x-forwarded-for': '192.0.2.2', 'x-real-ip': '192.0.2.3' }))).status, 429)
})

test('an explicitly trusted proxy separates clients and normalizes IPv6 spellings', async () => {
  const limit = createRateLimiter({ limit: 1, env: { RATE_LIMIT_IP_HEADER: 'x-real-ip' } })
  assert.equal(await limit(request({ 'x-real-ip': '192.0.2.1' })), null)
  assert.equal(await limit(request({ 'x-real-ip': '192.0.2.2' })), null)
  assert.equal(await limit(request({ 'x-real-ip': '2001:0db8:0:0:0:0:0:1' })), null)
  assert.equal((await limit(request({ 'x-real-ip': '2001:db8::1' }))).status, 429)
  assert.equal(await limit(request({ 'x-real-ip': 'fe80::1%eth0' })), null)
  assert.equal((await limit(request({ 'x-real-ip': 'fe80::1' }))).status, 429)
  assert.equal(await limit(request({ 'x-real-ip': 'not an IP' })), null)
  assert.equal((await limit(request())).status, 429)
})

test('local storage remains bounded without evicting active quotas', async () => {
  let time = 0
  const limit = createRateLimiter({ limit: 1, maxKeys: 1, windowMs: 1000, now: () => time,
    env: { RATE_LIMIT_IP_HEADER: 'x-real-ip' } })
  assert.equal(await limit(request({ 'x-real-ip': '192.0.2.1' })), null)
  assert.equal((await limit(request({ 'x-real-ip': '192.0.2.2' }))).status, 429)
  assert.equal((await limit(request({ 'x-real-ip': '192.0.2.1' }))).status, 429)
  time = 1000
  assert.equal(await limit(request({ 'x-real-ip': '192.0.2.2' })), null)
})

test('independent serverless instances share one atomic Redis quota and hash client IPs', async () => {
  const counts = new Map()
  const env = { VERCEL: '1', UPSTASH_REDIS_REST_URL: 'https://redis.example.com', UPSTASH_REDIS_REST_TOKEN: 'test-token' }
  const fetcher = async (url, options) => {
    assert.equal(url, env.UPSTASH_REDIS_REST_URL)
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.equal(options.cache, 'no-store')
    assert.ok(options.signal)
    const [command, script, keyCount, key, expiry] = JSON.parse(options.body)
    assert.equal(command, 'EVAL')
    assert.match(script, /INCR/)
    assert.match(script, /PEXPIRE/)
    assert.equal(keyCount, '1')
    assert.equal(expiry, '60000')
    assert.match(key, /^openbot:rate:v1:[0-9a-f]{64}$/)
    const count = (counts.get(key) ?? 0) + 1
    counts.set(key, count)
    return Response.json({ result: [count, 59801] })
  }
  const first = createRateLimiter({ limit: 2, env, fetcher })
  const second = createRateLimiter({ limit: 2, env, fetcher })
  const client = request({ 'x-forwarded-for': '192.0.2.1' })
  assert.equal(await first(client), null)
  assert.equal(await second(client), null)
  const blocked = await first(client)
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers.get('retry-after'), '60')
  assert.equal(await second(request({ 'x-forwarded-for': '192.0.2.2' })), null)
})

test('serverless configuration and Redis failures fail closed without exposing credentials', async () => {
  const base = { VERCEL: '1', UPSTASH_REDIS_REST_URL: 'https://redis.example.com', UPSTASH_REDIS_REST_TOKEN: 'test-secret' }
  for (const options of [
    { env: { VERCEL: '1' } },
    { env: { ...base, UPSTASH_REDIS_REST_TOKEN: '' } },
    { env: { ...base, UPSTASH_REDIS_REST_URL: 'http://redis.example.com' } },
    { env: base, fetcher: async () => { throw Error('test-secret') } },
    { env: base, fetcher: async () => new Response('', { status: 503 }) },
    { env: base, fetcher: async () => Response.json({ result: [1, -1] }) },
    { env: base, fetcher: async () => Response.json({ error: 'test-secret' }) }
  ]) {
    const response = await createRateLimiter(options)(request())
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('retry-after'), '5')
    assert.doesNotMatch(await response.text(), /test-secret/)
  }
})
