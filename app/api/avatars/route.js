import catalog from '../../lib/catalog.json' with { type: 'json' }
import sources from '../../lib/upstream/sources.json' with { type: 'json' }
import { rateLimit } from '../../lib/rate-limit.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request) {
  const limited = await rateLimit(request)
  if (limited) return limited
  return Response.json({
    version: 3,
    total: catalog.length,
    sources,
    avatars: catalog.map(entry => ({
      ...entry,
      url: '/api/avatar?' + new URLSearchParams({ v: '3', collection: entry.collection, avatar: entry.id }),
      originalUrl: entry.styles.includes('original')
        ? '/api/avatar?' + new URLSearchParams({ v: '3', collection: entry.collection, avatar: entry.id, style: 'original' }) : null
    }))
  }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' } })
}
