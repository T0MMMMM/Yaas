import { describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'

// mainWindow.ts imports electron at load time; only the pure helper is under test here.
vi.mock('electron', () => ({ BrowserWindow: vi.fn(), shell: {} }))

import { setWindowControlsVisible } from './mainWindow'

function fakeWindow() {
  const setWindowButtonVisibility = vi.fn()
  return {
    win: { setWindowButtonVisibility } as unknown as BrowserWindow,
    setWindowButtonVisibility,
  }
}

describe('setWindowControlsVisible', () => {
  it('toggles the traffic lights on macOS', () => {
    const { win, setWindowButtonVisibility } = fakeWindow()
    setWindowControlsVisible(win, false, 'darwin')
    setWindowControlsVisible(win, true, 'darwin')
    expect(setWindowButtonVisibility.mock.calls).toEqual([[false], [true]])
  })

  it.each(['win32', 'linux'] as const)('does nothing on %s', (platform) => {
    const { win, setWindowButtonVisibility } = fakeWindow()
    expect(() => setWindowControlsVisible(win, false, platform)).not.toThrow()
    expect(setWindowButtonVisibility).not.toHaveBeenCalled()
  })
})
