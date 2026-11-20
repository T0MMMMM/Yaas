import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { Tooltip } from '@shared/ipc/contract'

/** The one fake view the OverlayView under test creates. */
const fake = vi.hoisted(() => ({
  view: null as null | {
    setVisible: ReturnType<typeof vi.fn>
    setBounds: ReturnType<typeof vi.fn>
    webContents: {
      send: ReturnType<typeof vi.fn>
      focus: ReturnType<typeof vi.fn>
    }
  },
}))

vi.mock('electron', () => {
  class WebContentsView {
    setVisible = vi.fn()
    setBounds = vi.fn()
    setBackgroundColor = vi.fn()
    webContents = {
      send: vi.fn(),
      focus: vi.fn(),
      isFocused: () => false,
      isDestroyed: () => false,
      isLoading: () => false,
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      loadURL: () => Promise.resolve(),
      close: vi.fn(),
    }
    constructor() {
      fake.view = this
    }
  }
  return { WebContentsView, ipcMain: {} }
})

import { OverlayView, TOOLTIP_FADE_MS, TOOLTIP_STRIP_W, tooltipBounds } from './overlayView'

const WINDOW = { width: 1000, height: 700 }

function setup() {
  const win = {
    contentView: { addChildView: vi.fn() },
    getContentSize: () => [WINDOW.width, WINDOW.height],
    on: vi.fn(),
    webContents: { focus: vi.fn() },
  }
  const overlay = new OverlayView(win as unknown as BrowserWindow, 'preload.js', 'http://ui')
  const view = fake.view
  if (!view) throw new Error('no view')
  view.setVisible.mockClear()
  view.setBounds.mockClear()
  return { overlay, view }
}

const tip: Tooltip = {
  anchor: { x: 0, y: 100, width: 240, height: 38 },
  title: 'Page A',
  detail: 'example.com',
}
const sent = (view: ReturnType<typeof setup>['view'], channel: string) =>
  view.webContents.send.mock.calls.filter(([c]) => c === channel).map(([, payload]) => payload)
const lastVisible = (view: ReturnType<typeof setup>['view']) =>
  view.setVisible.mock.calls.at(-1)?.[0]

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('tooltipBounds', () => {
  it('is a full-height strip starting at the anchor’s right edge', () => {
    expect(tooltipBounds(tip.anchor, WINDOW)).toEqual({
      x: 240,
      y: 0,
      width: TOOLTIP_STRIP_W,
      height: 700,
    })
    expect(TOOLTIP_STRIP_W).toBe(320)
  })

  it('is clamped to the window', () => {
    const anchor = { x: 800, y: 0, width: 100, height: 38 }
    expect(tooltipBounds(anchor, WINDOW)).toEqual({ x: 900, y: 0, width: 100, height: 700 })
    expect(tooltipBounds({ ...anchor, x: 1200 }, WINDOW).width).toBe(0)
  })
})

describe('OverlayView.tooltip', () => {
  it('shows the strip with the tooltip, without taking focus', () => {
    const { overlay, view } = setup()
    overlay.tooltip(tip)
    expect(view.setBounds).toHaveBeenLastCalledWith(tooltipBounds(tip.anchor, WINDOW))
    expect(lastVisible(view)).toBe(true)
    expect(sent(view, 'overlay.tooltip')).toEqual([tip])
    expect(view.webContents.focus).not.toHaveBeenCalled()
  })

  it('is ignored while a popover is open', () => {
    const { overlay, view } = setup()
    overlay.open({ kind: 'command' })
    view.setBounds.mockClear()
    overlay.tooltip(tip)
    overlay.tooltip(null)
    expect(sent(view, 'overlay.tooltip')).toEqual([])
    expect(view.setBounds).not.toHaveBeenCalled()
    vi.advanceTimersByTime(TOOLTIP_FADE_MS)
    expect(lastVisible(view)).toBe(true)
  })

  it('fades out: sends null, then hides after the fade', () => {
    const { overlay, view } = setup()
    overlay.tooltip(tip)
    overlay.tooltip(null)
    expect(sent(view, 'overlay.tooltip')).toEqual([tip, null])
    expect(lastVisible(view)).toBe(true)
    vi.advanceTimersByTime(TOOLTIP_FADE_MS)
    expect(lastVisible(view)).toBe(false)
  })

  it('stays shown when another tooltip comes during the fade', () => {
    const { overlay, view } = setup()
    overlay.tooltip(tip)
    overlay.tooltip(null)
    overlay.tooltip({ ...tip, title: 'Page B' })
    vi.advanceTimersByTime(TOOLTIP_FADE_MS)
    expect(lastVisible(view)).toBe(true)
  })

  it('hides at once once the pointer is on the strip, so the page gets the next click', () => {
    const { overlay, view } = setup()
    overlay.tooltip(tip)
    overlay.tooltip(null, { now: true })
    expect(sent(view, 'overlay.tooltip')).toEqual([tip, null])
    expect(lastVisible(view)).toBe(false)
  })

  it('gives way to a popover, which keeps the whole window', () => {
    const { overlay, view } = setup()
    overlay.tooltip(tip)
    overlay.open({ kind: 'command' })
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, ...WINDOW })
    expect(view.webContents.focus).toHaveBeenCalled()
    // A late null from the sidebar neither hides the popover nor reaches the overlay.
    overlay.tooltip(null)
    vi.advanceTimersByTime(TOOLTIP_FADE_MS)
    expect(lastVisible(view)).toBe(true)
    expect(sent(view, 'overlay.tooltip')).toEqual([tip])
  })
})
