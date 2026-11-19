import { ContextMeter, UsageMeter } from '../features/meters/Meters'
import { DEMO_SPACES, findSession, usageView } from '../features/sidebar/demoData'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'
import styles from './Shell.module.css'

/**
 * Context bar: its own card above the content card, only while a session is open
 * (DESIGN.md §2). Also the window drag region.
 */
export function ContextBar() {
  const { activeSessionId, activeSpaceId } = useUi()
  const placement = useSettings((s) => s.settings?.metersPlacement ?? 'contextbar')
  const found = findSession(activeSessionId)
  const space = DEMO_SPACES.find((s) => s.id === activeSpaceId)
  if (!found) return null

  return (
    <header className={`${styles.contextbar} drag`} data-testid="contextbar">
      <div className={styles.contextbarTitle}>
        <span className={styles.title}>{found.session.title}</span>
        <span className={styles.meta}>{found.environment.path}</span>
      </div>
      {placement === 'contextbar' && (
        <div className={styles.contextbarMeters}>
          <ContextMeter tokens={found.session.contextTokens} />
          {space && <UsageMeter layout="inline" {...usageView(space)} />}
        </div>
      )}
    </header>
  )
}
