import { useContext } from 'react'
import type { TabView } from '../workspace/workspace'
import { Favicon } from './Favicon'
import { showTabMenu } from './menus'
import { tilt } from './tilt'
import { TabDragContext, useTabDragHandle } from './useTabDrag'
import { TOOLTIP_ROW, useTooltipEnter } from './useTooltip'
import styles from './FavoriteTiles.module.css'

function Tile({ tab, active }: { tab: TabView; active: boolean }) {
  const drag = useTabDragHandle(tab.id)
  const enterTooltip = useTooltipEnter()
  return (
    <li
      className={styles.item}
      style={tilt(tab.id)}
      data-testid="favorite"
      data-drop={`tab:${tab.id}`}
      data-dragged={drag.dragged || undefined}
    >
      <button
        className={styles.tile}
        data-active={active}
        data-loaded={tab.loaded}
        aria-current={active ? 'page' : undefined}
        aria-label={tab.title}
        {...TOOLTIP_ROW}
        onPointerEnter={(e) => enterTooltip(e.currentTarget, tab.title, tab.host)}
        onPointerDown={drag.onPointerDown}
        onClick={() => void window.bigBrowser.invoke('browser.activateTab', { tabId: tab.id })}
        onContextMenu={(e) => {
          e.preventDefault()
          showTabMenu(tab.id)
        }}
      >
        <Favicon tab={tab} className={styles.favicon} />
      </button>
    </li>
  )
}

/**
 * The space's favourites: a grid of large favicons filling the width, above the pinned list. A tab
 * dropped on the grid becomes the last favourite; while a tab is dragged and there are none
 * yet, an empty grid is drawn to drop it on.
 */
export function FavoriteTiles({ tabs, activeId }: { tabs: TabView[]; activeId: string | null }) {
  const { dragging, zone } = useContext(TabDragContext)
  if (tabs.length === 0 && dragging.size === 0) return null
  return (
    <ul
      className={styles.tiles}
      aria-label="Favorites"
      data-testid="favorites"
      data-drop="list:favorites"
      data-drop-target={zone === 'list:favorites' || undefined}
    >
      {tabs.map((tab) => (
        <Tile key={tab.id} tab={tab} active={tab.id === activeId} />
      ))}
      {tabs.length === 0 && <li className={styles.hint}>Drop here to add to Favorites</li>}
    </ul>
  )
}
