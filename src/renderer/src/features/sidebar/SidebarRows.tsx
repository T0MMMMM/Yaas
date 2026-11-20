import type { SidebarNode } from '../workspace/workspace'
import { usePresence } from '../../ui/usePresence'
import { FolderRow } from './FolderRow'
import { nodeKey, ROW_EXIT_MS } from './rows'
import { TabRow } from './TabRow'

interface RowsProps {
  nodes: SidebarNode[]
  activeId: string | null
  /** Whether a row that left plays its exit (exitsWhenGone). */
  exits: (node: SidebarNode) => boolean
}

/**
 * The rows of a pinned or today list, or of a folder (FolderRow draws its children with it, so
 * folders nest): tab rows animate out when their tab closed; a removed folder just leaves.
 */
export function Rows({ nodes, activeId, exits }: RowsProps) {
  const rows = usePresence(nodes, nodeKey, ROW_EXIT_MS, exits)
  return rows.map(({ item: node, exiting }) => {
    if (node.kind === 'tab') {
      return (
        <TabRow
          key={nodeKey(node)}
          tab={node.tab}
          depth={node.depth}
          active={node.tab.id === activeId}
          exiting={exiting}
        />
      )
    }
    return exiting ? null : (
      <FolderRow key={nodeKey(node)} node={node} activeId={activeId} exits={exits} />
    )
  })
}
