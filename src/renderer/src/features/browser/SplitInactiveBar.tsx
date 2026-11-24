import type { TabView } from '../workspace/workspace'
import { addressBarTint } from './addressBarTint'
import styles from './SplitInactiveBar.module.css'

interface SplitInactiveBarProps {
  tab: TabView
}

/**
 * Quiet header strip for the unfocused half of a split card (redesign direction §4). Keeps both
 * split cards aligned at the same height so switching focus between halves never reflows either
 * page; clicking activates this half and moves the full AddressBar onto it.
 */
export function SplitInactiveBar({ tab }: SplitInactiveBarProps) {
  const barTint = addressBarTint(tab.themeColor)
  return (
    <button
      type="button"
      className={`${styles.bar} no-drag`}
      style={barTint}
      data-tinted={barTint ? true : undefined}
      data-testid="split-inactive-bar"
      aria-label={`Focus ${tab.title}`}
      title={tab.url}
      onClick={() => void window.bigBrowser.invoke('browser.activateTab', { tabId: tab.id })}
    >
      {tab.host ? (
        <>
          <span className={styles.host}>{tab.host}</span>
          {tab.rest && <span className={styles.rest}>{tab.rest}</span>}
        </>
      ) : (
        <span className={styles.host}>{tab.title}</span>
      )}
    </button>
  )
}
