/** Keyboard shortcuts registry (DESIGN.md §8). Feeds the Settings list; the menu in src/main/menu.ts binds them. */
export const SHORTCUTS: Array<{ action: string; keys: string }> = [
  { action: 'New tab', keys: '⌘T' },
  { action: 'Find a tab', keys: '⌘K' },
  { action: 'Close tab', keys: '⌘W' },
  { action: 'Reopen closed tab', keys: '⌘⇧T' },
  { action: 'Reopen closed tab (outside text fields)', keys: '⌘Z' },
  { action: 'Focus the address bar', keys: '⌘L' },
  { action: 'Reload', keys: '⌘R' },
  { action: 'Back', keys: '⌘[' },
  { action: 'Forward', keys: '⌘]' },
  { action: 'Next tab', keys: '⌃Tab' },
  { action: 'Previous tab', keys: '⌃⇧Tab' },
  { action: 'Settings', keys: '⌘,' },
]
