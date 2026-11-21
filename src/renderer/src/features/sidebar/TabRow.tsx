import { useContext, type CSSProperties } from 'react'
import { X } from '@phosphor-icons/react'
import type { TabView } from '../workspace/workspace'
import { Favicon } from './Favicon'
import { useCompact } from './CompactContext'
import { FolderTrailContext } from './FolderTrailContext'
import { showTabMenu } from './menus'
import { tilt } from './tilt'
import { useDragHandle } from './useTabDrag'
import { TOOLTIP_ROW, useTooltipEnter } from './useTooltip'
import styles from './TabRow.module.css'

/**
 * One tab of the pinned or today list, indented under its parent tab by `depth`. Dragging the row
 * moves the tab (useTabDrag).
 */
export function TabRow({
  tab,
  depth,
  active,
  exiting = false,
}: {
  tab: TabView
  depth: number
  active: boolean
  /** The tab is closed: the row plays its exit animation, inert and not counted as a tab. */
  exiting?: boolean
}) {
  const drag = useDragHandle(`tab:${tab.id}`)
  const compact = useCompact()
  const trail = useContext(FolderTrailContext)
  const enterTooltip = useTooltipEnter()
  return (
    <li
      className={styles.item}
      style={{ ...tilt(tab.id), '--depth': depth } as CSSProperties}
      data-testid={exiting ? 'tab-exiting' : 'tab'}
      data-depth={depth}
      data-exiting={exiting || undefined}
      inert={exiting}
      aria-hidden={exiting || undefined}
      data-drop={exiting ? undefined : `tab:${tab.id}`}
      // A row that moves aside while another is dragged (dragLift).
      data-drag-row={exiting ? undefined : true}
      data-dragged={drag.dragged || undefined}
      onContextMenu={(e) => {
        e.preventDefault()
        showTabMenu(tab.id, e)
      }}
    >
      {compact &&
        trail.map((hue, index) => (
          <span
            key={index}
            className={styles.folderBar}
            style={{ '--bar-hue': hue, '--bar-index': index } as CSSProperties}
            data-testid="folder-bar"
            aria-hidden="true"
          />
        ))}
      <button
        className={styles.row}
        data-active={active}
        data-loaded={tab.loaded}
        aria-current={active ? 'page' : undefined}
        aria-label={compact ? tab.title : undefined}
        {...TOOLTIP_ROW}
        onPointerEnter={(e) => enterTooltip(e.currentTarget, tab.title, tab.host, tab.faviconUrl)}
        onPointerDown={drag.onPointerDown}
        onClick={() => void window.bigBrowser.invoke('browser.activateTab', { tabId: tab.id })}
      >
        <Favicon tab={tab} className={styles.favicon} />
        <span className={styles.title}>{tab.title}</span>
      </button>
      <button
        className={styles.close}
        data-active={active}
        aria-label="Close tab"
        title="Close tab (⌘W)"
        onClick={() => void window.bigBrowser.invoke('browser.closeTab', { tabId: tab.id })}
      >
        <X size={13} weight="bold" />
      </button>
    </li>
  )
}
