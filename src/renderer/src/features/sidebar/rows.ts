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
