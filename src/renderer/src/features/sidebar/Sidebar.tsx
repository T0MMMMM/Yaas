import { Folder, FolderOpen, Plus, Search, Settings } from 'lucide-react'
import { ContextMeter, UsageMeter } from '../meters/Meters'
import { useWorkspace } from '../workspace/useWorkspace'
import type { EnvironmentView, SessionView } from '../workspace/workspace'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { SessionStatusIcon } from './SessionStatusIcon'
import styles from './Sidebar.module.css'

/** Arc-style vertical sidebar (DESIGN.md §2). Renders the workspace views; no data logic here. */
export function Sidebar() {
  const ui = useUi()
  const { spaces, space, tree, open, usage } = useWorkspace()
  const settings = useSettings((s) => s.settings)
  const switcher = settings?.spaceSwitcherStyle ?? 'emoji'
  const metersInSidebar = settings?.metersPlacement === 'sidebar'
  if (!space || !tree) return null

  const renderSession = (session: SessionView, nested: boolean) => (
    <li key={session.id}>
      <button
        className={styles.row}
        data-nested={nested}
        data-active={session.id === open?.session.id && ui.view === 'session'}
        onClick={() => ui.openSession(session.id)}
      >
        <span className={styles.rowTitle}>{session.title}</span>
        <SessionStatusIcon status={session.status} />
      </button>
    </li>
  )

  const renderFolder = (env: EnvironmentView) => {
    const isOpen = !ui.closedEnvironments.has(env.id)
    const Icon = isOpen ? FolderOpen : Folder
    return (
      <li key={env.id} data-testid="environment">
        <button
          className={styles.folder}
          onClick={() => ui.toggleEnvironment(env.id)}
          aria-expanded={isOpen}
          title={env.path}
        >
          <Icon size={15} className={styles.folderIcon} />
          <span className={styles.rowTitle}>{env.name}</span>
          {!isOpen && <span className={styles.count}>{env.sessions.length}</span>}
        </button>
        {isOpen && (
          <ul className={styles.list}>{env.sessions.map((s) => renderSession(s, true))}</ul>
        )}
      </li>
    )
  }

  return (
    <nav className={styles.sidebar} aria-label="Spaces and sessions" data-testid="sidebar">
      <div className={`${styles.titlebar} drag`} />

      <button className={`${styles.search} no-drag`}>
        <Search size={14} />
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>

      <div className={styles.scroll}>
        {tree.pinned.length > 0 && (
          <>
            <ul className={styles.list} aria-label="Pinned" data-testid="pinned">
              {tree.pinned.map((item) =>
                item.kind === 'environment'
                  ? renderFolder(item.environment)
                  : renderSession(item.session, false),
              )}
            </ul>
            <hr className={styles.separator} />
          </>
        )}
        <ul className={styles.list}>{tree.environments.map(renderFolder)}</ul>

        <button className={styles.newSession}>
          <Plus size={14} />
          <span>New session</span>
          <kbd>⌘T</kbd>
        </button>
      </div>

      {metersInSidebar && open && (
        <div className={styles.meters}>
          <ContextMeter tokens={open.session.contextTokens} limit={open.session.contextLimit} />
          {usage && <UsageMeter layout="stacked" {...usage} />}
        </div>
      )}

      <div className={styles.bottom}>
        <div className={styles.accounts} data-style={switcher} role="tablist" aria-label="Accounts">
          {spaces.map((s) => (
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
