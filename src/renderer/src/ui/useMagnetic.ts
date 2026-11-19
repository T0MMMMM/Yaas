import { useCallback, type PointerEvent } from 'react'

/**
 * Magnetic hover: the element leans toward the pointer while it's over it, then springs back.
 * Uses the CSS `translate` property, so it composes with any `transform` the element already has.
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.35) {
  const onPointerMove = useCallback(
    (e: PointerEvent<T>) => {
      const el = e.currentTarget
      const box = el.getBoundingClientRect()
      const dx = (e.clientX - (box.left + box.width / 2)) * strength
      const dy = (e.clientY - (box.top + box.height / 2)) * strength
      el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`
    },
    [strength],
  )
  const onPointerLeave = useCallback((e: PointerEvent<T>) => {
    e.currentTarget.style.translate = ''
  }, [])
  return { onPointerMove, onPointerLeave }
}
