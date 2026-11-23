import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  FileText,
  GithubLogo,
  Globe,
  MagnifyingGlass,
  Table,
  VideoCamera,
} from '@phosphor-icons/react'
import { Favicon } from '../sidebar/Favicon'
import { useWorkspace } from '../workspace/useWorkspace'
import { dockSections, OPEN_ROW, QUICK_ACTIONS, type DockRow } from './dock'
import { finderTabs } from './finder'
import { Picker, type PickerRow, type PickerSection } from './Picker'
import styles from './Picker.module.css'

const ACTION_ICONS: Record<string, ReactNode> = {
  'https://docs.new/': <FileText size={14} weight="regular" />,
  'https://meet.new/': <VideoCamera size={14} weight="regular" />,
  'https://sheets.new/': <Table size={14} weight="regular" />,
  'https://github.com/new': <GithubLogo size={14} weight="regular" />,
}

/**
 * ⌘T, the new-tab dock: compact card centred over the web window. Empty, it lists up to 3 of this
 * space's recent tabs and puts quick actions as pill buttons in the bottom bar; typing matches
 * open tabs across every space and offers to go to (or search for) what was typed. Submitting
 * opens it in a new tab, or switches to the open tab picked (and its space). Escape opens nothing.
 */
export function CommandField({
  contentLeft,
  closing,
  onClose,
}: {
  contentLeft?: number
  closing?: boolean
  onClose(): void
}) {
  const workspace = useWorkspace()
  const [query, setQuery] = useState('')

  const dock = useMemo(
    () =>
      workspace
        ? dockSections({
            query,
            spaceId: workspace.space.id,
            tabs: finderTabs(workspace),
          })
        : [],
    [workspace, query],
  )

  const sections = useMemo<PickerSection[]>(() => {
    if (!workspace) return []
    const tabsById = new Map(workspace.allTabs.map((t) => [t.id, t]))
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
      }
    }
    const toPickerRow = (row: DockRow): PickerRow => ({
      key: row.key,
      icon: iconOf(row),
      label: row.label,
      ...(row.hint !== undefined && { hint: row.hint }),
      enterLabel: row.kind === 'tab' ? 'Switch to Tab' : 'Open in New Tab',
    })
    return dock.map((s) => ({ title: s.title, rows: s.rows.map(toPickerRow) }))
  }, [workspace, dock])

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

  const runQuickAction = (url: string) => {
    if (closing) return
    void window.bigBrowser.invoke('browser.openTab', { input: url })
    onClose()
  }

  const footerActions = QUICK_ACTIONS.map((action) => (
    <button
      key={action.url}
      type="button"
      className={styles.pill}
      aria-label={action.label}
      title={action.label}
      data-testid="quick-action"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => runQuickAction(action.url)}
    >
      <span className={styles.pillIcon} aria-hidden="true">
        {ACTION_ICONS[action.url] ?? <Globe size={14} />}
      </span>
      <span>{action.shortLabel}</span>
    </button>
  ))

  return (
    <Picker
      label="Search or enter address"
      placeholder="Enter a web address"
      query={query}
      onQuery={setQuery}
      sections={sections}
      footerActions={footerActions}
      contentLeft={contentLeft}
      onRun={run}
      closing={closing}
      onClose={onClose}
      testId="command-field"
    />
  )
}
