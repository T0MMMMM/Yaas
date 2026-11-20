import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakeSession = {
  clearStorageData: vi.fn(() => Promise.resolve()),
  clearCache: vi.fn(() => Promise.resolve()),
  setUserAgent: vi.fn(),
  getUserAgent: () => 'UA',
  setPermissionRequestHandler: vi.fn(),
  setPermissionCheckHandler: vi.fn(),
  registerPreloadScript: vi.fn(),
  extensions: { loadExtension: vi.fn() },
}
const destroy = vi.fn()

vi.mock('electron', () => ({
  dialog: {},
  session: { fromPartition: vi.fn(() => fakeSession) },
}))
vi.mock('electron-chrome-extensions', () => ({
  ElectronChromeExtensions: vi.fn(function () {
    return { destroy }
  }),
}))
vi.mock('electron-chrome-web-store', () => ({
  installChromeWebStore: vi.fn(() => Promise.resolve()),
}))

import { SpaceSessions } from './spaceSessions'

describe('SpaceSessions.wipe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clears the space session and drops its extensions', async () => {
    const sessions = new SpaceSessions({
      userData: 'u',
      mirrorPreload: 'm',
      autoUpdate: false,
      host: { openTab: vi.fn(), selectTab: vi.fn(), closeTab: vi.fn(), window: () => null },
    })
    sessions.get('s1')
    expect(sessions.extensionsFor('s1')).not.toBeNull()
    await sessions.wipe('s1')
    expect(fakeSession.clearStorageData).toHaveBeenCalledOnce()
    expect(fakeSession.clearCache).toHaveBeenCalledOnce()
    expect(sessions.extensionsFor('s1')).toBeNull()
  })
})
