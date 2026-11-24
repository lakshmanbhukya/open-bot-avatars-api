import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Only validated catalog filenames reach this cache: at most 82 published images.
const assets = new Map()

export async function avatarAsset(collection, filename) {
  const key = `${collection}/${filename}`
  let asset = assets.get(key)
  if (!asset) {
    asset = readFile(path.join(process.cwd(), 'public', 'avatars', 'v3', collection, filename))
      .then(data => ({ data, etag: '"' + createHash('sha256').update(data).digest('hex') + '"' }))
      .catch(error => {
        assets.delete(key)
        throw error
      })
    assets.set(key, asset)
  }
  return asset
}
