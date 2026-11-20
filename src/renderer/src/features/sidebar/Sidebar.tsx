import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { useWorkspace } from '../workspace/useWorkspace'
import { todayCloseOrder, type SidebarNode } from '../workspace/workspace'
import { anchorOf } from '../../ui/anchor'
import { useMagnetic } from '../../ui/useMagnetic'
import { usePresence } from '../../ui/usePresence'
import { CompactContext } from './CompactContext'
import { FavoriteTiles } from './FavoriteTiles'
import { FolderRow } from './FolderRow'
import { exitsWhenGone, nodeKey, ROW_EXIT_MS } from './rows'
import { TabRow } from './TabRow'
import { tilt } from './tilt'
import { TabDragContext, useTabDrag } from './useTabDrag'
import { TooltipContext, useTooltip } from './useTooltip'
import styles from './Sidebar.module.css'

/** Opens the command field (⌘T): the tab is created only when the user submits it. */
function newTab(): Promise<void> {
  return window.bigBrowser.invoke('overlay.open', { kind: 'command' })
}

/** Opens the + menu in the overlay view, above the button (it floats over the page). */
function openNewMenu(button: HTMLElement): Promise<void> {
  return window.bigBrowser.invoke('overlay.open', { kind: 'new-menu', anchor: anchorOf(button) })
}

/** Closes every today tab in `todayCloseOrder`; ⌘⇧T reopens them one by one. */
async function clearToday(nodes: SidebarNode[], activeId: string | null): Promise<void> {
  for (const tabId of todayCloseOrder(nodes, activeId)) {
    await window.bigBrowser.invoke('browser.closeTab', { tabId })
  }
}

interface RowsProps {
  nodes: SidebarNode[]
  activeId: string | null
  /** Whether a row that left plays its exit (exitsWhenGone). */
  exits: (node: SidebarNode) => boolean
}

function Rows({ nodes, activeId, exits }: RowsProps) {
  const rows = usePresence(nodes, nodeKey, ROW_EXIT_MS, exits)
  return rows.map(({ item: node, exiting }) => {
    if (node.kind === 'tab') {
      return (
        <TabRow
          key={nodeKey(node)}
          tab={node.tab}
          depth={node.depth}
          active={node.tab.id === activeId}
          exiting={exiting}
        />
      )
    }
    // A removed folder just leaves: only tab rows animate out.
    return exiting ? null : (
      <FolderRow key={nodeKey(node)} node={node} activeId={activeId} exits={exits} />
    )
  })
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

  useEffect(() => window.bigBrowser.on('overlay.closed', () => setMenuOpen(false)), [])

  const sections = workspace?.sections
  const activeId = workspace?.activeTab?.id ?? null
  const openTabIds = workspace?.openTabIds
  // Only a closed tab's row animates out; a moved one (or a space switch) is never drawn twice.
  const exits = useMemo(() => exitsWhenGone(openTabIds ?? new Set()), [openTabIds])
  const scroll = useRef<HTMLDivElement>(null)
  const { drag, indicator } = useTabDrag(sections, scroll)
  const dragging = drag.dragging.size > 0
  const dropOn = (key: string): true | undefined => drag.zone === key || undefined
  const nav = useRef<HTMLElement>(null)
  // Tab rows and tiles show a tooltip in the overlay instead of a native `title`.
  const tooltip = useTooltip(nav, dragging)

  return (
    <CompactContext.Provider value={compact}>
      <TabDragContext.Provider value={drag}>
        <TooltipContext.Provider value={tooltip.enter}>
          <nav
            ref={nav}
            className={styles.sidebar}
            aria-label="Spaces and tabs"
            data-testid="sidebar"
            data-compact={compact}
            data-dragging={dragging || undefined}
            onPointerOver={tooltip.over}
            onPointerLeave={tooltip.leave}
            onPointerDownCapture={tooltip.press}
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
                  <Rows nodes={sections.pinned} activeId={activeId} exits={exits} />
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
                {sections && <Rows nodes={sections.today} activeId={activeId} exits={exits} />}
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
                      void window.bigBrowser.invoke('browser.activateSpace', { spaceId: s.id })
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
        </TooltipContext.Provider>
      </TabDragContext.Provider>
    </CompactContext.Provider>
  )
}
