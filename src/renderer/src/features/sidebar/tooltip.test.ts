import { describe, expect, it } from 'vitest'
import { commands, TOOLTIP_TEXT_MAX, type Tooltip } from '@shared/ipc/contract'
import {
  clipTooltip,
  NO_TOOLTIP,
  tooltipReducer,
  type TooltipEvent,
  type TooltipState,
} from './tooltip'

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

describe('clipTooltip', () => {
  it('carries an inline favicon, never a remote or oversized one', () => {
    const anchor = { x: 0, y: 0, width: 10, height: 10 }
    expect(clipTooltip(anchor, 'A', 'a.com', 'data:image/png;base64,AA').icon).toBe(
      'data:image/png;base64,AA',
    )
    expect(clipTooltip(anchor, 'A', 'a.com', 'https://a.com/favicon.ico').icon).toBeUndefined()
    expect(clipTooltip(anchor, 'A', 'a.com', `data:${'x'.repeat(5000)}`).icon).toBeUndefined()
    expect(clipTooltip(anchor, 'A', 'a.com', null).icon).toBeUndefined()
  })

  const anchor = { x: 0, y: 0, width: 240, height: 38 }

  it('keeps short texts as they are', () => {
    expect(clipTooltip(anchor, 'A', 'a.com')).toEqual({ anchor, title: 'A', detail: 'a.com' })
  })

  it('clips a huge title or URL so the contract still takes it', () => {
    const huge = 'x'.repeat(TOOLTIP_TEXT_MAX * 4)
    const tip = clipTooltip(anchor, huge, huge)
    expect(tip.title).toHaveLength(TOOLTIP_TEXT_MAX)
    expect(tip.title.endsWith('…')).toBe(true)
    expect(tip.detail).toHaveLength(TOOLTIP_TEXT_MAX)
    expect(commands['overlay.tooltip'].input.safeParse(tip).success).toBe(true)
  })
})
