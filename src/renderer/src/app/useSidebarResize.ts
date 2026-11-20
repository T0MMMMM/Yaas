import { useCallback, useState, type PointerEvent } from 'react'
import {
  SIDEBAR_COMPACT,
  SIDEBAR_COMPACT_FROM,
  SIDEBAR_COMPACT_MAX,
  SIDEBAR_COMPACT_MIN,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  type Settings,
} from '@shared/ipc/contract'
import { useSettings } from '../stores/settings'

export const clampSidebar = (px: number) =>
  Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, px)))

const clampBetween = (px: number, min: number, max: number): number =>
  Math.round(Math.min(max, Math.max(min, px)))

/**
 * The width a drag settles on: from the compact threshold up, clamped to it…max; under it, the
 * icon-only range (never a half-compact width).
 */
export const snapWidth = (px: number): number =>
  px >= SIDEBAR_COMPACT_FROM
    ? clampBetween(px, SIDEBAR_COMPACT_FROM, SIDEBAR_MAX)
    : clampBetween(px, SIDEBAR_COMPACT_MIN, SIDEBAR_COMPACT_MAX)

/**
 * What the address bar's sidebar button writes: to icons only (remembering the width it leaves),
 * or back to that width — never a half-compact one.
 */
export function toggledSidebar(
  width: number,
  expandedWidth: number,
): Pick<Settings, 'sidebarWidth' | 'sidebarExpandedWidth'> {
  if (width < SIDEBAR_COMPACT_FROM) {
    return {
      sidebarWidth: clampBetween(expandedWidth, SIDEBAR_COMPACT_FROM, SIDEBAR_MAX),
      sidebarExpandedWidth: expandedWidth,
    }
  }
  return { sidebarWidth: SIDEBAR_COMPACT, sidebarExpandedWidth: width }
}

/** The address bar's sidebar button: whether the sidebar is icons only, and the switch. */
export function useSidebarToggle() {
  const { settings, update } = useSettings()
  const width = snapWidth(settings?.sidebarWidth ?? SIDEBAR_DEFAULT)
  const expanded = settings?.sidebarExpandedWidth ?? SIDEBAR_DEFAULT
  const toggle = useCallback(
    () => void update(toggledSidebar(width, expanded)),
    [width, expanded, update],
  )
  return { compact: width < SIDEBAR_COMPACT_FROM, toggle }
}

/**
 * Drag-to-resize for the sidebar. The width follows the pointer locally while dragging and is
 * saved once on release (one IPC call per drag). Double-click resets to the default.
 */
export function useSidebarResize() {
  const { settings, update } = useSettings()
  // Old stored widths (e.g. 56…159 from before) are normalised, never shown half-compact.
  const saved = snapWidth(settings?.sidebarWidth ?? SIDEBAR_DEFAULT)
  // Width while dragging; null otherwise (then the saved width applies).
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const width = dragWidth ?? saved

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = width
      let latest = startWidth
      setDragWidth(startWidth)

      const move = (ev: globalThis.PointerEvent) => {
        latest = snapWidth(startWidth + ev.clientX - startX)
        setDragWidth(latest)
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        // Keep showing the dragged width until the saved value comes back.
        void update({ sidebarWidth: latest }).finally(() => setDragWidth(null))
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [width, update],
  )

  const reset = useCallback(() => void update({ sidebarWidth: SIDEBAR_DEFAULT }), [update])

  return {
    width,
    compact: width < SIDEBAR_COMPACT_FROM,
    resizing: dragWidth !== null,
    onPointerDown,
    reset,
  }
}
