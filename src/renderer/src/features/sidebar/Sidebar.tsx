import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { Favicon } from './Favicon'
import { FavoriteTiles } from './FavoriteTiles'
import { FolderGlyph } from './glyphs'
import { folderHue, folderIcon } from './hash'
import { exitsWhenGone, newlyOpenedTabIds, ROW_ENTER_MS } from './rows'
import { Rows } from './SidebarRows'
import { SpaceHeader } from './SpaceHeader'
import {
  finishSpaceSwap,
  INITIAL_SWAP,
  markSwapVisible,
  nextSpaceSwap,
  SWAP_DELAY_MS,
  SWAP_IN_MS,
  SWAP_OUT_MS,
  type SpaceSnapshot,
} from './spaceSwap'
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

/** Inert visual mirror of a space's rows while it fades out during a space switch (no test ids). */
function GhostRows({ nodes, activeId }: { nodes: SidebarNode[]; activeId: string | null }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.kind === 'tab') {
          const active = node.tab.id === activeId
          return (
            <li
              key={`t:${node.tab.id}:${index}`}
              className={styles.ghostRow}
              data-active={active || undefined}
            >
              <Favicon tab={node.tab} className={styles.ghostFavicon} />
              <span className={styles.ghostTitle}>{node.tab.title}</span>
            </li>
          )
        }
        if (node.kind === 'split') {
          const active = node.first.id === activeId || node.second.id === activeId
          return (
            <li
              key={`s:${node.first.id}:${index}`}
              className={styles.ghostRow}
              data-active={active || undefined}
            >
              <Favicon tab={node.first} className={styles.ghostFavicon} />
              <span className={styles.ghostTitle}>
                {node.first.title} | {node.second.title}
              </span>
            </li>
          )
        }
        const auto = node.kind === 'auto-folder'
        const name = auto ? node.host : node.folder.name
        const icon = auto ? { kind: 'hue' as const, hue: folderHue(name) } : folderIcon(node.folder)
        return (
          <li key={`f:${name}:${index}`} className={styles.ghostFolder}>
            <div className={styles.ghostRow}>
              {icon.kind === 'emoji' ? (
                <span className={styles.ghostEmoji}>{icon.emoji}</span>
              ) : (
                <FolderGlyph hue={icon.hue} open={auto ? true : !node.folder.collapsed} />
              )}
              <span className={styles.ghostTitle}>{name}</span>
            </div>
          </li>
        )
      })}
    </>
  )
}

/** Outgoing space visual overlay fading out over 150 ms while the new space enters after 75 ms. */
function SpaceSwapGhost({
  snapshot,
  onDone,
}: {
  snapshot: SpaceSnapshot
  onDone: (gen: number) => void
}) {
  const { space, sections, activeId, gen } = snapshot
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(gen), SWAP_OUT_MS + 40)
    return () => window.clearTimeout(timer)
  }, [gen, onDone])

  return (
    <div className={styles.swapGhost} aria-hidden="true" inert onAnimationEnd={() => onDone(gen)}>
      {sections.favorites.length > 0 && (
        <ul className={styles.ghostTiles}>
          {sections.favorites.map((tab) => (
            <li
              key={tab.id}
              className={styles.ghostTile}
              data-active={tab.id === activeId || undefined}
            >
              <Favicon tab={tab} className={styles.ghostTileIcon} />
            </li>
          ))}
        </ul>
      )}
      <div className={styles.ghostHeader}>
        <span className={styles.ghostIconSlot}>
          {space.icon ? space.icon : <span className={styles.dot} style={{ color: space.color }} />}
        </span>
        <span className={styles.ghostHeaderName}>{space.label}</span>
      </div>
      {!space.sectionCollapsed && sections.pinned.length > 0 && (
        <ul className={styles.list}>
          <GhostRows nodes={sections.pinned} activeId={activeId} />
        </ul>
      )}
      <div className={styles.separator}>
        <span className={styles.rule} />
      </div>
      <div className={styles.ghostRow}>
        <Plus size={16} weight="regular" />
        <span className={styles.ghostTitle}>New tab</span>
      </div>
      {sections.today.length > 0 && (
        <ul className={styles.list}>
          <GhostRows nodes={sections.today} activeId={activeId} />
        </ul>
      )}
    </div>
  )
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

  // Track genuinely newly opened tab ids in the current space so only they play row-enter.
  const [openTracker, setOpenTracker] = useState<{
    spaceId: string | null
    openIds: ReadonlySet<string> | null
    entering: ReadonlySet<string>
  }>({ spaceId: null, openIds: null, entering: EMPTY_IDS })

  if (spaceId !== openTracker.spaceId || openTabIds !== openTracker.openIds) {
    const added = newlyOpenedTabIds(openTracker.spaceId, spaceId, openTracker.openIds, openTabIds)
    const nextEntering =
      spaceId !== openTracker.spaceId
        ? EMPTY_IDS
        : added.size > 0
          ? new Set([...openTracker.entering, ...added].filter((id) => openTabIds.has(id)))
          : openTracker.entering.size > 0
            ? new Set([...openTracker.entering].filter((id) => openTabIds.has(id)))
            : EMPTY_IDS
    setOpenTracker({ spaceId, openIds: openTabIds, entering: nextEntering })
  }

  useEffect(() => {
    if (openTracker.entering.size === 0) return
    const timer = window.setTimeout(() => {
      setOpenTracker((current) =>
        current.entering.size === 0 ? current : { ...current, entering: EMPTY_IDS },
      )
    }, ROW_ENTER_MS + 30)
    return () => window.clearTimeout(timer)
  }, [openTracker.entering])

  // Signature space-switch swap: old space content fades out in 150 ms, new fades in after 75 ms.
  const [swap, setSwap] = useState(INITIAL_SWAP)
  const nextSwap = nextSpaceSwap(swap, space && sections ? { space, sections, activeId } : null)
  if (nextSwap !== swap) setSwap(nextSwap)

  useEffect(() => {
    if (swap.swapCount === 0 || swap.incomingVisible) return
    const currentSwap = swap.swapCount
    const timer = window.setTimeout(
      () => setSwap((current) => markSwapVisible(current, currentSwap)),
      SWAP_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [swap.swapCount, swap.incomingVisible])

  const liveContent = useRef<HTMLDivElement>(null)
  const liveAnim = useRef<Animation | null>(null)
  useLayoutEffect(() => {
    if (swap.swapCount === 0) return
    const el = liveContent.current
    if (!el || typeof el.animate !== 'function') return
    liveAnim.current?.cancel()
    liveAnim.current = el.animate([{ opacity: 0 }, { opacity: 1 }], {
      delay: SWAP_DELAY_MS,
      duration: SWAP_IN_MS,
      easing: 'ease',
      fill: 'backwards',
    })
  }, [swap.swapCount])

  useEffect(() => () => liveAnim.current?.cancel(), [])

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
                {swap.outgoing && (
                  <SpaceSwapGhost
                    key={swap.outgoing.gen}
                    snapshot={swap.outgoing}
                    onDone={(gen) => setSwap((current) => finishSpaceSwap(current, gen))}
                  />
                )}
                <div ref={liveContent} className={styles.spaceContent}>
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
                </div>
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
