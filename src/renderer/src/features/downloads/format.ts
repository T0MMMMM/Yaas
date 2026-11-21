const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** A byte count for people: `812 B`, `1.4 MB`. */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000
    unit++
  }
  const text = unit === 0 || value >= 10 ? String(Math.round(value)) : value.toFixed(1)
  return `${text} ${UNITS[unit]}`
}

/** The share of a download received, 0 to 1; null while its size is unknown. */
export function fraction(receivedBytes: number, totalBytes: number): number | null {
  return totalBytes > 0 ? Math.min(1, receivedBytes / totalBytes) : null
}
