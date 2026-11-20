import { useEffect, useState, type CSSProperties } from 'react'
import { Globe, MagnifyingGlass, Plus, X } from '@phosphor-icons/react'
import { useWorkspace } from '../workspace/useWorkspace'
import type { TabView } from '../workspace/workspace'
import { useUi } from '../../stores/ui'
import { anchorOf } from '../../ui/anchor'
import { useMagnetic } from '../../ui/useMagnetic'
import { hashUnit } from './hash'
import styles from './Sidebar.module.css'

/**
 * Each card gets its own tilt, stable per id, so a list never moves in lockstep:
 * hover −0.3…−1.1° or +0.3…+1.1°, selected a little more.
 */
function tilt(id: string): CSSProperties {
  const sign = hashUnit(id, 7) < 0.5 ? -1 : 1
  const hover = sign * (0.3 + hashUnit(id, 1) * 0.8)
  const selected = sign * (0.6 + hashUnit(id, 2) * 0.9)
  return { '--tilt-hover': `${hover}deg`, '--tilt-selected': `${selected}deg` } as CSSProperties
}

/** Opens a blank tab in the active space, then puts the address bar in edit mode. */
async function newTab(): Promise<void> {
  await window.acab.invoke('browser.openTab', {})
  useUi.getState().focusAddress()
}

/** Opens the + menu in the overlay view, above the button (it floats over the page). */
function openNewMenu(button: HTMLElement): void {
  void window.acab.invoke('overlay.open', { kind: 'new-menu', anchor: anchorOf(button) })
}

/** Only inline images: a remote favicon would load in the UI's own session, outside the space. */
function Favicon({ tab }: { tab: TabView }) {
  if (tab.faviconUrl?.startsWith('data:')) {
    return <img className={styles.favicon} src={tab.faviconUrl} alt="" />
  }
  return <Globe size={16} className={styles.favicon} />
}

/** Arc-style vertical sidebar: the active space's tabs and the spaces. No data logic here. */
export function Sidebar() {
  const workspace = useWorkspace()
  const magnet = useMagnetic<HTMLButtonElement>(0.4)
  /** Whether the + menu is open in the overlay. */
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => window.acab.on('overlay.closed', () => setMenuOpen(false)), [])

  return (
    <nav className={styles.sidebar} aria-label="Spaces and tabs" data-testid="sidebar">
      <div className={`${styles.titlebar} drag`} />

      <button className={`${styles.search} no-drag`}>
        <MagnifyingGlass size={15} weight="bold" />
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>

      <div className={styles.scroll}>
        <ul className={styles.list} aria-label="Tabs">
          {workspace?.tabs.map((tab) => {
            const active = tab.id === workspace.activeTab?.id
            return (
              <li key={tab.id} className={styles.item} style={tilt(tab.id)} data-testid="tab">
                <button
                  className={styles.row}
                  data-active={active}
                  data-loaded={tab.loaded}
                  aria-current={active ? 'page' : undefined}
                  title={tab.url}
                  onClick={() => void window.acab.invoke('browser.activateTab', { tabId: tab.id })}
                >
                  <Favicon tab={tab} />
                  <span className={styles.rowTitle}>{tab.title}</span>
                </button>
                <button
                  className={styles.close}
                  data-active={active}
                  aria-label="Close tab"
                  title="Close tab (⌘W)"
                  onClick={() => void window.acab.invoke('browser.closeTab', { tabId: tab.id })}
                >
                  <X size={13} weight="bold" />
                </button>
              </li>
            )
          })}
        </ul>

        <button className={styles.newTab} onClick={() => void newTab()} data-testid="new-tab">
          <Plus size={13} weight="bold" />
          <span>New tab</span>
          <kbd>⌘T</kbd>
        </button>
      </div>

      <div className={styles.bottom}>
        {/* Downloads (plan 4). */}
        <div className={styles.slot} />

        <div className={styles.spaces} role="tablist" aria-label="Spaces">
          {workspace?.spaces.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === workspace.space.id}
              aria-label={s.label}
              title={s.label}
              className={styles.space}
              style={{ ...tilt(s.id), color: s.color }}
              onClick={() => void window.acab.invoke('browser.activateSpace', { spaceId: s.id })}
              {...magnet}
            >
              <span className={styles.dot} />
            </button>
          ))}
        </div>

        <button
          className={`${styles.iconButton} no-drag`}
          aria-label="New tab, space or settings"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="New…"
          onClick={(e) => {
            setMenuOpen(true)
            openNewMenu(e.currentTarget)
          }}
          {...magnet}
        >
          <Plus size={18} weight="regular" />
        </button>
      </div>
    </nav>
  )
}
