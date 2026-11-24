import type { SidebarNode } from '../workspace/workspace'

/**
 * Length of a row's two-phase exit animation (`--dur-row-exit` 180 ms fade + `--dur-row-collapse`
 * 250 ms height collapse): the row leaves the DOM once both phases have played.
 */
export const ROW_EXIT_MS = 430

/** Length of a newly opened row's enter animation (`--dur-row-enter` 250 ms). */
export const ROW_ENTER_MS = 250

/** Identifies a sidebar node across renders (a row that leaves keeps its key while it exits). */
export const nodeKey = (node: SidebarNode): string =>
  node.kind === 'tab'
    ? `tab:${node.tab.id}`
    : node.kind === 'split'
      ? `tab:${node.first.id}`
      : node.kind === 'folder'
        ? `folder:${node.folder.id}`
        : `auto:${node.host}`

/**
 * Whether a row that left its list plays the exit animation: only a tab row whose tab was closed
 * (in no space any more). A moved tab, the rows of a space just left and a folder just leave.
 */
export const exitsWhenGone =
  (openTabIds: ReadonlySet<string>) =>
  (node: SidebarNode): boolean =>
    (node.kind === 'tab' && !openTabIds.has(node.tab.id)) ||
    (node.kind === 'split' && !openTabIds.has(node.first.id) && !openTabIds.has(node.second.id))

/**
 * Tab ids that just opened in the active space (absent from `previousOpenIds`). Returns an empty
 * set when switching spaces or on first render so only genuinely new tabs play the row entrance.
 */
export function newlyOpenedTabIds(
  previousSpaceId: string | null,
  currentSpaceId: string | null,
  previousOpenIds: ReadonlySet<string> | null,
  currentOpenIds: ReadonlySet<string>,
): Set<string> {
  if (previousOpenIds === null || previousSpaceId === null || previousSpaceId !== currentSpaceId) {
    return new Set()
  }
  const added = new Set<string>()
  for (const id of currentOpenIds) {
    if (!previousOpenIds.has(id)) added.add(id)
  }
  return added
}

/**
 * The rows still playing their enter once `added` opened, closed tabs and `done` (a batch whose
 * enter ended) left out. Returns the same set when nothing changed, so a re-render with a new
 * `openIds` (a page load, a title) does not restart the enter timer or touch the rows.
 */
export function enteringAfter(
  entering: ReadonlySet<string>,
  added: ReadonlySet<string>,
  openIds: ReadonlySet<string>,
  done: ReadonlySet<string> = new Set(),
): ReadonlySet<string> {
  const kept = [...entering].filter((id) => openIds.has(id) && !done.has(id))
  if (added.size === 0 && kept.length === entering.size) return entering
  return new Set([...kept, ...added])
}
