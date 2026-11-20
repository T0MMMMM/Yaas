import { describe, expect, it } from 'vitest'
import type { Tooltip } from '@shared/ipc/contract'
import { NO_TOOLTIP, tooltipReducer, type TooltipEvent, type TooltipState } from './tooltip'

const tip = (title: string, y = 0): Tooltip => ({
  anchor: { x: 0, y, width: 240, height: 38 },
  title,
  detail: 'example.com',
})
const a = tip('A', 0)
const b = tip('B', 38)

const run = (...events: TooltipEvent[]): TooltipState => events.reduce(tooltipReducer, NO_TOOLTIP)

describe('tooltipReducer', () => {
  it('shows the hovered row once the delay has passed', () => {
    expect(run({ type: 'enter', tooltip: a })).toEqual({ shown: null, pending: a })
    expect(run({ type: 'enter', tooltip: a }, { type: 'delay' })).toEqual({
      shown: a,
      pending: null,
    })
  })

  it('shows the last row hovered before the delay', () => {
    expect(
      run({ type: 'enter', tooltip: a }, { type: 'enter', tooltip: b }, { type: 'delay' }),
    ).toEqual({ shown: b, pending: null })
  })

  it('slides at once to another row while shown', () => {
    expect(
      run({ type: 'enter', tooltip: a }, { type: 'delay' }, { type: 'enter', tooltip: b }),
    ).toEqual({ shown: b, pending: null })
  })

  it('clears everything when the pointer leaves the sidebar', () => {
    expect(run({ type: 'enter', tooltip: a }, { type: 'leave' })).toEqual(NO_TOOLTIP)
    expect(run({ type: 'enter', tooltip: a }, { type: 'delay' }, { type: 'leave' })).toEqual(
      NO_TOOLTIP,
    )
  })

  it('clears everything on a press, even while shown', () => {
    expect(run({ type: 'enter', tooltip: a }, { type: 'delay' }, { type: 'press' })).toEqual(
      NO_TOOLTIP,
    )
    // A delay that fires after the press shows nothing.
    expect(run({ type: 'enter', tooltip: a }, { type: 'press' }, { type: 'delay' })).toEqual(
      NO_TOOLTIP,
    )
  })
})
