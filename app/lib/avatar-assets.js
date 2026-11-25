import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Only validated versioned catalog filenames reach this bounded asset cache.
const assets = new Map()

export async function avatarAsset(collection, filename, version = '3') {
  const key = `${version}/${collection}/${filename}`
  let asset = assets.get(key)
  if (!asset) {
    asset = readFile(path.join(process.cwd(), 'public', 'avatars', `v${version}`, collection, filename))
      .then(data => ({ data, etag: '"' + createHash('sha256').update(data).digest('hex') + '"' }))
      .catch(error => {
        assets.delete(key)
        throw error
      })
    assets.set(key, asset)
  }
  return asset
}
