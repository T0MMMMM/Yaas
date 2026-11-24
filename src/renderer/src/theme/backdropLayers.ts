import type { ColorScheme } from './windowTint'

export interface BackdropLayer {
  id: number
  spaceId: string | null
  scheme: ColorScheme
  top: string
  bottom: string
  /** True while this layer is fading in over the stack (opacity 0 → 1). */
  entering: boolean
}

const MAX_STACK = 4

/**
 * Computes the next stack of backdrop layers for a color/space/scheme change:
 * - Before a space is loaded (`next === null`), keeps the current stack untouched.
 * - First hydration from an empty stack pushes a single fading-in layer over `--frame-base` so
 *   startup never jumps from the app accent to the active space colour.
 * - Color-scheme switches replace the stack in place (no crossfade lagging behind instant token
 *   flips) and drop any mid-fade layers from the previous scheme.
 * - Live same-space color edits update the top layer in place.
 * - Switching spaces pushes a new entering layer on top; capping preserves the settled base layer
 *   at index 0 and drops only the oldest intermediate entering layer so no mid-fade layer snaps
 *   opaque.
 */
export function nextBackdropLayers(
  layers: readonly BackdropLayer[],
  next: { spaceId: string | null; scheme: ColorScheme; top: string; bottom: string } | null,
): BackdropLayer[] {
  if (!next) return layers as BackdropLayer[]

  const last = layers[layers.length - 1]
  if (!last) return [{ id: 0, ...next, entering: true }]

  if (
    last.spaceId === next.spaceId &&
    last.scheme === next.scheme &&
    last.top === next.top &&
    last.bottom === next.bottom
  ) {
    return layers as BackdropLayer[]
  }

  // Scheme switch flips instantly with the rest of the tokens (no crossfade, no stale layers).
  if (last.scheme !== next.scheme) {
    return [{ id: last.id, ...next, entering: false }]
  }

  const isSpaceSwitch =
    last.spaceId !== null && next.spaceId !== null && last.spaceId !== next.spaceId

  if (!isSpaceSwitch || (last.top === next.top && last.bottom === next.bottom)) {
    return [...layers.slice(0, -1), { ...last, ...next }]
  }

  const appended = [...layers, { id: last.id + 1, ...next, entering: true }]
  if (appended.length <= MAX_STACK) return appended
  // Preserve the settled bottom layer (index 0) and drop the oldest intermediate entering layer.
  const base = appended[0]
  return base ? [base, ...appended.slice(-(MAX_STACK - 1))] : appended.slice(-MAX_STACK)
}

/**
 * Settles a layer whose fade-in animation just reached `opacity: 1`: every layer beneath it is
 * now completely occluded and can be dropped, promoting the finished layer to settled without any
 * opacity jump. Newer layers still fading above it continue uninterrupted.
 */
export function settleBackdropLayers(
  layers: readonly BackdropLayer[],
  finishedId: number,
): BackdropLayer[] {
  const index = layers.findIndex((layer) => layer.id === finishedId)
  if (index === -1) return layers as BackdropLayer[]
  const settled = layers[index]
  if (!settled || (!settled.entering && index === 0)) return layers as BackdropLayer[]
  return [{ ...settled, entering: false }, ...layers.slice(index + 1)]
}
