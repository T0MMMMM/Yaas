// A transparent view over the whole window, above the tab views, so UI popovers (the + menu, the
// site menu) can float over the page. It loads the UI renderer under `#overlay` with the app
// preload, so it is a trusted sender like the UI window. Hidden while no popover is open.
import { WebContentsView, type BrowserWindow, type WebContents } from 'electron'
import { emit } from '../ipc/router'
import type { OverlayKind, PageBounds } from '@shared/ipc/contract'

export class OverlayView {
  private readonly view: WebContentsView
  private isOpen = false

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
    win.on('resize', () => this.fit())
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

  open(kind: OverlayKind, anchor: PageBounds): void {
    this.isOpen = true
    this.fit()
    this.raise()
    this.view.setVisible(true)
    const contents = this.view.webContents
    // Focused so Escape reaches it; only while open, so a hidden overlay never takes the keyboard.
    const show = (): void => {
      contents.focus()
      emit(contents, 'overlay.opened', { kind, anchor })
    }
    if (contents.isLoading()) contents.once('did-finish-load', show)
    else show()
  }

  close(): void {
    if (!this.isOpen) return
    this.isOpen = false
    const hadFocus = this.view.webContents.isFocused()
    this.view.setVisible(false)
    // Hand the keyboard back to the UI the popover was opened from.
    if (hadFocus) this.win.webContents.focus()
    this.onClosed()
  }

  /** Full content size of the window. */
  private fit(): void {
    const [width = 0, height = 0] = this.win.getContentSize()
    this.view.setBounds({ x: 0, y: 0, width, height })
  }
}
