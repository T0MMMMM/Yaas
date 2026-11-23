import type { ColorScheme } from './windowTint'

export interface BackdropLayer {
  id: number
  spaceId: string | null
  scheme: ColorScheme
  top: string
  bottom: string
}

const MAX_STACK = 4

/**
 * Computes the next stack of backdrop layers for a color/space/scheme change:
 * - Initial hydration (`null -> space`) or live color edit inside the same space updates in place.
 * - Switching space or color scheme pushes a new layer on top so it crossfades over the settled
 *   layer without an alpha dip or jump, even under rapid space switching.
 */
export function nextBackdropLayers(
  layers: readonly BackdropLayer[],
  next: { spaceId: string | null; scheme: ColorScheme; top: string; bottom: string },
): BackdropLayer[] {
  const last = layers[layers.length - 1]
  if (!last) return [{ id: 0, ...next }]

  if (
    last.spaceId === next.spaceId &&
    last.scheme === next.scheme &&
    last.top === next.top &&
    last.bottom === next.bottom
  ) {
    return layers as BackdropLayer[]
  }

  const isSwitch =
    (last.spaceId !== null && next.spaceId !== null && last.spaceId !== next.spaceId) ||
    last.scheme !== next.scheme

  if (!isSwitch || (last.top === next.top && last.bottom === next.bottom)) {
    return [...layers.slice(0, -1), { ...last, ...next }]
  }

  const appended = [...layers, { id: last.id + 1, ...next }]
  return appended.length > MAX_STACK ? appended.slice(-MAX_STACK) : appended
}
