import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Icon } from '@phosphor-icons/react'
import type { PageBounds } from '@shared/ipc/contract'
import { useDismiss } from './useDismiss'
import styles from './Menu.module.css'

export type MenuItem =
  { id: string; label: string; icon: Icon; shortcut?: string; onSelect(): void } | 'separator'

interface MenuProps {
  /** Rect of the button the menu opens from, in viewport coordinates. */
  anchor: PageBounds
  /** Opens above the anchor or below it; either way it starts at the anchor's left edge. */
  placement: 'above' | 'below'
  items: MenuItem[]
  onClose(): void
}

/** Gap between the anchor and the menu, and the menu's margin to the window's edges. */
const GAP = 6

/**
 * A yab-shaped popover (spec, "Menus and settings"): a rounded glass card with rows of icon,
 * label and shortcut. Closes on Escape, a click outside or a choice.
 */
export function Menu({ anchor, placement, items, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [])

  useDismiss(ref, onClose)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const rows = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const index = rows.indexOf(document.activeElement as HTMLElement)
    const step = e.key === 'ArrowDown' ? 1 : -1
    rows[(index + step + rows.length) % rows.length]?.focus()
  }

  // Geometry comes from the anchor at runtime, in viewport coordinates: the menu is portalled to
  // <body> because an ancestor with backdrop-filter (liquid glass) would otherwise become the
  // containing block of a fixed element. It runs in the overlay view, above the page, so it may
  // extend over the page; it only keeps clear of the window's right edge.
  const place: CSSProperties = {
    left: anchor.x,
    maxWidth: Math.max(0, window.innerWidth - anchor.x - GAP),
    ...(placement === 'above'
      ? { bottom: window.innerHeight - anchor.y + GAP }
      : { top: anchor.y + anchor.height + GAP }),
  }

  return createPortal(
    <div
      ref={ref}
      className={`${styles.menu} no-drag`}
      style={place}
      data-placement={placement}
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
