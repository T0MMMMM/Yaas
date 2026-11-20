import { useCallback, useEffect, useRef, useState } from 'react'
import type { OverlayRequest, Tooltip } from '@shared/ipc/contract'
import type { MenuSpecItem } from '@shared/menuSpec'
import { SiteMenu } from '../features/browser/SiteMenu'
import { CommandField } from '../features/finder/CommandField'
import { TabFinder } from '../features/finder/TabFinder'
import { useWorkspace } from '../features/workspace/useWorkspace'
import { useBrowser } from '../stores/browser'
import { useSettings } from '../stores/settings'
import { Menu } from '../ui/Menu'
import { OverlayTooltip } from './OverlayTooltip'

/** Name of a folder made from the + menu; the sidebar then edits it. */
const NEW_FOLDER_NAME = 'New Folder'

/** The + menu: its actions run here, in the overlay. */
const NEW_MENU: MenuSpecItem[] = [
  { kind: 'filter' },
  { kind: 'item', id: 'new-tab', label: 'New tab', icon: 'Plus', shortcut: '⌘T', enabled: true },
  { kind: 'item', id: 'new-folder', label: 'New folder', icon: 'FolderSimplePlus', enabled: true },
  { kind: 'item', id: 'new-space', label: 'New space', icon: 'SquaresFour', enabled: true },
  { kind: 'separator' },
  {
    kind: 'item',
    id: 'settings',
    label: 'Settings',
    icon: 'GearSix',
    shortcut: '⌘,',
    enabled: true,
  },
]

/** Length of a card's exit animation (`--dur-fast`): the view is hidden once it has played. */
const EXIT_MS = 120
/** How long a hidden tooltip stays mounted to fade out: main hides the strip after as long. */
const TOOLTIP_FADE_MS = 150

/**
 * What the overlay view renders (`#overlay`): one popover or card at a time, floating over the page.
 * Main shows the view and says which popover with `overlay.opened`; a dismissal plays the card's
 * exit animation, then hides the view with `overlay.close`. Otherwise it may draw a sidebar
 * tooltip (`overlay.tooltip`), never focused; a popover replaces it.
 */
export function Overlay() {
  const [request, setRequest] = useState<OverlayRequest | null>(null)
  const [closing, setClosing] = useState(false)
  const [tooltip, setTooltip] = useState<{ tooltip: Tooltip; closing: boolean } | null>(null)
  /** The pending unmount of a tooltip fading out. */
  const tooltipFade = useRef<number | null>(null)
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

  const clearTooltipFade = useCallback(() => {
    if (tooltipFade.current !== null) window.clearTimeout(tooltipFade.current)
    tooltipFade.current = null
  }, [])

  useEffect(
    () =>
      window.bigBrowser.on('overlay.opened', (next) => {
        // e.g. the + menu's New tab, which opens the command field as the menu closes.
        cancelExit()
        // The menu wins: a tooltip never stays drawn under or over it.
        clearTooltipFade()
        setTooltip(null)
        setRequest(next)
      }),
    [cancelExit, clearTooltipFade],
  )
  useEffect(
    () =>
      window.bigBrowser.on('overlay.tooltip', (next) => {
        clearTooltipFade()
        if (next) {
          setTooltip({ tooltip: next, closing: false })
          return
        }
        setTooltip((shown) => shown && { ...shown, closing: true })
        tooltipFade.current = window.setTimeout(() => {
          tooltipFade.current = null
          setTooltip(null)
        }, TOOLTIP_FADE_MS)
      }),
    [clearTooltipFade],
  )
  useEffect(() => clearTooltipFade, [clearTooltipFade])

  // The strip sits over the page: once the pointer is on it, hide it at once (main skips the fade)
  // so the page under it gets the next click. Main hides the view on the first move.
  const tooltipShown = tooltip !== null && !request
  useEffect(() => {
    if (!tooltipShown) return
    const leave = (): void => void window.bigBrowser.invoke('overlay.tooltip', null)
    window.addEventListener('pointermove', leave)
    return () => window.removeEventListener('pointermove', leave)
  }, [tooltipShown])
  // Main can hide the view itself (⌘L): nothing left to animate.
  useEffect(
    () =>
      window.bigBrowser.on('overlay.closed', () => {
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
      void window.bigBrowser.invoke('overlay.close')
    }, EXIT_MS)
  }, [])

  if (!request) {
    return tooltip && <OverlayTooltip tooltip={tooltip.tooltip} closing={tooltip.closing} />
  }

  switch (request.kind) {
    // The centred cards (⌘K, ⌘T) have no anchor.
    case 'tab-finder':
      return <TabFinder closing={closing} onClose={close} />
    case 'command':
      return <CommandField closing={closing} onClose={close} />
    case 'site-menu':
      return <SiteMenu anchor={request.anchor} closing={closing} onClose={close} />
    case 'new-menu': {
      const actions: Record<string, () => void> = {
        // Swaps this menu for the command field (⌘T), which creates the tab on submit.
        'new-tab': () => void window.bigBrowser.invoke('overlay.open', { kind: 'command' }),
        'new-folder': () => {
          void window.bigBrowser
            .invoke('browser.createFolder', { name: NEW_FOLDER_NAME })
            .then((folder) => window.bigBrowser.invoke('ui.renameFolder', { folderId: folder.id }))
        },
        'new-space': () => {
          if (!workspace || !accent) return
          void window.bigBrowser.invoke('browser.createSpace', {
            name: `Space ${workspace.spaces.length + 1}`,
            color: accent,
          })
        },
        settings: () => void window.bigBrowser.invoke('ui.openSettings'),
      }
      return (
        <Menu
          anchor={request.anchor}
          placement="above"
          items={NEW_MENU}
          closing={closing}
          onChoose={(id) => actions[id]?.()}
          onClose={close}
        />
      )
    }
    // Main's menus: the chosen item runs in main.
    case 'context-menu':
    case 'anchored-menu': {
      const { menu } = request
      const onChoose = (itemId: string) =>
        void window.bigBrowser.invoke('overlay.choose', { menuId: menu.id, itemId })
      return request.kind === 'context-menu' ? (
        <Menu
          key={menu.id}
          at={request.at}
          items={menu.items}
          closing={closing}
          onChoose={onChoose}
          onClose={close}
        />
      ) : (
        <Menu
          key={menu.id}
          anchor={request.anchor}
          placement={request.placement}
          items={menu.items}
          closing={closing}
          onChoose={onChoose}
          onClose={close}
        />
      )
    }
  }
}
