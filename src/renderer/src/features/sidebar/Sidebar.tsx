import type { CSSProperties } from 'react'
import { DotsThree, GearSix, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { ContextMeter, UsageMeter } from '../meters/Meters'
import { useWorkspace } from '../workspace/useWorkspace'
import type { EnvironmentView, SessionView } from '../workspace/workspace'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { useMagnetic } from '../../ui/useMagnetic'
import { FolderGlyph, SessionGlyph } from './glyphs'
import { hashUnit } from './hash'
import { SessionStatusIcon } from './SessionStatusIcon'
import styles from './Sidebar.module.css'

/**
 * Each card gets its own tilt, stable per id, so a list never moves in lockstep:
 * hover −0.3…−1.1° or +0.3…+1.1°, selected a little more.
 */
function tilt(id: string): CSSProperties {
  const sign = hashUnit(id, 7) < 0.5 ? -1 : 1
  const hover = sign * (0.3 + hashUnit(id, 1) * 0.8)
  const selected = sign * (0.6 + hashUnit(id, 2) * 0.9)
  return { '--tilt-hover': `${hover}deg`, '--tilt-selected': `${selected}deg` } as CSSProperties
}

/** Arc-style vertical sidebar (DESIGN.md §2). Renders the workspace views; no data logic here. */
export function Sidebar() {
  const ui = useUi()
  const { spaces, space, tree, open, usage } = useWorkspace()
  const settings = useSettings((s) => s.settings)
  const switcher = settings?.spaceSwitcherStyle ?? 'emoji'
  const metersInSidebar = settings?.metersPlacement === 'sidebar'
  const magnet = useMagnetic<HTMLButtonElement>(0.4)
  if (!space || !tree) return null

  const renderSession = (session: SessionView, nested: boolean) => (
    <li key={session.id} className={styles.item} style={tilt(session.id)}>
      <button
        className={styles.row}
        data-nested={nested}
        data-active={session.id === open?.session.id && ui.view === 'session'}
        onClick={() => ui.openSession(session.id)}
      >
        <SessionGlyph />
        <span className={styles.rowTitle}>{session.title}</span>
        <SessionStatusIcon status={session.status} />
      </button>
      <button className={styles.more} aria-label="Session actions" title="More">
        <DotsThree size={18} weight="bold" />
      </button>
    </li>
  )

  const renderFolder = (env: EnvironmentView) => {
    const isOpen = !ui.closedEnvironments.has(env.id)
    return (
      <li key={env.id} data-testid="environment" style={tilt(env.id)}>
        <button
          className={styles.folder}
          onClick={() => ui.toggleEnvironment(env.id)}
          aria-expanded={isOpen}
          title={env.path}
        >
          <FolderGlyph name={env.name} open={isOpen} />
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
        <MagnifyingGlass size={15} weight="bold" />
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
          <Plus size={13} weight="bold" />
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
              style={tilt(s.id)}
              onClick={() => ui.setSpace(s.id)}
              {...magnet}
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
          {...magnet}
          aria-pressed={ui.view === 'settings'}
          title="Settings (⌘,)"
          aria-label="Settings"
        >
          <GearSix size={18} />
        </button>
      </div>
    </nav>
  )
}
