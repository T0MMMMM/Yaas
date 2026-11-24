import type { SidebarSections, SpaceSummary } from '../workspace/workspace'

/** Outgoing space fade duration (`--dur-swap-out`). */
export const SWAP_OUT_MS = 150
/** Delay before incoming space fades in (`--dur-swap-delay`). */
export const SWAP_DELAY_MS = 75
/** Incoming space fade duration (`--dur-row-fade`). */
export const SWAP_IN_MS = 150

export interface SpaceSnapshot {
  /** Monotonic generation id so React keys each outgoing snapshot cleanly. */
  gen: number
  space: SpaceSummary
  sections: SidebarSections
  activeId: string | null
}

export interface SpaceSwapState {
  current: SpaceSnapshot | null
  outgoing: SpaceSnapshot | null
  /** Incremented whenever the active space changes so the live content replays its enter fade. */
  swapCount: number
  /** False during the 75 ms enter delay so a rapid follow-up switch keeps the visible outgoing ghost. */
  incomingVisible: boolean
}

export const INITIAL_SWAP: SpaceSwapState = {
  current: null,
  outgoing: null,
  swapCount: 0,
  incomingVisible: true,
}

/**
 * Pure state machine for the fast space-switch sidebar swap (redesign direction §5: old out
 * 150 ms, new in after 75 ms). When interrupted mid-flight while the previous incoming space is
 * still hidden behind its 75 ms delay, keeps the visible outgoing snapshot so spam-switching
 * never flashes blank.
 */
export function nextSpaceSwap(
  state: SpaceSwapState,
  next: { space: SpaceSummary; sections: SidebarSections; activeId: string | null } | null,
): SpaceSwapState {
  if (!next) return state
  const prev = state.current
  if (!prev) {
    return {
      current: { gen: 0, ...next },
      outgoing: null,
      swapCount: 0,
      incomingVisible: true,
    }
  }
  if (prev.space.id === next.space.id) {
    if (
      prev.space === next.space &&
      prev.sections === next.sections &&
      prev.activeId === next.activeId
    ) {
      return state
    }
    return { ...state, current: { ...prev, ...next } }
  }
  const outgoing = state.outgoing !== null && !state.incomingVisible ? state.outgoing : prev
  const gen = prev.gen + 1
  return {
    current: { gen, ...next },
    outgoing,
    swapCount: state.swapCount + 1,
    incomingVisible: false,
  }
}

/** Marks the incoming space as visible once the 75 ms swap delay has elapsed. */
export function markSwapVisible(state: SpaceSwapState, swapCount: number): SpaceSwapState {
  if (state.swapCount !== swapCount || state.incomingVisible) return state
  return { ...state, incomingVisible: true }
}

/** Clears the outgoing snapshot once its 150 ms fade finishes (ignoring stale generations). */
export function finishSpaceSwap(state: SpaceSwapState, finishedGen: number): SpaceSwapState {
  if (!state.outgoing || state.outgoing.gen !== finishedGen) return state
  return { ...state, outgoing: null }
}
