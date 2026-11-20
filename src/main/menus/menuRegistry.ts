// Main's side of the menus the overlay draws: what each item of the open menu runs. The overlay only
// gets the `MenuSpec` (labels, icons, ids) and answers with the chosen item's id.
import { BrowserError } from '@core/browser/browserStore'
import type { OverlayRequest, PageBounds } from '@shared/ipc/contract'
import type { MenuSpec, MenuSpecItem, Point } from '@shared/menuSpec'

/** A menu item as main builds it: a `MenuSpecItem` plus what choosing it runs. */
export type MenuItemDef =
  | {
      kind: 'item'
      /** Unique within the whole menu, submenus included. */
      id: string
      label: string
      /** Default true. */
      enabled?: boolean
      /** A data URL or a Phosphor name. */
      icon?: string
      shortcut?: string
      checked?: boolean
      /** An item with a submenu opens it rather than running anything. */
      submenu?: MenuItemDef[]
      run?: () => void
    }
  | { kind: 'separator' }
  | { kind: 'filter' }

/** Where a menu opens: at a point (a right-click), or joined to a button. */
export type MenuWhere = { at: Point } | { anchor: PageBounds; placement: 'above' | 'below' }

/** The overlay request that draws `menu` where it was asked for. */
export function menuRequest(where: MenuWhere, menu: MenuSpec): OverlayRequest {
  return 'at' in where
    ? { kind: 'context-menu', at: where.at, menu }
    : { kind: 'anchored-menu', anchor: where.anchor, placement: where.placement, menu }
}

interface Action {
  enabled: boolean
  run: (() => void) | undefined
}

/**
 * The one menu open in the overlay and the actions of its items. A choice runs at most once, and
 * only for the current menu: a stale id (a replaced or closed menu) does nothing.
 */
export class MenuRegistry {
  private current: { id: string; actions: Map<string, Action> } | null = null
  private count = 0

  open(items: MenuItemDef[]): MenuSpec {
    const actions = new Map<string, Action>()
    const spec = (defs: MenuItemDef[]): MenuSpecItem[] =>
      defs.map((def) => {
        if (def.kind !== 'item') return def
        const { run, submenu, enabled = true, ...rest } = def
        if (actions.has(def.id)) throw new Error(`Duplicate menu item id ${def.id}`)
        actions.set(def.id, { enabled, run })
        return { ...rest, enabled, ...(submenu && { submenu: spec(submenu) }) }
      })
    const menu: MenuSpec = { id: `menu-${++this.count}`, items: spec(items) }
    this.current = { id: menu.id, actions }
    return menu
  }

  /**
   * Runs the chosen item, once. Its tab, folder or space may have vanished while the menu was open
   * (closed by a shortcut, a page, another window): the store's `not_found` is then ignored.
   */
  choose(menuId: string, itemId: string): void {
    if (this.current?.id !== menuId) return
    const action = this.current.actions.get(itemId)
    if (!action?.enabled || !action.run) return
    this.current = null
    try {
      action.run()
    } catch (error) {
      if (!(error instanceof BrowserError && error.code === 'not_found')) throw error
    }
  }

  clear(): void {
    this.current = null
  }
}
