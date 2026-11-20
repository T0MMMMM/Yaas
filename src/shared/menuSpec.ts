// The wire format of a menu drawn by the overlay: main builds the items (and keeps what each one
// runs), the overlay draws them and answers `overlay.choose { menuId, itemId }`.
import { z } from 'zod'

/** Longest menu icon: a Phosphor name, or a `data:image/…` URL (an extension's icon). */
export const MENU_ICON_MAX = 65_536
/** Longest label or shortcut text. */
export const MENU_TEXT_MAX = 200

/** A Phosphor icon component's name (`PushPin`) or a `data:image/…` URL. */
const iconSchema = z
  .string()
  .max(MENU_ICON_MAX)
  .regex(/^(?:[A-Z][A-Za-z0-9]*|data:image\/.+)$/s, 'expected a Phosphor name or an image data URL')

export type MenuSpecItem =
  | {
      kind: 'item'
      id: string
      label: string
      enabled: boolean
      /** A data URL or a Phosphor name. */
      icon?: string | undefined
      shortcut?: string | undefined
      checked?: boolean | undefined
      submenu?: MenuSpecItem[] | undefined
    }
  | { kind: 'separator' }
  /** A field narrowing the items by label; only as a menu's first entry. */
  | { kind: 'filter' }

export const menuSpecItemSchema: z.ZodType<MenuSpecItem, MenuSpecItem> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('item'),
        id: z.string().min(1).max(MENU_TEXT_MAX),
        label: z.string().max(MENU_TEXT_MAX),
        enabled: z.boolean(),
        icon: iconSchema.optional(),
        shortcut: z.string().max(MENU_TEXT_MAX).optional(),
        checked: z.boolean().optional(),
        submenu: z.array(menuSpecItemSchema).optional(),
      })
      .strict(),
    z.object({ kind: z.literal('separator') }).strict(),
    z.object({ kind: z.literal('filter') }).strict(),
  ]),
)

export const menuSpecSchema = z
  .object({ id: z.string().min(1), items: z.array(menuSpecItemSchema) })
  .strict()
export type MenuSpec = z.infer<typeof menuSpecSchema>

/** A point in window coordinates (DIP), e.g. where a right-click happened. */
export const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()
export type Point = z.infer<typeof pointSchema>
