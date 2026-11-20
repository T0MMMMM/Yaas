import type { SidebarNode } from '../workspace/workspace'

/** Length of a row's exit animation (`--dur-base`): the row leaves the DOM once it has played. */
export const ROW_EXIT_MS = 200

/** Identifies a sidebar node across renders (a row that leaves keeps its key while it exits). */
export const nodeKey = (node: SidebarNode): string =>
  node.kind === 'tab'
    ? `tab:${node.tab.id}`
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
    node.kind === 'tab' && !openTabIds.has(node.tab.id)
