// Default browser support: parsing http(s) URLs from OS launch arguments or open-url events,
// queueing URLs that arrive before the main window exists, and registering as the default handler.

export interface ExternalUrlHost {
  /** Opens `url` as a new today tab in the active space. */
  openTab: (url: string) => void
  /** Restores (if minimized) and focuses the browser window. */
  focusWindow: () => void
}

export interface DefaultBrowserApi {
  isDefaultProtocolClient: (protocol: string) => boolean
  setAsDefaultProtocolClient: (protocol: string) => boolean
  openExternal: (url: string) => Promise<void>
  platform: NodeJS.Platform
}

/** Returns the canonical http(s) URL when `raw` is a valid web URL, else null. */
export function parseExternalUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  try {
    const parsed = new URL(trimmed)
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
      return null
    }
    return parsed.href
  } catch {
    return null
  }
}

/**
 * First http(s) URL passed on the command line (Windows / Linux default-browser launch and
 * second-instance argv). Flags (`--…`) and file paths are never matched.
 */
export function urlFromArgv(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith('-')) continue
    const url = parseExternalUrl(arg)
    if (url) return url
  }
  return null
}

/** Opens an http(s) URL from another app in the active space and focuses the window. */
export function openExternalUrl(url: string, host: ExternalUrlHost): boolean {
  const parsed = parseExternalUrl(url)
  if (!parsed) return false
  host.openTab(parsed)
  host.focusWindow()
  return true
}

/**
 * Holds external URLs that arrive before the window exists (initial argv, macOS `open-url` before
 * `ready` or while all windows are closed) and opens each once when a window attaches.
 */
export class ExternalUrlQueue {
  private pending: string[] = []
  private host: ExternalUrlHost | null = null

  enqueue(url: string | null | undefined): boolean {
    const parsed = url ? parseExternalUrl(url) : null
    if (!parsed) return false
    if (this.host) return openExternalUrl(parsed, this.host)
    this.pending.push(parsed)
    return true
  }

  attach(host: ExternalUrlHost): void {
    this.host = host
    const queued = this.pending
    this.pending = []
    for (const url of queued) openExternalUrl(url, host)
  }

  detach(): void {
    this.host = null
  }
}

/** Whether Big Browser is currently the system's default handler for `https`. */
export function isDefaultBrowser(api: Pick<DefaultBrowserApi, 'isDefaultProtocolClient'>): boolean {
  return api.isDefaultProtocolClient('https')
}

/**
 * Registers Big Browser for `http` and `https`. On Windows, also opens the OS Default apps page
 * (Windows does not let apps claim http/https silently).
 */
export async function makeDefaultBrowser(api: DefaultBrowserApi): Promise<{ isDefault: boolean }> {
  api.setAsDefaultProtocolClient('http')
  api.setAsDefaultProtocolClient('https')
  if (api.platform === 'win32') {
    await api.openExternal('ms-settings:defaultapps').catch(() => undefined)
  }
  return { isDefault: isDefaultBrowser(api) }
}
