/**
 * Byte sizes shared by the server (STORAGE_LIMIT, quota checks) and the UI
 * (storage meter), so both read and print sizes the same way.
 *
 * Decimal units (KB, MB, GB, TB = powers of 1000) match how storage providers
 * bill and how disks are sold; binary units (KiB, MiB, GiB, TiB) are accepted
 * for people who think in those.
 */
const UNITS: Record<string, number> = {
  b: 1,
  kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12,
  kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4,
}

/** Parses "10GB", "500 MB", "1.5GiB", or a plain byte count. Returns null for anything else. */
export function parseByteSize(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') return Number.isSafeInteger(input) && input > 0 ? input : null
  const match = /^\s*(\d+(?:\.\d+)?)\s*([a-z]*)\s*$/i.exec(input)
  if (!match) return null
  const unit = (match[2] || 'b').toLowerCase()
  const factor = UNITS[unit]
  if (!factor) return null
  const bytes = Math.round(Number(match[1]) * factor)
  return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : null
}

/** Formats bytes with decimal units, e.g. 1234567 -> "1.2 MB". */
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3))
  const value = bytes / 1000 ** index
  return `${index === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[index]}`
}
