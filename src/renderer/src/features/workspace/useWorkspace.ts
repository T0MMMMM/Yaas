import { useAccounts } from '../../stores/accounts'
import { useUi } from '../../stores/ui'
import { DEMO_SPACES } from './demoData'
import { openSession, sidebarTree, usageView, type SidebarTree } from './workspace'

// Demo reset times are computed once per app start so they don't drift between renders.
const appStart = Date.now()

const EMPTY_TREE: SidebarTree = { pinned: [], environments: [] }

export interface SpaceSummary {
  id: string
  label: string
  emoji: string
}

/**
 * The single entry point for workspace data in the renderer: the spaces, the active space's
 * sidebar tree, the open session and the account usage.
 *
 * Real accounts are the spaces as soon as one exists. Their sessions and usage are not wired yet,
 * so their tree is empty and usage unknown. With no account at all, demo data shows the layout.
 */
export function useWorkspace() {
  const activeSpaceId = useUi((s) => s.activeSpaceId)
  const activeSessionId = useUi((s) => s.activeSessionId)
  const accounts = useAccounts((s) => s.accounts)

  if (accounts && accounts.length > 0) {
    const spaces: SpaceSummary[] = accounts.map(({ id, label, emoji }) => ({ id, label, emoji }))
    const space = spaces.find((s) => s.id === activeSpaceId) ?? spaces[0] ?? null
    return { spaces, space, tree: EMPTY_TREE, open: null, usage: null, demo: false }
  }

  const spaces: SpaceSummary[] = DEMO_SPACES.map(({ id, label, emoji }) => ({ id, label, emoji }))
  const space = DEMO_SPACES.find((s) => s.id === activeSpaceId) ?? DEMO_SPACES[0]
  if (!space) return { spaces, space: null, tree: null, open: null, usage: null, demo: true }

  return {
    spaces,
    space: { id: space.id, label: space.label, emoji: space.emoji } satisfies SpaceSummary,
    tree: sidebarTree(space),
    open: openSession(space, activeSessionId),
    usage: usageView(space, appStart),
    demo: true,
  }
}
