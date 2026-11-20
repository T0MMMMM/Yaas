import { useCallback, useEffect, useState } from 'react'
import { GearSix, Plus, SquaresFour } from '@phosphor-icons/react'
import type { OverlayRequest } from '@shared/ipc/contract'
import { SiteMenu } from '../features/browser/SiteMenu'
import { useWorkspace } from '../features/workspace/useWorkspace'
import { useBrowser } from '../stores/browser'
import { useSettings } from '../stores/settings'
import { Menu, type MenuItem } from '../ui/Menu'

/**
 * What the overlay view renders (`#overlay`): one popover at a time, floating over the page.
 * Main shows the view and says which popover with `overlay.opened`; any dismissal hides it again
 * with `overlay.close`.
 */
export function Overlay() {
  const [request, setRequest] = useState<OverlayRequest | null>(null)
  const initBrowser = useBrowser((s) => s.init)
  const workspace = useWorkspace()
  const accent = useSettings((s) => s.settings?.accent)

  useEffect(() => initBrowser(), [initBrowser])
  useEffect(() => window.acab.on('overlay.opened', setRequest), [])

  // Transparent body (global.css): only the popover paints, the page shows around it.
  useEffect(() => {
    document.documentElement.dataset['surface'] = 'overlay'
  }, [])

  const close = useCallback(() => {
    setRequest(null)
    void window.acab.invoke('overlay.close')
  }, [])

  if (!request) return null

  if (request.kind === 'site-menu') return <SiteMenu anchor={request.anchor} onClose={close} />

  const newMenu: MenuItem[] = [
    {
      id: 'new-tab',
      label: 'New tab',
      icon: Plus,
      shortcut: '⌘T',
      onSelect: () => {
        void window.acab
          .invoke('browser.openTab', {})
          .then(() => window.acab.invoke('ui.focusAddress'))
      },
    },
    {
      id: 'new-space',
      label: 'New space',
      icon: SquaresFour,
      onSelect: () => {
        if (!workspace || !accent) return
        void window.acab.invoke('browser.createSpace', {
          name: `Space ${workspace.spaces.length + 1}`,
          color: accent,
        })
      },
    },
    'separator',
    {
      id: 'settings',
      label: 'Settings',
      icon: GearSix,
      shortcut: '⌘,',
      onSelect: () => void window.acab.invoke('ui.openSettings'),
    },
  ]
  return <Menu anchor={request.anchor} placement="above" items={newMenu} onClose={close} />
}
