import type { SidebarNode } from '../workspace/workspace'
import { usePresence } from '../../ui/usePresence'
import { FolderRow } from './FolderRow'
import { nodeKey, ROW_EXIT_MS } from './rows'
import { SplitRow } from './SplitRow'
import { TabRow } from './TabRow'

const NO_ENTERING: ReadonlySet<string> = new Set()

interface RowsProps {
  nodes: SidebarNode[]
  activeId: string | null
  /** Tab ids that just opened in this space and should play the enter animation. */
  enteringIds?: ReadonlySet<string>
  /** Whether a row that left plays its exit (exitsWhenGone). */
  exits: (node: SidebarNode) => boolean
}

/**
 * The rows of a pinned or today list, or of a folder (FolderRow draws its children with it, so
 * folders nest): tab and split rows animate out when their tabs closed; a removed folder just
 * leaves.
 */
export function Rows({ nodes, activeId, enteringIds = NO_ENTERING, exits }: RowsProps) {
  const rows = usePresence(nodes, nodeKey, ROW_EXIT_MS, exits)
  return rows.map(({ item: node, exiting }) => {
    if (node.kind === 'tab') {
      return (
        <TabRow
          key={nodeKey(node)}
          tab={node.tab}
          depth={node.depth}
          active={node.tab.id === activeId}
          entering={!exiting && enteringIds.has(node.tab.id)}
          exiting={exiting}
        />
      )
    }
    if (node.kind === 'split') {
      return (
        <SplitRow
          key={nodeKey(node)}
          first={node.first}
          second={node.second}
          depth={node.depth}
          activeId={activeId}
          entering={!exiting && (enteringIds.has(node.first.id) || enteringIds.has(node.second.id))}
          exiting={exiting}
        />
      )
    }
    return exiting ? null : (
      <FolderRow
        key={nodeKey(node)}
        node={node}
        activeId={activeId}
        enteringIds={enteringIds}
        exits={exits}
      />
    )
  })
}
