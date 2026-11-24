import { useEffect, useSyncExternalStore, type CSSProperties } from 'react'
import { DEFAULT_ACCENT } from '@shared/ipc/contract'
import { AddressBar } from '../features/browser/AddressBar'
import { PageSlot } from '../features/browser/PageSlot'
import { SettingsView } from '../features/settings/SettingsView'
import { Sidebar } from '../features/sidebar/Sidebar'
import { useWorkspace } from '../features/workspace/useWorkspace'
import { useBrowser } from '../stores/browser'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'
import { applySpaceAccent, onSystemSchemeChange, resolveScheme } from '../theme/applyTheme'
import { FrameBackdrop } from '../theme/FrameBackdrop'
import { useSidebarResize } from './useSidebarResize'
import { WindowControls } from './WindowControls'
import styles from './Shell.module.css'

const getSystemScheme = () => resolveScheme('system')

/** Whether ⌘Z in `el` is a text undo: an input, a text area or editable content. */
function isTextField(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable
}

/** Main layout: space-tinted frame wrapping sidebar | address bar inside the page card. */
export function Shell() {
  const view = useUi((s) => s.view)
  const initBrowser = useBrowser((s) => s.init)
  const resize = useSidebarResize()
  const platform = useSettings((s) => s.info?.platform)
  const colorScheme = useSettings((s) => s.settings?.colorScheme ?? 'system')
  const defaultAccent = useSettings((s) => s.settings?.accent ?? DEFAULT_ACCENT)
  const workspace = useWorkspace()

  const systemScheme = useSyncExternalStore(onSystemSchemeChange, getSystemScheme)
  const scheme = colorScheme === 'system' ? systemScheme : colorScheme

  useEffect(() => initBrowser(), [initBrowser])

  // Shortcuts pressed while a page has focus arrive from main's menu.
  useEffect(
    () =>
      window.bigBrowser.on('browser.shortcut', (shortcut) => {
        const ui = useUi.getState()
        if (shortcut.kind === 'focus-address') ui.focusAddress()
        else if (shortcut.kind === 'settings') ui.openSettings()
        else if (shortcut.kind === 'rename-folder') ui.renameFolder(shortcut.folderId)
        else if (shortcut.kind === 'rename-space') ui.renameSpace(shortcut.spaceId)
        else void window.bigBrowser.invoke('overlay.open', { kind: shortcut.kind })
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
      void window.bigBrowser.invoke('browser.reopenClosed')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const activeSpace = workspace?.space ?? null
  const spaceColor = activeSpace?.color ?? defaultAccent
  const isSplit = Boolean(workspace?.activeSplit)

  // Propagate the active space accent onto :root so derived tokens (--space-accent-soft,
  // --bg-dock-selected, --selection-bg) resolve to the space colour instead of the app accent.
  useEffect(() => {
    applySpaceAccent(spaceColor)
  }, [spaceColor])

  return (
    <div
      className={styles.shell}
      data-resizing={resize.resizing}
      style={{ '--sidebar-w': `${resize.width}px` } as CSSProperties}
    >
      <FrameBackdrop spaceId={activeSpace?.id ?? null} color={spaceColor} scheme={scheme} />

      {/* The window buttons wait in the top margin (Linux keeps its native title bar). */}
      {(platform === 'mac' || platform === 'windows') && <WindowControls platform={platform} />}

      <div className={styles.body}>
        <div className={styles.sidebarSlot}>
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
          <div className={styles.page} data-split={isSplit || undefined}>
            <AddressBar />
            <main className={styles.card}>
              <PageSlot />
            </main>
          </div>
        </div>
      </div>

      {view === 'settings' && <SettingsView />}
    </div>
  )
}
