import { useCallback, type PointerEvent } from 'react'

/** Scale of a magnetic element while the pointer is over it. */
const HOVER_SCALE = '1.08'

/**
 * Magnetic hover: the element leans toward the pointer and grows slightly while it's over it, then
 * springs back. Uses the CSS `translate` and `scale` properties, so it composes with any
 * `transform` the element already has. Does nothing when the `magneticButtons` setting is off.
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.5) {
  const onPointerMove = useCallback(
    (e: PointerEvent<T>) => {
      if (document.documentElement.dataset['magnetic'] === 'off') return
      const el = e.currentTarget
      const box = el.getBoundingClientRect()
      const dx = (e.clientX - (box.left + box.width / 2)) * strength
      const dy = (e.clientY - (box.top + box.height / 2)) * strength
      el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`
      el.style.scale = HOVER_SCALE
    },
    [strength],
  )
  const onPointerLeave = useCallback((e: PointerEvent<T>) => {
    e.currentTarget.style.translate = ''
    e.currentTarget.style.scale = ''
  }, [])
  return { onPointerMove, onPointerLeave }
}
