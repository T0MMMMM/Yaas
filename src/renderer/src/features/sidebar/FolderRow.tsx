import { useRef, useState } from 'react'
import { Folder, FolderOpen } from '@phosphor-icons/react'
import type { SidebarNode } from '../workspace/workspace'
import { useUi } from '../../stores/ui'
import { showFolderMenu } from './menus'
import { TabRow } from './TabRow'
import { tilt } from './tilt'
import styles from './FolderRow.module.css'

type FolderNode = Extract<SidebarNode, { kind: 'folder' | 'auto-folder' }>

/** Same bounds as the contract's folder names. */
const NAME_MAX = 80

/** The folder's name as an inline field: Enter or leaving it saves, Esc cancels. */
function NameField({ folderId, name }: { folderId: string; name: string }) {
  const [value, setValue] = useState(name)
  const done = useUi((s) => s.renameFolder)
  /** Esc: a blur that follows (or none) must not save. */
  const cancelled = useRef(false)
  const save = (): void => {
    if (cancelled.current) return
    const next = value.trim().slice(0, NAME_MAX)
    if (next && next !== name) {
      void window.acab.invoke('browser.renameFolder', { folderId, name: next })
    }
    done(null)
  }
  return (
    <input
      className={styles.name}
      aria-label="Folder name"
      value={value}
      maxLength={NAME_MAX}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') {
          cancelled.current = true
          done(null)
        }
      }}
    />
  )
}

/**
 * A pinned folder (collapsed state in main, renamable, native menu on right-click) or an
 * automatic folder of today (collapsed state per host in the UI store, no menu).
 */
export function FolderRow({ node, activeId }: { node: FolderNode; activeId: string | null }) {
  const collapsedHosts = useUi((s) => s.collapsedHosts)
  const toggleHost = useUi((s) => s.toggleHost)
  const renaming = useUi((s) => node.kind === 'folder' && s.renamingFolderId === node.folder.id)

  const auto = node.kind === 'auto-folder'
  const key = auto ? `auto:${node.host}` : node.folder.id
  const name = auto ? node.host : node.folder.name
  const collapsed = auto ? Boolean(collapsedHosts[node.host]) : node.folder.collapsed
  const Icon = collapsed ? Folder : FolderOpen

  const toggle = (): void => {
    if (node.kind === 'auto-folder') toggleHost(node.host)
    else {
      void window.acab.invoke('browser.setFolderCollapsed', {
        folderId: node.folder.id,
        collapsed: !collapsed,
      })
    }
  }

  return (
    <li className={styles.folder} data-testid={node.kind} data-collapsed={collapsed}>
      <div
        className={styles.header}
        style={tilt(key)}
        onContextMenu={(e) => {
          if (node.kind !== 'folder') return
          e.preventDefault()
          showFolderMenu(node.folder.id)
        }}
      >
        {renaming && node.kind === 'folder' ? (
          <div className={styles.row}>
            <Icon className={styles.icon} weight="fill" />
            <NameField folderId={node.folder.id} name={node.folder.name} />
          </div>
        ) : (
          <button
            className={styles.row}
            aria-expanded={!collapsed}
            title={auto ? `${name} — tabs of this site` : name}
            onClick={toggle}
          >
            <Icon className={styles.icon} weight="fill" />
            <span className={styles.title}>{name}</span>
            {/* Visual only: the name stays the folder's (aria-expanded says it is closed). */}
            {collapsed && (
              <span className={styles.count} aria-hidden="true">
                {node.children.length}
              </span>
            )}
          </button>
        )}
      </div>
      {!collapsed && node.children.length > 0 && (
        <ul className={styles.children} aria-label={name}>
          {node.children.map(
            (child) =>
              child.kind === 'tab' && (
                <TabRow
                  key={child.tab.id}
                  tab={child.tab}
                  depth={child.depth}
                  active={child.tab.id === activeId}
                />
              ),
          )}
        </ul>
      )}
    </li>
  )
}
