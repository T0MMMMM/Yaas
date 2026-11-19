import {
  Folder,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
} from 'lucide-react'
import { ContextMeter, UsageMeter } from '../meters/Meters'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { DEMO_SPACES, findSession, type DemoEnvironment, type DemoSession } from './demoData'
import { SessionStatusIcon } from './SessionStatusIcon'
import styles from './Sidebar.module.css'

/** Arc-style vertical sidebar (DESIGN.md §2). Static demo data, nothing is wired yet. */
export function Sidebar() {
  const ui = useUi()
  const { settings, update } = useSettings()
  const switcher = settings?.spaceSwitcherStyle ?? 'emoji'
  const autoHide = settings?.sidebarAutoHide ?? false
  const metersInSidebar = settings?.metersPlacement === 'sidebar'

  const space = DEMO_SPACES.find((s) => s.id === ui.activeSpaceId) ?? DEMO_SPACES[0]
  if (!space) return null

  // Pinned section: pinned environments + individually pinned sessions. Below: the rest.
  const pinnedEnvs = space.environments.filter((e) => e.pinned)
  const otherEnvs = space.environments.filter((e) => !e.pinned)
  const pinnedSessions = otherEnvs.flatMap((e) => e.sessions.filter((s) => s.pinned))
  const found = ui.view === 'session' ? findSession(ui.activeSessionId) : null

  const renderSession = (session: DemoSession, nested: boolean) => (
    <li key={session.id}>
      <button
        className={styles.row}
        data-nested={nested}
        data-active={session.id === ui.activeSessionId && ui.view === 'session'}
        onClick={() => ui.openSession(session.id)}
      >
        <span className={styles.rowTitle}>{session.title}</span>
        <SessionStatusIcon status={session.status} />
      </button>
    </li>
  )

  const renderFolder = (env: DemoEnvironment) => {
    const open = !ui.closedEnvironments.has(env.id)
    const sessions = env.pinned ? env.sessions : env.sessions.filter((s) => !s.pinned)
    const Icon = open ? FolderOpen : Folder
    return (
      <li key={env.id} data-testid="environment">
        <button
          className={styles.folder}
          onClick={() => ui.toggleEnvironment(env.id)}
          aria-expanded={open}
          title={env.path}
        >
          <Icon size={15} className={styles.folderIcon} />
          <span className={styles.rowTitle}>{env.name}</span>
          {!open && <span className={styles.count}>{sessions.length}</span>}
        </button>
        {open && <ul className={styles.list}>{sessions.map((s) => renderSession(s, true))}</ul>}
      </li>
    )
  }

  return (
    <nav className={styles.sidebar} aria-label="Spaces and sessions" data-testid="sidebar">
      <div className={`${styles.titlebar} drag`}>
        <button
          className={`${styles.iconButton} no-drag`}
          onClick={() => void update({ sidebarAutoHide: !autoHide })}
          title={autoHide ? 'Keep sidebar open (⌘S)' : 'Auto-hide sidebar (⌘S)'}
          aria-label={autoHide ? 'Keep sidebar open' : 'Auto-hide sidebar'}
        >
          {autoHide ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <button className={`${styles.search} no-drag`}>
        <Search size={14} />
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>

      <div className={styles.scroll}>
        {(pinnedEnvs.length > 0 || pinnedSessions.length > 0) && (
          <>
            <ul className={styles.list} aria-label="Pinned" data-testid="pinned">
              {pinnedEnvs.map(renderFolder)}
              {pinnedSessions.map((s) => renderSession(s, false))}
            </ul>
            <hr className={styles.separator} />
          </>
        )}
        <ul className={styles.list}>{otherEnvs.map(renderFolder)}</ul>

        <button className={styles.newSession}>
          <Plus size={14} />
          <span>New session</span>
          <kbd>⌘T</kbd>
        </button>
      </div>

      {metersInSidebar && (
        <div className={styles.meters}>
          {found && <ContextMeter tokens={found.session.contextTokens} />}
          <UsageMeter layout="stacked" {...space.usage} />
        </div>
      )}

      <div className={styles.bottom}>
        <div className={styles.accounts} data-style={switcher} role="tablist" aria-label="Accounts">
          {DEMO_SPACES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === space.id}
              aria-label={s.label}
              title={s.label}
              className={styles.account}
              onClick={() => ui.setSpace(s.id)}
            >
              {switcher === 'emoji' && s.emoji}
              {switcher === 'letter' && s.label.charAt(0).toUpperCase()}
              {switcher === 'dots' && <span className={styles.dot} />}
            </button>
          ))}
        </div>
        <button
          className={styles.iconButton}
          onClick={ui.openSettings}
          aria-pressed={ui.view === 'settings'}
          title="Settings (⌘,)"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </nav>
  )
}
