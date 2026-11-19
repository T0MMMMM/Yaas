import { ContextMeter, UsageMeter } from '../features/meters/Meters'
import { DEMO_SPACES, findSession, usageView } from '../features/sidebar/demoData'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'
import styles from './Shell.module.css'

/** Top bar card above the content card; also the window drag region (DESIGN.md §2). */
export function TopBar() {
  const { activeSessionId, activeSpaceId } = useUi()
  const placement = useSettings((s) => s.settings?.metersPlacement ?? 'topbar')
  const found = findSession(activeSessionId)
  const space = DEMO_SPACES.find((s) => s.id === activeSpaceId)

  return (
    <header className={`${styles.topbar} drag`} data-testid="topbar">
      <div className={styles.topbarTitle}>
        {found && (
          <>
            <span className={styles.title}>{found.session.title}</span>
            <span className={styles.meta}>{found.environment.path}</span>
          </>
        )}
      </div>
      {placement === 'topbar' && (
        <div className={styles.topbarMeters}>
          {found && <ContextMeter tokens={found.session.contextTokens} />}
          {space && <UsageMeter layout="inline" {...usageView(space)} />}
        </div>
      )}
    </header>
  )
}
