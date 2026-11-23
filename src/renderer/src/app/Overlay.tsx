import { useCallback, useEffect, useRef, useState } from 'react'
import type { OverlayRequest, Tooltip } from '@shared/ipc/contract'
import type { MenuSpecItem } from '@shared/menuSpec'
import { DownloadsMenu } from '../features/downloads/DownloadsMenu'
import { SiteMenu } from '../features/browser/SiteMenu'
import { SplitDragLayer } from '../features/browser/SplitDragLayer'
import { CommandField } from '../features/finder/CommandField'
import { TabFinder } from '../features/finder/TabFinder'
import { EmojiField } from '../features/sidebar/EmojiField'
import { FolderIconPicker } from '../features/sidebar/FolderIconPicker'
import { useWorkspace } from '../features/workspace/useWorkspace'
import { useBrowser } from '../stores/browser'
import { useDownloads } from '../stores/downloads'
import { useSettings } from '../stores/settings'
import { AnchoredCard } from '../ui/AnchoredCard'
import { ColorPicker } from '../ui/ColorPicker'
import { ConfirmCard } from '../ui/ConfirmCard'
import { Menu } from '../ui/Menu'
import { OverlayTooltip } from './OverlayTooltip'

/** Name of a folder made from the + menu; the sidebar then edits it. */
const NEW_FOLDER_NAME = 'New Folder'

/** The + menu: its actions run here, in the overlay (yab §5 order; filter sits at the bottom). */
const NEW_MENU: MenuSpecItem[] = [
  { kind: 'filter' },
  { kind: 'item', id: 'new-space', label: 'New space', icon: 'SquaresFour', enabled: true },
  { kind: 'item', id: 'new-folder', label: 'New folder', icon: 'FolderSimplePlus', enabled: true },
  { kind: 'separator' },
  {
    kind: 'item',
    id: 'split-view',
    label: 'Split View',
    icon: 'SquareSplitHorizontal',
    shortcut: '⌃⌘\\',
    enabled: true,
  },
  { kind: 'item', id: 'new-tab', label: 'New tab', icon: 'Plus', shortcut: '⌘T', enabled: true },
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

/** Length of a card's exit animation (`--dur-popover-out`): the view is hidden once it has played. */
const EXIT_MS = 100
/** How long a hidden tooltip stays mounted to fade out: main hides the strip after as long. */
const TOOLTIP_FADE_MS = 100

/**
 * What the overlay view renders (`#overlay`): one popover or card at a time, floating over the page.
 * Main shows the view and says which popover with `overlay.opened`; a dismissal plays the card's
 * exit animation, then hides the view with `overlay.close`. Otherwise it may draw a sidebar
 * tooltip (`overlay.tooltip`), never focused; a popover replaces it.
 */
export function Overlay() {
  const [request, setRequest] = useState<OverlayRequest | null>(null)
  /** Bumped on every `overlay.opened` so reopening mid-close mounts a fresh card with focus. */
  const [openId, setOpenId] = useState(0)
  const [closing, setClosing] = useState(false)
  const [tooltip, setTooltip] = useState<{ tooltip: Tooltip; closing: boolean } | null>(null)
  /** The pending unmount of a tooltip fading out. */
  const tooltipFade = useRef<number | null>(null)
  /** The pending `overlay.close`, while the exit animation plays. */
  const exit = useRef<number | null>(null)
  const initBrowser = useBrowser((s) => s.init)
  const initDownloads = useDownloads((s) => s.init)
  const workspace = useWorkspace()
  const accent = useSettings((s) => s.settings?.accent)

  useEffect(() => initBrowser(), [initBrowser])
  useEffect(() => initDownloads(), [initDownloads])
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
        setOpenId((id) => id + 1)
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
      return <TabFinder key={openId} closing={closing} onClose={close} />
    case 'command':
      return <CommandField key={openId} closing={closing} onClose={close} />
    case 'split-drag':
      return <SplitDragLayer />
    case 'site-menu':
      return <SiteMenu anchor={request.anchor} closing={closing} onClose={close} />
    case 'new-menu': {
      const actions: Record<string, () => void> = {
        // Swaps this menu for the command field (⌘T), which creates the tab on submit.
        'new-tab': () => void window.bigBrowser.invoke('overlay.open', { kind: 'command' }),
        // Main pairs the active tab with the next row of its list, else the previous.
        'split-view': () => void window.bigBrowser.invoke('browser.splitActive'),
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
    // A space menu's cards: they run their change from here, the overlay being a trusted sender.
    case 'space-icon': {
      const { spaceId } = request
      const space = workspace?.spaces.find((s) => s.id === spaceId)
      return (
        <AnchoredCard
          anchor={request.anchor}
          label="Space icon"
          testId="space-icon"
          closing={closing}
          onClose={close}
        >
          {space && (
            <EmojiField
              value={space.icon}
              onPick={(icon) => {
                if (closing) return
                void window.bigBrowser.invoke('browser.setSpaceIcon', { spaceId, icon })
                close()
              }}
            />
          )}
        </AnchoredCard>
      )
    }
    case 'folder-icon': {
      const { folderId } = request
      const folder = workspace?.folders.find((f) => f.id === folderId)
      return (
        <AnchoredCard
          anchor={request.anchor}
          label="Folder icon"
          testId="folder-icon"
          closing={closing}
          onClose={close}
        >
          {folder && (
            <FolderIconPicker
              folder={folder}
              onPick={(icon) => {
                if (closing) return
                void window.bigBrowser.invoke('browser.setFolderIcon', { folderId, icon })
                close()
              }}
            />
          )}
        </AnchoredCard>
      )
    }
    case 'space-color': {
      const { spaceId } = request
      const space = workspace?.spaces.find((s) => s.id === spaceId)
      return (
        <AnchoredCard
          anchor={request.anchor}
          label="Space look"
          testId="space-color"
          closing={closing}
          onClose={close}
        >
          {space && (
            <ColorPicker
              value={space.color}
              onChange={(color) =>
                void window.bigBrowser.invoke('browser.setSpaceColor', { spaceId, color })
              }
            />
          )}
        </AnchoredCard>
      )
    }
    // Live: the list updates from `downloads.changed` while the card is open.
    case 'downloads':
      return (
        <AnchoredCard
          anchor={request.anchor}
          label="Downloads"
          testId="downloads"
          placement="above"
          closing={closing}
          onClose={close}
        >
          <DownloadsMenu />
        </AnchoredCard>
      )
    case 'confirm': {
      const { action } = request
      return (
        <ConfirmCard
          anchor={request.anchor}
          message={request.message}
          confirmLabel={request.confirmLabel}
          closing={closing}
          onConfirm={() => {
            if (action.kind === 'delete-space') {
              void window.bigBrowser
                .invoke('browser.deleteSpace', { spaceId: action.spaceId })
                .catch((error: unknown) => console.warn('Delete Space failed:', error))
            }
          }}
          onClose={close}
        />
      )
    }
    // Main's menus: the chosen item runs in main.
    case 'context-menu':
    case 'anchored-menu': {
      const { menu } = request
      // A failed choice (main logs it) never surfaces here as an unhandled rejection.
      const onChoose = (itemId: string) =>
        void window.bigBrowser
          .invoke('overlay.choose', { menuId: menu.id, itemId })
          .catch((error: unknown) => console.warn('Menu item failed:', error))
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
