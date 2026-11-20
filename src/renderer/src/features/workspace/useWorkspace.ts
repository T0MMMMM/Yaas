import { useMemo } from 'react'
import { useAccounts } from '../../stores/accounts'
import { useBrowser } from '../../stores/browser'
import { useSettings } from '../../stores/settings'
import { DEMO_SPACES } from './demoData'
import {
  browserView,
  sidebarTree,
  usageView,
  type BrowserView,
  type OpenSessionView,
  type SidebarTree,
  type UsageView,
} from './workspace'

/**
 * The single entry point for workspace data in the renderer: the spaces, the active space's tabs,
 * its sidebar (favourites, pinned, today) and the active tab. null until the first browser state
 * arrives from main.
 */
export function useWorkspace(): BrowserView | null {
  const state = useBrowser((s) => s.state)
  // Before the settings load (and in the overlay, which never loads them): the default, on.
  const autoFolders = useSettings((s) => s.settings?.autoFolders ?? true)
  return useMemo(() => (state ? browserView(state, { autoFolders }) : null), [state, autoFolders])
}

// ---------- sessions: hidden until AI tabs (step 3) ----------

// Demo reset times are computed once per app start so they don't drift between renders.
const appStart = Date.now()

const EMPTY_TREE: SidebarTree = { pinned: [], environments: [] }

export interface AccountSummary {
  id: string
  label: string
  emoji: string
}

/**
 * Session data for the hidden YAAS views (SessionView, ContextBar, meters): the Claude accounts,
 * a sidebar tree, the open session and the usage. No session can be opened in the browser UI, so
 * `open` is always null.
 */
export interface SessionWorkspace {
  spaces: AccountSummary[]
  space: AccountSummary | null
  tree: SidebarTree | null
  open: OpenSessionView | null
  usage: UsageView | null
  demo: boolean
}

export function useSessionWorkspace(): SessionWorkspace {
  const accounts = useAccounts((s) => s.accounts)

  if (accounts && accounts.length > 0) {
    const spaces: AccountSummary[] = accounts.map(({ id, label, emoji }) => ({ id, label, emoji }))
    return {
      spaces,
      space: spaces[0] ?? null,
      tree: EMPTY_TREE,
      open: null,
      usage: null,
      demo: false,
    }
  }

  const spaces: AccountSummary[] = DEMO_SPACES.map(({ id, label, emoji }) => ({ id, label, emoji }))
  const space = DEMO_SPACES[0]
  if (!space) return { spaces, space: null, tree: null, open: null, usage: null, demo: true }

  return {
    spaces,
    space: { id: space.id, label: space.label, emoji: space.emoji } satisfies AccountSummary,
    tree: sidebarTree(space),
    open: null,
    usage: usageView(space, appStart),
    demo: true,
  }
}
