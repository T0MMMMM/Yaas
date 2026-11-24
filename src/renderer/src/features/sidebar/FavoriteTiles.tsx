import { useContext, type CSSProperties } from 'react'
import type { TabView } from '../workspace/workspace'
import { Favicon } from './Favicon'
import { useFaviconColor } from './faviconColor'
import { showTabMenu } from './menus'
import { tilt } from './tilt'
import { TabDragContext, useDragHandle } from './useTabDrag'
import { TOOLTIP_ROW, useTooltipEnter } from './useTooltip'
import styles from './FavoriteTiles.module.css'

/**
 * A favourite, or a favourite split (`second`): one tile with both favicons, the pair shown on a
 * click (the half already shown stays so), its menu the shown half's or the first's.
 */
function Tile({
  tab,
  second,
  activeId,
}: {
  tab: TabView
  second: TabView | undefined
  activeId: string | null
}) {
  const drag = useDragHandle(`tab:${tab.id}`)
  const enterTooltip = useTooltipEnter()
  const shownHalf = second && activeId === second.id ? second : tab
  const active = activeId === tab.id || shownHalf !== tab
  const title = second ? `${tab.title} | ${second.title}` : tab.title
  const ringColor = useFaviconColor(shownHalf.faviconUrl)
  const itemStyle = {
    ...tilt(tab.id),
    ...(ringColor ? { '--tile-ring': ringColor } : {}),
  } as CSSProperties
  return (
    <li
      className={styles.item}
      style={itemStyle}
      data-testid="favorite"
      data-split={second ? true : undefined}
      data-drop={`tab:${tab.id}`}
      data-drag-row
      data-dragged={drag.dragged || undefined}
    >
      <button
        className={styles.tile}
        data-active={active}
        data-loaded={tab.loaded || (second?.loaded ?? false)}
        aria-current={active ? 'page' : undefined}
        aria-label={title}
        {...TOOLTIP_ROW}
        onPointerEnter={(e) => enterTooltip(e.currentTarget, title, tab.host, tab.faviconUrl)}
        onPointerDown={drag.onPointerDown}
        onClick={() =>
          void window.bigBrowser.invoke('browser.activateTab', { tabId: shownHalf.id })
        }
        onContextMenu={(e) => {
          e.preventDefault()
          showTabMenu(shownHalf.id, e)
        }}
      >
        {second ? (
          <span className={styles.pair}>
            <Favicon tab={tab} className={styles.favicon} />
            <Favicon tab={second} className={styles.favicon} />
          </span>
        ) : (
          <Favicon tab={tab} className={styles.favicon} />
        )}
      </button>
    </li>
  )
}

/**
 * The space's favourites: a grid of large favicons filling the width, above the pinned list. A tab
 * dropped on the grid becomes the last favourite, a dragged tile moves among the others; while a
 * tab is dragged and there are none yet, an empty grid is drawn to drop it on.
 */
export function FavoriteTiles({
  tabs,
  seconds,
  activeId,
}: {
  tabs: TabView[]
  /** The second half of each favourite split, by its first tab's id. */
  seconds: ReadonlyMap<string, TabView>
  activeId: string | null
}) {
  const { dragging, zone } = useContext(TabDragContext)
  // A folder can't be a favourite: only a dragged tab draws the empty grid.
  const tabDragged = [...dragging].some((key) => key.startsWith('tab:'))
  if (tabs.length === 0 && !tabDragged) return null
  return (
    <ul
      className={styles.tiles}
      aria-label="Favorites"
      data-testid="favorites"
      data-drop="list:favorites"
      data-drop-target={zone === 'list:favorites' || undefined}
    >
      {tabs.map((tab) => (
        <Tile key={tab.id} tab={tab} second={seconds.get(tab.id)} activeId={activeId} />
      ))}
      {tabs.length === 0 && <li className={styles.hint}>Drop here to add to Favorites</li>}
    </ul>
  )
}
