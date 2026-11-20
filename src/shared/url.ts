// Pure URL helpers for the address bar. Bundled into the renderer, so this
// file uses only the global URL API (no Node or Electron imports).

export const DEFAULT_SEARCH = 'https://www.google.com/search?q=%s'

const ABOUT_BLANK = 'about:blank'
const HTTP_URL = /^https?:\/\//i
// A bare host: localhost, an IPv4 address, or a dotted domain, with an
// optional port and an optional path, query or fragment.
const BARE_HOST =
  /^(localhost|\d{1,3}(?:\.\d{1,3}){3}|[a-z0-9-]+(?:\.[a-z0-9-]+)+)(:\d+)?([/?#].*)?$/i
const LOCAL_HOST = /^(localhost|\d{1,3}(?:\.\d{1,3}){3})(?::|\/|\?|#|$)/i

function search(text: string, template: string): string {
  return template.replace('%s', encodeURIComponent(text))
}

/** Turns what the user typed in the address bar into a navigable URL. */
export function resolveInput(text: string, searchTemplate: string = DEFAULT_SEARCH): string {
  const input = text.trim()
  if (input === ABOUT_BLANK) return ABOUT_BLANK

  if (HTTP_URL.test(input)) {
    try {
      return new URL(input).href
    } catch {
      return search(input, searchTemplate)
    }
  }

  if (BARE_HOST.test(input)) {
    const scheme = LOCAL_HOST.test(input) ? 'http://' : 'https://'
    try {
      return new URL(scheme + input).href
    } catch {
      return search(input, searchTemplate)
    }
  }

  return search(input, searchTemplate)
}

/** Splits a URL for display: the host is shown bright, the path dimmed. */
export function displayUrl(url: string): { host: string; rest: string } {
  const empty = { host: '', rest: '' }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return empty
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return empty

  const host = parsed.host.replace(/^www\./i, '')
  const rest = `${parsed.pathname}${parsed.search}${parsed.hash}`
  return { host, rest: rest === '/' ? '' : rest }
}

/** The lower-cased hostname of an http(s) URL, else null. */
export function hostOf(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? hostname.toLowerCase() : null
  } catch {
    return null
  }
}
