import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Icon } from '@phosphor-icons/react'
import type { PageBounds } from '@shared/ipc/contract'
import { POPOVER_GAP as GAP } from './anchor'
import { PopoverNeck } from './PopoverNeck'
import { useConnector } from './connector'
import { useDismiss } from './useDismiss'
import styles from './Menu.module.css'
import popover from './Popover.module.css'

export type MenuItem =
  { id: string; label: string; icon: Icon; shortcut?: string; onSelect(): void } | 'separator'

interface MenuProps {
  /** Rect of the button the menu opens from, in viewport coordinates. */
  anchor: PageBounds
  /** Opens above the anchor or below it; either way the card is placed so the connector sits centred on the anchor. */
  placement: 'above' | 'below'
  items: MenuItem[]
  /** A field at the top that narrows the items to those whose label has what is typed. */
  filter?: boolean
  /** Plays the exit animation (the overlay hides it once done). */
  closing?: boolean
  onClose(): void
}

/** The items whose label has `query` (any case); separators only while nothing is typed. */
function filtered(items: MenuItem[], query: string): MenuItem[] {
  const q = query.trim().toLowerCase()
  if (q === '') return items
  return items.filter((item) => item !== 'separator' && item.label.toLowerCase().includes(q))
}

/**
 * A yab-shaped popover (spec, "Menus and settings"): a rounded opaque card joined to its button,
 * with rows of icon, label and shortcut. Closes on Escape, a click outside or a choice. With
 * `filter`, typing narrows the rows and Enter in the field picks the first one.
 */
export function Menu({
  anchor,
  placement,
  items,
  filter = false,
  closing = false,
  onClose,
}: MenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const shown = filtered(items, query)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, [role="menuitem"]')?.focus()
  }, [])

  useDismiss(ref, onClose)
  const connector = useConnector(anchor)

  // The action first: the exit animation only delays hiding the menu. A closing menu takes no
  // more choices (a quick second Enter would run the item twice).
  const choose = (item: Exclude<MenuItem, 'separator'>) => {
    if (closing) return
    item.onSelect()
    onClose()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const rows = [...(ref.current?.querySelectorAll<HTMLElement>('input, [role="menuitem"]') ?? [])]
    const index = rows.indexOf(document.activeElement as HTMLElement)
    const step = e.key === 'ArrowDown' ? 1 : -1
    rows[(index + step + rows.length) % rows.length]?.focus()
  }

  // Geometry comes from the anchor at runtime, in viewport coordinates: the menu is portalled to
  // <body> because an ancestor with backdrop-filter (liquid glass) would otherwise become the
  // containing block of a fixed element. It runs in the overlay view, above the page, so it may
  // extend over the page; it only keeps clear of the window's right edge.
  const place: CSSProperties & { '--anchor-mid': string } = {
    '--anchor-mid': `${anchor.x + anchor.width / 2}px`,
    maxWidth: Math.max(0, window.innerWidth - anchor.x - GAP),
    ...(placement === 'above'
      ? { bottom: window.innerHeight - anchor.y + GAP }
      : { top: anchor.y + anchor.height + GAP }),
  }

  return createPortal(
    <div
      ref={ref}
      className={`${styles.menu} ${popover.alignLeft} no-drag`}
      style={place}
      data-placement={placement}
      data-state={closing ? 'closing' : 'open'}
      // While it animates out it takes no focus, keys or clicks.
      inert={closing}
      role="menu"
      onKeyDown={onKeyDown}
      data-testid="menu"
    >
      <PopoverNeck ref={connector} side={placement === 'above' ? 'bottom' : 'top'} />
      {filter && (
        <input
          className={styles.filter}
          aria-label="Filter"
          placeholder="Filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            const first = shown.find((item) => item !== 'separator')
            if (e.key === 'Enter' && first) choose(first)
          }}
          spellCheck={false}
        />
      )}
      {shown.map((item, i) =>
        item === 'separator' ? (
          <hr key={`separator-${i}`} className={styles.separator} />
        ) : (
          <button
            key={item.id}
            role="menuitem"
            className={styles.item}
            onClick={() => choose(item)}
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
