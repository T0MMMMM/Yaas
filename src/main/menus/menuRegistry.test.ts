import { describe, expect, it, vi } from 'vitest'
import { BrowserError } from '@core/browser/browserStore'
import { MenuRegistry, menuRequest, type MenuItemDef } from './menuRegistry'

const item = (id: string, run: () => void, extra: Partial<MenuItemDef> = {}): MenuItemDef => ({
  kind: 'item',
  id,
  label: id,
  run,
  ...extra,
})

describe('MenuRegistry', () => {
  it('strips run from the spec and gives each menu a fresh id', () => {
    const registry = new MenuRegistry()
    const first = registry.open([
      item('pin', () => undefined, { icon: 'PushPin' }),
      { kind: 'separator' },
      { kind: 'item', id: 'move', label: 'Move', submenu: [item('top', () => undefined)] },
    ])
    expect(first.items).toEqual([
      { kind: 'item', id: 'pin', label: 'pin', enabled: true, icon: 'PushPin' },
      { kind: 'separator' },
      {
        kind: 'item',
        id: 'move',
        label: 'Move',
        enabled: true,
        submenu: [{ kind: 'item', id: 'top', label: 'top', enabled: true }],
      },
    ])
    const second = registry.open([item('pin', () => undefined)])
    expect(second.id).not.toBe(first.id)
  })

  it("runs the chosen item's action once", () => {
    const registry = new MenuRegistry()
    const pin = vi.fn()
    const other = vi.fn()
    const menu = registry.open([item('pin', pin), item('other', other)])
    registry.choose(menu.id, 'pin')
    expect(pin).toHaveBeenCalledOnce()
    expect(other).not.toHaveBeenCalled()
    // The menu is spent: a second choice runs nothing.
    registry.choose(menu.id, 'pin')
    registry.choose(menu.id, 'other')
    expect(pin).toHaveBeenCalledOnce()
    expect(other).not.toHaveBeenCalled()
  })

  it('ignores an older menu, an unknown item, a disabled item and a cleared menu', () => {
    const registry = new MenuRegistry()
    const old = vi.fn()
    const older = registry.open([item('pin', old)])
    const current = vi.fn()
    const menu = registry.open([item('pin', current), item('off', current, { enabled: false })])
    registry.choose(older.id, 'pin')
    expect(old).not.toHaveBeenCalled()
    registry.choose(menu.id, 'nope')
    registry.choose(menu.id, 'off')
    expect(current).not.toHaveBeenCalled()

    const cleared = registry.open([item('pin', current)])
    registry.clear()
    registry.choose(cleared.id, 'pin')
    expect(current).not.toHaveBeenCalled()
  })

  it('reaches nested submenu items by id', () => {
    const registry = new MenuRegistry()
    const deep = vi.fn()
    const menu = registry.open([
      {
        kind: 'item',
        id: 'a',
        label: 'A',
        submenu: [{ kind: 'item', id: 'b', label: 'B', submenu: [item('c', deep)] }],
      },
    ])
    registry.choose(menu.id, 'c')
    expect(deep).toHaveBeenCalledOnce()
  })

  it('refuses two items with one id', () => {
    const registry = new MenuRegistry()
    expect(() =>
      registry.open([
        item('x', () => undefined),
        { kind: 'item', id: 'sub', label: 'Sub', submenu: [item('x', () => undefined)] },
      ]),
    ).toThrow(/x/)
  })

  it('swallows a vanished target (not_found), lets any other error through', () => {
    const registry = new MenuRegistry()
    const gone = registry.open([
      item('pin', () => {
        throw new BrowserError('not_found', 'Unknown tab')
      }),
    ])
    expect(() => registry.choose(gone.id, 'pin')).not.toThrow()

    const invalid = registry.open([
      item('move', () => {
        throw new BrowserError('invalid_move', 'into itself')
      }),
    ])
    expect(() => registry.choose(invalid.id, 'move')).toThrow('into itself')

    const broken = registry.open([
      item('boom', () => {
        throw new Error('boom')
      }),
    ])
    expect(() => registry.choose(broken.id, 'boom')).toThrow('boom')
  })
})

describe('menuRequest', () => {
  const menu = { id: 'm', items: [] }

  it('opens at a point as a context menu', () => {
    expect(menuRequest({ at: { x: 3, y: 4 } }, menu)).toEqual({
      kind: 'context-menu',
      at: { x: 3, y: 4 },
      menu,
    })
  })

  it('opens from a button as an anchored menu', () => {
    const anchor = { x: 1, y: 2, width: 30, height: 30 }
    expect(menuRequest({ anchor, placement: 'below' }, menu)).toEqual({
      kind: 'anchored-menu',
      anchor,
      placement: 'below',
      menu,
    })
  })
})
