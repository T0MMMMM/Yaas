import { useEffect, useRef, useState } from 'react'
import { CaretDown, DotsThree } from '@phosphor-icons/react'
import type { SpaceSummary } from '../workspace/workspace'
import { useUi } from '../../stores/ui'
import { anchorOf } from '../../ui/anchor'
import { useCompact } from './CompactContext'
import styles from './SpaceHeader.module.css'

/** Same bounds as the contract's space names. */
const NAME_MAX = 40

/** Opens the space's menu from `button` (below it, joined by the funnel); its cards open there too. */
function openSpaceMenu(spaceId: string, button: HTMLElement): Promise<void> {
  return window.bigBrowser.invoke('browser.showSpaceMenu', { spaceId, anchor: anchorOf(button) })
}

/** The space's name as an inline field: Enter or leaving it saves, Esc cancels. */
function NameField({ space }: { space: SpaceSummary }) {
  const [value, setValue] = useState(space.label)
  const done = useUi((s) => s.renameSpace)
  /** Esc: a blur that follows (or none) must not save. */
  const cancelled = useRef(false)
  const save = (): void => {
    if (cancelled.current) return
    const next = value.trim().slice(0, NAME_MAX)
    if (next && next !== space.label) {
      void window.bigBrowser.invoke('browser.renameSpace', { spaceId: space.id, name: next })
    }
    done(null)
  }
  return (
    <input
      className={styles.field}
      aria-label="Space name"
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
 * The head of the space section (spec goals 4, 7, 8): the space's emoji (or its colour dot), its
 * name and a "…" button that opens the space menu. On hover the emoji turns into a chevron that
 * folds the section (kept in main). Rename Space… turns the name into a field. Icon-only, only
 * the emoji (or dot) remains; a right-click still opens the menu, but Rename Space… does nothing
 * there (the name field is hidden).
 */
export function SpaceHeader({ space }: { space: SpaceSummary }) {
  const compact = useCompact()
  const renamingRequested = useUi((s) => s.renamingSpaceId === space.id)
  const renaming = renamingRequested && !compact
  const stopRenaming = useUi((s) => s.renameSpace)
  const more = useRef<HTMLButtonElement>(null)
  /** Whether the space menu (or one of its cards) is open from the "…" button. */
  const [menuOpen, setMenuOpen] = useState(false)
  const collapsed = space.sectionCollapsed

  useEffect(() => window.bigBrowser.on('overlay.closed', () => setMenuOpen(false)), [])
  // A rename asked for while icon-only is dropped, not kept for when the sidebar widens.
  useEffect(() => {
    if (renamingRequested && compact) stopRenaming(null)
  }, [renamingRequested, compact, stopRenaming])

  const open = (button: HTMLElement): void => {
    setMenuOpen(true)
    // If the menu cannot open, nothing will ever send `overlay.closed`.
    openSpaceMenu(space.id, button).catch(() => setMenuOpen(false))
  }

  return (
    <div
      className={styles.header}
      data-testid="space-header"
      data-menu-open={menuOpen || undefined}
      onContextMenu={(e) => {
        e.preventDefault()
        // Icon-only, the "…" button is hidden: the menu opens from the whole header.
        open(more.current?.offsetParent ? more.current : e.currentTarget)
      }}
    >
      <button
        className={styles.toggle}
        aria-label={collapsed ? 'Expand space section' : 'Collapse space section'}
        aria-expanded={!collapsed}
        title={space.label}
        onClick={() =>
          void window.bigBrowser.invoke('browser.setSpaceSectionCollapsed', {
            spaceId: space.id,
            collapsed: !collapsed,
          })
        }
      >
        <span className={styles.glyph} style={{ color: space.color }} aria-hidden="true">
          {space.icon ?? <span className={styles.dot} />}
        </span>
        <CaretDown
          className={styles.chevron}
          data-collapsed={collapsed}
          weight="bold"
          aria-hidden="true"
          data-testid="space-chevron"
        />
      </button>
      {renaming ? <NameField space={space} /> : <span className={styles.name}>{space.label}</span>}
      <button
        ref={more}
        className={styles.more}
        aria-label="Space options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="Space options"
        onClick={(e) => open(e.currentTarget)}
      >
        <DotsThree size={16} weight="bold" />
      </button>
    </div>
  )
}
