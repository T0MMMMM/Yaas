import { ContextMeter, UsageMeter } from '../features/meters/Meters'
import { useWorkspace } from '../features/workspace/useWorkspace'
import { useSettings } from '../stores/settings'
import styles from './Shell.module.css'

/**
 * Context bar: its own card above the content card, only while a session is open
 * (DESIGN.md §2). Also the window drag region.
 */
export function ContextBar() {
  const { open, usage } = useWorkspace()
  const placement = useSettings((s) => s.settings?.metersPlacement ?? 'contextbar')
  if (!open) return null

  return (
    <header className={`${styles.contextbar} drag`} data-testid="contextbar">
      <div className={styles.contextbarTitle}>
        <span className={styles.title}>{open.session.title}</span>
        <span className={styles.meta}>{open.environment.path}</span>
      </div>
      {placement === 'contextbar' && (
        <div className={styles.contextbarMeters}>
          <ContextMeter tokens={open.session.contextTokens} limit={open.session.contextLimit} />
          {usage && <UsageMeter layout="inline" {...usage} />}
        </div>
      )}
    </header>
  )
}
