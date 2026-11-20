// Shortcuts live in the application menu: a focused web page (a WebContentsView) swallows key
// events before the UI renderer sees them, but menu accelerators still fire.
import { Menu, type MenuItemConstructorOptions } from 'electron'

export interface MenuActions {
  newTab(): void
  closeTab(): void
  focusAddress(): void
  reload(): void
  back(): void
  forward(): void
  nextTab(): void
  previousTab(): void
  settings(): void
}

export function buildAppMenu(actions: MenuActions): Menu {
  const item = (
    id: keyof MenuActions,
    label: string,
    accelerator: string,
  ): MenuItemConstructorOptions => ({
    id,
    label,
    accelerator,
    click: () => actions[id](),
  })

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: 'ACAB',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              item('settings', 'Settings…', 'CmdOrCtrl+,'),
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'File',
      submenu: [
        item('newTab', 'New Tab', 'CmdOrCtrl+T'),
        item('closeTab', 'Close Tab', 'CmdOrCtrl+W'),
        item('focusAddress', 'Open Location', 'CmdOrCtrl+L'),
        ...(process.platform === 'darwin'
          ? []
          : [
              { type: 'separator' } as const,
              item('settings', 'Settings…', 'CmdOrCtrl+,'),
              { type: 'separator' } as const,
              { role: 'quit' } as const,
            ]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        item('reload', 'Reload', 'CmdOrCtrl+R'),
        item('back', 'Back', 'CmdOrCtrl+['),
        item('forward', 'Forward', 'CmdOrCtrl+]'),
        { type: 'separator' },
        item('nextTab', 'Next Tab', 'Ctrl+Tab'),
        item('previousTab', 'Previous Tab', 'Ctrl+Shift+Tab'),
      ],
    },
  ]
  return Menu.buildFromTemplate(template)
}
