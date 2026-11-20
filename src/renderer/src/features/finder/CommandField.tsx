import { useMemo, useState } from 'react'
import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react'
import { Favicon } from '../sidebar/Favicon'
import { useWorkspace } from '../workspace/useWorkspace'
import { commandSuggestions, finderTabs } from './finder'
import { Picker, type PickerRow } from './Picker'

/** Key of the first row, which opens what was typed in a new tab. */
const OPEN = 'open'

/**
 * ⌘T: what to open, over the page. Submitting opens it in a new tab (a URL, else a search), or
 * switches to the open tab picked. Escape opens nothing.
 */
export function CommandField({ closing, onClose }: { closing?: boolean; onClose(): void }) {
  const workspace = useWorkspace()
  const [query, setQuery] = useState('')

  const rows = useMemo<PickerRow[]>(() => {
    if (!workspace) return []
    const byId = new Map(workspace.allTabs.map((t) => [t.id, t]))
    return commandSuggestions(query, finderTabs(workspace)).flatMap((s): PickerRow[] => {
      if (s.kind !== 'tab') {
        const icon = s.kind === 'go' ? <ArrowRight /> : <MagnifyingGlass />
        return [{ key: OPEN, icon, label: s.label }]
      }
      const tab = byId.get(s.id)
      return tab ? [{ key: s.id, icon: <Favicon tab={tab} />, label: s.label, hint: s.hint }] : []
    })
  }, [workspace, query])

  const run = (row: PickerRow) => {
    if (row.key === OPEN) void window.acab.invoke('browser.openTab', { input: query.trim() })
    else void window.acab.invoke('browser.activateTab', { tabId: row.key })
  }

  return (
    <Picker
      label="Search or enter address"
      query={query}
      onQuery={setQuery}
      rows={rows}
      onRun={run}
      closing={closing}
      onClose={onClose}
      testId="command-field"
    />
  )
}
