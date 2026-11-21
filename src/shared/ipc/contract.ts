// THE IPC contract. Every command and event crossing the preload bridge is declared here.
// Main validates every input with these schemas; the renderer gets the types for free.
import { z } from 'zod'
import type {
  Account,
  BrowserFolder,
  BrowserSnapshot,
  BrowserSpace,
  BrowserTab,
  Download,
  HistoryEntry,
} from '../model'
import { menuSpecSchema, pointSchema } from '../menuSpec'
import type { CommandChannel, EventChannel } from './channels'

export const SIDEBAR_MIN = 48
/** Icon-only mode: a dragged width under `SIDEBAR_COMPACT_FROM` settles in 48…72 px. */
export const SIDEBAR_COMPACT_MIN = 48
export const SIDEBAR_COMPACT_MAX = 72
/** The default icon-only width. */
export const SIDEBAR_COMPACT = 56
export const SIDEBAR_COMPACT_FROM = 120
export const SIDEBAR_MAX = 440
export const SIDEBAR_DEFAULT = 248
/** Height of the window's top margin once open, with the window buttons (= `--window-controls-h`). */
export const WINDOW_CONTROLS_H = 32

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #RRGGBB')

/** A lower-cased hostname: it ends up in a filter rule, so no `$ , | ~` or whitespace. */
const hostnameSchema = z.string().regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/)

export const settingsSchema = z.object({
  accent: hexColor,
  colorScheme: z.enum(['light', 'dark', 'system']),
  /** 0 = opaque frame … 1 = fully see-through; at the top of the range the UI turns to liquid glass. */
  transparency: z.number().min(0).max(1),
  /** Grain intensity on the window frame, 0 = off. */
  grain: z.number().min(0).max(1),
  /** Account switcher at the bottom of the sidebar (DESIGN.md §2, §7). */
  spaceSwitcherStyle: z.enum(['emoji', 'letter', 'dots']),
  /** Where the context indicator and account usage live. */
  metersPlacement: z.enum(['contextbar', 'sidebar']),
  /** Hovered and selected cards tilt slightly, each at its own angle (DESIGN.md §2). */
  askewCards: z.boolean(),
  /** Buttons lean toward the pointer and grow slightly while hovered (DESIGN.md §2). */
  magneticButtons: z.boolean(),
  /** 3+ today tabs of one site are drawn as a folder named after it (derived, never stored). */
  autoFolders: z.boolean(),
  /** The bar above the page: its own card, or attached to the page with a separator line. */
  contextBarStyle: z.enum(['card', 'attached']),
  /** Sidebar width in px, resizable by drag (DESIGN.md §2). */
  sidebarWidth: z.number().int().min(SIDEBAR_MIN).max(SIDEBAR_MAX),
  /** The width the sidebar comes back to from icon-only mode (the address bar's sidebar button). */
  sidebarExpandedWidth: z.number().int().min(SIDEBAR_MIN).max(SIDEBAR_MAX),
  /** Archive sessions inactive for N days (never deletes; pinned sessions excluded). */
  autoArchive: z.object({
    enabled: z.boolean(),
    afterDays: z.number().int().min(1).max(365),
  }),
  onboardingDone: z.boolean(),
  /** Built-in ad and tracker blocking; `allowedHosts` are the sites where it is turned off. */
  adBlock: z.object({ enabled: z.boolean(), allowedHosts: z.array(hostnameSchema) }),
})
export type Settings = z.infer<typeof settingsSchema>

export const appInfoSchema = z.object({
  version: z.string(),
  platform: z.enum(['mac', 'windows', 'linux']),
  /** Whether native window material (vibrancy / Acrylic) is available. */
  glassSupported: z.boolean(),
})
export type AppInfo = z.infer<typeof appInfoSchema>

export const accountSchema = z.object({
  id: z.string(),
  provider: z.literal('claude-code'),
  label: z.string(),
  emoji: z.string(),
  color: hexColor,
  configDir: z.string().nullable(),
  authMethod: z.enum(['claude.ai', 'console', 'oauth-token', 'none']),
  email: z.string().nullable(),
  orgName: z.string().nullable(),
  plan: z.string().nullable(),
  defaultProfileId: z.string().nullable(),
  position: z.number().int(),
  archivedAt: z.string().nullable(),
}) satisfies z.ZodType<Account>

export const cliInfoSchema = z.object({
  /** Absolute path of the Claude Code CLI, or null when it can't be found. */
  path: z.string().nullable(),
  version: z.string().nullable(),
})
export type CliInfo = z.infer<typeof cliInfoSchema>

export const browserSpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: hexColor,
  position: z.number().int(),
  icon: z.string().nullable(),
  sectionCollapsed: z.boolean(),
}) satisfies z.ZodType<BrowserSpace>

export const tabSectionSchema = z.enum(['favorites', 'pinned', 'today'])

export const browserTabSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  url: z.string(),
  title: z.string(),
  faviconUrl: z.string().nullable(),
  position: z.number().int(),
  section: tabSectionSchema,
  folderId: z.string().nullable(),
  parentId: z.string().nullable(),
  lastActiveAt: z.string().nullable(),
}) satisfies z.ZodType<BrowserTab>

export const historyEntrySchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  url: z.string(),
  title: z.string(),
  visitCount: z.number().int(),
  lastVisit: z.string(),
}) satisfies z.ZodType<HistoryEntry>

export const downloadSchema = z.object({
  id: z.string(),
  url: z.string(),
  path: z.string(),
  filename: z.string(),
  totalBytes: z.number().int(),
  receivedBytes: z.number().int(),
  state: z.enum(['progressing', 'completed', 'interrupted']),
  startedAt: z.string(),
}) satisfies z.ZodType<Download>

export const browserFolderSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  name: z.string(),
  position: z.number().int(),
  collapsed: z.boolean(),
  parentId: z.string().nullable(),
  icon: z.string().nullable(),
}) satisfies z.ZodType<BrowserFolder>

/** Live state of a tab's web contents — never persisted. */
export interface TabRuntime {
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  /** The page's `theme-color`, or null when it has none. */
  themeColor: string | null
  /** Id of the tab's web contents in main, or null when it has none. */
  webContentsId: number | null
  /** The tab has a view (its page is loaded); false until first shown, and after an unload. */
  loaded: boolean
}

export const tabRuntimeSchema = z.object({
  loading: z.boolean(),
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
  themeColor: z.string().nullable(),
  webContentsId: z.number().int().nullable(),
  loaded: z.boolean(),
}) satisfies z.ZodType<TabRuntime>

/** The browser model plus the runtime state of every tab, keyed by tab id. */
export type BrowserState = BrowserSnapshot & { runtime: Record<string, TabRuntime> }

export const browserStateSchema = z.object({
  spaces: z.array(browserSpaceSchema),
  activeSpaceId: z.string(),
  tabs: z.array(browserTabSchema),
  folders: z.array(browserFolderSchema),
  activeTabIds: z.record(z.string(), z.string().nullable()),
  runtime: z.record(z.string(), tabRuntimeSchema),
}) satisfies z.ZodType<BrowserState>

/** Where the page sits in the window, in DIP. Sent by the renderer. */
export interface PageBounds {
  x: number
  y: number
  width: number
  height: number
}

const bound = z.number().int().min(0)
export const pageBoundsSchema = z
  .object({ x: bound, y: bound, width: bound, height: bound })
  .strict() satisfies z.ZodType<PageBounds>

/**
 * What the overlay view shows: the + menu or the site menu of the address bar (popovers anchored
 * to a button), the tab finder (⌘K) or the command field (⌘T) (cards centred over the window), a
 * menu built by main (`MenuSpec`): at the pointer (a right-click) or from a button, or a card a
 * space menu opens from its button (the space's icon or colour, a confirmation).
 */
export const overlayKindSchema = z.enum([
  'new-menu',
  'site-menu',
  'tab-finder',
  'command',
  'context-menu',
  'anchored-menu',
  'space-icon',
  'space-color',
  'folder-icon',
  'confirm',
  'downloads',
])
export type OverlayKind = z.infer<typeof overlayKindSchema>

/** What a confirmation card's confirm button runs (from the overlay, a trusted sender). */
export const confirmActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('delete-space'), spaceId: z.string().min(1) }).strict(),
])
export type ConfirmAction = z.infer<typeof confirmActionSchema>

/** A popover and the rect (window DIP) of the button it opens from, or a centred card. */
export const overlayRequestSchema = z.union([
  z
    .object({ kind: z.enum(['new-menu', 'site-menu', 'downloads']), anchor: pageBoundsSchema })
    .strict(),
  z.object({ kind: z.enum(['tab-finder', 'command']) }).strict(),
  /** A space's icon (an emoji) or colour, edited from the button its menu opened from. */
  z
    .object({
      kind: z.enum(['space-icon', 'space-color']),
      anchor: pageBoundsSchema,
      spaceId: z.string().min(1),
    })
    .strict(),
  /** A folder's icon (a hue or an emoji), edited from the row its menu opened at. */
  z
    .object({
      kind: z.literal('folder-icon'),
      anchor: pageBoundsSchema,
      folderId: z.string().min(1),
    })
    .strict(),
  /** A question with Cancel and `confirmLabel`, which runs `action`. */
  z
    .object({
      kind: z.literal('confirm'),
      anchor: pageBoundsSchema,
      message: z.string().min(1).max(500),
      confirmLabel: z.string().min(1).max(40),
      action: confirmActionSchema,
    })
    .strict(),
  /** Main's menu, opened at a point (window DIP): the pointer of a right-click. */
  z.object({ kind: z.literal('context-menu'), at: pointSchema, menu: menuSpecSchema }).strict(),
  /** Main's menu, joined to the button it opens from. */
  z
    .object({
      kind: z.literal('anchored-menu'),
      anchor: pageBoundsSchema,
      placement: z.enum(['above', 'below']),
      menu: menuSpecSchema,
    })
    .strict(),
])
export type OverlayRequest = z.infer<typeof overlayRequestSchema>

/**
 * A sidebar row's tooltip, drawn in the overlay beside the row: the row's rect (window DIP; the
 * tooltip starts at its right edge and is centred on it vertically), its title and a detail line.
 */
/** Longest tooltip title or detail; the sidebar clips longer ones before sending (clipTooltip). */
export const TOOLTIP_TEXT_MAX = 500

/** Longest favicon URL a tooltip carries (a data: URL can be long; longer ones are dropped). */
export const TOOLTIP_ICON_MAX = 4096

export const tooltipSchema = z
  .object({
    anchor: pageBoundsSchema,
    title: z.string().max(TOOLTIP_TEXT_MAX),
    detail: z.string().max(TOOLTIP_TEXT_MAX),
    /** The row's favicon, shown before the title. */
    icon: z.string().max(TOOLTIP_ICON_MAX).optional(),
  })
  .strict()
export type Tooltip = z.infer<typeof tooltipSchema>

/**
 * What main asks the UI to do: shortcuts pressed while a page has focus, actions from the overlay
 * or from main's menus (a folder's Rename edits its name in the sidebar).
 */
export const shortcutSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('focus-address') }).strict(),
  z.object({ kind: z.literal('settings') }).strict(),
  z.object({ kind: z.literal('rename-folder'), folderId: z.string().min(1) }).strict(),
  /** The space menu's Rename Space…: the space header turns into a field. */
  z.object({ kind: z.literal('rename-space'), spaceId: z.string().min(1) }).strict(),
  /** ⌘K: open the tab finder. */
  z.object({ kind: z.literal('tab-finder') }).strict(),
  /** ⌘T: open the command field (a tab is created only when it is submitted). */
  z.object({ kind: z.literal('command') }).strict(),
])
export type Shortcut = z.infer<typeof shortcutSchema>

const id = z.string().min(1)
const tabRef = z.object({ tabId: id }).strict()
const folderRef = z.object({ folderId: id }).strict()
const folderName = z.string().min(1).max(80)

export const commands = {
  'app.info': { input: z.void(), output: appInfoSchema },
  'settings.get': { input: z.void(), output: settingsSchema },
  'settings.update': { input: settingsSchema.partial().strict(), output: settingsSchema },
  'claude.detect': { input: z.void(), output: cliInfoSchema },
  'accounts.list': { input: z.void(), output: z.array(accountSchema) },
  /** Imports the account already signed in to ~/.claude (ADR-0002). Idempotent. */
  'accounts.importDefault': { input: z.void(), output: accountSchema },
  'browser.state': { input: z.void(), output: browserStateSchema },
  /** Opens a tab in the given space (default: the active one); `input` goes through resolveInput. */
  'browser.openTab': {
    input: z.object({ spaceId: id.optional(), input: z.string().optional() }).strict(),
    output: browserTabSchema,
  },
  /** The user's close: a favourite or pinned tab is unloaded (its view destroyed), a today tab deleted. */
  'browser.closeTab': { input: tabRef, output: z.void() },
  /** Deletes a tab whatever its section (reopenable). */
  'browser.removeTab': { input: tabRef, output: z.void() },
  /** Moves a tab to `index` of a section (or of any pinned folder); today's index is in drawn order. */
  'browser.moveTab': {
    input: z
      .object({
        tabId: id,
        section: tabSectionSchema,
        folderId: id.nullable().optional(),
        index: z.number().int().min(0),
      })
      .strict(),
    output: z.void(),
  },
  /**
   * A new folder at the end of its parent's list: the space's pinned section, or the folder
   * `parentId` (default: the active space's pinned section).
   */
  'browser.createFolder': {
    input: z
      .object({ spaceId: id.optional(), name: folderName, parentId: id.nullable().optional() })
      .strict(),
    output: browserFolderSchema,
  },
  /** Moves a folder (with its subtree) to `index` of pinned's top level or of another folder. */
  'browser.moveFolder': {
    input: z
      .object({ folderId: id, parentId: id.nullable(), index: z.number().int().min(0) })
      .strict(),
    output: z.void(),
  },
  'browser.renameFolder': {
    input: z.object({ folderId: id, name: folderName }).strict(),
    output: z.void(),
  },
  'browser.setFolderCollapsed': {
    input: z.object({ folderId: id, collapsed: z.boolean() }).strict(),
    output: z.void(),
  },
  /** `hue:<deg>` (a folder hue) or an emoji; null goes back to the hue of the name. */
  'browser.setFolderIcon': {
    input: z.object({ folderId: id, icon: z.string().min(1).max(16).nullable() }).strict(),
    output: z.void(),
  },
  /** Deletes a folder with its child folders and tabs (reopenable together). */
  'browser.deleteFolder': { input: folderRef, output: z.void() },
  /** Reopens the last closed tab, or the last deleted folder with its subtree. */
  'browser.reopenClosed': { input: z.void(), output: z.void() },
  /** The tab's menu, drawn at the pointer (pin, favourites, folder, copy, close). */
  'browser.showTabMenu': {
    input: z.object({ tabId: id, at: pointSchema }).strict(),
    output: z.void(),
  },
  /**
   * The folder's menu, drawn at the pointer (rename, icon, move to folder, delete); its icon card
   * opens from `anchor`, the folder's row (window DIP), or the pointer without one.
   */
  'browser.showFolderMenu': {
    input: z
      .object({ folderId: id, at: pointSchema, anchor: pageBoundsSchema.optional() })
      .strict(),
    output: z.void(),
  },
  /**
   * The space's menu, joined to the button it opens from (`anchor`, window DIP): rename, icon,
   * look, new folder, settings, delete. Its cards open from the same button.
   */
  'browser.showSpaceMenu': {
    input: z.object({ spaceId: id, anchor: pageBoundsSchema }).strict(),
    output: z.void(),
  },
  'browser.activateTab': { input: tabRef, output: z.void() },
  'browser.navigate': {
    input: z.object({ tabId: id, input: z.string() }).strict(),
    output: z.void(),
  },
  'browser.goBack': { input: tabRef, output: z.void() },
  'browser.goForward': { input: tabRef, output: z.void() },
  'browser.reload': { input: tabRef, output: z.void() },
  'browser.createSpace': {
    input: z.object({ name: z.string().min(1).max(40), color: hexColor }).strict(),
    output: browserSpaceSchema,
  },
  'browser.activateSpace': { input: z.object({ spaceId: id }).strict(), output: z.void() },
  'browser.renameSpace': {
    input: z.object({ spaceId: id, name: z.string().min(1).max(40) }).strict(),
    output: z.void(),
  },
  /** An emoji or icon name; null goes back to the colour dot. */
  'browser.setSpaceIcon': {
    input: z.object({ spaceId: id, icon: z.string().min(1).max(16).nullable() }).strict(),
    output: z.void(),
  },
  'browser.setSpaceColor': {
    input: z.object({ spaceId: id, color: hexColor }).strict(),
    output: z.void(),
  },
  'browser.setSpaceSectionCollapsed': {
    input: z.object({ spaceId: id, collapsed: z.boolean() }).strict(),
    output: z.void(),
  },
  /** Deletes a space with its tabs, folders and browsing data; the last space can't be deleted. */
  'browser.deleteSpace': { input: z.object({ spaceId: id }).strict(), output: z.void() },
  /** The most visited pages of a space (the active one by default), for the new-tab dock. */
  'history.frequent': {
    input: z.object({ spaceId: id.optional() }).strict(),
    output: z.array(historyEntrySchema),
  },
  /** Pages of any space whose title or URL contains the query. */
  'history.search': {
    input: z.object({ query: z.string().max(500) }).strict(),
    output: z.array(historyEntrySchema),
  },
  /** Forgets one page. */
  'history.forget': { input: z.object({ id }).strict(), output: z.void() },
  /** The downloads of every space, newest first. */
  'downloads.list': { input: z.void(), output: z.array(downloadSchema) },
  /** Forgets the finished downloads (never their files). */
  'downloads.clear': { input: z.void(), output: z.void() },
  /** Shows a downloaded file in Finder / Explorer. */
  'downloads.show': { input: z.object({ id }).strict(), output: z.void() },
  'browser.setPageBounds': { input: pageBoundsSchema, output: z.void() },
  'browser.setPageVisible': {
    input: z.object({ visible: z.boolean() }).strict(),
    output: z.void(),
  },
  /** Copies the tab's URL to the clipboard (the address bar's Copy link). */
  'browser.copyLink': { input: tabRef, output: z.void() },
  /** Shares the tab's URL: the macOS share menu at the pointer, elsewhere copied to the clipboard. */
  'browser.share': { input: tabRef, output: z.void() },
  /** Opens or closes the developer tools of the tab's page. */
  'browser.toggleDevTools': { input: tabRef, output: z.void() },
  /**
   * The window's top margin opened or closed: shows or hides the traffic lights (macOS; no-op
   * elsewhere), and while open main reports the pointer leaving the top band (`window.topHover`).
   */
  'window.setControlsVisible': {
    input: z.object({ visible: z.boolean() }).strict(),
    output: z.void(),
  },
  /** The window buttons the UI draws on Windows (no native caption buttons there). */
  'window.minimize': { input: z.void(), output: z.void() },
  /** Maximizes the window, or restores it when it is maximized. */
  'window.toggleMaximize': { input: z.void(), output: z.void() },
  'window.close': { input: z.void(), output: z.void() },
  'window.isMaximized': { input: z.void(), output: z.boolean() },
  /** Opens the Chrome Web Store as a tab of the active space. */
  'browser.openWebStore': { input: z.void(), output: z.void() },
  /** Shows the overlay view over the whole window with a popover anchored to a UI button. */
  'overlay.open': { input: overlayRequestSchema, output: z.void() },
  'overlay.close': { input: z.void(), output: z.void() },
  /** From the overlay: the item chosen in main's menu (a stale or unknown menu does nothing). */
  'overlay.choose': {
    input: z.object({ menuId: id, itemId: id }).strict(),
    output: z.void(),
  },
  /**
   * Shows a sidebar tooltip in the overlay (never focused), or hides it with `null`: from the UI
   * after a fade, from the overlay (the pointer is on it) at once. Ignored while a popover is open.
   */
  'overlay.tooltip': { input: tooltipSchema.nullable(), output: z.void() },
  /** Asks the UI to open its settings (from the overlay): emits `browser.shortcut` `settings`. */
  'ui.openSettings': { input: z.void(), output: z.void() },
  /** Asks the UI to edit the address (from the overlay): emits `browser.shortcut` `focus-address`. */
  'ui.focusAddress': { input: z.void(), output: z.void() },
  /** Asks the UI to edit a folder's name (from the overlay): emits `browser.shortcut` `rename-folder`. */
  'ui.renameFolder': { input: folderRef, output: z.void() },
} as const satisfies Record<CommandChannel, { input: z.ZodType; output: z.ZodType }>

export const events = {
  'settings.changed': settingsSchema,
  'accounts.changed': z.array(accountSchema),
  'browser.changed': browserStateSchema,
  /** Something main asks the UI to do (see shortcutSchema). */
  'browser.shortcut': shortcutSchema,
  /** To the UI and the overlay: the downloads list changed (progress, a finish, Clear). */
  'downloads.changed': z.array(downloadSchema),
  /** To the overlay only: which popover to show, and where. */
  'overlay.opened': overlayRequestSchema,
  /** To the overlay only: the tooltip to draw, or `null` to fade it out. */
  'overlay.tooltip': tooltipSchema.nullable(),
  /**
   * To the UI and the overlay: the overlay closed, so the button that opened it resets and the
   * overlay drops its popover (main can close it, e.g. for ⌘L, without the overlay asking).
   */
  'overlay.closed': z.void(),
  /** To the UI: the window was maximized (`true`) or restored, so the drawn button follows. */
  'window.maximized': z.boolean(),
  /**
   * To the UI, while the window's top margin is open: whether the pointer is still in the window's
   * top band. The open margin is a drag region (and holds the macOS traffic lights), where the
   * page gets no pointer events, so main watches instead.
   */
  'window.topHover': z.boolean(),
} as const satisfies Record<EventChannel, z.ZodType>

export type Commands = typeof commands
export type CommandInput<C extends CommandChannel> = z.input<Commands[C]['input']>
export type CommandOutput<C extends CommandChannel> = z.output<Commands[C]['output']>
export type EventPayload<E extends EventChannel> = z.output<(typeof events)[E]>

/** Result envelope used on the wire, so errors survive structured cloning. */
export type IpcResult<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

/** Shape of `window.bigBrowser`, implemented by the preload. */
export interface BigBrowserBridge {
  invoke<C extends CommandChannel>(
    channel: C,
    ...args: undefined extends CommandInput<C> ? [] : [input: CommandInput<C>]
  ): Promise<CommandOutput<C>>
  on<E extends EventChannel>(channel: E, listener: (payload: EventPayload<E>) => void): () => void
}
