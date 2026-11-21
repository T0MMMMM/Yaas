// Where the two pages of a split go: pure geometry, shared by main (views) and tests.
import type { BrowserTab } from '@shared/model'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** A split's ratio before the divider is ever moved. */
export const DEFAULT_SPLIT_RATIO = 0.5

/** The two halves of `bounds`: the first gets `ratio` of the width left after the `gap`. */
export function splitBounds(
  bounds: Rect,
  ratio: number,
  gap: number,
): { first: Rect; second: Rect } {
  const x = Math.round(bounds.x)
  const y = Math.round(bounds.y)
  const width = Math.max(0, Math.round(bounds.width))
  const height = Math.max(0, Math.round(bounds.height))
  const usable = Math.max(0, width - gap)
  const firstWidth = Math.round(usable * ratio)
  const secondWidth = usable - firstWidth
  return {
    first: { x, y, width: firstWidth, height },
    second: { x: x + width - secondWidth, y, width: secondWidth, height },
  }
}

/** The split the tab `activeId` is a half of (the first half stores the ratio), or null. */
export function shownSplit(
  tabs: readonly Pick<BrowserTab, 'id' | 'splitOf' | 'splitRatio'>[],
  activeId: string,
): { firstId: string; secondId: string; ratio: number } | null {
  const active = tabs.find((t) => t.id === activeId)
  if (!active) return null
  const first = active.splitOf === null ? active : tabs.find((t) => t.id === active.splitOf)
  if (!first || first.splitOf !== null) return null
  const second =
    active === first
      ? [...tabs].sort((a, b) => (a.id < b.id ? -1 : 1)).find((t) => t.splitOf === first.id)
      : active
  if (!second) return null
  return { firstId: first.id, secondId: second.id, ratio: first.splitRatio ?? DEFAULT_SPLIT_RATIO }
}
