import { useUi } from '../../stores/ui'
import { DEMO_SPACES } from './demoData'
import { openSession, sidebarTree, usageView } from './workspace'

// Demo reset times are computed once per app start so they don't drift between renders.
const appStart = Date.now()

export interface SpaceSummary {
  id: string
  label: string
  emoji: string
}

/**
 * The single entry point for workspace data in the renderer: the spaces, the active space's
 * sidebar tree, the open session and the account usage. Backed by demo data for now; the
 * IPC-backed version keeps this exact shape.
 */
export function useWorkspace() {
  const activeSpaceId = useUi((s) => s.activeSpaceId)
  const activeSessionId = useUi((s) => s.activeSessionId)

  const space = DEMO_SPACES.find((s) => s.id === activeSpaceId) ?? DEMO_SPACES[0]
  const spaces: SpaceSummary[] = DEMO_SPACES.map(({ id, label, emoji }) => ({ id, label, emoji }))
  if (!space) return { spaces, space: null, tree: null, open: null, usage: null }

  return {
    spaces,
    space: { id: space.id, label: space.label, emoji: space.emoji } satisfies SpaceSummary,
    tree: sidebarTree(space),
    open: openSession(space, activeSessionId),
    usage: usageView(space, appStart),
  }
}
