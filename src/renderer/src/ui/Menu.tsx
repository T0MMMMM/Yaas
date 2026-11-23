import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CaretRight, Check } from '@phosphor-icons/react'
import type { PageBounds } from '@shared/ipc/contract'
import type { MenuSpecItem, Point } from '@shared/menuSpec'
import { POPOVER_GAP as GAP } from './anchor'
import { PopoverNeck } from './PopoverNeck'
import { useConnector } from './connector'
import { menuIcon } from './menuIcons'
import { placeCard } from './menuPlacement'
import { useDismiss } from './useDismiss'
import styles from './Menu.module.css'
import popover from './Popover.module.css'

type Entry = Extract<MenuSpecItem, { kind: 'item' }>

/** Where the menu opens: joined to a button, or at a point (a right-click) with no neck. */
export type MenuWhere = { anchor: PageBounds; placement: 'above' | 'below' } | { at: Point }

type MenuProps = MenuWhere & {
  /** A leading `{ kind: 'filter' }` draws a field that narrows the items by label. */
  items: MenuSpecItem[]
  /** Plays the exit animation (the overlay hides it once done). */
  closing?: boolean
  /** An enabled item without a submenu was chosen; the menu then closes. */
  onChoose(itemId: string): void
  onClose(): void
}

/** Space between a submenu card and the card it opens from. */
const SUBMENU_GAP = 4

/**
 * How long an open submenu stays open while the pointer crosses other rows of its card (moving
 * diagonally into it). Reaching the submenu in that time keeps it; resting on a row switches.
 */
export const SUBMENU_GRACE_MS = 250

/** An open submenu: the row it opens from, in window coordinates (layout, not transformed). */
interface OpenSubmenu {
  id: string
  /** Left and right edges of the card holding the row. */
  left: number
  right: number
  /** Top and bottom of the row. */
  top: number
  bottom: number
}

/** The items whose label has `query` (any case); separators only while nothing is typed. */
function filtered(items: MenuSpecItem[], query: string): MenuSpecItem[] {
  const q = query.trim().toLowerCase()
  const rows = items.filter((item) => item.kind !== 'filter')
  if (q === '') return rows
  return rows.filter((item) => item.kind === 'item' && item.label.toLowerCase().includes(q))
}

/** The rows of one card the keyboard moves through (its filter field first). */
function rowsOf(card: HTMLElement | null): HTMLElement[] {
  return [
    ...(card?.querySelectorAll<HTMLElement>(
      ':scope > input, :scope > [role="menuitem"]:not([aria-disabled="true"])',
    ) ?? []),
  ]
}

/**
 * A yab-shaped popover (spec, "Menus and settings"): a rounded opaque card of rows (icon or check,
 * label, shortcut or a submenu's caret). Joined to its button by the funnel, or opened at the
 * pointer and kept inside the window. A submenu opens beside its row (hover, →, Enter) as a second
 * card and closes with ← or by resting on another row (after a short grace, so the pointer can cross
 * rows on its way into it). Escape or a click outside closes everything.
 */
export function Menu(props: MenuProps) {
  const { items, closing = false, onChoose, onClose } = props
  const layer = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [path, setPath] = useState<OpenSubmenu[]>([])
  /** The row to focus once the next render is laid out (`null`: the card's first row). */
  const pendingFocus = useRef<{ level: number; id: string | null } | null>(null)
  /** A submenu switch waiting out the grace (the pointer may be on its way into the submenu). */
  const graceTimer = useRef<number | null>(null)
  const cancelGrace = () => {
    if (graceTimer.current !== null) window.clearTimeout(graceTimer.current)
    graceTimer.current = null
  }
  useEffect(() => cancelGrace, [])
  const hasFilter = items[0]?.kind === 'filter'

  // Each open submenu's items: the chain stops at a row that no longer has one.
  const levels: MenuSpecItem[][] = [filtered(items, query)]
  for (const open of path) {
    const parent = levels[levels.length - 1]?.find(
      (item): item is Entry => item.kind === 'item' && item.id === open.id,
    )
    if (!parent?.submenu) break
    levels.push(parent.submenu)
  }

  const cardAt = (level: number): HTMLElement | null =>
    layer.current?.querySelector<HTMLElement>(`:scope > [data-level="${level}"]`) ?? null

  useEffect(() => {
    // The filter field takes the keyboard; otherwise the card does, and ↓ reaches the first row.
    const first = layer.current?.querySelector<HTMLElement>(':scope > [data-level="0"]')
    ;(first?.querySelector<HTMLElement>(':scope > input') ?? first)?.focus()
  }, [])

  useLayoutEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    const card = cardAt(target.level)
    const row =
      target.id === null
        ? rowsOf(card).find((el) => el.tagName !== 'INPUT')
        : card?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(target.id)}"]`)
    row?.focus({ preventScroll: true })
  })

  useDismiss(layer, onClose)

  /** Opens `entry`'s submenu beside its row, closing any deeper one. */
  const openSubmenu = (level: number, entry: Entry, row: HTMLElement) => {
    const card = row.parentElement
    if (!card) return
    const top = card.offsetTop + card.clientTop + row.offsetTop
    const open: OpenSubmenu = {
      id: entry.id,
      left: card.offsetLeft,
      right: card.offsetLeft + card.offsetWidth,
      top,
      bottom: top + row.offsetHeight,
    }
    setPath((current) =>
      current[level]?.id === entry.id
        ? current.slice(0, level + 1)
        : [...current.slice(0, level), open],
    )
  }

  // The action first: the exit animation only delays hiding the menu. A closing menu takes no
  // more choices (a quick second Enter would run the item twice).
  const choose = (entry: Entry) => {
    if (closing || !entry.enabled || entry.submenu) return
    onChoose(entry.id)
    onClose()
  }

  const onRowClick = (level: number, entry: Entry, e: MouseEvent<HTMLButtonElement>) => {
    cancelGrace()
    if (!entry.submenu) return choose(entry)
    if (!entry.enabled) return
    openSubmenu(level, entry, e.currentTarget)
    // Enter or Space (a click with no pointer): into the submenu.
    if (e.detail === 0) pendingFocus.current = { level: level + 1, id: null }
  }

  const onKeyDown = (level: number, e: KeyboardEvent<HTMLDivElement>) => {
    cancelGrace()
    const active = document.activeElement as HTMLElement | null
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const rows = rowsOf(e.currentTarget)
      const index = active ? rows.indexOf(active) : -1
      const step = e.key === 'ArrowDown' ? 1 : -1
      const next = index === -1 ? (step === 1 ? 0 : rows.length - 1) : index + step
      rows[(next + rows.length) % rows.length]?.focus()
    } else if (e.key === 'ArrowRight') {
      const id = active?.dataset['itemId']
      const entry = levels[level]?.find(
        (item): item is Entry => item.kind === 'item' && item.id === id,
      )
      if (!active || !entry?.submenu || !entry.enabled) return
      e.preventDefault()
      openSubmenu(level, entry, active)
      pendingFocus.current = { level: level + 1, id: null }
    } else if (e.key === 'ArrowLeft' && level > 0) {
      e.preventDefault()
      const parent = path[level - 1]
      setPath((current) => current.slice(0, level - 1))
      if (parent) pendingFocus.current = { level: level - 1, id: parent.id }
    }
  }

  const onRowEnter = (level: number, entry: Entry, e: MouseEvent<HTMLButtonElement>) => {
    if (closing) return
    cancelGrace()
    const row = e.currentTarget
    // Hover follows the keyboard's row, except while the filter field has it: what is typed next
    // must still reach the field (the row shows its hover fill anyway).
    const focused = document.activeElement
    // The filter field is the menu's only input.
    const filtering = focused instanceof HTMLInputElement && layer.current?.contains(focused)
    if (entry.enabled && !filtering) row.focus({ preventScroll: true })
    // Hovering another row closes a deeper submenu; a submenu's row opens its own. While a
    // submenu of this card is open, that waits out the grace: the pointer may be crossing rows on
    // its way into it.
    const opensOwn = entry.submenu !== undefined && entry.enabled
    const switchSubmenu = () =>
      opensOwn
        ? openSubmenu(level, entry, row)
        : setPath((current) => (current.length > level ? current.slice(0, level) : current))
    const otherOpen = path[level] !== undefined && path[level].id !== entry.id
    if (!otherOpen) return switchSubmenu()
    graceTimer.current = window.setTimeout(() => {
      graceTimer.current = null
      switchSubmenu()
    }, SUBMENU_GRACE_MS)
  }

  const at = 'at' in props ? props.at : null
  const anchored = 'anchor' in props ? props : null

  return createPortal(
    // One layer for all the cards: a press on any of them is inside the menu (useDismiss).
    <div ref={layer} className={styles.layer}>
      {levels.map((rows, level) => (
        <MenuCard
          key={level === 0 ? 'root' : `${level}:${path[level - 1]?.id}`}
          level={level}
          rows={rows}
          open={path[level]?.id ?? null}
          from={level === 0 ? null : (path[level - 1] ?? null)}
          at={at}
          anchored={level === 0 ? anchored : null}
          closing={closing}
          filter={
            level === 0 && hasFilter ? (
              <input
                className={styles.filter}
                data-position={anchored?.placement === 'above' ? 'bottom' : 'top'}
                aria-label="Filter"
                placeholder="Filter…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPath([])
                }}
                onKeyDown={(e) => {
                  const first = levels[0]?.find(
                    (item): item is Entry => item.kind === 'item' && item.enabled && !item.submenu,
                  )
                  if (e.key === 'Enter' && first) choose(first)
                }}
                spellCheck={false}
              />
            ) : null
          }
          onKeyDown={(e) => onKeyDown(level, e)}
          onCardEnter={level > 0 ? cancelGrace : undefined}
          onRowEnter={(entry, e) => onRowEnter(level, entry, e)}
          onRowClick={(entry, e) => onRowClick(level, entry, e)}
        />
      ))}
    </div>,
    document.body,
  )
}

interface MenuCardProps {
  level: number
  rows: MenuSpecItem[]
  /** The row whose submenu is open. */
  open: string | null
  /** The row a submenu opens from (null for the menu itself). */
  from: OpenSubmenu | null
  at: Point | null
  anchored: { anchor: PageBounds; placement: 'above' | 'below' } | null
  closing: boolean
  filter: ReactNode
  onKeyDown(e: KeyboardEvent<HTMLDivElement>): void
  /** The pointer reached this card (a submenu: it stays open). */
  onCardEnter: (() => void) | undefined
  onRowEnter(entry: Entry, e: MouseEvent<HTMLButtonElement>): void
  onRowClick(entry: Entry, e: MouseEvent<HTMLButtonElement>): void
}

const NO_ANCHOR: PageBounds = { x: 0, y: 0, width: 0, height: 0 }

/** One card of the menu: the menu itself (level 0) or an open submenu beside its row. */
function MenuCard({
  level,
  rows,
  open,
  from,
  at,
  anchored,
  closing,
  filter,
  onKeyDown,
  onCardEnter,
  onRowEnter,
  onRowClick,
}: MenuCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const connector = useConnector(anchored?.anchor ?? NO_ANCHOR)
  const withIcons = rows.some((row) => row.kind === 'item' && (row.icon || row.checked))

  // A card opened at a point or beside a row: placed once its size is known, before it paints,
  // flipped where there is no room and grown from the corner it opens from.
  useLayoutEffect(() => {
    const card = ref.current
    if (!card || anchored) return
    const size = { width: card.offsetWidth, height: card.offsetHeight }
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    let place
    if (from) {
      const inset =
        (card.querySelector<HTMLElement>('[role="menuitem"]')?.offsetTop ?? 0) + card.clientTop
      place = placeCard({ x: from.right + SUBMENU_GAP, y: from.top - inset }, size, viewport, {
        x: from.left - SUBMENU_GAP,
        y: from.bottom + inset,
      })
    } else if (at) {
      place = placeCard(at, size, viewport)
    } else return
    card.style.left = `${place.left}px`
    card.style.top = `${place.top}px`
    card.style.transformOrigin = place.origin
  })

  // Geometry comes from the anchor at runtime, in viewport coordinates. It runs in the overlay
  // view, above the page, so it may extend over the page; it only keeps clear of the window's
  // right edge.
  const style: CSSProperties & { '--anchor-mid'?: string } = anchored
    ? {
        '--anchor-mid': `${anchored.anchor.x + anchored.anchor.width / 2}px`,
        maxWidth: Math.max(0, window.innerWidth - anchored.anchor.x - GAP),
        ...(anchored.placement === 'above'
          ? { bottom: window.innerHeight - anchored.anchor.y + GAP }
          : { top: anchored.anchor.y + anchored.anchor.height + GAP }),
      }
    : // Taller than the window: it scrolls.
      { maxHeight: Math.max(0, window.innerHeight - 2 * GAP), overflowY: 'auto' }

  return (
    <div
      ref={ref}
      className={`${styles.menu} ${anchored ? popover.alignLeft : ''} no-drag`}
      style={style}
      data-level={level}
      data-placement={anchored?.placement}
      data-icons={withIcons || undefined}
      data-state={closing ? 'closing' : 'open'}
      // While it animates out it takes no focus, keys or clicks.
      inert={closing}
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerEnter={onCardEnter}
      data-testid={level === 0 ? 'menu' : 'submenu'}
    >
      {anchored && (
        <PopoverNeck ref={connector} side={anchored.placement === 'above' ? 'bottom' : 'top'} />
      )}
      {anchored?.placement !== 'above' && filter}
      {rows.map((row, i) => {
        if (row.kind !== 'item') return <hr key={`separator-${i}`} className={styles.separator} />
        const Icon = row.icon ? menuIcon(row.icon) : null
        return (
          <button
            key={row.id}
            role="menuitem"
            className={styles.item}
            data-item-id={row.id}
            data-open={open === row.id || undefined}
            aria-disabled={!row.enabled || undefined}
            aria-haspopup={row.submenu ? 'menu' : undefined}
            aria-expanded={row.submenu ? open === row.id : undefined}
            onPointerEnter={(e) => onRowEnter(row, e)}
            onClick={(e) => onRowClick(row, e)}
          >
            {withIcons && (
              <span className={styles.icon} aria-hidden>
                {row.checked ? (
                  <Check size={16} weight="bold" />
                ) : Icon ? (
                  <Icon size={16} />
                ) : row.icon?.startsWith('data:image/') ? (
                  <img src={row.icon} alt="" className={styles.image} />
                ) : null}
              </span>
            )}
            <span className={styles.label}>{row.label}</span>
            {row.submenu ? (
              <CaretRight size={12} weight="bold" className={styles.caret} aria-hidden />
            ) : (
              row.shortcut && <kbd className={styles.shortcut}>{row.shortcut}</kbd>
            )}
          </button>
        )
      })}
      {anchored?.placement === 'above' && filter}
    </div>
  )
}
