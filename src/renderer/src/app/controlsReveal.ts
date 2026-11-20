// Windows: the window's minimize / maximize / close buttons are drawn by the UI and stay hidden
// until the pointer rests on the window's top edge; the top margin then grows to hold them.

/** `revealing` and `hiding` are the short waits before the margin opens or closes. */
export type ControlsState = 'hidden' | 'revealing' | 'shown' | 'hiding'
export type ControlsEvent = 'enter' | 'leave' | 'elapsed'

/** How long the pointer rests on the top edge before the buttons come. */
export const REVEAL_DELAY_MS = 120
/** How long the buttons stay after the pointer leaves them. */
export const HIDE_DELAY_MS = 250

export function controlsReducer(state: ControlsState, event: ControlsEvent): ControlsState {
  switch (state) {
    case 'hidden':
      return event === 'enter' ? 'revealing' : state
    case 'revealing':
      if (event === 'elapsed') return 'shown'
      return event === 'leave' ? 'hidden' : state
    case 'shown':
      return event === 'leave' ? 'hiding' : state
    case 'hiding':
      if (event === 'elapsed') return 'hidden'
      return event === 'enter' ? 'shown' : state
  }
}

/** The wait before `elapsed` in a transient state, or null when nothing is pending. */
export function controlsDelay(state: ControlsState): number | null {
  if (state === 'revealing') return REVEAL_DELAY_MS
  if (state === 'hiding') return HIDE_DELAY_MS
  return null
}
