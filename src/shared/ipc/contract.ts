// THE IPC contract. Every command and event crossing the preload bridge is declared here.
// Main validates every input with these schemas; the renderer gets the types for free.
import { z } from 'zod'
import type { Account, BrowserSnapshot, BrowserSpace, BrowserTab } from '../model'
import type { CommandChannel, EventChannel } from './channels'

export const SIDEBAR_MIN = 200
export const SIDEBAR_MAX = 440
export const SIDEBAR_DEFAULT = 248

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #RRGGBB')

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

export const browserTabSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  url: z.string(),
  title: z.string(),
  faviconUrl: z.string().nullable(),
  position: z.number().int(),
}) satisfies z.ZodType<BrowserTab>

/** Live state of a tab's web contents — never persisted. */
export interface TabRuntime {
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  /** The page's `theme-color`, or null when it has none. */
  themeColor: string | null
}

export const tabRuntimeSchema = z.object({
  loading: z.boolean(),
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
  themeColor: z.string().nullable(),
}) satisfies z.ZodType<TabRuntime>

/** The browser model plus the runtime state of each tab that has a view, keyed by tab id. */
export type BrowserState = BrowserSnapshot & { runtime: Record<string, TabRuntime> }

export const browserStateSchema = z.object({
  spaces: z.array(browserSpaceSchema),
  activeSpaceId: z.string(),
  tabs: z.array(browserTabSchema),
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

const id = z.string().min(1)
const tabRef = z.object({ tabId: id }).strict()

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
  'browser.closeTab': { input: tabRef, output: z.void() },
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
  /** Shows the overlay view over the whole window with a popover anchored to a UI button. */
  'overlay.open': { input: overlayRequestSchema, output: z.void() },
  'overlay.close': { input: z.void(), output: z.void() },
  /** Asks the UI to open its settings (from the overlay): emits `browser.shortcut` 'settings'. */
  'ui.openSettings': { input: z.void(), output: z.void() },
  /** Asks the UI to edit the address (from the overlay): emits `browser.shortcut` 'focus-address'. */
  'ui.focusAddress': { input: z.void(), output: z.void() },
} as const satisfies Record<CommandChannel, { input: z.ZodType; output: z.ZodType }>

export const events = {
  'settings.changed': settingsSchema,
  'accounts.changed': z.array(accountSchema),
  'browser.changed': browserStateSchema,
  /** A shortcut pressed while a page has focus, forwarded to the UI. */
  'browser.shortcut': z.enum(['focus-address', 'settings']),
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
