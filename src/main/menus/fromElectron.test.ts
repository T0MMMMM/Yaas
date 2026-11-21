import type { MenuItem, MenuItemConstructorOptions, NativeImage } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { clickLikeElectron, toMenuItemDefs } from './fromElectron'
import type { MenuItemDef } from './menuRegistry'

type Item = Extract<MenuItemDef, { kind: 'item' }>

/** A NativeImage stand-in: only what the conversion reads. */
function fakeImage(size: number): NativeImage {
  const image = {
    isEmpty: () => false,
    getSize: () => ({ width: size, height: size }),
    resize: vi.fn(() => fakeImage(16)),
    toDataURL: () => `data:image/png;base64,${size}`,
  }
  return image as unknown as NativeImage
}

const asItem = (def: MenuItemDef | undefined): Item => {
  if (def?.kind !== 'item') throw new Error(`expected an item, got ${def?.kind}`)
  return def
}

describe('toMenuItemDefs', () => {
  it('collapses leading, trailing and repeated separators, hidden items aside', () => {
    const kinds = (items: MenuItemConstructorOptions[]) =>
      toMenuItemDefs(items, () => undefined).map((d) => (d.kind === 'item' ? d.label : '-'))
    expect(
      kinds([
        { type: 'separator' },
        { label: 'A' },
        { type: 'separator' },
        { label: 'Hidden', visible: false },
        { type: 'separator' },
        { label: 'B' },
        { type: 'separator' },
      ]),
    ).toEqual(['A', '-', 'B'])
    expect(kinds([{ label: 'Hidden', visible: false }, { type: 'separator' }])).toEqual([])
    const nested = asItem(
      toMenuItemDefs(
        [{ label: 'P', submenu: [{ type: 'separator' }, { label: 'C' }, { type: 'separator' }] }],
        () => undefined,
      )[0],
    )
    expect(nested.submenu?.map((d) => d.kind)).toEqual(['item'])
  })

  it('keeps a submenu, its order and nesting', () => {
    const defs = toMenuItemDefs(
      [
        {
          label: 'Parent',
          submenu: [{ label: 'First' }, { label: 'Second', enabled: false }],
        },
      ],
      () => undefined,
    )
    const parent = asItem(defs[0])
    expect(parent.label).toBe('Parent')
    expect(parent.run).toBeUndefined()
    const children = (parent.submenu ?? []).map(asItem)
    expect(children.map((c) => [c.label, c.enabled])).toEqual([
      ['First', true],
      ['Second', false],
    ])
    // Ids are unique across the whole menu, submenus included.
    const ids = [parent.id, ...children.map((c) => c.id)]
    expect(new Set(ids).size).toBe(3)
  })

  it('reads the submenu of a built MenuItem (a Menu with items)', () => {
    const child = { commandId: 2, label: 'Child', enabled: true, visible: true, type: 'normal' }
    const parent = {
      commandId: 1,
      label: 'Ext',
      enabled: true,
      visible: true,
      type: 'submenu',
      submenu: { items: [child] },
    }
    const defs = toMenuItemDefs([parent as unknown as MenuItem], () => undefined)
    const submenu = asItem(defs[0]).submenu ?? []
    expect(submenu.map((d) => asItem(d).label)).toEqual(['Child'])
  })

  it('keeps a separator a separator and drops hidden items', () => {
    const defs = toMenuItemDefs(
      [{ label: 'A' }, { type: 'separator' }, { label: 'Hidden', visible: false }, { label: 'B' }],
      () => undefined,
    )
    expect(defs.map((d) => (d.kind === 'item' ? d.label : d.kind))).toEqual(['A', 'separator', 'B'])
  })

  it('shows checkbox and radio items checked', () => {
    const defs = toMenuItemDefs(
      [
        { label: 'On', type: 'checkbox', checked: true },
        { label: 'Off', type: 'radio', checked: false },
      ],
      () => undefined,
    )
    expect(defs.map((d) => asItem(d).checked)).toEqual([true, false])
  })

  it('gives an item with an icon a 16 px PNG data URL', () => {
    const big = fakeImage(32)
    const defs = toMenuItemDefs(
      [
        { label: 'Small', icon: fakeImage(16) },
        { label: 'Big', icon: big },
        { label: 'Path', icon: '/some/icon.png' },
      ],
      () => undefined,
    )
    expect(asItem(defs[0]).icon).toBe('data:image/png;base64,16')
    expect(asItem(defs[1]).icon).toBe('data:image/png;base64,16')
    expect(big.resize).toHaveBeenCalledWith({ width: 16, height: 16 })
    expect(asItem(defs[2]).icon).toBeUndefined()
  })

  it('runs the original click through invoke', () => {
    const click = vi.fn()
    const item: MenuItemConstructorOptions = { label: 'Go', click }
    const invoke = vi.fn()
    asItem(toMenuItemDefs([item], invoke)[0]).run?.()
    expect(invoke).toHaveBeenCalledWith(item, expect.any(Object))
  })
})

describe('clickLikeElectron', () => {
  const win = { id: 1 } as unknown as Electron.BrowserWindow
  const contents = { id: 2 } as unknown as Electron.WebContents

  it("calls a template's click with (item, window, event)", () => {
    const click = vi.fn()
    const item: MenuItemConstructorOptions = { label: 'Go', click }
    asItem(toMenuItemDefs([item], clickLikeElectron(win, contents))[0]).run?.()
    expect(click).toHaveBeenCalledWith(item, win, expect.any(Object))
  })

  it("calls a built MenuItem's click with (event, window, contents)", () => {
    const click = vi.fn()
    const item = { commandId: 1, label: 'Go', enabled: true, visible: true, type: 'normal', click }
    asItem(
      toMenuItemDefs([item as unknown as MenuItem], clickLikeElectron(win, contents))[0],
    ).run?.()
    expect(click).toHaveBeenCalledWith(expect.any(Object), win, contents)
  })
})
