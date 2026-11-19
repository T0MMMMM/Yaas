// Plain list of IPC channel names — no dependencies, safe to import from the sandboxed preload.
// Must match the keys of `commands` / `events` in ./contract.ts (enforced by a test).

export const COMMAND_CHANNELS = [
  'app.info',
  'settings.get',
  'settings.update',
  'claude.detect',
  'accounts.list',
  'accounts.importDefault',
] as const

export const EVENT_CHANNELS = ['settings.changed', 'accounts.changed'] as const

export type CommandChannel = (typeof COMMAND_CHANNELS)[number]
export type EventChannel = (typeof EVENT_CHANNELS)[number]
