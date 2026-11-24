import { createHash, randomUUID } from 'node:crypto'
import { examples, renderAvatarSvg } from 'open-bot-avatar'
import library from '../api/avatar/libraries.json' with { type: 'json' }

export const dynamic = 'force-dynamic'

const colors = ['#ff7848', '#8d80ff', '#5acaa6', '#ffb930', '#e985b3', '#65aefa']

function librarySvg({ name, color, path, x, y, scale }, bytes) {
  const tilt = (bytes[3] / 255 - 0.5) * 12
  const eyes = bytes[2] % 2
    ? '<path d="M-12 1q3-6 6 0m12 0q3-6 6 0" fill="none" stroke="#242434" stroke-width="3" stroke-linecap="round"/>'
    : '<g fill="#242434"><ellipse cx="-8" rx="2.8" ry="5.5"/><ellipse cx="8" rx="2.8" ry="5.5"/></g>'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512" role="img" aria-label="${name}">
    <title>${name}</title><metadata>${library.source}\n${library.license}</metadata>
    <g transform="rotate(${tilt} 50 50)"><path fill="${color}" d="${path}"/>
    <g transform="translate(${x} ${y}) scale(${scale})"><g data-eyes="">${eyes}</g></g></g></svg>`
}

export function GET(request) {
  const params = new URL(request.url).searchParams
  const seeds = params.getAll('seed')
  if (seeds.length > 1 || (seeds.length && (!seeds[0] || seeds[0].length > 128))) {
    return new Response('Provide one seed of 1 to 128 characters.', { status: 400 })
  }
  const seed = seeds[0] ?? randomUUID()
  const bytes = createHash('sha256').update(seed).digest()
  // Older saved profile URLs use the original seven-shape mapping.
  const expanded = !seeds.length || params.get('v') === '2'
  const index = expanded
    ? bytes.readUInt32BE() % (examples.length + library.shapes.length)
    : bytes[0] % examples.length
  const location = new URLSearchParams({ seed })
  if (expanded) location.set('v', '2')
  const svg = index >= examples.length
    ? librarySvg(library.shapes[index - examples.length], bytes)
    : renderAvatarSvg(examples[index], {
    size: 512,
    color: colors[bytes[1] % colors.length],
    mood: bytes[2] % 2 ? 'happy' : 'neutral',
    view: { yaw: (bytes[3] / 255 - 0.5) * 0.65, pitch: (bytes[4] / 255 - 0.5) * 0.35 }
  })
  return new Response(svg, { headers: {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': seeds.length ? 'public, max-age=86400' : 'no-store',
    'Content-Location': '/api/avatar?' + location,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Location'
  } })
}

