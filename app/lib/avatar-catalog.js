import v3 from './catalogs/v3.json' with { type: 'json' }
import v4 from './catalogs/v4.json' with { type: 'json' }

export const PICKER_VERSION = '4'

export function catalogForVersion(version) {
  if (version === '3') return v3
  if (version === '4') return v4
  return null
}

/** @param {{ formats: string[], styles: string[], variants?: { format: string, style: string }[] }} entry */
export function variantsFor(entry) {
  return entry.variants ?? entry.formats.flatMap(format => entry.styles.map(style => ({ format, style })))
}

export function supportsVariant(entry, format, style) {
  return variantsFor(entry).some(pair => pair.format === format && pair.style === style)
}

// Call only after catalog/variant validation; shared by the API, picker, and asset checks.
export function avatarFilename(id, format, style) {
  return `${id}${style === 'flat' ? '' : '-' + style}.${format}`
}
