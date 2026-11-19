import { ChevronRight, Pin, Plus, Search } from 'lucide-react'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { CONTEXT_LIMIT, DEMO_SPACES, type DemoSession } from './demoData'
import { SessionStatusIcon } from './SessionStatusIcon'
import styles from './Sidebar.module.css'

/** Arc-style vertical sidebar (DESIGN.md §2). Static demo data, nothing is wired yet. */
export function Sidebar() {
  const { activeSpaceId, activeSessionId, collapsedEnvironments, setSpace, openSession } = useUi()
  const toggleEnvironment = useUi((s) => s.toggleEnvironment)
  const switcherStyle = useSettings((s) => s.settings?.spaceSwitcherStyle ?? 'icons')

  const space = DEMO_SPACES.find((s) => s.id === activeSpaceId) ?? DEMO_SPACES[0]
  if (!space) return null

  const allSessions = space.environments.flatMap((e) => e.sessions)
  const pinnedSessions = allSessions.filter((s) => s.pinned)
  const environments = [...space.environments].sort((a, b) => Number(b.pinned) - Number(a.pinned))
  const activeSession = allSessions.find((s) => s.id === activeSessionId) ?? null

  const renderRow = (session: DemoSession) => (
    <li key={session.id}>
      <button
        className={styles.tab}
        data-active={session.id === activeSessionId}
        onClick={() => openSession(session.id)}
      >
        <span className={styles.tabTitle}>{session.title}</span>
        <SessionStatusIcon status={session.status} />
      </button>
    </li>
  )

  return (
    <nav className={styles.sidebar} aria-label="Spaces and sessions" data-testid="sidebar">
      <div className={`${styles.titlebar} drag`} />

      <button className={`${styles.search} no-drag`}>
        <Search size={14} />
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>

      {pinnedSessions.length > 0 && (
        <div className={styles.tiles} aria-label="Pinned sessions">
          {pinnedSessions.map((session) => (
            <button
              key={session.id}
              className={styles.tile}
              data-active={session.id === activeSessionId}
              onClick={() => openSession(session.id)}
              title={session.title}
            >
              <span className={styles.tileTitle}>{session.title}</span>
              <SessionStatusIcon status={session.status} />
            </button>
          ))}
        </div>
      )}

      <div className={styles.environments}>
        {environments.map((env) => {
          const sessions = env.sessions.filter((s) => !s.pinned)
          const collapsed = collapsedEnvironments.has(env.id)
          return (
            <section key={env.id} className={styles.environment} data-testid="environment">
              <button
                className={styles.envHeader}
                onClick={() => toggleEnvironment(env.id)}
                aria-expanded={!collapsed}
                title={env.path}
              >
                <ChevronRight size={12} className={styles.chevron} data-open={!collapsed} />
                <span className={styles.envName}>{env.name}</span>
                {env.pinned && <Pin size={11} className={styles.envPin} aria-label="Pinned" />}
                {collapsed && <span className={styles.count}>{sessions.length}</span>}
              </button>
              {!collapsed && <ul className={styles.list}>{sessions.map(renderRow)}</ul>}
            </section>
          )
        })}
      </div>

      <button className={styles.newSession}>
        <Plus size={14} />
        <span>New session</span>
        <kbd>⌘T</kbd>
      </button>

      <div className={styles.spacer} />

      {activeSession && <ContextIndicator tokens={activeSession.contextTokens} />}

      <div className={styles.usage} title="Usage of this account (demo values)">
        <Gauge label="5h" value={space.usage.fiveHour} />
        <Gauge label="7d" value={space.usage.sevenDay} />
      </div>

      <div
        className={styles.switcher}
        data-style={switcherStyle}
        role="tablist"
        aria-label="Spaces"
      >
        {DEMO_SPACES.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === space.id}
            aria-label={s.label}
            title={s.label}
            className={styles.spaceItem}
            onClick={() => setSpace(s.id)}
          >
            {switcherStyle === 'icons' ? <s.icon size={15} /> : <span className={styles.dot} />}
          </button>
        ))}
      </div>
    </nav>
  )
}

function ContextIndicator({ tokens }: { tokens: number }) {
  const ratio = Math.min(tokens / CONTEXT_LIMIT, 1)
  const r = 6
  const circumference = 2 * Math.PI * r
  const format = (n: number) => `${Math.round(n / 1000)}k`
  return (
    <div
      className={styles.context}
      data-warn={ratio > 0.8}
      data-testid="context-indicator"
      title="Context window of this session (demo value)"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r={r} className={styles.ringTrack} />
        <circle
          cx="8"
          cy="8"
          r={r}
          className={styles.ringFill}
          strokeDasharray={`${ratio * circumference} ${circumference}`}
        />
      </svg>
      <span>Context</span>
      <span className={styles.contextValue}>
        {format(tokens)} / {format(CONTEXT_LIMIT)}
      </span>
    </div>
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
