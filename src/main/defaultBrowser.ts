// Default browser support: parsing http(s) URLs from OS launch arguments or open-url events,
// queueing URLs that arrive before the main window exists, handling second-instance / open-url,
// and registering/checking default-browser status on macOS, Windows (UserChoice + HKCU
// Capabilities / RegisteredApplications), and Linux.
import { resolve } from 'node:path'

export const WINDOWS_PROG_ID = 'BigBrowserURL'
export const WINDOWS_USER_CHOICE_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice'
export const WINDOWS_PROG_ID_KEY = `HKCU\\Software\\Classes\\${WINDOWS_PROG_ID}`
export const WINDOWS_CAPABILITIES_SUBKEY = 'Software\\BigBrowser\\Capabilities'
export const WINDOWS_CAPABILITIES_KEY = `HKCU\\${WINDOWS_CAPABILITIES_SUBKEY}`
export const WINDOWS_REGISTERED_APPS_KEY = 'HKCU\\Software\\RegisteredApplications'
export const WINDOWS_APP_NAME = 'Big Browser'
export const WINDOWS_APP_DESCRIPTION = 'A web browser you customize with your own AI'

export interface ExternalUrlHost {
  /** Opens `url` as a new today tab in the active space. */
  openTab: (url: string) => void
  /** Restores (if minimized) and focuses the browser window. */
  focusWindow: () => void
}

export interface ProtocolClientTarget {
  execPath: string
  /** Extra launch args (`[resolve(argv[1])]` in Electron dev mode, empty when packaged). */
  args: string[]
  /** Whether running under Electron dev mode (`process.defaultApp`) with an entry script. */
  defaultApp: boolean
}

export interface DefaultBrowserApi {
  platform: NodeJS.Platform
  target: ProtocolClientTarget
  isDefaultProtocolClient: (protocol: string, path?: string, args?: string[]) => boolean
  setAsDefaultProtocolClient: (protocol: string, path?: string, args?: string[]) => boolean
  /** Runs `reg.exe` with argv (no shell) and resolves to stdout. Used on Windows only. */
  runReg: (args: string[]) => Promise<string>
  openExternal: (url: string) => Promise<void>
}

/** Computes the exe and entry script for protocol registration (dev mode vs packaged). */
export function protocolClientTarget(
  execPath: string,
  argv: readonly string[],
  defaultApp: boolean,
  resolvePath: (p: string) => string = resolve,
): ProtocolClientTarget {
  const entry = defaultApp && argv.length >= 2 && argv[1] ? [resolvePath(argv[1])] : []
  return { execPath, args: entry, defaultApp: entry.length > 0 }
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

/**
 * Handles Electron's `second-instance` event: opens the first http(s) URL in `argv` (which also
 * focuses the window), or focuses the window when no web URL was passed.
 */
export function handleSecondInstance(
  argv: readonly string[],
  queue: ExternalUrlQueue,
  focusWindow: () => void,
): boolean {
  const url = urlFromArgv(argv)
  if (url) return queue.enqueue(url)
  focusWindow()
  return false
}

/**
 * Handles macOS `open-url`: queues/opens an http(s) URL (ignoring non-web URLs) and asks the
 * caller to ensure a window exists when accepted.
 */
export function handleOpenUrl(
  url: string,
  queue: ExternalUrlQueue,
  ensureWindow: () => void,
): boolean {
  if (!queue.enqueue(url)) return false
  ensureWindow()
  return true
}

/** Quotes an argument for a Windows `shell\open\command` string. */
const quoteWinArg = (arg: string): string => `"${arg.replace(/"/g, '')}"`

/** Builds the Windows `shell\open\command` value (`"<exe>" ["<entry>"] "%1"`). */
export function windowsOpenCommand(target: ProtocolClientTarget): string {
  return [...[target.execPath, ...target.args].map(quoteWinArg), '"%1"'].join(' ')
}

/**
 * `reg.exe` argument lists registering Big Browser under HKCU (ProgId, Capabilities with
 * URLAssociations for http/https, and RegisteredApplications) so Windows Default apps lists it.
 */
export function windowsRegistrationCommands(target: ProtocolClientTarget): string[][] {
  const openCommand = windowsOpenCommand(target)
  const associationsKey = `${WINDOWS_CAPABILITIES_KEY}\\URLAssociations`
  return [
    ['add', WINDOWS_PROG_ID_KEY, '/ve', '/t', 'REG_SZ', '/d', 'Big Browser URL', '/f'],
    ['add', WINDOWS_PROG_ID_KEY, '/v', 'URL Protocol', '/t', 'REG_SZ', '/d', '', '/f'],
    [
      'add',
      `${WINDOWS_PROG_ID_KEY}\\shell\\open\\command`,
      '/ve',
      '/t',
      'REG_SZ',
      '/d',
      openCommand,
      '/f',
    ],
    [
      'add',
      WINDOWS_CAPABILITIES_KEY,
      '/v',
      'ApplicationName',
      '/t',
      'REG_SZ',
      '/d',
      WINDOWS_APP_NAME,
      '/f',
    ],
    [
      'add',
      WINDOWS_CAPABILITIES_KEY,
      '/v',
      'ApplicationDescription',
      '/t',
      'REG_SZ',
      '/d',
      WINDOWS_APP_DESCRIPTION,
      '/f',
    ],
    ['add', associationsKey, '/v', 'http', '/t', 'REG_SZ', '/d', WINDOWS_PROG_ID, '/f'],
    ['add', associationsKey, '/v', 'https', '/t', 'REG_SZ', '/d', WINDOWS_PROG_ID, '/f'],
    [
      'add',
      WINDOWS_REGISTERED_APPS_KEY,
      '/v',
      WINDOWS_APP_NAME,
      '/t',
      'REG_SZ',
      '/d',
      WINDOWS_CAPABILITIES_SUBKEY,
      '/f',
    ],
  ]
}

/** Parses the `ProgId` value from `reg query ...\https\UserChoice /v ProgId` output. */
export function parseWindowsUserChoiceProgId(output: string): string | null {
  const match = /^\s*ProgId\s+REG_\w+\s+(\S+)\s*$/im.exec(output)
  return match?.[1] ?? null
}

/**
 * Whether Big Browser is currently the system's default handler for `https`. On Windows this reads
 * `UserChoice\ProgId` from HKCU rather than Electron's legacy `Software\Classes\https` check.
 */
export async function isDefaultBrowser(
  api: Pick<DefaultBrowserApi, 'platform' | 'target' | 'isDefaultProtocolClient' | 'runReg'>,
): Promise<boolean> {
  if (api.platform === 'win32') {
    try {
      const stdout = await api.runReg(['query', WINDOWS_USER_CHOICE_KEY, '/v', 'ProgId'])
      const progId = parseWindowsUserChoiceProgId(stdout)
      return progId !== null && progId.toLowerCase() === WINDOWS_PROG_ID.toLowerCase()
    } catch {
      return false
    }
  }
  return api.target.defaultApp
    ? api.isDefaultProtocolClient('https', api.target.execPath, api.target.args)
    : api.isDefaultProtocolClient('https')
}

/**
 * Registers Big Browser for `http` and `https`. On Windows, registers HKCU ProgId, Capabilities,
 * and RegisteredApplications so Default apps lists Big Browser, then opens
 * `ms-settings:defaultapps`.
 */
export async function makeDefaultBrowser(api: DefaultBrowserApi): Promise<{ isDefault: boolean }> {
  if (api.platform === 'win32') {
    for (const args of windowsRegistrationCommands(api.target)) {
      await api.runReg(args).catch(() => undefined)
    }
    await api.openExternal('ms-settings:defaultapps').catch(() => undefined)
  } else if (api.target.defaultApp) {
    api.setAsDefaultProtocolClient('http', api.target.execPath, api.target.args)
    api.setAsDefaultProtocolClient('https', api.target.execPath, api.target.args)
  } else {
    api.setAsDefaultProtocolClient('http')
    api.setAsDefaultProtocolClient('https')
  }
  return { isDefault: await isDefaultBrowser(api) }
}
