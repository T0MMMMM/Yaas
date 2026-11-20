import { TOOLTIP_TEXT_MAX, type PageBounds, type Tooltip } from '@shared/ipc/contract'

/** How long the pointer rests on a row before its tooltip shows. */
export const TOOLTIP_DELAY_MS = 500
/**
 * How long the pointer may rest on a part of the sidebar without a tooltip (a folder row, a button,
 * a gap between rows) before the tooltip goes: short enough to feel immediate, long enough for a
 * move across a gap to the next row to keep sliding.
 */
export const TOOLTIP_GRACE_MS = 80

/** The sidebar's tooltip: the one shown in the overlay, and the one waiting for the delay. */
export interface TooltipState {
  shown: Tooltip | null
  pending: Tooltip | null
}

export type TooltipEvent =
  /** The pointer entered a row. */
  | { type: 'enter'; tooltip: Tooltip }
  /** TOOLTIP_DELAY_MS after the first `enter`. */
  | { type: 'delay' }
  /** The pointer left the sidebar. */
  | { type: 'leave' }
  /** A pointer press or a drag start in the sidebar. */
  | { type: 'press' }

export const NO_TOOLTIP: TooltipState = { shown: null, pending: null }

/**
 * Once a tooltip shows, hovering another row slides it there at once; until then, the last row
 * hovered waits for the delay. Leaving the sidebar or pressing clears both.
 */
export function tooltipReducer(state: TooltipState, event: TooltipEvent): TooltipState {
  switch (event.type) {
    case 'enter':
      return state.shown
        ? { shown: event.tooltip, pending: null }
        : { shown: null, pending: event.tooltip }
    case 'delay':
      return state.pending ? { shown: state.pending, pending: null } : state
    case 'leave':
    case 'press':
      return NO_TOOLTIP
  }
}

const clip = (text: string): string =>
  text.length > TOOLTIP_TEXT_MAX ? `${text.slice(0, TOOLTIP_TEXT_MAX - 1)}…` : text

/** A row's tooltip, its texts clipped to what the contract takes (a page title can be huge). */
export function clipTooltip(anchor: PageBounds, title: string, detail: string): Tooltip {
  return { anchor, title: clip(title), detail: clip(detail) }
}
