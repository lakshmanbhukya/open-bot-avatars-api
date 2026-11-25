import { createHash, randomUUID } from 'node:crypto'
import { avatarAsset } from '../../lib/avatar-assets.js'
import { catalogForVersion, supportsVariant, avatarFilename } from '../../lib/avatar-catalog.js'
import { GET as legacyAvatar } from '../../lib/legacy-avatar.js'
import { rateLimit } from '../../lib/rate-limit.js'

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
  const version = params.get('v')
  if (version !== null && !['1', '2', '3', '4'].includes(version)) return error('Version must be 1, 2, 3, or 4.')
  const modernOptions = ['collection', 'avatar', 'format', 'style'].some(key => params.has(key))
  if (version === '1' || version === '2' || (!version && seed !== null && !modernOptions)) {
    if (modernOptions) return error('Collection, avatar, format, and style require v=3 or v=4.')
    const response = legacyAvatar(request)
    for (const [key, value] of Object.entries(cors)) response.headers.set(key, value)
    return response
  }
  // Unversioned image URLs retain v3 selection and eligibility forever.
  const selectedVersion = version ?? '3'
  const catalog = catalogForVersion(selectedVersion)
  const catalogUrl = selectedVersion === '3' ? '/api/avatars' : `/api/avatars?v=${selectedVersion}`
  const collection = params.get('collection')
  if (collection !== null && !collections.includes(collection)) return error('Collection must be open-bot-avatar or bot-avatars.')
  const format = params.get('format') ?? 'png'
  if (!['png', 'svg'].includes(format)) return error('Format must be png or svg.')
  const style = params.get('style') ?? 'flat'
  if (!(selectedVersion === '4' ? ['flat', 'original', 'fluffy'] : ['flat', 'original']).includes(style)) return error(selectedVersion === '4' ? 'Style must be flat, original, or fluffy.' : 'Style must be flat or original.')
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
  } catch {
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
