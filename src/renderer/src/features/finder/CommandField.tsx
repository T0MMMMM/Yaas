import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  FileText,
  GithubLogo,
  Globe,
  MagnifyingGlass,
  Table,
  VideoCamera,
} from '@phosphor-icons/react'
import type { HistoryEntry } from '@shared/model'
import { Favicon } from '../sidebar/Favicon'
import { useWorkspace } from '../workspace/useWorkspace'
import { dockSections, OPEN_ROW, type DockRow } from './dock'
import { finderTabs } from './finder'
import { Picker, type PickerRow, type PickerSection } from './Picker'

const ACTION_ICONS: Record<string, ReactNode> = {
  'https://docs.new/': <FileText />,
  'https://meet.new/': <VideoCamera />,
  'https://sheets.new/': <Table />,
  'https://github.com/new': <GithubLogo />,
}

/**
 * ⌘T, the new-tab dock: what to open, over the page. Empty, it lists this space's recent tabs, its
 * most visited pages and quick actions; typing matches every space and offers to go to (or search
 * for) what was typed. Submitting opens it in a new tab, or switches to the open tab picked (and
 * its space). Escape opens nothing.
 */
export function CommandField({ closing, onClose }: { closing?: boolean; onClose(): void }) {
  const workspace = useWorkspace()
  const [query, setQuery] = useState('')
  const [frequent, setFrequent] = useState<HistoryEntry[]>([])
  const [matches, setMatches] = useState<HistoryEntry[]>([])

  // Local database reads: no debounce, but an answer for an older query is dropped.
  useEffect(() => {
    let current = true
    void window.bigBrowser.invoke('history.frequent', {}).then((rows) => {
      if (current) setFrequent(rows)
    })
    return () => {
      current = false
    }
  }, [])

  useEffect(() => {
    const q = query.trim()
    // An empty query lists no matches (dockSections ignores them).
    if (q === '') return
    let current = true
    void window.bigBrowser.invoke('history.search', { query: q }).then((rows) => {
      if (current) setMatches(rows)
    })
    return () => {
      current = false
    }
  }, [query])

  const forget = useCallback((id: string) => {
    void window.bigBrowser.invoke('history.forget', { id })
    setFrequent((rows) => rows.filter((r) => r.id !== id))
    setMatches((rows) => rows.filter((r) => r.id !== id))
  }, [])

  const dock = useMemo(
    () =>
      workspace
        ? dockSections({
            query,
            spaceId: workspace.space.id,
            tabs: finderTabs(workspace),
            frequent,
            matches,
          })
        : [],
    [workspace, query, frequent, matches],
  )

  const sections = useMemo<PickerSection[]>(() => {
    if (!workspace) return []
    const tabsById = new Map(workspace.allTabs.map((t) => [t.id, t]))
    const tabsByUrl = new Map(workspace.allTabs.map((t) => [t.url, t]))
    const iconOf = (row: DockRow): ReactNode => {
      switch (row.kind) {
        case 'go':
          return <ArrowRight />
        case 'search':
          return <MagnifyingGlass />
        case 'tab': {
          const tab = row.tabId === undefined ? undefined : tabsById.get(row.tabId)
          return tab ? <Favicon tab={tab} /> : <Globe />
        }
        case 'history': {
          // History keeps no favicon: an open tab of the page lends its own.
          const tab = row.url === undefined ? undefined : tabsByUrl.get(row.url)
          return tab ? <Favicon tab={tab} /> : <Globe />
        }
        case 'action':
          return (row.url !== undefined && ACTION_ICONS[row.url]) || <Globe />
      }
    }
    const toPickerRow = (row: DockRow): PickerRow => {
      const { historyId } = row
      return {
        key: row.key,
        icon: iconOf(row),
        label: row.label,
        ...(row.hint !== undefined && { hint: row.hint }),
        enterLabel: row.kind === 'tab' ? 'Switch to Tab' : 'Open in New Tab',
        ...(historyId !== undefined && {
          onRemove: () => forget(historyId),
          removeLabel: `Forget ${row.label}`,
        }),
      }
    }
    return dock.map((s) => ({ title: s.title, rows: s.rows.map(toPickerRow) }))
  }, [workspace, dock, forget])

  // The dock rows behind the picker's, by key, to run them.
  const dockRows = useMemo(
    () => new Map(dock.flatMap((s) => s.rows).map((r) => [r.key, r])),
    [dock],
  )

  const run = (picked: PickerRow) => {
    const row = dockRows.get(picked.key)
    if (!row) return
    if (row.key === OPEN_ROW) {
      void window.bigBrowser.invoke('browser.openTab', { input: query.trim() })
    } else if (row.kind === 'tab' && row.tabId !== undefined) {
      // A tab of another space: the store activates its space too.
      void window.bigBrowser.invoke('browser.activateTab', { tabId: row.tabId })
    } else if (row.url !== undefined) {
      void window.bigBrowser.invoke('browser.openTab', { input: row.url })
    }
  }

  return (
    <Picker
      label="Search or enter address"
      query={query}
      onQuery={setQuery}
      sections={sections}
      onRun={run}
      closing={closing}
      onClose={onClose}
      testId="command-field"
    />
  )
}
