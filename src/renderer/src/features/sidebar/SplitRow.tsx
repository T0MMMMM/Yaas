import { useContext, type CSSProperties, type MouseEvent } from 'react'
import { X } from '@phosphor-icons/react'
import type { TabView } from '../workspace/workspace'
import { Favicon } from './Favicon'
import { useCompact } from './CompactContext'
import { FolderTrailContext } from './FolderTrailContext'
import { showTabMenu } from './menus'
import { tilt } from './tilt'
import { useDragHandle } from './useTabDrag'
import { TOOLTIP_ROW, useTooltipEnter } from './useTooltip'
import rowStyles from './TabRow.module.css'
import styles from './SplitRow.module.css'

const activate = (tabId: string): void =>
  void window.bigBrowser.invoke('browser.activateTab', { tabId })

/**
 * Two tabs shown side by side, as one row of the pinned or today list: both favicons, then
 * "Title A | Title B", each title showing its half. Dragging the row moves the pair (useTabDrag,
 * by the first tab's key); its menu is the half right-clicked's (Separate among its items); its ×
 * closes both tabs. Icon-only: the two favicons stacked.
 */
export function SplitRow({
  first,
  second,
  depth,
  activeId,
  exiting = false,
}: {
  first: TabView
  second: TabView
  depth: number
  activeId: string | null
  /** Both tabs are closed: the row plays its exit animation, inert. */
  exiting?: boolean
}) {
  const drag = useDragHandle(`tab:${first.id}`)
  const compact = useCompact()
  const trail = useContext(FolderTrailContext)
  const enterTooltip = useTooltipEnter()
  const shown = activeId === first.id || activeId === second.id
  const title = `${first.title} | ${second.title}`
  /** The half a click or right-click on `e` means: its title's, else the shown one, else the first. */
  const halfOf = (e: MouseEvent): TabView => {
    const half = (e.target as HTMLElement).closest<HTMLElement>('[data-half]')?.dataset['half']
    if (half === 'second' || (half === undefined && activeId === second.id)) return second
    return first
  }
  /** Both halves: a pinned or favourite split is unloaded and stays a split. */
  const close = (): void => {
    void window.bigBrowser.invoke('browser.closeSplit', { tabId: first.id })
  }
  const titleHalf = (tab: TabView, half: 'first' | 'second') => (
    <button
      className={styles.half}
      data-half={half}
      data-active={shown && tab.id === activeId}
      data-testid="split-half"
      onClick={(e) => {
        e.stopPropagation()
        activate(tab.id)
      }}
    >
      {tab.title}
    </button>
  )
  return (
    <li
      className={rowStyles.item}
      style={{ ...tilt(first.id), '--depth': depth } as CSSProperties}
      data-testid={exiting ? 'split-exiting' : 'split-row'}
      data-depth={depth}
      data-exiting={exiting || undefined}
      inert={exiting}
      aria-hidden={exiting || undefined}
      data-drop={exiting ? undefined : `tab:${first.id}`}
      data-drag-row={exiting ? undefined : true}
      data-dragged={drag.dragged || undefined}
      onContextMenu={(e) => {
        e.preventDefault()
        showTabMenu(halfOf(e).id, e)
      }}
    >
      {compact &&
        trail.map((hue, index) => (
          <span
            key={index}
            className={rowStyles.folderBar}
            style={{ '--bar-hue': hue, '--bar-index': index } as CSSProperties}
            data-testid="folder-bar"
            aria-hidden="true"
          />
        ))}
      <div
        className={`${rowStyles.row} ${styles.row}`}
        data-active={shown}
        data-loaded={first.loaded || second.loaded}
        {...TOOLTIP_ROW}
        onPointerEnter={(e) => enterTooltip(e.currentTarget, title, first.host, first.faviconUrl)}
        onPointerDown={drag.onPointerDown}
        onClick={(e) => activate(halfOf(e).id)}
      >
        <button
          className={styles.favicons}
          aria-label={compact ? title : `Show ${title}`}
          aria-current={shown ? 'page' : undefined}
        >
          <Favicon tab={first} className={rowStyles.favicon} />
          <Favicon tab={second} className={rowStyles.favicon} />
        </button>
        <span className={`${rowStyles.title} ${styles.titles}`}>
          {titleHalf(first, 'first')}
          <span className={styles.bar} aria-hidden="true">
            |
          </span>
          {titleHalf(second, 'second')}
        </span>
      </div>
      <button
        className={rowStyles.close}
        aria-label="Close split"
        title="Close both tabs"
        onClick={close}
      >
        <X size={13} weight="bold" />
      </button>
    </li>
  )
}
