import { describe, expect, it } from 'vitest'
import { DEFAULT_ACCENT } from '@shared/ipc/contract'
import { applySpaceAccent, resolveScheme } from './applyTheme'

describe('resolveScheme', () => {
  it('returns explicit light or dark regardless of OS preference', () => {
    expect(resolveScheme('light', true)).toBe('light')
    expect(resolveScheme('dark', false)).toBe('dark')
  })

  it('follows OS preference when set to system', () => {
    expect(resolveScheme('system', true)).toBe('dark')
    expect(resolveScheme('system', false)).toBe('light')
  })
})

describe('applySpaceAccent', () => {
  const fakeRoot = () => {
    const props = new Map<string, string>()
    return {
      props,
      style: {
        setProperty: (name: string, value: string) => {
          props.set(name, value)
        },
      },
    }
  }

  it('sets --space-accent and all space-derived tokens on the root element', () => {
    const root = fakeRoot()
    applySpaceAccent('#2BB673', root)

    expect(root.props.get('--space-accent')).toBe('#2BB673')
    expect(root.props.get('--space-accent-soft')).toBe(
      'color-mix(in srgb, #2BB673 12%, transparent)',
    )
    expect(root.props.get('--bg-dock-selected')).toBe(
      'color-mix(in srgb, #2BB673 12%, transparent)',
    )
    expect(root.props.get('--selection-bg')).toBe('color-mix(in srgb, #2BB673 22%, transparent)')
  })

  it('updates derived tokens when switching to another space color', () => {
    const root = fakeRoot()
    applySpaceAccent('#2BB673', root)
    applySpaceAccent('#FF8A3D', root)

    expect(root.props.get('--space-accent')).toBe('#FF8A3D')
    expect(root.props.get('--bg-dock-selected')).toBe(
      'color-mix(in srgb, #FF8A3D 12%, transparent)',
    )
    expect(root.props.get('--selection-bg')).toBe('color-mix(in srgb, #FF8A3D 22%, transparent)')
  })

  it('falls back to DEFAULT_ACCENT when given an invalid color', () => {
    const root = fakeRoot()
    applySpaceAccent('not-a-hex', root)

    expect(root.props.get('--space-accent')).toBe(DEFAULT_ACCENT)
    expect(root.props.get('--space-accent-soft')).toBe(
      `color-mix(in srgb, ${DEFAULT_ACCENT} 12%, transparent)`,
    )
  })
})
