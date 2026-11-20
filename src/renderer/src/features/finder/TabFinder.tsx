import { useMemo, useState } from 'react'
import { Favicon } from '../sidebar/Favicon'
import { useWorkspace } from '../workspace/useWorkspace'
import { finderTabs, rankTabs } from './finder'
import { Picker, type PickerRow } from './Picker'

/**
 * ⌘K: finds an open tab of any space by its title or URL and activates it (switching space).
 * An empty query lists the active space's tabs.
 */
export function TabFinder({ closing, onClose }: { closing?: boolean; onClose(): void }) {
  const workspace = useWorkspace()
  const [query, setQuery] = useState('')

  const rows = useMemo<PickerRow[]>(() => {
    if (!workspace) return []
    const byId = new Map(workspace.allTabs.map((t) => [t.id, t]))
    return rankTabs(query, finderTabs(workspace)).flatMap(({ id }) => {
      const tab = byId.get(id)
      if (!tab) return []
      const where = [tab.host, tab.space.id === workspace.space.id ? '' : tab.space.label]
      return [
        {
          key: id,
          icon: <Favicon tab={tab} />,
          label: tab.title,
          hint: where.filter(Boolean).join(' · '),
        },
      ]
    })
  }, [workspace, query])

  return (
    <Picker
      label="Find a tab"
      query={query}
      onQuery={setQuery}
      rows={rows}
      onRun={(row) => void window.bigBrowser.invoke('browser.activateTab', { tabId: row.key })}
      closing={closing}
      onClose={onClose}
      testId="finder"
    />
  )
}
