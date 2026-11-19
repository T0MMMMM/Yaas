/** Keyboard shortcuts registry (DESIGN.md §8). Feeds the Settings list; later the palette and remapping. */
export const SHORTCUTS: Array<{ action: string; keys: string }> = [
  { action: 'Command palette', keys: '⌘K' },
  { action: 'New session', keys: '⌘T' },
  { action: 'Close tab (keeps the session)', keys: '⌘W' },
  { action: 'Reopen last closed', keys: '⇧⌘T' },
  { action: 'Switch to account 1…9', keys: '⌘1…9' },
  { action: 'Next / previous session', keys: '⌃Tab / ⌃⇧Tab' },
  { action: 'Search in session / all sessions', keys: '⌘F / ⇧⌘F' },
  { action: 'Interrupt Claude', keys: 'Esc / ⌘.' },
  { action: 'Approve once / always for project / deny', keys: '⏎ / ⌘⏎ / Esc' },
  { action: 'Pin / unpin', keys: '⌘D' },
  { action: 'Settings', keys: '⌘,' },
  { action: 'Add account', keys: '⇧⌘N' },
]
