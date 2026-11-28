import { createHash, randomUUID } from 'node:crypto'
import { avatarAsset } from '../../lib/avatar-assets.js'
import { catalogForVersion, PICKER_VERSION, supportsVariant, avatarFilename } from '../../lib/avatar-catalog.js'
import { rateLimit } from '../../lib/rate-limit.js'
import { reportFailure } from '../../lib/diagnostics.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Location, X-Avatar-Collection, X-Avatar-Id, ETag'
}
const allowed = new Set(['v', 'seed', 'collection', 'avatar', 'format', 'style'])
const collections = ['open-bot-avatar', 'bot-avatars']

export async function GET(request) {
  const limited = await rateLimit(request)
  if (limited) return limited
  const params = new URL(request.url).searchParams
  function error(message) {
    return Response.json({ error: message }, { status: 400, headers: { ...cors, 'Cache-Control': 'no-store' } })
  }
  for (const key of params.keys()) {
    if (!allowed.has(key)) return error('Unknown parameter: ' + key)
    if (params.getAll(key).length !== 1) return error('Provide only one ' + key + '.')
  }
  const seed = params.get('seed')
  if (seed !== null && (!seed || seed.length > 128)) return error('Provide one seed of 1 to 128 characters.')
  const selectedVersion = params.get('v') ?? PICKER_VERSION
  const catalog = catalogForVersion(selectedVersion)
  if (!catalog) return error('Version must be 5.')
  const catalogUrl = `/api/avatars?v=${selectedVersion}`
  const collection = params.get('collection')
  if (collection !== null && !collections.includes(collection)) return error('Collection must be open-bot-avatar or bot-avatars.')
  const format = params.get('format') ?? 'png'
  if (!['png', 'svg'].includes(format)) return error('Format must be png or svg.')
  const style = params.get('style') ?? 'flat'
  if (!['flat', 'original', 'fluffy'].includes(style)) return error('Style must be flat, original, or fluffy.')
  const id = params.get('avatar')
  if (id !== null && !collection) return error('Provide a collection when selecting an avatar.')
  if (id !== null && seed !== null) return error('Choose an avatar or a seed, not both.')
  let candidates = catalog.filter(entry => !collection || entry.collection === collection)
  if (id !== null) candidates = candidates.filter(entry => entry.id === id)
  if (!candidates.length) return error(`Unknown avatar in this collection. See ${catalogUrl}.`)
  candidates = candidates.filter(entry => supportsVariant(entry, format, style))
  if (!candidates.length) return error(`This collection or avatar does not support that format/style. See ${catalogUrl}.`)
  const random = seed === null && id === null
  const bytes = createHash('sha256').update(seed ?? randomUUID()).digest()
  const entry = candidates[id !== null ? 0 : bytes.readUInt32BE() % candidates.length]
  const query = new URLSearchParams({ v: selectedVersion, collection: entry.collection, avatar: entry.id, format, style })
  const file = avatarFilename(entry.id, format, style)
  let asset
  try {
    asset = await avatarAsset(entry.collection, file, selectedVersion)
  } catch (error) {
    reportFailure('image-asset', error?.code === 'ENOENT' ? 'missing-file' : 'read-failure')
    return Response.json({ error: 'This avatar is temporarily unavailable. Please try again shortly.' }, {
      status: 503, headers: { ...cors, 'Access-Control-Expose-Headers': 'Retry-After', 'Cache-Control': 'no-store', 'Retry-After': '5' }
    })
  }
  const { data, etag } = asset
  const headers = {
    ...cors,
    'Content-Type': format === 'svg' ? 'image/svg+xml; charset=utf-8' : 'image/png',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': random ? 'no-store' : 'public, max-age=86400',
    'Content-Location': '/api/avatar?' + query,
    'X-Avatar-Collection': entry.collection,
    'X-Avatar-Id': entry.id,
    ETag: etag
  }
  if (!random && request.headers.get('if-none-match')?.split(',').some(value => value.trim().replace(/^W\//, '') === etag || value.trim() === '*')) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(data, { headers })
}
