import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Icon } from '@phosphor-icons/react'
import styles from './Menu.module.css'

export type MenuItem =
  { id: string; label: string; icon: Icon; shortcut?: string; onSelect(): void } | 'separator'

interface MenuProps {
  /** The button the menu opens from. It opens upward and never extends past its right edge. */
  anchor: HTMLElement | null
  items: MenuItem[]
  onClose(): void
}

/** Gap between the anchor and the menu, and the menu's margin to the window's left edge. */
const GAP = 6

/**
 * A yab-shaped popover (spec, "Menus and settings"): a rounded glass card with rows of icon,
 * label and shortcut. Closes on Escape, a click outside or a choice.
 */
export function Menu({ anchor, items, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Escape closes the menu only, not the view behind it.
      e.stopPropagation()
      onClose()
    }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || anchor?.contains(target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onDown, true)
    }
  }, [anchor, onClose])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const rows = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const index = rows.indexOf(document.activeElement as HTMLElement)
    const step = e.key === 'ArrowDown' ? 1 : -1
    rows[(index + step + rows.length) % rows.length]?.focus()
  }

  if (!anchor) return null
  // Geometry comes from the anchor at runtime, in viewport coordinates: the menu is portalled to
  // <body> because an ancestor with backdrop-filter (liquid glass) would otherwise become the
  // containing block of a fixed element. A page view is drawn above the UI, so the menu must stay
  // inside the sidebar: it ends at the anchor's right edge.
  const box = anchor.getBoundingClientRect()
  const place: CSSProperties = {
    bottom: window.innerHeight - box.top + GAP,
    right: window.innerWidth - box.right,
    maxWidth: Math.max(0, box.right - GAP),
  }

  return createPortal(
    <div
      ref={ref}
      className={`${styles.menu} no-drag`}
      style={place}
      role="menu"
      onKeyDown={onKeyDown}
      data-testid="menu"
    >
      {items.map((item, i) =>
        item === 'separator' ? (
          <hr key={`separator-${i}`} className={styles.separator} />
        ) : (
          <button
            key={item.id}
            role="menuitem"
            className={styles.item}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            <item.icon size={16} className={styles.icon} />
            <span className={styles.label}>{item.label}</span>
            {item.shortcut && <kbd className={styles.shortcut}>{item.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}
