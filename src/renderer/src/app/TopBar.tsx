import { ContextMeter, UsageMeter } from '../features/meters/Meters'
import { DEMO_SPACES, findSession } from '../features/sidebar/demoData'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'
import styles from './Shell.module.css'

/** Bar above the content card, on the window frame; also the drag region (DESIGN.md §2). */
export function TopBar() {
  const { activeSessionId, activeSpaceId, view } = useUi()
  const placement = useSettings((s) => s.settings?.metersPlacement ?? 'topbar')
  const found = view === 'session' ? findSession(activeSessionId) : null
  const space = DEMO_SPACES.find((s) => s.id === activeSpaceId)

  return (
    <header className={`${styles.topbar} drag`} data-testid="topbar">
      <div className={styles.topbarTitle}>
        {view === 'settings' ? (
          <span className={styles.title}>Settings</span>
        ) : (
          found && (
            <>
              <span className={styles.title}>{found.session.title}</span>
              <span className={styles.meta}>{found.environment.path}</span>
            </>
          )
        )}
      </div>
      {placement === 'topbar' && (
        <div className={styles.topbarMeters}>
          {found && <ContextMeter tokens={found.session.contextTokens} />}
          {space && <UsageMeter layout="inline" {...space.usage} />}
        </div>
      )}
    </header>
  )
}
