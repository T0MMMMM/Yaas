import { gapOffsets, slotShifts, type FlipRow } from './flip'
import type { DropHit } from './useTabDrag'

// The visuals of a sidebar drag (useTabDrag): the dragged row lifts as a clone that follows the
// pointer, its slot stays (the row is hidden by the sidebar), and the other rows move aside with
// a CSS `translate` (transitioned by the sidebar while it drags) so a gap opens where the row
// will land. Imperative on purpose: it changes every pointer move, and React keeps its own styles.

/** An element's box as laid out, without any translate a drag gave it (client coordinates). */
export function layoutBox(
  el: HTMLElement,
  container: HTMLElement,
): { top: number; left: number; width: number; height: number } | null {
  let top = 0
  let left = 0
  let node: HTMLElement = el
  // offsetTop / offsetLeft ignore transforms and translates: the drop maths sees the layout.
  while (node !== container) {
    top += node.offsetTop
    left += node.offsetLeft
    const parent = node.offsetParent
    if (!(parent instanceof HTMLElement)) return null
    if (parent !== container) {
      top += parent.clientTop
      left += parent.clientLeft
    }
    node = parent
  }
  const box = container.getBoundingClientRect()
  return {
    top: box.top + container.clientTop + top - container.scrollTop,
    left: box.left + container.clientLeft + left - container.scrollLeft,
    width: el.offsetWidth,
    height: el.offsetHeight,
  }
}

/** Attributes a clone must not carry: it is no row, no drop target and no test handle. */
const CLONE_STRIPPED = [
  'id',
  'data-testid',
  'data-drop',
  'data-drop-target',
  'data-dragged',
  'data-drag-row',
]

/** A CSS time token of the container, in ms (0 under prefers-reduced-motion). */
function durationOf(el: HTMLElement, token: string): number {
  const value = getComputedStyle(el).getPropertyValue(token).trim()
  const ms = Number.parseFloat(value)
  if (Number.isNaN(ms)) return 0
  return value.endsWith('ms') ? ms : ms * 1000
}

const DRAGGED = '\u0000dragged'

export class DragLift {
  private readonly clone: HTMLElement
  /** The clone's resting place: where the dragged row was when the drag began. */
  private readonly start: DOMRect
  private dx = 0
  private dy = 0
  private shifted = new Set<HTMLElement>()
  private grown: HTMLElement | null = null

  /**
   * `root` is the dragged row's element (a tab row, a tile or a folder with its rows); `moving`
   * the elements that move with it (a today tab's subtree), `root` included.
   */
  constructor(
    private readonly container: HTMLElement,
    private readonly root: HTMLElement,
    private readonly moving: HTMLElement[],
    cloneClass: string | undefined,
  ) {
    this.start = root.getBoundingClientRect()
    const clone = root.cloneNode(true) as HTMLElement
    for (const el of [clone, ...clone.querySelectorAll('*')]) {
      for (const name of CLONE_STRIPPED) el.removeAttribute(name)
    }
    clone.setAttribute('data-testid', 'drag-clone')
    clone.setAttribute('aria-hidden', 'true')
    clone.inert = true
    Object.assign(clone.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: `${this.start.width}px`,
      height: `${this.start.height}px`,
      translate: '',
    })
    // Inside the sidebar, so the rows' styles still apply. A glass panel's backdrop filter makes
    // its own box the clone's frame: measure where (0, 0) lands, then place it on the row.
    const host = container.parentElement ?? container
    host.append(clone)
    const origin = clone.getBoundingClientRect()
    clone.style.left = `${this.start.left - origin.left}px`
    clone.style.top = `${this.start.top - origin.top}px`
    if (cloneClass) clone.classList.add(cloneClass)
    this.clone = clone
  }

  /** The clone follows the pointer, `dx`/`dy` from where it was pressed. */
  follow(dx: number, dy: number): void {
    this.dx = dx
    this.dy = dy
    this.clone.style.translate = `${dx}px ${dy}px`
  }

  /** Opens the gap a hit shows (a line between rows or a place among the tiles); none for a zone. */
  shift(hit: DropHit | null): void {
    const offsets = new Map<HTMLElement, string>()
    let grow: { list: HTMLElement; px: number } | null = null
    // A drop into a folder or a list, or onto a tab to split, opens no gap.
    const target = hit && hit.zone === null && 'section' in hit.target ? hit.target : null
    const list = target
      ? this.container.querySelector<HTMLElement>(`[data-drop="list:${target.section}"]`)
      : null
    if (hit && target && list) {
      const leaves = this.leavesOf(list)
      if (target.section === 'favorites' && list.contains(this.root)) {
        this.tileShifts(leaves, target.index, offsets)
      } else if (hit.line !== null) {
        grow = this.gapShifts(list, leaves, hit.line, offsets)
      }
    }
    for (const el of this.shifted) if (!offsets.has(el)) el.style.translate = ''
    for (const [el, value] of offsets) el.style.translate = value
    this.shifted = new Set(offsets.keys())
    if (this.grown && this.grown !== grow?.list) this.grown.style.paddingBottom = ''
    if (grow) grow.list.style.paddingBottom = `${grow.px}px`
    this.grown = grow?.list ?? null
  }

  /** Esc: the rows close the gap and the clone flies back to the row, then everything resets. */
  async cancel(): Promise<void> {
    this.shift(null)
    const home = this.root.getBoundingClientRect()
    const scale = getComputedStyle(this.clone).scale
    const flight = this.clone.animate(
      [
        { translate: `${this.dx}px ${this.dy}px`, scale: scale === 'none' ? '1' : scale },
        {
          translate: `${home.left - this.start.left}px ${home.top - this.start.top}px`,
          scale: '1',
        },
      ],
      {
        duration: durationOf(this.container, '--dur-base'),
        easing: getComputedStyle(this.container).getPropertyValue('--ease').trim() || 'ease',
        fill: 'forwards',
      },
    )
    await flight.finished.catch(() => undefined)
    this.clear()
  }

  /** Dropped: the clone goes; the rows keep the gap until the sidebar draws the new order. */
  drop(): void {
    this.clone.remove()
  }

  /** Everything back at once, without a transition (the new order is drawn where the gap was). */
  clear(): void {
    this.clone.remove()
    const touched = [...this.shifted, ...(this.grown ? [this.grown] : [])]
    for (const el of touched) {
      el.style.transition = 'none'
      el.style.translate = ''
      el.style.paddingBottom = ''
    }
    // Applies the reset now, so restoring the transition does not animate it.
    void this.container.offsetHeight
    for (const el of touched) el.style.transition = ''
    this.shifted.clear()
    this.grown = null
  }

  /** A list's drawn rows (tab rows, folder headers, tiles), the dragged ones left out. */
  private leavesOf(list: HTMLElement): HTMLElement[] {
    return [...list.querySelectorAll<HTMLElement>('[data-drag-row]')].filter(
      (el) => !el.closest('[inert]') && !this.moving.some((m) => m.contains(el)),
    )
  }

  /** The dragged block's height: the row, and below it what moves with it. */
  private blockHeight(): number {
    const own = layoutBox(this.root, this.container)
    if (!own) return 0
    const bottoms = this.moving
      .map((el) => layoutBox(el, this.container))
      .map((b) => (b ? b.top + b.height : 0))
    return Math.max(own.top + own.height, ...bottoms) - own.top
  }

  /** Rows of a list open a gap at `line`; a list the row comes into grows by it. */
  private gapShifts(
    list: HTMLElement,
    leaves: HTMLElement[],
    line: number,
    offsets: Map<HTMLElement, string>,
  ): { list: HTMLElement; px: number } | null {
    const rows: FlipRow[] = []
    leaves.forEach((el, i) => {
      const box = layoutBox(el, this.container)
      if (box) rows.push({ id: String(i), top: box.top, height: box.height })
    })
    const height = this.blockHeight()
    const own = layoutBox(this.root, this.container)
    const same = list.contains(this.root)
    const dragged: FlipRow = { id: DRAGGED, top: own?.top ?? 0, height }
    // In its own list the dragged row keeps its drawn place; from another list it comes last.
    const at = same ? rows.findIndex((r) => r.top > dragged.top) : -1
    rows.splice(at < 0 ? rows.length : at, 0, dragged)
    const target = rows.filter((r) => r.id !== DRAGGED && r.top + r.height / 2 < line).length
    const gaps = gapOffsets(rows, DRAGGED, target)
    leaves.forEach((el, i) => {
      const y = gaps[String(i)] ?? 0
      if (y !== 0) offsets.set(el, `0 ${y}px`)
    })
    return same ? null : { list, px: height }
  }

  /** The tiles move into the slots of their places once the dragged tile lands at `target`. */
  private tileShifts(leaves: HTMLElement[], target: number, offsets: Map<HTMLElement, string>) {
    const tiles = [this.root, ...leaves]
      .map((el) => ({ el, box: layoutBox(el, this.container) }))
      .filter((t) => t.box !== null)
      .sort(
        (a, b) => (a.box?.top ?? 0) - (b.box?.top ?? 0) || (a.box?.left ?? 0) - (b.box?.left ?? 0),
      )
    const slots = tiles.map((t, i) => ({
      id: t.el === this.root ? DRAGGED : String(i),
      left: t.box?.left ?? 0,
      top: t.box?.top ?? 0,
    }))
    const shifts = slotShifts(slots, DRAGGED, target)
    tiles.forEach((t, i) => {
      const s = shifts[String(i)]
      if (s && (s.x !== 0 || s.y !== 0)) offsets.set(t.el, `${s.x}px ${s.y}px`)
    })
  }
}
