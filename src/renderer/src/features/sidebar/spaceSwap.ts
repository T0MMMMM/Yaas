import { durationOf, easingOf } from './dragLift'

// The sidebar's space-switch swap (redesign direction §5): the old space's content fades out over
// --dur-swap-out while the new one fades in after --dur-swap-delay. The old content is a stripped
// copy of the real rows taken before React draws the new space (SpaceSwapStage), so it looks
// exactly like what was on screen. Imperative on purpose, like the drag lift: the copy is no
// React tree.

/** A swap in flight: the old content's layer and the new content's delayed fade-in. */
export interface SpaceSwap {
  layer: HTMLElement
  fadeIn: Animation | null
  /** When the new content becomes visible (performance.now() time). */
  visibleAt: number
}

/**
 * Whether the new content of `swap` is still hidden behind its delay: switching again then keeps
 * the old content on screen instead of copying an invisible space, so spam-switching never
 * flashes blank.
 */
export function hidesIncoming(swap: SpaceSwap | null, now: number): boolean {
  return swap !== null && swap.layer.isConnected && now < swap.visibleAt
}

/**
 * Starts a swap: `snapshot` (the old content) goes in an inert layer before `live`, fades out
 * (`layerClass`, Sidebar CSS) and leaves the DOM; `live` fades in after the delay. With no
 * snapshot, the running swap's layer stays and only the fade-in restarts.
 */
export function startSpaceSwap(
  live: HTMLElement,
  snapshot: HTMLElement | null,
  previous: SpaceSwap | null,
  layerClass: string | undefined,
): SpaceSwap {
  previous?.fadeIn?.cancel()
  let layer = previous?.layer ?? null
  if (snapshot || !layer?.isConnected) {
    layer?.remove()
    const own = document.createElement('div')
    if (layerClass) own.className = layerClass
    own.setAttribute('aria-hidden', 'true')
    own.setAttribute('data-testid', 'space-swap')
    own.inert = true
    if (snapshot) own.append(snapshot)
    own.addEventListener('animationend', (e) => {
      if (e.target === own) own.remove()
    })
    live.before(own)
    layer = own
  }
  const delay = durationOf(live, '--dur-swap-delay')
  const fadeIn =
    typeof live.animate === 'function'
      ? live.animate([{ opacity: 0 }, { opacity: 1 }], {
          delay,
          duration: durationOf(live, '--dur-row-fade'),
          easing: easingOf(live, '--ease'),
          fill: 'backwards',
        })
      : null
  return { layer, fadeIn, visibleAt: performance.now() + delay }
}

/** Stops a swap at once: the old content goes and the new one shows. */
export function endSpaceSwap(swap: SpaceSwap | null): void {
  swap?.fadeIn?.cancel()
  swap?.layer.remove()
}
