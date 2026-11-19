import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { COMMAND_CHANNELS, type CommandChannel, type EventChannel } from '@shared/ipc/channels'
import {
  commands,
  events,
  type CommandInput,
  type CommandOutput,
  type EventPayload,
  type IpcResult,
} from '@shared/ipc/contract'

export type CommandHandler<C extends CommandChannel> = (
  input: CommandInput<C>,
  event: IpcMainInvokeEvent,
) => CommandOutput<C> | Promise<CommandOutput<C>>

export type CommandHandlers = { [C in CommandChannel]: CommandHandler<C> }

/**
 * Registers one ipcMain handler per command. Every call is checked: trusted sender, valid input
 * (zod), and the result is wrapped in an IpcResult envelope.
 */
export function registerCommands(
  handlers: CommandHandlers,
  isTrustedSender: (sender: WebContents) => boolean,
): void {
  for (const channel of COMMAND_CHANNELS) {
    ipcMain.handle(channel, async (event, raw: unknown): Promise<IpcResult<unknown>> => {
      if (!isTrustedSender(event.sender)) {
        return { ok: false, error: { code: 'forbidden', message: 'Untrusted sender' } }
      }
      const parsed = commands[channel].input.safeParse(raw)
      if (!parsed.success) {
        return { ok: false, error: { code: 'invalid_input', message: parsed.error.message } }
      }
      try {
        const handler = handlers[channel] as CommandHandler<typeof channel>
        const data = await handler(parsed.data as never, event)
        return { ok: true, data }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, error: { code: 'internal', message } }
      }
    })
  }
}

/** Sends a validated event to a renderer. */
export function emit<E extends EventChannel>(
  target: WebContents,
  channel: E,
  payload: EventPayload<E>,
): void {
  if (target.isDestroyed()) return
  target.send(channel, events[channel].parse(payload))
}
