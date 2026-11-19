// THE IPC contract. Every command and event crossing the preload bridge is declared here.
// Main validates every input with these schemas; the renderer gets the types for free.
import { z } from 'zod'
import type { Account } from '../model'
import type { CommandChannel, EventChannel } from './channels'

export const SIDEBAR_MIN = 200
export const SIDEBAR_MAX = 440
export const SIDEBAR_DEFAULT = 248

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #RRGGBB')

export const settingsSchema = z.object({
  accent: hexColor,
  colorScheme: z.enum(['light', 'dark', 'system']),
  glass: z.boolean(),
  grain: z.boolean(),
  /** 0..0.2 — see docs/DESIGN.md §3.2 */
  grainOpacity: z.number().min(0).max(0.2),
  /** Account switcher at the bottom of the sidebar (DESIGN.md §2, §7). */
  spaceSwitcherStyle: z.enum(['emoji', 'letter', 'dots']),
  /** Where the context indicator and account usage live. */
  metersPlacement: z.enum(['contextbar', 'sidebar']),
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
  /** Whether native window material (vibrancy / Mica) is available. */
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

export const commands = {
  'app.info': { input: z.void(), output: appInfoSchema },
  'settings.get': { input: z.void(), output: settingsSchema },
  'settings.update': { input: settingsSchema.partial().strict(), output: settingsSchema },
  'claude.detect': { input: z.void(), output: cliInfoSchema },
  'accounts.list': { input: z.void(), output: z.array(accountSchema) },
  /** Imports the account already signed in to ~/.claude (ADR-0002). Idempotent. */
  'accounts.importDefault': { input: z.void(), output: accountSchema },
} as const satisfies Record<CommandChannel, { input: z.ZodType; output: z.ZodType }>

export const events = {
  'settings.changed': settingsSchema,
  'accounts.changed': z.array(accountSchema),
} as const satisfies Record<EventChannel, z.ZodType>

export type Commands = typeof commands
export type CommandInput<C extends CommandChannel> = z.input<Commands[C]['input']>
export type CommandOutput<C extends CommandChannel> = z.output<Commands[C]['output']>
export type EventPayload<E extends EventChannel> = z.output<(typeof events)[E]>

/** Result envelope used on the wire, so errors survive structured cloning. */
export type IpcResult<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

/** Shape of `window.yaas`, implemented by the preload. */
export interface YaasBridge {
  invoke<C extends CommandChannel>(
    channel: C,
    ...args: undefined extends CommandInput<C> ? [] : [input: CommandInput<C>]
  ): Promise<CommandOutput<C>>
  on<E extends EventChannel>(channel: E, listener: (payload: EventPayload<E>) => void): () => void
}
