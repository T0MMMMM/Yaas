// Plain list of IPC channel names — no dependencies, safe to import from the sandboxed preload.
// Must match the keys of `commands` / `events` in ./contract.ts (enforced by a test).

export const COMMAND_CHANNELS = [
  'app.info',
  'settings.get',
  'settings.update',
  'claude.detect',
  'accounts.list',
  'accounts.importDefault',
  'browser.state',
  'browser.openTab',
  'browser.closeTab',
  'browser.activateTab',
  'browser.navigate',
  'browser.goBack',
  'browser.goForward',
  'browser.reload',
  'browser.createSpace',
  'browser.activateSpace',
  'browser.setPageBounds',
  'browser.setPageVisible',
  'overlay.open',
  'overlay.close',
  'ui.openSettings',
  'ui.focusAddress',
] as const

export const EVENT_CHANNELS = [
  'settings.changed',
  'accounts.changed',
  'browser.changed',
  'browser.shortcut',
  'overlay.opened',
  'overlay.closed',
] as const

export type CommandChannel = (typeof COMMAND_CHANNELS)[number]
export type EventChannel = (typeof EVENT_CHANNELS)[number]
