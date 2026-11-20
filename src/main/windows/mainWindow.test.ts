import { describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'

// mainWindow.ts imports electron at load time; only the pure helper is under test here.
vi.mock('electron', () => ({ BrowserWindow: vi.fn(), shell: {} }))

import { inTopBand, setWindowControlsVisible, toggleMaximize } from './mainWindow'

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

describe('toggleMaximize', () => {
  function fakeFrame(maximized: boolean) {
    const maximize = vi.fn()
    const unmaximize = vi.fn()
    const win = { isMaximized: () => maximized, maximize, unmaximize } as unknown as BrowserWindow
    return { win, maximize, unmaximize }
  }

  it('maximizes a window that is not', () => {
    const { win, maximize, unmaximize } = fakeFrame(false)
    toggleMaximize(win)
    expect(maximize).toHaveBeenCalledOnce()
    expect(unmaximize).not.toHaveBeenCalled()
  })

  it('restores a maximized window', () => {
    const { win, maximize, unmaximize } = fakeFrame(true)
    toggleMaximize(win)
    expect(unmaximize).toHaveBeenCalledOnce()
    expect(maximize).not.toHaveBeenCalled()
  })
})

describe('inTopBand', () => {
  const bounds = { x: 100, y: 50, width: 800, height: 600 }

  it('is true across the whole width of the window, in its top band', () => {
    expect(inTopBand({ x: 100, y: 50 }, bounds, 32)).toBe(true)
    expect(inTopBand({ x: 899, y: 81 }, bounds, 32)).toBe(true)
  })

  it('is false below the band or beside the window', () => {
    expect(inTopBand({ x: 500, y: 82 }, bounds, 32)).toBe(false)
    expect(inTopBand({ x: 99, y: 60 }, bounds, 32)).toBe(false)
    expect(inTopBand({ x: 900, y: 60 }, bounds, 32)).toBe(false)
    expect(inTopBand({ x: 500, y: 49 }, bounds, 32)).toBe(false)
  })
})
