import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

const script = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('PTTL', KEYS[1])}
`

function refusal(status, retryAfter) {
  return Response.json({ error: status === 429
    ? 'Too many avatar requests. Please try again shortly.'
    : 'Avatar API temporarily unavailable. Please try again shortly.' }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Retry-After': String(Math.max(1, Math.ceil(retryAfter))),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Retry-After',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}

// Trust only headers overwritten by the hosting platform or an explicitly configured proxy.
function clientKey(request, env) {
  const header = env.VERCEL === '1' ? 'x-forwarded-for' : env.RATE_LIMIT_IP_HEADER || ''
  const value = header ? request?.headers.get(header)?.split(',')[0].trim() : ''
  const ip = isIP(value || '')
  const address = ip === 6 ? new URL(`http://[${value.split('%')[0]}]/`).hostname : ip ? value : 'shared'
  return 'openbot:rate:v1:' + createHash('sha256').update(address).digest('hex')
}

export function createRateLimiter({ limit = 180, windowMs = 60_000, maxKeys = 10_000,
  now = Date.now, env = process.env, fetcher = fetch } = {}) {
  const buckets = new Map()

  return async function rateLimit(request) {
    const key = clientKey(request, env)
    const url = env.UPSTASH_REDIS_REST_URL
    const token = env.UPSTASH_REDIS_REST_TOKEN
    if (url || token || env.VERCEL === '1') {
      try {
        if (!url || !token || new URL(url).protocol !== 'https:') throw Error('Invalid rate limit store configuration')
        const response = await fetcher(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(['EVAL', script, '1', key, String(windowMs)]),
          cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(1500)
        })
        if (!response.ok) throw Error('Rate limit store unavailable')
        const { result } = await response.json()
        if (!Array.isArray(result) || result.length !== 2 || !result.every(Number.isSafeInteger)
          || result[0] < 1 || result[1] < 0) throw Error('Invalid rate limit store response')
        return result[0] > limit ? refusal(429, result[1] / 1000) : null
      } catch {
        // A configured shared store must not silently fall back to a weaker local limit.
        return refusal(503, 5)
      }
    }

    // shortcut: memory limits apply per process; configure Redis for serverless or multiple instances.
    const time = now()
    for (const [oldKey, bucket] of buckets) {
      if (bucket.reset > time) break
      buckets.delete(oldKey)
    }
    let bucket = buckets.get(key)
    if (!bucket) {
      if (buckets.size >= maxKeys) return refusal(429, windowMs / 1000)
      bucket = { count: 0, reset: time + windowMs }
      buckets.set(key, bucket)
    }
    if (bucket.count >= limit) return refusal(429, (bucket.reset - time) / 1000)
    bucket.count++
    return null
  }
}

export const rateLimit = createRateLimiter()
