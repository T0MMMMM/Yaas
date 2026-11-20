import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type RefObject,
} from 'react'
import type { Tooltip } from '@shared/ipc/contract'
import { anchorOf } from '../../ui/anchor'
import { NO_TOOLTIP, TOOLTIP_DELAY_MS, tooltipReducer } from './tooltip'

/** What a row calls when the pointer enters it: its tooltip shows beside it, over the page. */
export type EnterRow = (row: HTMLElement, title: string, detail: string) => void

export const TooltipContext = createContext<EnterRow>(() => undefined)

/** The sidebar's `enter`, for tab rows and favourite tiles. */
export const useTooltipEnter = (): EnterRow => useContext(TooltipContext)

/**
 * The sidebar's tooltips (tooltip.ts): rows call `enter`, the sidebar sends `leave` and `press`;
 * every change of the shown tooltip goes to the overlay with `overlay.tooltip`. The anchor is the
 * row's height across to the sidebar's right edge, so the strip main shows starts at the page and
 * never covers the sidebar. `disabled` (a drag) clears it and ignores rows.
 */
export function useTooltip(
  sidebar: RefObject<HTMLElement | null>,
  disabled: boolean,
): { enter: EnterRow; leave: () => void; press: () => void } {
  const [state, dispatch] = useReducer(tooltipReducer, NO_TOOLTIP)
  const delay = useRef<number | null>(null)
  const sent = useRef<Tooltip | null>(null)

  const clearDelay = useCallback(() => {
    if (delay.current !== null) window.clearTimeout(delay.current)
    delay.current = null
  }, [])
  const leave = useCallback(() => {
    clearDelay()
    dispatch({ type: 'leave' })
  }, [clearDelay])
  const press = useCallback(() => {
    clearDelay()
    dispatch({ type: 'press' })
  }, [clearDelay])

  const enter = useCallback<EnterRow>(
    (row, title, detail) => {
      const nav = sidebar.current
      if (disabled || !nav) return
      const rest = anchorOf(row)
      const right = Math.round(nav.getBoundingClientRect().right)
      const anchor = { ...rest, width: Math.max(0, right - rest.x) }
      dispatch({ type: 'enter', tooltip: { anchor, title, detail } })
      // The delay runs from the first row entered; later rows only change what it will show.
      delay.current ??= window.setTimeout(() => {
        delay.current = null
        dispatch({ type: 'delay' })
      }, TOOLTIP_DELAY_MS)
    },
    [sidebar, disabled],
  )

  useEffect(() => {
    if (disabled) press()
  }, [disabled, press])
  // A popover took the overlay meanwhile (main ignored any tooltip): start over once it closes.
  useEffect(() => window.acab.on('overlay.closed', leave), [leave])
  useEffect(() => clearDelay, [clearDelay])

  useEffect(() => {
    if (state.shown === sent.current) return
    sent.current = state.shown
    void window.acab.invoke('overlay.tooltip', state.shown)
  }, [state.shown])

  return { enter, leave, press }
}
