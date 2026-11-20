import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderSimplePlus, GearSix, Plus, SquaresFour } from '@phosphor-icons/react'
import type { OverlayRequest } from '@shared/ipc/contract'
import { SiteMenu } from '../features/browser/SiteMenu'
import { CommandField } from '../features/finder/CommandField'
import { TabFinder } from '../features/finder/TabFinder'
import { useWorkspace } from '../features/workspace/useWorkspace'
import { useBrowser } from '../stores/browser'
import { useSettings } from '../stores/settings'
import { Menu, type MenuItem } from '../ui/Menu'

/** Name of a folder made from the + menu; the sidebar then edits it. */
const NEW_FOLDER_NAME = 'New Folder'

/** Length of a card's exit animation (`--dur-fast`): the view is hidden once it has played. */
const EXIT_MS = 120

/**
 * What the overlay view renders (`#overlay`): one popover or card at a time, floating over the page.
 * Main shows the view and says which popover with `overlay.opened`; a dismissal plays the card's
 * exit animation, then hides the view with `overlay.close`.
 */
export function Overlay() {
  const [request, setRequest] = useState<OverlayRequest | null>(null)
  const [closing, setClosing] = useState(false)
  /** The pending `overlay.close`, while the exit animation plays. */
  const exit = useRef<number | null>(null)
  const initBrowser = useBrowser((s) => s.init)
  const workspace = useWorkspace()
  const accent = useSettings((s) => s.settings?.accent)

  useEffect(() => initBrowser(), [initBrowser])
  /** Drops a pending exit: a new popover replaces the closing one, or main already hid the view. */
  const cancelExit = useCallback(() => {
    if (exit.current !== null) window.clearTimeout(exit.current)
    exit.current = null
    setClosing(false)
  }, [])

  useEffect(
    () =>
      window.acab.on('overlay.opened', (next) => {
        // e.g. the + menu's New tab, which opens the command field as the menu closes.
        cancelExit()
        setRequest(next)
      }),
    [cancelExit],
  )
  // Main can hide the view itself (⌘L): nothing left to animate.
  useEffect(
    () =>
      window.acab.on('overlay.closed', () => {
        cancelExit()
        setRequest(null)
      }),
    [cancelExit],
  )
  useEffect(() => cancelExit, [cancelExit])

  // Transparent body (global.css): only the popover paints, the page shows around it.
  useEffect(() => {
    document.documentElement.dataset['surface'] = 'overlay'
  }, [])

  const close = useCallback(() => {
    if (exit.current !== null) return
    setClosing(true)
    exit.current = window.setTimeout(() => {
      exit.current = null
      setClosing(false)
      setRequest(null)
      void window.acab.invoke('overlay.close')
    }, EXIT_MS)
  }, [])

  if (!request) return null

  // The centred cards (⌘K, ⌘T) have no anchor.
  if (!('anchor' in request)) {
    return request.kind === 'tab-finder' ? (
      <TabFinder closing={closing} onClose={close} />
    ) : (
      <CommandField closing={closing} onClose={close} />
    )
  }
  if (request.kind === 'site-menu') {
    return <SiteMenu anchor={request.anchor} closing={closing} onClose={close} />
  }

  const newMenu: MenuItem[] = [
    {
      id: 'new-tab',
      label: 'New tab',
      icon: Plus,
      shortcut: '⌘T',
      // Swaps this menu for the command field (⌘T), which creates the tab on submit.
      onSelect: () => void window.acab.invoke('overlay.open', { kind: 'command' }),
    },
    {
      id: 'new-folder',
      label: 'New folder',
      icon: FolderSimplePlus,
      onSelect: () => {
        void window.acab
          .invoke('browser.createFolder', { name: NEW_FOLDER_NAME })
          .then((folder) => window.acab.invoke('ui.renameFolder', { folderId: folder.id }))
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
  return (
    <Menu
      anchor={request.anchor}
      placement="above"
      items={newMenu}
      filter
      closing={closing}
      onClose={close}
    />
  )
}
