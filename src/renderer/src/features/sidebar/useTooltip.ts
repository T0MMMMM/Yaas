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
import {
  clipTooltip,
  NO_TOOLTIP,
  TOOLTIP_DELAY_MS,
  TOOLTIP_GRACE_MS,
  tooltipReducer,
} from './tooltip'

/** What a row calls when the pointer enters it: its tooltip shows beside it, over the page. */
export type EnterRow = (row: HTMLElement, title: string, detail: string) => void

export const TooltipContext = createContext<EnterRow>(() => undefined)

/** The sidebar's `enter`, for tab rows and favourite tiles. */
export const useTooltipEnter = (): EnterRow => useContext(TooltipContext)

/** Marks a row or tile that has a tooltip (`data-tooltip-row`); anything else in the sidebar clears it. */
export const TOOLTIP_ROW = { 'data-tooltip-row': true } as const

/**
 * The sidebar's tooltips (tooltip.ts): rows call `enter`, the sidebar sends `leave` and `press`;
 * every change of the shown tooltip goes to the overlay with `overlay.tooltip`. The anchor is the
 * row's height across to the sidebar's right edge, so the strip main shows starts at the page and
 * never covers the sidebar. `over` (the sidebar's `pointerover`) clears it, after
 * TOOLTIP_GRACE_MS, once the pointer is on anything but a tooltip row: a folder row, a button, a gap.
 * `disabled` (a drag) clears it and ignores rows.
 */
export function useTooltip(
  sidebar: RefObject<HTMLElement | null>,
  disabled: boolean,
): {
  enter: EnterRow
  over: (event: { target: EventTarget }) => void
  leave: () => void
  press: () => void
} {
  const [state, dispatch] = useReducer(tooltipReducer, NO_TOOLTIP)
  const delay = useRef<number | null>(null)
  const sent = useRef<Tooltip | null>(null)
  /** The pending `leave` while the pointer is off the tooltip rows. */
  const grace = useRef<number | null>(null)

  const clearDelay = useCallback(() => {
    if (delay.current !== null) window.clearTimeout(delay.current)
    delay.current = null
  }, [])
  const clearGrace = useCallback(() => {
    if (grace.current !== null) window.clearTimeout(grace.current)
    grace.current = null
  }, [])
  const leave = useCallback(() => {
    clearDelay()
    clearGrace()
    dispatch({ type: 'leave' })
  }, [clearDelay, clearGrace])
  const press = useCallback(() => {
    clearDelay()
    clearGrace()
    dispatch({ type: 'press' })
  }, [clearDelay, clearGrace])
  const over = useCallback(
    ({ target }: { target: EventTarget }) => {
      if (target instanceof Element && target.closest('[data-tooltip-row]')) {
        clearGrace()
        return
      }
      grace.current ??= window.setTimeout(leave, TOOLTIP_GRACE_MS)
    },
    [clearGrace, leave],
  )

  const enter = useCallback<EnterRow>(
    (row, title, detail) => {
      const nav = sidebar.current
      if (disabled || !nav) return
      clearGrace()
      const rest = anchorOf(row)
      const right = Math.round(nav.getBoundingClientRect().right)
      const anchor = { ...rest, width: Math.max(0, right - rest.x) }
      dispatch({ type: 'enter', tooltip: clipTooltip(anchor, title, detail) })
      // The delay runs from the first row entered; later rows only change what it will show.
      delay.current ??= window.setTimeout(() => {
        delay.current = null
        dispatch({ type: 'delay' })
      }, TOOLTIP_DELAY_MS)
    },
    [sidebar, disabled, clearGrace],
  )

  useEffect(() => {
    if (disabled) press()
  }, [disabled, press])
  // A popover took the overlay meanwhile (main ignored any tooltip): start over once it closes.
  useEffect(() => window.bigBrowser.on('overlay.closed', leave), [leave])
  useEffect(
    () => () => {
      clearDelay()
      clearGrace()
    },
    [clearDelay, clearGrace],
  )

  useEffect(() => {
    if (state.shown === sent.current) return
    sent.current = state.shown
    void window.bigBrowser.invoke('overlay.tooltip', state.shown)
  }, [state.shown])

  return { enter, over, leave, press }
}
