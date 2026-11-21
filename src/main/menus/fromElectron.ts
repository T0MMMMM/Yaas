// Electron menu items (an extension's `chrome.contextMenus` entries, built by
// electron-chrome-extensions) turned into the menus the overlay draws. Type-only Electron imports:
// the conversion runs on plain objects.
import type {
  BrowserWindow,
  KeyboardEvent,
  MenuItem,
  MenuItemConstructorOptions,
  NativeImage,
  WebContents,
} from 'electron'
import { MENU_ICON_MAX } from '@shared/menuSpec'
import type { MenuItemDef } from './menuRegistry'

export type ElectronMenuEntry = MenuItemConstructorOptions | MenuItem

/** Calls an entry's own click, given the keyboard state of the choice. */
export type InvokeElectronItem = (item: ElectronMenuEntry, event: KeyboardEvent) => void

/** Side of a menu icon, in px. */
const ICON_SIZE = 16

/** A built `MenuItem` (from `new MenuItem` / `Menu.buildFromTemplate`), not a template. */
const isBuilt = (item: ElectronMenuEntry): item is MenuItem => 'commandId' in item

function childrenOf(item: ElectronMenuEntry): ElectronMenuEntry[] | null {
  const submenu: unknown = item.submenu
  if (Array.isArray(submenu)) return submenu as ElectronMenuEntry[]
  if (submenu && typeof submenu === 'object' && 'items' in submenu) {
    return (submenu as { items: MenuItem[] }).items
  }
  return null
}

/** A 16 px PNG data URL of an image icon; a path or an empty image draws none. */
function iconOf(icon: NativeImage | string | undefined | null): string | undefined {
  if (!icon || typeof icon === 'string' || icon.isEmpty()) return undefined
  const { width, height } = icon.getSize()
  const sized =
    width === ICON_SIZE && height === ICON_SIZE
      ? icon
      : icon.resize({ width: ICON_SIZE, height: ICON_SIZE })
  const url = sized.toDataURL()
  return url.startsWith('data:image/') && url.length <= MENU_ICON_MAX ? url : undefined
}

/**
 * Converts Electron menu items, submenus included, to drawn menu items. Ids are `prefix:path`
 * (`extension:0.1`), unique across the menu; choosing an item calls `invoke` with it.
 */
export function toMenuItemDefs(
  items: ElectronMenuEntry[],
  invoke: InvokeElectronItem,
  prefix = 'electron',
): MenuItemDef[] {
  return convert(items, invoke, `${prefix}:`)
}

function convert(
  items: ElectronMenuEntry[],
  invoke: InvokeElectronItem,
  idPrefix: string,
): MenuItemDef[] {
  const defs = items.flatMap((item, index): MenuItemDef[] => {
    if (item.visible === false) return []
    if (item.type === 'separator') return [{ kind: 'separator' }]
    const id = `${idPrefix}${index}`
    const children = childrenOf(item)
    const icon = iconOf(item.icon)
    const checkable = item.type === 'checkbox' || item.type === 'radio'
    return [
      {
        kind: 'item',
        id,
        label: item.label ?? '',
        enabled: item.enabled !== false,
        ...(icon && { icon }),
        ...(checkable && { checked: item.checked === true }),
        ...(children
          ? { submenu: convert(children, invoke, `${id}.`) }
          : { run: () => invoke(item, {}) }),
      },
    ]
  })
  return tidySeparators(defs)
}

/** Drops leading, trailing and repeated separators (left over from hidden items). */
function tidySeparators(defs: MenuItemDef[]): MenuItemDef[] {
  const tidy = defs.filter(
    (def, i) => def.kind !== 'separator' || (i > 0 && defs[i - 1]?.kind !== 'separator'),
  )
  while (tidy.at(-1)?.kind === 'separator') tidy.pop()
  return tidy
}

/**
 * Calls an entry's click the way Electron's own menus do, for the window and page the menu was
 * opened on: a template's `click(menuItem, window, event)`, a built item's
 * `click(event, window, webContents)` (which then calls its template's click).
 */
export function clickLikeElectron(win: BrowserWindow, contents: WebContents): InvokeElectronItem {
  return (item, event) => {
    if (isBuilt(item)) {
      ;(item.click as (e: KeyboardEvent, w: BrowserWindow, c: WebContents) => void)(
        event,
        win,
        contents,
      )
    } else {
      item.click?.(item as unknown as MenuItem, win, event)
    }
  }
}
