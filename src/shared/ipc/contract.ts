// THE IPC contract. Every command and event crossing the preload bridge is declared here.
// Main validates every input with these schemas; the renderer gets the types for free.
import { z } from 'zod'
import type { Account, BrowserFolder, BrowserSnapshot, BrowserSpace, BrowserTab } from '../model'
import type { CommandChannel, EventChannel } from './channels'

export const SIDEBAR_MIN = 200
export const SIDEBAR_MAX = 440
export const SIDEBAR_DEFAULT = 248

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
  /** 3+ today tabs of one site are drawn as a folder named after it (derived, never stored). */
  autoFolders: z.boolean(),
  /** The bar above the page: its own card, or attached to the page with a separator line. */
  contextBarStyle: z.enum(['card', 'attached']),
  /** Sidebar width in px, resizable by drag (DESIGN.md §2). */
  sidebarWidth: z.number().int().min(SIDEBAR_MIN).max(SIDEBAR_MAX),
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
}) satisfies z.ZodType<BrowserTab>

export const browserFolderSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  name: z.string(),
  position: z.number().int(),
  collapsed: z.boolean(),
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

/** What the overlay view shows: the + menu, or the site menu of the address bar. */
export const overlayKindSchema = z.enum(['new-menu', 'site-menu'])
export type OverlayKind = z.infer<typeof overlayKindSchema>

/** An overlay popover and the rect (window DIP) of the button it opens from. */
export const overlayRequestSchema = z
  .object({ kind: overlayKindSchema, anchor: pageBoundsSchema })
  .strict()
export type OverlayRequest = z.infer<typeof overlayRequestSchema>

/**
 * What main asks the UI to do: shortcuts pressed while a page has focus, actions from the overlay
 * or from a native menu (a folder's Rename edits its name in the sidebar).
 */
export const shortcutSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('focus-address') }).strict(),
  z.object({ kind: z.literal('settings') }).strict(),
  z.object({ kind: z.literal('rename-folder'), folderId: z.string().min(1) }).strict(),
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
  /** Moves a tab to `index` of a section (or of a pinned folder); today's index is in drawn order. */
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
  /** A new folder at the end of the space's pinned section (default: the active space). */
  'browser.createFolder': {
    input: z.object({ spaceId: id.optional(), name: folderName }).strict(),
    output: browserFolderSchema,
  },
  'browser.renameFolder': {
    input: z.object({ folderId: id, name: folderName }).strict(),
    output: z.void(),
  },
  'browser.setFolderCollapsed': {
    input: z.object({ folderId: id, collapsed: z.boolean() }).strict(),
    output: z.void(),
  },
  /** Deletes a folder and its tabs (reopenable together). */
  'browser.deleteFolder': { input: folderRef, output: z.void() },
  /** Reopens the last closed tab, or the tabs of the last deleted folder. */
  'browser.reopenClosed': { input: z.void(), output: z.void() },
  /** The tab's native context menu, at the pointer (pin, favourites, folder, copy, close). */
  'browser.showTabMenu': { input: tabRef, output: z.void() },
  /** The folder's native context menu, at the pointer (rename, delete). */
  'browser.showFolderMenu': { input: folderRef, output: z.void() },
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
  'browser.setPageBounds': { input: pageBoundsSchema, output: z.void() },
  'browser.setPageVisible': {
    input: z.object({ visible: z.boolean() }).strict(),
    output: z.void(),
  },
  /** Shares the tab's URL: the macOS share menu at the pointer, elsewhere copied to the clipboard. */
  'browser.share': { input: tabRef, output: z.void() },
  /** Opens or closes the developer tools of the tab's page. */
  'browser.toggleDevTools': { input: tabRef, output: z.void() },
  /** Opens the Chrome Web Store as a tab of the active space. */
  'browser.openWebStore': { input: z.void(), output: z.void() },
  /** Shows the overlay view over the whole window with a popover anchored to a UI button. */
  'overlay.open': { input: overlayRequestSchema, output: z.void() },
  'overlay.close': { input: z.void(), output: z.void() },
  /** Asks the UI to open its settings (from the overlay): emits `browser.shortcut` `settings`. */
  'ui.openSettings': { input: z.void(), output: z.void() },
  /** Asks the UI to edit the address (from the overlay): emits `browser.shortcut` `focus-address`. */
  'ui.focusAddress': { input: z.void(), output: z.void() },
} as const satisfies Record<CommandChannel, { input: z.ZodType; output: z.ZodType }>

export const events = {
  'settings.changed': settingsSchema,
  'accounts.changed': z.array(accountSchema),
  'browser.changed': browserStateSchema,
  /** Something main asks the UI to do (see shortcutSchema). */
  'browser.shortcut': shortcutSchema,
  /** To the overlay only: which popover to show, and where. */
  'overlay.opened': overlayRequestSchema,
  /** To the UI only: the overlay closed, so the button that opened it resets. */
  'overlay.closed': z.void(),
} as const satisfies Record<EventChannel, z.ZodType>

export type Commands = typeof commands
export type CommandInput<C extends CommandChannel> = z.input<Commands[C]['input']>
export type CommandOutput<C extends CommandChannel> = z.output<Commands[C]['output']>
export type EventPayload<E extends EventChannel> = z.output<(typeof events)[E]>

/** Result envelope used on the wire, so errors survive structured cloning. */
export type IpcResult<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

/** Shape of `window.acab`, implemented by the preload. */
export interface AcabBridge {
  invoke<C extends CommandChannel>(
    channel: C,
    ...args: undefined extends CommandInput<C> ? [] : [input: CommandInput<C>]
  ): Promise<CommandOutput<C>>
  on<E extends EventChannel>(channel: E, listener: (payload: EventPayload<E>) => void): () => void
}
