// THE IPC contract. Every command and event crossing the preload bridge is declared here.
// Main validates every input with these schemas; the renderer gets the types for free.
import { z } from 'zod'
import type { CommandChannel, EventChannel } from './channels'

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #RRGGBB')

export const settingsSchema = z.object({
  accent: hexColor,
  colorScheme: z.enum(['light', 'dark', 'system']),
  glass: z.boolean(),
  grain: z.boolean(),
  /** 0..0.2 — see docs/DESIGN.md §3.2 */
  grainOpacity: z.number().min(0).max(0.2),
  /** Sidebar space switcher: account icons or plain dots (DESIGN.md §2). */
  spaceSwitcherStyle: z.enum(['icons', 'dots']),
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

export const commands = {
  'app.info': { input: z.void(), output: appInfoSchema },
  'settings.get': { input: z.void(), output: settingsSchema },
  'settings.update': { input: settingsSchema.partial().strict(), output: settingsSchema },
} as const satisfies Record<CommandChannel, { input: z.ZodType; output: z.ZodType }>

export const events = {
  'settings.changed': settingsSchema,
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
