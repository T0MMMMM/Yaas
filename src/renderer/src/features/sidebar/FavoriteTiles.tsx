import type { TabView } from '../workspace/workspace'
import { Favicon } from './Favicon'
import { showTabMenu } from './menus'
import { tilt } from './tilt'
import styles from './FavoriteTiles.module.css'

/** The space's favourites: a 4-column grid of large favicons, above the pinned list. */
export function FavoriteTiles({ tabs, activeId }: { tabs: TabView[]; activeId: string | null }) {
  if (tabs.length === 0) return null
  return (
    <ul className={styles.tiles} aria-label="Favorites" data-testid="favorites">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <li key={tab.id} className={styles.item} style={tilt(tab.id)} data-testid="favorite">
            <button
              className={styles.tile}
              data-active={active}
              data-loaded={tab.loaded}
              aria-current={active ? 'page' : undefined}
              aria-label={tab.title}
              title={tab.title}
              onClick={() => void window.acab.invoke('browser.activateTab', { tabId: tab.id })}
              onContextMenu={(e) => {
                e.preventDefault()
                showTabMenu(tab.id)
              }}
            >
              <Favicon tab={tab} className={styles.favicon} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
