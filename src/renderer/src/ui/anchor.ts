import type { PageBounds } from '@shared/ipc/contract'

/** Gap between a popover and the button it opens from (and the window's edges). */
export const POPOVER_GAP = 6

/** Rect of the button a popover opens from, in window coordinates, as `overlay.open` takes it. */
export function anchorOf(button: HTMLElement): PageBounds {
  const box = button.getBoundingClientRect()
  return {
    x: Math.max(0, Math.round(box.left)),
    y: Math.max(0, Math.round(box.top)),
    width: Math.round(box.width),
    height: Math.round(box.height),
  }
}
