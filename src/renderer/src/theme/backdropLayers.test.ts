import { describe, expect, it } from 'vitest'
import { nextBackdropLayers, settleBackdropLayers, type BackdropLayer } from './backdropLayers'

const layer = (overrides: Partial<BackdropLayer> = {}): BackdropLayer => ({
  id: 0,
  spaceId: 'space-1',
  scheme: 'light',
  top: '#d8d4e6',
  bottom: '#ebe8f2',
  entering: false,
  ...overrides,
})

describe('nextBackdropLayers', () => {
  it('returns the same reference when nothing changed or next is null', () => {
    const current = [layer()]
    expect(nextBackdropLayers(current, null)).toBe(current)
    expect(
      nextBackdropLayers(current, {
        spaceId: 'space-1',
        scheme: 'light',
        top: '#d8d4e6',
        bottom: '#ebe8f2',
      }),
    ).toBe(current)
  })

  it('fades in the first space when hydrating from an empty stack (no accent flash)', () => {
    const hydrated = nextBackdropLayers([], {
      spaceId: 'space-1',
      scheme: 'light',
      top: '#d0e7db',
      bottom: '#e7f2ec',
    })
    expect(hydrated).toHaveLength(1)
    expect(hydrated[0]).toMatchObject({ id: 0, spaceId: 'space-1', entering: true })
  })

  it('updates in place on live same-space color edits', () => {
    const current = [layer()]
    const edited = nextBackdropLayers(current, {
      spaceId: 'space-1',
      scheme: 'light',
      top: '#e8d9ce',
      bottom: '#f3ebe5',
    })
    expect(edited).toHaveLength(1)
    expect(edited[0]?.top).toBe('#e8d9ce')
    expect(edited[0]?.entering).toBe(false)
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
    expect(switched[0]).toMatchObject({ id: 0, top: '#d8d4e6', entering: false })
    expect(switched[1]).toMatchObject({ id: 1, top: '#d0e7db', entering: true })
  })

  it('switches color scheme in place without stacking or leaving old-scheme layers behind', () => {
    const midFade = [
      layer({ id: 0, spaceId: 'space-1', scheme: 'light', entering: false }),
      layer({ id: 1, spaceId: 'space-2', scheme: 'light', top: '#d0e7db', entering: true }),
    ]
    const flipped = nextBackdropLayers(midFade, {
      spaceId: 'space-2',
      scheme: 'dark',
      top: '#383543',
      bottom: '#44434b',
    })
    expect(flipped).toHaveLength(1)
    expect(flipped[0]).toMatchObject({
      scheme: 'dark',
      top: '#383543',
      bottom: '#44434b',
      entering: false,
    })
  })

  it('preserves the settled bottom layer when capping rapid space switches so no mid-fade layer snaps opaque', () => {
    let stack = [layer({ id: 0, spaceId: 'space-1', entering: false })]
    for (let i = 1; i <= 6; i++) {
      stack = nextBackdropLayers(stack, {
        spaceId: `space-${i + 1}`,
        scheme: 'light',
        top: `#00000${i}`,
        bottom: `#11111${i}`,
      })
    }
    expect(stack).toHaveLength(4)
    // Index 0 stays the original settled base layer; all upper layers stay entering.
    expect(stack[0]).toMatchObject({ id: 0, spaceId: 'space-1', entering: false })
    expect(stack.slice(1).every((l) => l.entering)).toBe(true)
    expect(stack[stack.length - 1]?.spaceId).toBe('space-7')
  })
})

describe('settleBackdropLayers', () => {
  it('promotes a finished intermediate layer to settled and drops occluded layers below it', () => {
    const stack = [
      layer({ id: 0, spaceId: 'space-1', entering: false }),
      layer({ id: 1, spaceId: 'space-2', entering: true }),
      layer({ id: 2, spaceId: 'space-3', entering: true }),
    ]
    const afterFirst = settleBackdropLayers(stack, 1)
    expect(afterFirst).toHaveLength(2)
    expect(afterFirst[0]).toMatchObject({ id: 1, spaceId: 'space-2', entering: false })
    expect(afterFirst[1]).toMatchObject({ id: 2, spaceId: 'space-3', entering: true })

    const afterLast = settleBackdropLayers(afterFirst, 2)
    expect(afterLast).toHaveLength(1)
    expect(afterLast[0]).toMatchObject({ id: 2, spaceId: 'space-3', entering: false })
  })

  it('settles a single entering startup layer in place', () => {
    const startup = [layer({ id: 0, entering: true })]
    const settled = settleBackdropLayers(startup, 0)
    expect(settled).toHaveLength(1)
    expect(settled[0]?.entering).toBe(false)
  })
})
