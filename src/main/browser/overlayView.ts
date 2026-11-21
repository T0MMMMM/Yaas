// A transparent view over the whole window, above the tab views, so UI popovers (the + menu, the
// site menu, the tab finder, the command field) and main's menus (a sidebar row's menu at the
// pointer, `context-menu` / `anchored-menu`) can float over the page. It loads the UI renderer
// under `#overlay` with the app preload, so it is a trusted sender like the UI window. Hidden while
// no popover is open.
// It also draws the sidebar's tooltips: then it is only a strip beside the sidebar, never focused.
import { WebContentsView, type BrowserWindow, type Rectangle, type WebContents } from 'electron'
import { emit } from '../ipc/router'
import type { OverlayRequest, PageBounds, Tooltip } from '@shared/ipc/contract'

/** Width of the strip the overlay shrinks to for a tooltip, from the anchor's right edge. */
export const TOOLTIP_STRIP_W = 320
/** How long a hidden tooltip keeps the strip shown, so its card can fade out. */
export const TOOLTIP_FADE_MS = 150

/**
 * Where the overlay sits while it draws a tooltip: a full-height strip from the anchor's right edge,
 * so the card can slide from row to row without moving the view; clamped to the window.
 */
export function tooltipBounds(
  anchor: PageBounds,
  window: { width: number; height: number },
): Rectangle {
  const x = Math.min(anchor.x + anchor.width, window.width)
  return { x, y: 0, width: Math.min(TOOLTIP_STRIP_W, window.width - x), height: window.height }
}

export class OverlayView {
  private readonly view: WebContentsView
  private isOpen = false
  /** The one `did-finish-load` listener waiting to show the overlay; repeated opens replace it. */
  private pendingShow: (() => void) | null = null
  /** The tooltip strip: hidden, showing a tooltip, or fading one out before it hides. */
  private tooltipState: 'hidden' | 'shown' | 'fading' = 'hidden'
  private fade: ReturnType<typeof setTimeout> | null = null
  /** Where the keyboard goes back on close: the page a page menu was opened on, else the UI. */
  private returnFocusTo: WebContents | null = null

  constructor(
    private readonly win: BrowserWindow,
    preload: string,
    rendererUrl: string,
    /** Called when the overlay closes, to tell the UI. */
    private readonly onClosed: () => void = () => undefined,
  ) {
    this.view = new WebContentsView({
      webPreferences: {
        preload,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: false,
      },
    })
    this.view.setBackgroundColor('#00000000')
    this.view.setVisible(false)
    win.contentView.addChildView(this.view)
    this.fit()
    win.on('resize', () => {
      // The strip was laid out for the old size: drop the tooltip rather than misplace it.
      this.tooltip(null, { now: true })
      this.fit()
    })
    win.on('closed', () => this.view.webContents.close())

    const contents = this.view.webContents
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', (event) => event.preventDefault())
    void contents.loadURL(`${rendererUrl}#overlay`).catch(() => undefined)
  }

  get webContents(): WebContents {
    return this.view.webContents
  }

  /** Puts the overlay back on top of the window's views (after a tab view was added). */
  raise(): void {
    this.win.contentView.addChildView(this.view)
  }

  /**
   * Shows a popover or menu and focuses the overlay. `returnFocusTo` is the page a page menu was
   * opened on: it gets the keyboard back on close (the UI does otherwise).
   */
  open(request: OverlayRequest, returnFocusTo: WebContents | null = null): void {
    // A popover replaces any tooltip (the overlay drops it on `overlay.opened`).
    this.clearFade()
    this.tooltipState = 'hidden'
    this.isOpen = true
    this.returnFocusTo = returnFocusTo
    this.fit()
    this.raise()
    this.view.setVisible(true)
    const contents = this.view.webContents
    if (this.pendingShow) contents.removeListener('did-finish-load', this.pendingShow)
    this.pendingShow = null
    // Focused so Escape reaches it; only while open, so a hidden overlay never takes the keyboard.
    const show = (): void => {
      this.pendingShow = null
      if (!this.isOpen) return
      contents.focus()
      emit(contents, 'overlay.opened', request)
    }
    if (contents.isLoading()) {
      this.pendingShow = show
      contents.once('did-finish-load', show)
    } else show()
  }

  close(): void {
    if (!this.isOpen) return
    this.isOpen = false
    const hadFocus = this.view.webContents.isFocused()
    this.view.setVisible(false)
    // Hand the keyboard back to where the popover was opened from: the page or the UI.
    const target = this.returnFocusTo
    this.returnFocusTo = null
    if (hadFocus) {
      if (target && !target.isDestroyed()) target.focus()
      else this.win.webContents.focus()
    }
    this.onClosed()
  }

  /**
   * Shows a sidebar tooltip in the strip beside its anchor, or hides it with `null`: after
   * TOOLTIP_FADE_MS, or at once with `now` (the pointer is on the strip, and the page under it must
   * get the next click). Never focuses the view. Ignored while a popover is open: the menu wins.
   */
  tooltip(tooltip: Tooltip | null, { now = false }: { now?: boolean } = {}): void {
    if (this.isOpen) return
    const contents = this.view.webContents
    if (tooltip) {
      // Not loaded yet (just after launch): the next hover shows it.
      if (contents.isLoading()) return
      this.clearFade()
      const wasHidden = this.tooltipState === 'hidden'
      this.tooltipState = 'shown'
      this.view.setBounds(tooltipBounds(tooltip.anchor, this.size()))
      if (wasHidden) {
        this.raise()
        this.view.setVisible(true)
      }
      emit(contents, 'overlay.tooltip', tooltip)
      return
    }
    if (this.tooltipState === 'shown') {
      this.tooltipState = 'fading'
      emit(contents, 'overlay.tooltip', null)
      this.fade = setTimeout(() => this.hideTooltip(), TOOLTIP_FADE_MS)
    }
    if (now && this.tooltipState === 'fading') this.hideTooltip()
  }

  private hideTooltip(): void {
    this.clearFade()
    this.tooltipState = 'hidden'
    this.view.setVisible(false)
    this.fit()
  }

  private clearFade(): void {
    if (this.fade !== null) clearTimeout(this.fade)
    this.fade = null
  }

  private size(): { width: number; height: number } {
    const [width = 0, height = 0] = this.win.getContentSize()
    return { width, height }
  }

  /** Full content size of the window. */
  private fit(): void {
    this.view.setBounds({ x: 0, y: 0, ...this.size() })
  }
}
