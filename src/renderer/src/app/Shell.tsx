import { useEffect, type CSSProperties } from 'react'
import { AddressBar } from '../features/browser/AddressBar'
import { PageSlot } from '../features/browser/PageSlot'
import { SettingsView } from '../features/settings/SettingsView'
import { Sidebar } from '../features/sidebar/Sidebar'
import { useBrowser } from '../stores/browser'
import { useUi } from '../stores/ui'
import { useSidebarResize } from './useSidebarResize'
import styles from './Shell.module.css'

/** Whether ⌘Z in `el` is a text undo: an input, a text area or editable content. */
function isTextField(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable
}

/** Main layout: sidebar | address bar over the page card (spec, "Browser chrome"). */
export function Shell() {
  const view = useUi((s) => s.view)
  const initBrowser = useBrowser((s) => s.init)
  const resize = useSidebarResize()

  useEffect(() => initBrowser(), [initBrowser])

  // Icon-only: the traffic lights go (they would not fit); the top-left corner brings them back
  // while the pointer is on it. Leaving icon-only shows them again.
  useEffect(() => {
    void window.acab.invoke('window.setControlsVisible', { visible: !resize.compact })
  }, [resize.compact])

  // Shortcuts pressed while a page has focus arrive from main's menu.
  useEffect(
    () =>
      window.acab.on('browser.shortcut', (shortcut) => {
        const ui = useUi.getState()
        if (shortcut.kind === 'focus-address') ui.focusAddress()
        else if (shortcut.kind === 'settings') ui.openSettings()
        else if (shortcut.kind === 'rename-folder') ui.renameFolder(shortcut.folderId)
        else void window.acab.invoke('overlay.open', { kind: shortcut.kind })
      }),
    [],
  )

  // ⌘Z reopens the last closed tab while the UI has focus — never in a text field, where it stays
  // the text undo (a page's own keys never reach this window).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return
      if (isTextField(document.activeElement)) return
      e.preventDefault()
      void window.acab.invoke('browser.reopenClosed')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      className={`${styles.shell} grainy`}
      data-resizing={resize.resizing}
      style={{ '--sidebar-w': `${resize.width}px` } as CSSProperties}
    >
      <div className={styles.sidebarSlot}>
        {resize.compact && (
          <div
            className={styles.controlsZone}
            data-testid="controls-zone"
            onPointerEnter={() =>
              void window.acab.invoke('window.setControlsVisible', { visible: true })
            }
            onPointerLeave={() =>
              void window.acab.invoke('window.setControlsVisible', { visible: false })
            }
          />
        )}
        <Sidebar compact={resize.compact} />
        <div
          className={styles.resizer}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={resize.width}
          title="Drag to resize · double-click to reset"
          onPointerDown={resize.onPointerDown}
          onDoubleClick={resize.reset}
          data-testid="sidebar-resizer"
        />
      </div>

      <div className={styles.column}>
        <div className={styles.page}>
          <AddressBar />
          <main className={styles.card}>
            <PageSlot />
          </main>
        </div>
      </div>

      {view === 'settings' && <SettingsView />}
    </div>
  )
}
