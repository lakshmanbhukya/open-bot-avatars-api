import { catalogForVersion, PICKER_VERSION, supportsVariant } from '../../lib/avatar-catalog.js'
import v4Sources from '../../lib/catalogs/v4-sources.json' with { type: 'json' }
import v5Sources from '../../lib/catalogs/v5-sources.json' with { type: 'json' }
import { rateLimit } from '../../lib/rate-limit.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request) {
  const limited = await rateLimit(request)
  if (limited) return limited
  const versions = request ? new URL(request.url).searchParams.getAll('v') : []
  const version = versions[0] ?? PICKER_VERSION
  const catalog = catalogForVersion(version)
  if (versions.length > 1 || !catalog) {
    return Response.json({ error: 'Catalog version must be 4 or 5.' }, {
      status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
    })
  }
  return Response.json({
    version: Number(version),
    total: catalog.length,
    sources: version === '4' ? v4Sources : v5Sources,
    avatars: catalog.map(entry => ({
      ...entry,
      url: '/api/avatar?' + new URLSearchParams({ v: version, collection: entry.collection, avatar: entry.id }),
      originalUrl: supportsVariant(entry, 'png', 'original')
        ? '/api/avatar?' + new URLSearchParams({ v: version, collection: entry.collection, avatar: entry.id, style: 'original' }) : null,
      fluffyUrl: supportsVariant(entry, 'png', 'fluffy')
        ? '/api/avatar?' + new URLSearchParams({ v: version, collection: entry.collection, avatar: entry.id, style: 'fluffy' }) : null
    }))
  }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' } })
}
