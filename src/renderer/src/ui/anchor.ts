import type { PageBounds } from '@shared/ipc/contract'

/** Gap between a popover and the button it opens from (and the window's edges). */
export const POPOVER_GAP = 10

/**
 * Rect of the button a popover opens from, in window coordinates, as `overlay.open` takes it: the
 * button at rest, without its hover rotation, scale or magnetic lean, which it drops while open.
 * Rotations and scales keep the centre in place; the `translate` moves it.
 */
export function anchorOf(button: HTMLElement): PageBounds {
  const box = button.getBoundingClientRect()
  const translate = getComputedStyle(button).translate
  const [dx = 0, dy = 0] = translate === 'none' ? [] : translate.split(' ').map(parseFloat)
  const width = button.offsetWidth
  const height = button.offsetHeight
  return {
    x: Math.max(0, Math.round(box.left + box.width / 2 - dx - width / 2)),
    y: Math.max(0, Math.round(box.top + box.height / 2 - dy - height / 2)),
    width,
    height,
  }
}
