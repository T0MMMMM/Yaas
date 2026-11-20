import type { CSSProperties } from 'react'
import { X } from '@phosphor-icons/react'
import type { TabView } from '../workspace/workspace'
import { Favicon } from './Favicon'
import { showTabMenu } from './menus'
import { tilt } from './tilt'
import { useTabDragHandle } from './useTabDrag'
import styles from './TabRow.module.css'

/**
 * One tab of the pinned or today list, indented under its parent tab by `depth`. Dragging the row
 * moves the tab (useTabDrag).
 */
export function TabRow({ tab, depth, active }: { tab: TabView; depth: number; active: boolean }) {
  const drag = useTabDragHandle(tab.id)
  return (
    <li
      className={styles.item}
      style={{ ...tilt(tab.id), '--depth': depth } as CSSProperties}
      data-testid="tab"
      data-depth={depth}
      data-drop={`tab:${tab.id}`}
      data-dragged={drag.dragged || undefined}
      onContextMenu={(e) => {
        e.preventDefault()
        showTabMenu(tab.id)
      }}
    >
      <button
        className={styles.row}
        data-active={active}
        data-loaded={tab.loaded}
        aria-current={active ? 'page' : undefined}
        title={tab.url}
        onPointerDown={drag.onPointerDown}
        onClick={() => void window.acab.invoke('browser.activateTab', { tabId: tab.id })}
      >
        <Favicon tab={tab} className={styles.favicon} />
        <span className={styles.title}>{tab.title}</span>
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
}
