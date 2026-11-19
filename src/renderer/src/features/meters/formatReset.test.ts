import { describe, expect, it } from 'vitest'
import { formatReset } from './formatReset'

// Thursday 2026-11-19 14:19 local time
const now = new Date(2026, 10, 19, 14, 19)
const plus = (minutes: number) => new Date(now.getTime() + minutes * 60_000)

describe('formatReset', () => {
  it('shows only the time when the reset is today', () => {
    expect(formatReset(plus(3 * 60 + 11), now)).toEqual({ clock: '17:30', left: '3h11' })
  })

  it('shows the weekday when the reset is another day', () => {
    expect(formatReset(plus(23 * 60 + 41), now)).toEqual({ clock: 'Fri. 14:00', left: '23h41' })
  })

  it('switches to days beyond 48 hours, minutes under an hour', () => {
    expect(formatReset(plus(3 * 24 * 60 + 5 * 60), now).left).toBe('3d 5h')
    expect(formatReset(plus(12), now).left).toBe('12m')
    expect(formatReset(plus(-5), now).left).toBe('now')
  })
})
