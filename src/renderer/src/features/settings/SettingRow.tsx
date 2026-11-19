import type { ReactNode } from 'react'
import styles from './SettingsView.module.css'

/** One option: label + description on the left, control on the right (DESIGN.md §7). */
export function SettingRow({
  label,
  description,
  soon = false,
  children,
}: {
  label: string
  description?: string
  /** Not built yet: shown disabled with a "Soon" tag. */
  soon?: boolean
  children?: ReactNode
}) {
  return (
    <div className={styles.row} data-soon={soon}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>
          {label}
          {soon && <span className={styles.soon}>Soon</span>}
        </span>
        {description && <span className={styles.rowDescription}>{description}</span>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  )
}

export function SettingGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={styles.group}>
      {title && <h3 className={styles.groupTitle}>{title}</h3>}
      <div className={styles.groupRows}>{children}</div>
    </section>
  )
}
