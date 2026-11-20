// A page's favicon as the UI shows it: a `data:` URL, so the UI's CSP never has to allow the web.

/** Larger favicon responses are ignored (no icon rather than an oversized row). */
export const FAVICON_MAX_BYTES = 64 * 1024

/** The favicon as a `data:` URL, or null when the response is not an image or is empty or too big. */
export function faviconDataUrl(contentType: string, bytes: Uint8Array): string | null {
  const mediaType = (contentType.split(';')[0] ?? '').trim().toLowerCase()
  if (!/^image\/[a-z0-9.+-]+$/.test(mediaType)) return null
  if (bytes.length === 0 || bytes.length > FAVICON_MAX_BYTES) return null
  return `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`
}
