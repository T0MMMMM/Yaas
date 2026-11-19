import { useCallback, useState, type PointerEvent } from 'react'
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN } from '@shared/ipc/contract'
import { useSettings } from '../stores/settings'

export const clampSidebar = (px: number) =>
  Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, px)))

/**
 * Drag-to-resize for the sidebar. The width follows the pointer locally while dragging and is
 * saved once on release (one IPC call per drag). Double-click resets to the default.
 */
export function useSidebarResize() {
  const { settings, update } = useSettings()
  const saved = settings?.sidebarWidth ?? SIDEBAR_DEFAULT
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
        latest = clampSidebar(startWidth + ev.clientX - startX)
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

  return { width, resizing: dragWidth !== null, onPointerDown, reset }
}
