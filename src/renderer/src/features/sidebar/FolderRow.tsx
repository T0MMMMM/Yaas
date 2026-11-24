import { useContext, useMemo, useRef, useState } from 'react'
import { MAX_FOLDER_INDENT, type SidebarNode } from '../workspace/workspace'
import { useUi } from '../../stores/ui'
import { FolderTrailContext } from './FolderTrailContext'
import { FolderGlyph } from './glyphs'
import { folderHue, folderIcon } from './hash'
import { showFolderMenu } from './menus'
import { Rows } from './SidebarRows'
import { TabDragContext, useDragHandle } from './useTabDrag'
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
      void window.bigBrowser.invoke('browser.renameFolder', { folderId, name: next })
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
 * A pinned folder (collapsed state in main, renamable, its menu on right-click) or an
 * automatic folder of today (collapsed state per host in the UI store, no menu). Tabs and folders
 * dragged onto a pinned folder's row are filed into it; a pinned folder is dragged by its row. A
 * pinned folder's children (tabs and folders) are drawn by Rows one indent step further in, up
 * to MAX_FOLDER_INDENT steps.
 */
export function FolderRow({
  node,
  activeId,
  enteringIds,
  exits,
}: {
  node: FolderNode
  activeId: string | null
  enteringIds?: ReadonlySet<string>
  /** Whether a child row that left plays its exit (exitsWhenGone). */
  exits: (node: SidebarNode) => boolean
}) {
  const collapsedHosts = useUi((s) => s.collapsedHosts)
  const toggleHost = useUi((s) => s.toggleHost)
  const renaming = useUi((s) => node.kind === 'folder' && s.renamingFolderId === node.folder.id)
  const { zone } = useContext(TabDragContext)
  // An automatic folder is not dragged (its tabs are); its key is never pressed.
  const drag = useDragHandle(node.kind === 'folder' ? `folder:${node.folder.id}` : `folder:`)
  const outerTrail = useContext(FolderTrailContext)

  const auto = node.kind === 'auto-folder'
  const name = auto ? node.host : node.folder.name
  const collapsed = auto ? Boolean(collapsedHosts[node.host]) : node.folder.collapsed
  // A pinned folder's chosen hue or emoji; an automatic folder takes the hue of its host.
  const icon = auto ? { kind: 'hue' as const, hue: folderHue(name) } : folderIcon(node.folder)
  // Icon-only mode marks a filed tab with one bar per folder it sits in: the folder's hue (an
  // emoji icon keeps the hue of the name).
  const hue = String(icon.kind === 'hue' ? icon.hue : folderHue(name))
  const glyph =
    icon.kind === 'emoji' ? (
      <span className={styles.emoji} data-testid="folder-emoji" aria-hidden="true">
        {icon.emoji}
      </span>
    ) : (
      <FolderGlyph hue={icon.hue} open={!collapsed} />
    )
  // Past the deepest indent, a folder's rows line up with it.
  const indents = node.kind === 'auto-folder' || node.depth < MAX_FOLDER_INDENT
  const trail = useMemo(() => [...outerTrail, hue], [outerTrail, hue])

  const toggle = (): void => {
    if (node.kind === 'auto-folder') toggleHost(node.host)
    else {
      void window.bigBrowser.invoke('browser.setFolderCollapsed', {
        folderId: node.folder.id,
        collapsed: !collapsed,
      })
    }
  }

  return (
    <li
      className={styles.folder}
      data-testid={node.kind}
      data-collapsed={collapsed}
      // An automatic folder is measured as one block for a tab of another site (useTabDrag).
      data-drop={auto ? `auto:${node.host}` : undefined}
      // A dragged folder is hidden with its rows; its lifted clone follows the pointer.
      data-dragged={(!auto && drag.dragged) || undefined}
    >
      <div
        className={styles.header}
        // A tab dropped on a pinned folder files into it; an automatic folder's header does not.
        data-drop={auto ? undefined : `folder:${node.folder.id}`}
        data-drop-target={(!auto && zone === `folder:${node.folder.id}`) || undefined}
        data-drag-row
        onContextMenu={(e) => {
          if (node.kind !== 'folder') return
          e.preventDefault()
          showFolderMenu(node.folder.id, e, e.currentTarget)
        }}
      >
        {renaming && node.kind === 'folder' ? (
          <div className={styles.row}>
            {glyph}
            <NameField folderId={node.folder.id} name={node.folder.name} />
          </div>
        ) : (
          <button
            className={styles.row}
            aria-expanded={!collapsed}
            title={auto ? `${name} — tabs of this site` : name}
            // A pinned folder is dragged by its row, into another folder or elsewhere in pinned.
            onPointerDown={auto ? undefined : drag.onPointerDown}
            onClick={toggle}
          >
            {glyph}
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
      {/* Always mounted so the morph animates; inert (and hidden from assistive tech) when closed. */}
      {node.children.length > 0 && (
        <div className={styles.fold} data-collapsed={collapsed} inert={collapsed}>
          <FolderTrailContext.Provider value={trail}>
            <ul className={styles.children} data-indent={indents} aria-label={name}>
              <Rows
                nodes={node.children}
                activeId={activeId}
                enteringIds={enteringIds}
                exits={exits}
              />
            </ul>
          </FolderTrailContext.Provider>
        </div>
      )}
    </li>
  )
}
