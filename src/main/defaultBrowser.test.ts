import { describe, expect, it, vi } from 'vitest'
import {
  ExternalUrlQueue,
  handleOpenUrl,
  handleSecondInstance,
  isDefaultBrowser,
  makeDefaultBrowser,
  openExternalUrl,
  parseWindowsUserChoiceProgId,
  protocolClientTarget,
  urlFromArgv,
  WINDOWS_CAPABILITIES_KEY,
  WINDOWS_CAPABILITIES_SUBKEY,
  WINDOWS_PROG_ID,
  WINDOWS_PROG_ID_KEY,
  WINDOWS_REGISTERED_APPS_KEY,
  WINDOWS_USER_CHOICE_KEY,
  windowsOpenCommand,
  windowsRegistrationCommands,
  type DefaultBrowserApi,
  type ExternalUrlHost,
  type ProtocolClientTarget,
} from './defaultBrowser'

describe('urlFromArgv', () => {
  it('returns the first http or https URL argument and ignores flags and file paths', () => {
    expect(
      urlFromArgv([
        'C:\\Program Files\\Big Browser\\Big Browser.exe',
        '--remote-debugging-port=9222',
        '--url=https://ignored.test/',
        'out/main/index.js',
        '/Users/me/file.html',
        'file:///etc/hosts',
        'mailto:a@b.test',
        'https://example.com/path?q=1',
        'https://second.test/',
      ]),
    ).toBe('https://example.com/path?q=1')

    expect(urlFromArgv(['electron', 'http://127.0.0.1:4321/a'])).toBe('http://127.0.0.1:4321/a')
  })

  it('returns null when no http(s) URL is present', () => {
    expect(urlFromArgv([])).toBeNull()
    expect(urlFromArgv(['electron', '--flag', 'index.js', 'javascript:alert(1)'])).toBeNull()
    expect(urlFromArgv(['https://'])).toBeNull()
  })
})

describe('openExternalUrl', () => {
  it('opens a web URL as a tab and focuses the window', () => {
    const host: ExternalUrlHost = { openTab: vi.fn(), focusWindow: vi.fn() }
    expect(openExternalUrl('https://example.com/a', host)).toBe(true)
    expect(host.openTab).toHaveBeenCalledWith('https://example.com/a')
    expect(host.focusWindow).toHaveBeenCalledOnce()
  })

  it('ignores non-web URLs without opening a tab or focusing', () => {
    const host: ExternalUrlHost = { openTab: vi.fn(), focusWindow: vi.fn() }
    for (const bad of [
      '',
      'file:///tmp/x',
      'mailto:a@b.test',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(openExternalUrl(bad, host)).toBe(false)
    }
    expect(host.openTab).not.toHaveBeenCalled()
    expect(host.focusWindow).not.toHaveBeenCalled()
  })
})

describe('ExternalUrlQueue', () => {
  it('queues URLs arriving before a window exists and flushes them once on attach', () => {
    const queue = new ExternalUrlQueue()
    expect(queue.enqueue('https://first.test/')).toBe(true)
    expect(queue.enqueue('file:///ignored')).toBe(false)
    expect(queue.enqueue('http://second.test/a')).toBe(true)

    const host: ExternalUrlHost = { openTab: vi.fn(), focusWindow: vi.fn() }
    queue.attach(host)
    expect(host.openTab).toHaveBeenNthCalledWith(1, 'https://first.test/')
    expect(host.openTab).toHaveBeenNthCalledWith(2, 'http://second.test/a')
    expect(host.focusWindow).toHaveBeenCalledTimes(2)

    // Subsequent URLs open immediately; re-attaching does not replay earlier ones.
    queue.enqueue('https://third.test/')
    expect(host.openTab).toHaveBeenCalledTimes(3)
    expect(host.openTab).toHaveBeenLastCalledWith('https://third.test/')

    queue.detach()
    queue.enqueue('https://after-close.test/')
    expect(host.openTab).toHaveBeenCalledTimes(3)
    queue.attach(host)
    expect(host.openTab).toHaveBeenCalledTimes(4)
    expect(host.openTab).toHaveBeenLastCalledWith('https://after-close.test/')
  })
})

describe('handleSecondInstance and handleOpenUrl', () => {
  it('second-instance opens a web URL once, focuses when no URL, and ignores non-web URLs', () => {
    const queue = new ExternalUrlQueue()
    const host: ExternalUrlHost = { openTab: vi.fn(), focusWindow: vi.fn() }
    queue.attach(host)
    const fallbackFocus = vi.fn()

    expect(handleSecondInstance(['exe', 'https://a.test/1'], queue, fallbackFocus)).toBe(true)
    expect(host.openTab).toHaveBeenCalledTimes(1)
    expect(host.openTab).toHaveBeenCalledWith('https://a.test/1')
    expect(host.focusWindow).toHaveBeenCalledTimes(1)
    expect(fallbackFocus).not.toHaveBeenCalled()

    // No URL: focuses the window without opening a tab.
    expect(handleSecondInstance(['exe', '--flag'], queue, fallbackFocus)).toBe(false)
    expect(host.openTab).toHaveBeenCalledTimes(1)
    expect(fallbackFocus).toHaveBeenCalledTimes(1)

    // Non-web URL: ignored (no tab opened), window still focused.
    expect(handleSecondInstance(['exe', 'file:///etc/passwd'], queue, fallbackFocus)).toBe(false)
    expect(host.openTab).toHaveBeenCalledTimes(1)
    expect(fallbackFocus).toHaveBeenCalledTimes(2)
  })

  it('open-url opens a web URL once, ensures a window exists, and ignores non-web URLs', () => {
    const queue = new ExternalUrlQueue()
    const host: ExternalUrlHost = { openTab: vi.fn(), focusWindow: vi.fn() }
    const ensureWindow = vi.fn(() => queue.attach(host))

    // Non-web URLs are ignored completely and never reopen a window.
    expect(handleOpenUrl('mailto:a@b.test', queue, ensureWindow)).toBe(false)
    expect(handleOpenUrl('file:///tmp/a', queue, ensureWindow)).toBe(false)
    expect(ensureWindow).not.toHaveBeenCalled()
    expect(host.openTab).not.toHaveBeenCalled()

    // Web URL while detached: queued, then opened once when ensureWindow attaches the window.
    expect(handleOpenUrl('https://b.test/2', queue, ensureWindow)).toBe(true)
    expect(ensureWindow).toHaveBeenCalledTimes(1)
    expect(host.openTab).toHaveBeenCalledTimes(1)
    expect(host.openTab).toHaveBeenCalledWith('https://b.test/2')
    expect(host.focusWindow).toHaveBeenCalledTimes(1)
  })
})

describe('protocolClientTarget and Windows registry helpers', () => {
  it('resolves argv[1] in dev mode and omits args when packaged', () => {
    const dev = protocolClientTarget(
      '/path/electron',
      ['/path/electron', 'out/main/index.js'],
      true,
      (p) => `/abs/${p}`,
    )
    expect(dev).toEqual({
      execPath: '/path/electron',
      args: ['/abs/out/main/index.js'],
      defaultApp: true,
    })

    const prod = protocolClientTarget('/app/Big Browser', ['/app/Big Browser'], false)
    expect(prod).toEqual({ execPath: '/app/Big Browser', args: [], defaultApp: false })
  })

  it('builds quoted Windows open command for packaged and dev launches', () => {
    expect(
      windowsOpenCommand({
        execPath: 'C:\\Program Files\\Big Browser\\Big Browser.exe',
        args: [],
        defaultApp: false,
      }),
    ).toBe('"C:\\Program Files\\Big Browser\\Big Browser.exe" "%1"')

    expect(
      windowsOpenCommand({
        execPath: 'C:\\repo\\electron.exe',
        args: ['C:\\repo\\out\\main\\index.js'],
        defaultApp: true,
      }),
    ).toBe('"C:\\repo\\electron.exe" "C:\\repo\\out\\main\\index.js" "%1"')
  })

  it('builds the HKCU ProgId, Capabilities, URLAssociations, and RegisteredApplications commands', () => {
    const target: ProtocolClientTarget = {
      execPath: 'C:\\Program Files\\Big Browser\\Big Browser.exe',
      args: [],
      defaultApp: false,
    }
    const cmds = windowsRegistrationCommands(target)
    expect(cmds).toEqual([
      ['add', WINDOWS_PROG_ID_KEY, '/ve', '/t', 'REG_SZ', '/d', 'Big Browser URL', '/f'],
      ['add', WINDOWS_PROG_ID_KEY, '/v', 'URL Protocol', '/t', 'REG_SZ', '/d', '', '/f'],
      [
        'add',
        `${WINDOWS_PROG_ID_KEY}\\shell\\open\\command`,
        '/ve',
        '/t',
        'REG_SZ',
        '/d',
        '"C:\\Program Files\\Big Browser\\Big Browser.exe" "%1"',
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
        'Big Browser',
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
        'A web browser you customize with your own AI',
        '/f',
      ],
      [
        'add',
        `${WINDOWS_CAPABILITIES_KEY}\\URLAssociations`,
        '/v',
        'http',
        '/t',
        'REG_SZ',
        '/d',
        WINDOWS_PROG_ID,
        '/f',
      ],
      [
        'add',
        `${WINDOWS_CAPABILITIES_KEY}\\URLAssociations`,
        '/v',
        'https',
        '/t',
        'REG_SZ',
        '/d',
        WINDOWS_PROG_ID,
        '/f',
      ],
      [
        'add',
        WINDOWS_REGISTERED_APPS_KEY,
        '/v',
        'Big Browser',
        '/t',
        'REG_SZ',
        '/d',
        WINDOWS_CAPABILITIES_SUBKEY,
        '/f',
      ],
    ])
  })

  it('parses ProgId from reg query UserChoice output', () => {
    const real =
      '\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice\r\n' +
      '    ProgId    REG_SZ    FirefoxURL-F0DC299D809B9700\r\n\r\n'
    expect(parseWindowsUserChoiceProgId(real)).toBe('FirefoxURL-F0DC299D809B9700')
    expect(parseWindowsUserChoiceProgId('    ProgId    REG_SZ    BigBrowserURL\n')).toBe(
      'BigBrowserURL',
    )
    expect(parseWindowsUserChoiceProgId('ERROR: The system was unable to find the key.')).toBeNull()
  })
})

describe('default browser registration', () => {
  function api(
    platform: NodeJS.Platform,
    options: {
      isDefault?: boolean
      target?: ProtocolClientTarget
      regOutput?: string | Error
    } = {},
  ): DefaultBrowserApi {
    let registered = options.isDefault ?? false
    const target: ProtocolClientTarget = options.target ?? {
      execPath:
        platform === 'win32'
          ? 'C:\\Program Files\\Big Browser\\Big Browser.exe'
          : '/Applications/Big Browser.app/Contents/MacOS/Big Browser',
      args: [],
      defaultApp: false,
    }
    return {
      platform,
      target,
      isDefaultProtocolClient: vi.fn((protocol: string) => protocol === 'https' && registered),
      setAsDefaultProtocolClient: vi.fn((protocol: string) => {
        if (protocol === 'https') registered = true
        return true
      }),
      runReg: vi.fn(async (args: string[]) => {
        if (args[0] === 'query') {
          if (options.regOutput instanceof Error) throw options.regOutput
          return options.regOutput ?? ''
        }
        return ''
      }),
      openExternal: vi.fn(async () => undefined),
    }
  }

  it('checks https protocol status on macOS (passing exe and entry in dev mode)', async () => {
    expect(await isDefaultBrowser(api('darwin', { isDefault: false }))).toBe(false)
    expect(await isDefaultBrowser(api('darwin', { isDefault: true }))).toBe(true)

    const dev = api('darwin', {
      isDefault: true,
      target: { execPath: '/bin/electron', args: ['/repo/out/main/index.js'], defaultApp: true },
    })
    expect(await isDefaultBrowser(dev)).toBe(true)
    expect(dev.isDefaultProtocolClient).toHaveBeenCalledWith('https', '/bin/electron', [
      '/repo/out/main/index.js',
    ])
  })

  it('registers http and https on macOS (including dev mode args) without opening Windows settings', async () => {
    const mac = api('darwin', { isDefault: false })
    const result = await makeDefaultBrowser(mac)
    expect(mac.setAsDefaultProtocolClient).toHaveBeenCalledWith('http')
    expect(mac.setAsDefaultProtocolClient).toHaveBeenCalledWith('https')
    expect(mac.openExternal).not.toHaveBeenCalled()
    expect(result).toEqual({ isDefault: true })

    const macDev = api('darwin', {
      isDefault: false,
      target: { execPath: '/bin/electron', args: ['/repo/out/main/index.js'], defaultApp: true },
    })
    await makeDefaultBrowser(macDev)
    expect(macDev.setAsDefaultProtocolClient).toHaveBeenCalledWith('http', '/bin/electron', [
      '/repo/out/main/index.js',
    ])
    expect(macDev.setAsDefaultProtocolClient).toHaveBeenCalledWith('https', '/bin/electron', [
      '/repo/out/main/index.js',
    ])
  })

  it('reads Windows status from UserChoice ProgId and returns false for another browser or missing key', async () => {
    const other = api('win32', {
      regOutput: '    ProgId    REG_SZ    ChromeHTML\r\n',
    })
    expect(await isDefaultBrowser(other)).toBe(false)
    expect(other.runReg).toHaveBeenCalledWith(['query', WINDOWS_USER_CHOICE_KEY, '/v', 'ProgId'])
    expect(other.isDefaultProtocolClient).not.toHaveBeenCalled()

    const ours = api('win32', {
      regOutput: `    ProgId    REG_SZ    ${WINDOWS_PROG_ID}\r\n`,
    })
    expect(await isDefaultBrowser(ours)).toBe(true)

    const missing = api('win32', { regOutput: new Error('not found') })
    expect(await isDefaultBrowser(missing)).toBe(false)
  })

  it('registers HKCU keys on Windows, opens ms-settings:defaultapps, and stays false until UserChoice changes', async () => {
    const win = api('win32', {
      regOutput: '    ProgId    REG_SZ    MSEdgeHTM\r\n',
    })
    const result = await makeDefaultBrowser(win)
    expect(win.runReg).toHaveBeenCalledWith([
      'add',
      WINDOWS_REGISTERED_APPS_KEY,
      '/v',
      'Big Browser',
      '/t',
      'REG_SZ',
      '/d',
      WINDOWS_CAPABILITIES_SUBKEY,
      '/f',
    ])
    expect(win.openExternal).toHaveBeenCalledWith('ms-settings:defaultapps')
    expect(result).toEqual({ isDefault: false })
  })
})
