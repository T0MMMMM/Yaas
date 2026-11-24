import { useEffect, useMemo, useRef, useState } from 'react'
import { DownloadSimple, GearSix, Plus, SidebarSimple } from '@phosphor-icons/react'
import { useSidebarToggle } from '../../app/useSidebarResize'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { useWorkspace } from '../workspace/useWorkspace'
import { todayCloseOrder, type SidebarNode } from '../workspace/workspace'
import { anchorOf } from '../../ui/anchor'
import { useMagnetic } from '../../ui/useMagnetic'
import { CompactContext } from './CompactContext'
import { spaceEmoji } from './emoji'
import { FavoriteTiles } from './FavoriteTiles'
import { enteringAfter, exitsWhenGone, newlyOpenedTabIds, ROW_ENTER_MS } from './rows'
import { Rows } from './SidebarRows'
import { SpaceHeader } from './SpaceHeader'
import { SpaceSwapStage } from './SpaceSwapStage'
import { TabDragContext, useTabDrag } from './useTabDrag'
import { TooltipContext, useTooltip } from './useTooltip'
import styles from './Sidebar.module.css'

const EMPTY_IDS: ReadonlySet<string> = new Set()

/** Opens the command field (⌘T): the tab is created only when the user submits it. */
function newTab(): Promise<void> {
  return window.bigBrowser.invoke('overlay.open', { kind: 'command' })
}

/** Opens the + menu in the overlay view, above the button (it floats over the page). */
function openNewMenu(button: HTMLElement): Promise<void> {
  return window.bigBrowser.invoke('overlay.open', { kind: 'new-menu', anchor: anchorOf(button) })
}

/** Opens the downloads card in the overlay view, above the button. */
function openDownloads(button: HTMLElement): Promise<void> {
  return window.bigBrowser.invoke('overlay.open', { kind: 'downloads', anchor: anchorOf(button) })
}

/** Closes every today tab in `todayCloseOrder`; ⌘⇧T reopens them one by one. */
async function clearToday(nodes: SidebarNode[], activeId: string | null): Promise<void> {
  for (const tabId of todayCloseOrder(nodes, activeId)) {
    await window.bigBrowser.invoke('browser.closeTab', { tabId })
  }
}

/**
 * Arc-style vertical sidebar: favourite tiles, the space section (its header over the pinned tabs
 * and folders, which it folds), a separator, today's tabs, then the spaces. No data logic here —
 * the tree comes from the workspace. Tabs, tiles and folders are dragged between the lists
 * (useTabDrag): the row lifts and the others move aside where it will land.
 */
export function Sidebar({ compact = false }: { compact?: boolean }) {
  const workspace = useWorkspace()
  const sidebarToggle = useSidebarToggle()
  const switcherStyle = useSettings((s) => s.settings?.spaceSwitcherStyle ?? 'emoji')
  const openSettings = useUi((s) => s.openSettings)
  const magnet = useMagnetic<HTMLButtonElement>()
  /** Whether the + menu is open in the overlay. */
  const [menuOpen, setMenuOpen] = useState(false)
  /** Whether the downloads card is open in the overlay. */
  const [downloadsOpen, setDownloadsOpen] = useState(false)

  useEffect(
    () =>
      window.bigBrowser.on('overlay.closed', () => {
        setMenuOpen(false)
        setDownloadsOpen(false)
      }),
    [],
  )

  const sections = workspace?.sections
  const space = workspace?.space ?? null
  const spaceId = space?.id ?? null
  const activeId = workspace?.activeTab?.id ?? null
  const sectionCollapsed = space?.sectionCollapsed ?? false
  const openTabIds = workspace?.openTabIds ?? EMPTY_IDS

  // Track genuinely newly opened tab ids in the current space so only they play row-enter. Each
  // batch of new ids (`batch`) ends its enter on its own timer; a page load or a title change (a
  // new `openTabIds` with nothing added) keeps the same set, so no row's enter restarts.
  const [openTracker, setOpenTracker] = useState<{
    spaceId: string | null
    openIds: ReadonlySet<string> | null
    entering: ReadonlySet<string>
    batch: ReadonlySet<string>
  }>({ spaceId: null, openIds: null, entering: EMPTY_IDS, batch: EMPTY_IDS })

  if (spaceId !== openTracker.spaceId || openTabIds !== openTracker.openIds) {
    const added = newlyOpenedTabIds(openTracker.spaceId, spaceId, openTracker.openIds, openTabIds)
    setOpenTracker({
      spaceId,
      openIds: openTabIds,
      entering:
        spaceId === openTracker.spaceId
          ? enteringAfter(openTracker.entering, added, openTabIds)
          : EMPTY_IDS,
      batch: added.size > 0 ? added : openTracker.batch,
    })
  }

  useEffect(() => {
    const batch = openTracker.batch
    if (batch.size === 0) return
    // No cleanup: a later batch must not cancel this one's timer (a stale one finds nothing).
    window.setTimeout(() => {
      setOpenTracker((current) => {
        const entering = enteringAfter(
          current.entering,
          EMPTY_IDS,
          current.openIds ?? EMPTY_IDS,
          batch,
        )
        return entering === current.entering ? current : { ...current, entering }
      })
    }, ROW_ENTER_MS + 30)
  }, [openTracker.batch])

  // Only a closed tab's row animates out; a moved one (or a space switch) is never drawn twice.
  const exits = useMemo(() => exitsWhenGone(openTabIds), [openTabIds])
  const scroll = useRef<HTMLDivElement>(null)
  const drag = useTabDrag(sections, activeId, scroll, styles.dragClone)
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
            {/* The sidebar's own controls: icons only (left), settings (right). */}
            <div className={`${styles.titlebar} drag`}>
              <button
                className={`${styles.iconButton} no-drag`}
                aria-label={sidebarToggle.compact ? 'Expand sidebar' : 'Icons only'}
                title={sidebarToggle.compact ? 'Expand sidebar' : 'Icons-only sidebar'}
                onClick={sidebarToggle.toggle}
                {...magnet}
              >
                <SidebarSimple size={16} weight="regular" />
              </button>
              <button
                className={`${styles.iconButton} ${styles.settingsButton} no-drag`}
                aria-label="Settings"
                title="Settings (⌘,)"
                tabIndex={compact ? -1 : 0}
                aria-hidden={compact || undefined}
                onClick={() => openSettings()}
                {...magnet}
              >
                <GearSix size={16} weight="regular" />
              </button>
            </div>

            <div className={styles.scroll} ref={scroll}>
              <div className={styles.scrollStage}>
                <SpaceSwapStage
                  spaceId={spaceId}
                  className={styles.spaceContent}
                  layerClassName={styles.swapLayer}
                >
                  {sections && (
                    <FavoriteTiles
                      tabs={sections.favorites}
                      seconds={sections.favoriteSeconds}
                      activeId={activeId}
                    />
                  )}

                  {/* The space section: its header, then the pinned tabs and folders, which it folds
                      (always mounted so the morph animates; inert while folded). */}
                  {space && <SpaceHeader space={space} />}
                  <div
                    className={styles.fold}
                    data-collapsed={sectionCollapsed}
                    inert={sectionCollapsed}
                    data-testid="space-section"
                  >
                    <div className={styles.foldInner}>
                      {/* While a tab is dragged, an empty pinned list is drawn to drop it on. */}
                      {sections && (sections.pinned.length > 0 || dragging) && (
                        <ul
                          className={styles.list}
                          aria-label="Pinned"
                          data-testid="pinned"
                          data-drop="list:pinned"
                          data-drop-target={dropOn('list:pinned')}
                        >
                          <Rows
                            nodes={sections.pinned}
                            activeId={activeId}
                            enteringIds={openTracker.entering}
                            exits={exits}
                          />
                          {sections.pinned.length === 0 && (
                            <li className={styles.dropHint}>Drop here to pin</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>

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
                    <Plus size={16} weight="regular" />
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
                    {sections && (
                      <Rows
                        nodes={sections.today}
                        activeId={activeId}
                        enteringIds={openTracker.entering}
                        exits={exits}
                      />
                    )}
                  </ul>
                </SpaceSwapStage>
              </div>
            </div>

            <div className={styles.bottom}>
              <button
                className={`${styles.iconButton} ${styles.downloads} no-drag`}
                aria-label="Downloads"
                aria-haspopup="dialog"
                aria-expanded={downloadsOpen}
                title="Downloads"
                onClick={(e) => {
                  setDownloadsOpen(true)
                  openDownloads(e.currentTarget).catch(() => setDownloadsOpen(false))
                }}
                {...magnet}
              >
                <DownloadSimple size={16} weight="regular" />
              </button>

              <div className={styles.spaces} role="tablist" aria-label="Spaces">
                {workspace?.spaces.map((s) => (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={s.id === workspace.space.id}
                    aria-label={s.label}
                    title={s.label}
                    className={styles.space}
                    style={{ color: s.color }}
                    onClick={() =>
                      void window.bigBrowser.invoke('browser.activateSpace', { spaceId: s.id })
                    }
                    {...magnet}
                  >
                    {switcherStyle === 'dots' ? (
                      <span className={styles.dot} />
                    ) : switcherStyle === 'letter' ? (
                      <span className={styles.letter}>
                        {s.label.trim().charAt(0).toUpperCase() || '·'}
                      </span>
                    ) : (
                      <span className={styles.emoji}>{spaceEmoji(s.icon, s.label)}</span>
                    )}
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
                <Plus size={16} weight="regular" />
              </button>
            </div>
          </nav>
        </TooltipContext.Provider>
      </TabDragContext.Provider>
    </CompactContext.Provider>
  )
}
