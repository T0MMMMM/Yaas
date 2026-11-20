import { describe, expect, it } from 'vitest'
import { controlsDelay, controlsReducer, HIDE_DELAY_MS, REVEAL_DELAY_MS } from './controlsReveal'

describe('controlsReducer', () => {
  it('reveals the controls only after the pointer rests on the top edge', () => {
    expect(controlsReducer('hidden', 'enter')).toBe('revealing')
    expect(controlsReducer('revealing', 'elapsed')).toBe('shown')
  })

  it('reveals nothing when the pointer only passes over the edge', () => {
    expect(controlsReducer('revealing', 'leave')).toBe('hidden')
  })

  it('hides the controls a moment after the pointer leaves, unless it comes back', () => {
    expect(controlsReducer('shown', 'leave')).toBe('hiding')
    expect(controlsReducer('hiding', 'enter')).toBe('shown')
    expect(controlsReducer('hiding', 'elapsed')).toBe('hidden')
  })

  it('ignores events that change nothing', () => {
    expect(controlsReducer('shown', 'enter')).toBe('shown')
    expect(controlsReducer('shown', 'elapsed')).toBe('shown')
    expect(controlsReducer('hidden', 'leave')).toBe('hidden')
    expect(controlsReducer('hidden', 'elapsed')).toBe('hidden')
  })
})

describe('controlsDelay', () => {
  it('waits only in the two transient states', () => {
    expect(controlsDelay('revealing')).toBe(REVEAL_DELAY_MS)
    expect(controlsDelay('hiding')).toBe(HIDE_DELAY_MS)
    expect(controlsDelay('hidden')).toBeNull()
    expect(controlsDelay('shown')).toBeNull()
  })
})
