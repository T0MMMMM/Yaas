import { POPOVER_GAP } from './anchor'

interface Point {
  x: number
  y: number
}
interface Size {
  width: number
  height: number
}

/** Where a menu card sits, and the corner it grows from (a CSS `transform-origin`). */
export interface CardPlace {
  left: number
  top: number
  origin: `${'left' | 'right'} ${'top' | 'bottom'}`
}

/** One axis: from `start` onward if it fits, else ending at `end`, else clamped to the window. */
function axis(start: number, end: number, size: number, room: number): [number, boolean] {
  if (start + size <= room - POPOVER_GAP) return [start, false]
  if (end - size >= POPOVER_GAP) return [end - size, true]
  return [Math.max(POPOVER_GAP, Math.min(start, room - size - POPOVER_GAP)), false]
}

/**
 * Places a menu card opened at `at` (a right-click: its top-left corner on the pointer) inside the
 * viewport: flipped to end at `flip` (default: the same point) where there is no room right or
 * below, and kept POPOVER_GAP clear of the window's edges. A submenu passes its row's right edge
 * as `at` and its left edge as `flip`.
 */
export function placeCard(at: Point, size: Size, viewport: Size, flip: Point = at): CardPlace {
  const [left, flippedX] = axis(at.x, flip.x, size.width, viewport.width)
  const [top, flippedY] = axis(at.y, flip.y, size.height, viewport.height)
  return {
    left,
    top,
    origin: `${flippedX ? 'right' : 'left'} ${flippedY ? 'bottom' : 'top'}`,
  }
}
