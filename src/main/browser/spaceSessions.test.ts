import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakeSession = {
  clearStorageData: vi.fn(() => Promise.resolve()),
  clearCache: vi.fn(() => Promise.resolve()),
  setUserAgent: vi.fn(),
  getUserAgent: () => 'UA',
  setPermissionRequestHandler: vi.fn(),
  setPermissionCheckHandler: vi.fn(),
  registerPreloadScript: vi.fn(),
  extensions: {
    loadExtension: vi.fn(),
    getAllExtensions: vi.fn(() => [{ id: 'ext-a' }, { id: 'ext-b' }]),
    removeExtension: vi.fn(),
  },
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

import { join, resolve } from 'node:path'
import { SpaceSessions } from './spaceSessions'

describe('SpaceSessions.wipe', () => {
  beforeEach(() => vi.clearAllMocks())

  const removeDir = vi.fn((_path: string) => Promise.resolve())
  const make = () =>
    new SpaceSessions({
      userData: 'u',
      mirrorPreload: 'm',
      autoUpdate: false,
      host: { openTab: vi.fn(), selectTab: vi.fn(), closeTab: vi.fn(), window: () => null },
      removeDir,
    })

  it('clears the space session and drops its extensions', async () => {
    const sessions = make()
    sessions.get('s1')
    expect(sessions.extensionsFor('s1')).not.toBeNull()
    await sessions.wipe('s1')
    expect(fakeSession.clearStorageData).toHaveBeenCalledOnce()
    expect(fakeSession.clearCache).toHaveBeenCalledOnce()
    expect(sessions.extensionsFor('s1')).toBeNull()
  })

  it('unloads its extensions, so their workers stop and nothing is left to update', async () => {
    const sessions = make()
    sessions.get('s1')
    await sessions.wipe('s1')
    expect(fakeSession.extensions.removeExtension.mock.calls).toEqual([['ext-a'], ['ext-b']])
  })

  it('deletes its extensions from disk', async () => {
    const sessions = make()
    await sessions.wipe('3f2a-uuid')
    expect(removeDir).toHaveBeenCalledWith(resolve(join('u', 'extensions', '3f2a-uuid')))
  })

  it('never deletes outside the extensions folder', async () => {
    const sessions = make()
    for (const id of ['', '.', '..', '../other', 'a/../..']) await sessions.wipe(id)
    expect(removeDir).not.toHaveBeenCalled()
  })
})
