import { useEffect, useState } from 'react'
import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { useWorkspace } from '../workspace/useWorkspace'
import { tabsOf, type SidebarNode } from '../workspace/workspace'
import { useUi } from '../../stores/ui'
import { anchorOf } from '../../ui/anchor'
import { useMagnetic } from '../../ui/useMagnetic'
import { FavoriteTiles } from './FavoriteTiles'
import { FolderRow } from './FolderRow'
import { TabRow } from './TabRow'
import { tilt } from './tilt'
import styles from './Sidebar.module.css'

/** Opens a blank tab in the active space, then puts the address bar in edit mode. */
async function newTab(): Promise<void> {
  await window.acab.invoke('browser.openTab', {})
  useUi.getState().focusAddress()
}

/** Opens the + menu in the overlay view, above the button (it floats over the page). */
function openNewMenu(button: HTMLElement): Promise<void> {
  return window.acab.invoke('overlay.open', { kind: 'new-menu', anchor: anchorOf(button) })
}

/**
 * Closes every today tab, deepest and lowest first: ⌘⇧T then reopens them one by one, top-down,
 * each back under its parent.
 */
async function clearToday(nodes: SidebarNode[]): Promise<void> {
  for (const tab of tabsOf(nodes).reverse()) {
    await window.acab.invoke('browser.closeTab', { tabId: tab.id })
  }
}

function Rows({ nodes, activeId }: { nodes: SidebarNode[]; activeId: string | null }) {
  return nodes.map((node) =>
    node.kind === 'tab' ? (
      <TabRow
        key={node.tab.id}
        tab={node.tab}
        depth={node.depth}
        active={node.tab.id === activeId}
      />
    ) : (
      <FolderRow
        key={node.kind === 'folder' ? node.folder.id : `auto:${node.host}`}
        node={node}
        activeId={activeId}
      />
    ),
  )
}

/**
 * Arc-style vertical sidebar: favourite tiles, pinned tabs and folders, a separator, today's tabs,
 * then the spaces. No data logic here — the tree comes from the workspace.
 */
export function Sidebar() {
  const workspace = useWorkspace()
  const magnet = useMagnetic<HTMLButtonElement>(0.4)
  /** Whether the + menu is open in the overlay. */
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => window.acab.on('overlay.closed', () => setMenuOpen(false)), [])

  const sections = workspace?.sections
  const activeId = workspace?.activeTab?.id ?? null

  return (
    <nav className={styles.sidebar} aria-label="Spaces and tabs" data-testid="sidebar">
      <div className={`${styles.titlebar} drag`} />

      <button className={`${styles.search} no-drag`}>
        <MagnifyingGlass size={15} weight="bold" />
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>

      <div className={styles.scroll}>
        {sections && <FavoriteTiles tabs={sections.favorites} activeId={activeId} />}

        {sections && sections.pinned.length > 0 && (
          <ul className={styles.list} aria-label="Pinned" data-testid="pinned">
            <Rows nodes={sections.pinned} activeId={activeId} />
          </ul>
        )}

        <div className={styles.separator} data-testid="today-header">
          <span className={styles.rule} />
          {sections && sections.today.length > 0 && (
            <button
              className={styles.clear}
              title="Close today's tabs (⌘⇧T reopens them one by one)"
              onClick={() => void clearToday(sections.today)}
            >
              Clear
            </button>
          )}
        </div>

        <ul className={styles.list} aria-label="Today" data-testid="today">
          {sections && <Rows nodes={sections.today} activeId={activeId} />}
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
            // If the overlay cannot open, nothing will ever send `overlay.closed`.
            openNewMenu(e.currentTarget).catch(() => setMenuOpen(false))
          }}
          {...magnet}
        >
          <Plus size={18} weight="regular" />
        </button>
      </div>
    </nav>
  )
}
