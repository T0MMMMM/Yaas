import { describe, expect, it, vi } from 'vitest'
import {
  ExternalUrlQueue,
  isDefaultBrowser,
  makeDefaultBrowser,
  openExternalUrl,
  urlFromArgv,
  type DefaultBrowserApi,
  type ExternalUrlHost,
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

describe('default browser registration', () => {
  function api(platform: NodeJS.Platform, isDefault = false): DefaultBrowserApi {
    let registered = isDefault
    return {
      platform,
      isDefaultProtocolClient: vi.fn((protocol: string) => protocol === 'https' && registered),
      setAsDefaultProtocolClient: vi.fn((protocol: string) => {
        if (protocol === 'https') registered = true
        return true
      }),
      openExternal: vi.fn(async () => undefined),
    }
  }

  it('checks https protocol status for isDefaultBrowser', () => {
    expect(isDefaultBrowser(api('darwin', false))).toBe(false)
    expect(isDefaultBrowser(api('darwin', true))).toBe(true)
  })

  it('registers http and https on macOS without opening Windows settings', async () => {
    const mac = api('darwin', false)
    const result = await makeDefaultBrowser(mac)
    expect(mac.setAsDefaultProtocolClient).toHaveBeenCalledWith('http')
    expect(mac.setAsDefaultProtocolClient).toHaveBeenCalledWith('https')
    expect(mac.openExternal).not.toHaveBeenCalled()
    expect(result).toEqual({ isDefault: true })
  })

  it('registers http and https on Windows and opens ms-settings:defaultapps', async () => {
    const win = api('win32', false)
    await makeDefaultBrowser(win)
    expect(win.setAsDefaultProtocolClient).toHaveBeenCalledWith('http')
    expect(win.setAsDefaultProtocolClient).toHaveBeenCalledWith('https')
    expect(win.openExternal).toHaveBeenCalledWith('ms-settings:defaultapps')
  })
})
