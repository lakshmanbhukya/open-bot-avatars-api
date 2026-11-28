export const SITE_URL = 'https://open-bot-avatars-api.vercel.app'

export function siteOrigin(currentOrigin) {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || currentOrigin || SITE_URL)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Public site URL must be an HTTP(S) origin without credentials')
  }
  return url.origin
}
