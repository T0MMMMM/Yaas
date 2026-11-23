import { describe, expect, it } from 'vitest'
import { nextBackdropLayers, type BackdropLayer } from './backdropLayers'

const layer = (overrides: Partial<BackdropLayer> = {}): BackdropLayer => ({
  id: 0,
  spaceId: 'space-1',
  scheme: 'light',
  top: '#d8d4e6',
  bottom: '#ebe8f2',
  ...overrides,
})

describe('nextBackdropLayers', () => {
  it('returns the same reference when nothing changed', () => {
    const current = [layer()]
    expect(
      nextBackdropLayers(current, {
        spaceId: 'space-1',
        scheme: 'light',
        top: '#d8d4e6',
        bottom: '#ebe8f2',
      }),
    ).toBe(current)
  })

  it('replaces in place on initial workspace hydration and live same-space color edits', () => {
    const initial = [layer({ spaceId: null })]
    const hydrated = nextBackdropLayers(initial, {
      spaceId: 'space-1',
      scheme: 'light',
      top: '#d0e7db',
      bottom: '#e7f2ec',
    })
    expect(hydrated).toHaveLength(1)
    expect(hydrated[0]?.spaceId).toBe('space-1')
    expect(hydrated[0]?.top).toBe('#d0e7db')

    const edited = nextBackdropLayers(hydrated, {
      spaceId: 'space-1',
      scheme: 'light',
      top: '#e8d9ce',
      bottom: '#f3ebe5',
    })
    expect(edited).toHaveLength(1)
    expect(edited[0]?.top).toBe('#e8d9ce')
  })

  it('stacks a new entering layer when switching spaces with different colors', () => {
    const current = [layer()]
    const switched = nextBackdropLayers(current, {
      spaceId: 'space-2',
      scheme: 'light',
      top: '#d0e7db',
      bottom: '#e7f2ec',
    })
    expect(switched).toHaveLength(2)
    expect(switched[0]?.top).toBe('#d8d4e6')
    expect(switched[1]?.top).toBe('#d0e7db')
    expect(switched[1]?.id).toBe(1)
  })

  it('stacks a new entering layer when switching color scheme', () => {
    const current = [layer()]
    const switched = nextBackdropLayers(current, {
      spaceId: 'space-1',
      scheme: 'dark',
      top: '#383543',
      bottom: '#44434b',
    })
    expect(switched).toHaveLength(2)
    expect(switched[1]?.scheme).toBe('dark')
  })

  it('caps the stack during rapid space switching so layers stay bounded', () => {
    let stack = [layer()]
    for (let i = 1; i <= 6; i++) {
      stack = nextBackdropLayers(stack, {
        spaceId: `space-${i + 1}`,
        scheme: 'light',
        top: `#00000${i}`,
        bottom: `#11111${i}`,
      })
    }
    expect(stack.length).toBeLessThanOrEqual(4)
    expect(stack[stack.length - 1]?.spaceId).toBe('space-7')
  })
})
