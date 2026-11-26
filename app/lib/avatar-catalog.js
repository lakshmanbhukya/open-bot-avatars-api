import v5 from './catalogs/v5.json' with { type: 'json' }

export const PICKER_VERSION = '5'

export function catalogForVersion(version) {
  if (version === '5') return v5
  return null
}

/** @param {{ formats: string[], styles: string[], variants: { format: string, style: string }[] }} entry */
export function variantsFor(entry) {
  return entry.variants
}

export function supportsVariant(entry, format, style) {
  return variantsFor(entry).some(pair => pair.format === format && pair.style === style)
}

// Call only after catalog/variant validation; shared by the API, picker, and asset checks.
export function avatarFilename(id, format, style) {
  return `${id}${style === 'flat' ? '' : '-' + style}.${format}`
}
