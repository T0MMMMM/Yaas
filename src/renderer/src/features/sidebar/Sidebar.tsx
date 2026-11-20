import { useEffect, useRef, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { useWorkspace } from '../workspace/useWorkspace'
import { todayCloseOrder, type SidebarNode } from '../workspace/workspace'
import { anchorOf } from '../../ui/anchor'
import { useMagnetic } from '../../ui/useMagnetic'
import { CompactContext } from './CompactContext'
import { FavoriteTiles } from './FavoriteTiles'
import { FolderRow } from './FolderRow'
import { TabRow } from './TabRow'
import { tilt } from './tilt'
import { TabDragContext, useTabDrag } from './useTabDrag'
import styles from './Sidebar.module.css'

/** Opens the command field (⌘T): the tab is created only when the user submits it. */
function newTab(): Promise<void> {
  return window.acab.invoke('overlay.open', { kind: 'command' })
}

/** Opens the + menu in the overlay view, above the button (it floats over the page). */
function openNewMenu(button: HTMLElement): Promise<void> {
  return window.acab.invoke('overlay.open', { kind: 'new-menu', anchor: anchorOf(button) })
}

/** Closes every today tab in `todayCloseOrder`; ⌘⇧T reopens them one by one. */
async function clearToday(nodes: SidebarNode[], activeId: string | null): Promise<void> {
  for (const tabId of todayCloseOrder(nodes, activeId)) {
    await window.acab.invoke('browser.closeTab', { tabId })
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
 * then the spaces. No data logic here — the tree comes from the workspace. Tabs are dragged
 * between the lists (useTabDrag).
 */
export function Sidebar({ compact = false }: { compact?: boolean }) {
  const workspace = useWorkspace()
  const magnet = useMagnetic<HTMLButtonElement>()
  /** Whether the + menu is open in the overlay. */
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => window.acab.on('overlay.closed', () => setMenuOpen(false)), [])

  const sections = workspace?.sections
  const activeId = workspace?.activeTab?.id ?? null
  const scroll = useRef<HTMLDivElement>(null)
  const { drag, indicator } = useTabDrag(sections, scroll)
  const dragging = drag.dragging.size > 0
  const dropOn = (key: string): true | undefined => drag.zone === key || undefined

  return (
    <CompactContext.Provider value={compact}>
      <TabDragContext.Provider value={drag}>
        <nav
          className={styles.sidebar}
          aria-label="Spaces and tabs"
          data-testid="sidebar"
          data-compact={compact}
          data-dragging={dragging || undefined}
        >
          <div className={`${styles.titlebar} drag`} />

          <div className={styles.scroll} ref={scroll}>
            {sections && <FavoriteTiles tabs={sections.favorites} activeId={activeId} />}

            {/* While a tab is dragged, an empty pinned list is drawn to drop it on. */}
            {sections && (sections.pinned.length > 0 || dragging) && (
              <ul
                className={styles.list}
                aria-label="Pinned"
                data-testid="pinned"
                data-drop="list:pinned"
                data-drop-target={dropOn('list:pinned')}
              >
                <Rows nodes={sections.pinned} activeId={activeId} />
                {sections.pinned.length === 0 && (
                  <li className={styles.dropHint}>Drop here to pin</li>
                )}
              </ul>
            )}

            <div className={styles.separator} data-testid="today-header">
              <span className={styles.rule} />
              {sections && sections.today.length > 0 && (
                <button
                  className={styles.clear}
                  title="Close today's tabs (⌘⇧T reopens them one by one)"
                  onClick={() => void clearToday(sections.today, activeId)}
                >
                  Clear
                </button>
              )}
            </div>

            <button
              className={styles.newTab}
              onClick={() => void newTab()}
              data-testid="new-tab"
              aria-label="New tab"
              title={compact ? 'New tab (⌘T)' : undefined}
            >
              <Plus size={13} weight="bold" />
              <span>New tab</span>
              <kbd>⌘T</kbd>
            </button>

            <ul
              className={styles.list}
              aria-label="Today"
              data-testid="today"
              data-drop="list:today"
              data-drop-target={dropOn('list:today')}
            >
              {sections && <Rows nodes={sections.today} activeId={activeId} />}
            </ul>

            {indicator?.kind === 'line' && (
              <div
                className={styles.dropLine}
                style={{ top: indicator.top }}
                data-testid="drop-line"
                aria-hidden="true"
              />
            )}
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
                  onClick={() =>
                    void window.acab.invoke('browser.activateSpace', { spaceId: s.id })
                  }
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
      </TabDragContext.Provider>
    </CompactContext.Provider>
  )
}
