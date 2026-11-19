import { useState } from 'react'
import type { SessionStatus } from '@shared/model'
import { DEMO_SPACES } from './demoData'
import styles from './Sidebar.module.css'

const STATUS: Record<SessionStatus, { glyph: string; label: string }> = {
  idle: { glyph: '', label: 'Idle' },
  running: { glyph: '◐', label: 'Running' },
  'needs-approval': { glyph: '!', label: 'Needs your approval' },
  done: { glyph: '✓', label: 'Done' },
  error: { glyph: '×', label: 'Error' },
  limited: { glyph: '⏸', label: 'Account limited' },
}

/** Arc-style vertical sidebar (DESIGN.md §2). Static demo data, nothing is wired yet. */
export function Sidebar() {
  const [spaceId, setSpaceId] = useState(DEMO_SPACES[0]?.id)
  const [activeId, setActiveId] = useState<string | null>(null)
  const space = DEMO_SPACES.find((s) => s.id === spaceId) ?? DEMO_SPACES[0]
  if (!space) return null

  const pinned = space.sessions.filter((s) => s.pinned)
  const others = space.sessions.filter((s) => !s.pinned)

  const renderTab = (session: (typeof space.sessions)[number]) => {
    const status = STATUS[session.status]
    return (
      <li key={session.id}>
        <button
          className={styles.tab}
          data-active={session.id === activeId}
          onClick={() => setActiveId(session.id)}
        >
          <span className={styles.tabTitle}>{session.title}</span>
          {status.glyph && (
            <span
              className={styles.status}
              data-status={session.status}
              title={status.label}
              aria-label={status.label}
            >
              {status.glyph}
            </span>
          )}
        </button>
      </li>
    )
  }

  return (
    <nav className={styles.sidebar} aria-label="Spaces and sessions" data-testid="sidebar">
      <div className={`${styles.titlebar} drag`} />

      <button className={`${styles.search} no-drag`}>
        <span>Search…</span>
        <kbd>⌘K</kbd>
      </button>

      <div className={styles.spaceName}>
        <span>{space.emoji}</span> {space.label}
      </div>

      <ul className={styles.list}>{pinned.map(renderTab)}</ul>
      {pinned.length > 0 && <hr className={styles.divider} />}
      <ul className={styles.list}>{others.map(renderTab)}</ul>

      <button className={styles.newSession}>
        <span>+ New session</span>
        <kbd>⌘T</kbd>
      </button>

      <div className={styles.spacer} />

      <div className={styles.usage} title="Usage of this account (demo values)">
        <Gauge label="5h" value={space.usage.fiveHour} />
        <Gauge label="7d" value={space.usage.sevenDay} />
      </div>

      <div className={styles.switcher} role="tablist" aria-label="Spaces">
        {DEMO_SPACES.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === space.id}
            className={styles.spaceChip}
            title={s.label}
            onClick={() => setSpaceId(s.id)}
          >
            {s.emoji}
          </button>
        ))}
        <button className={styles.spaceChip} title="Add account">
          +
        </button>
      </div>
    </nav>
  )
}

function Gauge({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.gauge}>
      <span className={styles.gaugeLabel}>{label}</span>
      <span className={styles.gaugeTrack}>
        <span className={styles.gaugeFill} style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className={styles.gaugeValue}>{Math.round(value * 100)}%</span>
    </div>
  )
}
