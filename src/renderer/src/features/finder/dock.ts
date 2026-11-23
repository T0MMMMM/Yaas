// What the new-tab dock (⌘T) lists for a query, section by section. Pure, so the rules are
// unit-tested; the command field renders the rows and puts QUICK_ACTIONS as buttons in the footer.
import { DEFAULT_SEARCH, displayUrl, resolveInput } from '@shared/url'
import { recentFirst } from '../workspace/workspace'
import { rankTabs, type FinderTab } from './finder'

export interface DockRow {
  key: string
  /** go / search open the query in a new tab; tab switches to it. */
  kind: 'go' | 'search' | 'tab'
  label: string
  /** Dimmed, after the label: "In <folder>", another space's name, or the page's address. */
  hint?: string
  url?: string
  tabId?: string
}

export interface DockSection {
  /** null: the go-to / search row on top, without a title. */
  title: 'Recent Tabs' | null
  rows: DockRow[]
}

export interface QuickAction {
  /** Compact label on the bottom-bar pill button. */
  shortLabel: string
  /** Full address label (tooltip and accessible name). */
  label: string
  url: string
}

/** Recent tabs shown in the command dock, at most. */
export const DOCK_SECTION_LIMIT = 3

/** Key of the go-to / search row, which opens what was typed in a new tab. */
export const OPEN_ROW = 'open'

/** Pages that create something, offered as pill buttons in the command dock's bottom bar. */
export const QUICK_ACTIONS: ReadonlyArray<QuickAction> = [
  { shortLabel: 'Docs', label: 'docs.new', url: 'https://docs.new/' },
  { shortLabel: 'Meet', label: 'meet.new', url: 'https://meet.new/' },
  { shortLabel: 'Sheets', label: 'sheets.new', url: 'https://sheets.new/' },
  { shortLabel: 'GitHub', label: 'github.com/new', url: 'https://github.com/new' },
]

interface DockInput {
  query: string
  /** The active space: an empty query lists only its tabs. */
  spaceId: string
  /** Every open tab, any space. */
  tabs: FinderTab[]
}

/** Go to what looks like a URL, else search for it. Both open the query with browser.openTab. */
function openRow(q: string): DockRow {
  const url = resolveInput(q)
  const isSearch = url === DEFAULT_SEARCH.replace('%s', encodeURIComponent(q))
  return isSearch
    ? { key: OPEN_ROW, kind: 'search', label: `Search Google for "${q}"` }
    : { key: OPEN_ROW, kind: 'go', label: `Go to ${url}` }
}

function addressHint(url: string): string | undefined {
  const { host, rest } = displayUrl(url)
  const shown = `${host}${rest}`
  return shown === '' ? undefined : shown
}

function tabRow(tab: FinderTab, spaceId: string): DockRow {
  const hint =
    tab.folder !== null
      ? `In ${tab.folder}`
      : tab.spaceId !== spaceId
        ? tab.spaceName
        : addressHint(tab.url)
  return {
    key: `tab:${tab.id}`,
    kind: 'tab',
    label: tab.title,
    ...(hint !== undefined && { hint }),
    tabId: tab.id,
  }
}

/**
 * The dock's sections, empty ones left out. An empty query: up to 3 of this space's tabs most
 * recently active first. A query: the go-to / search row, then up to 3 open tabs of any space
 * matching it.
 */
export function dockSections({ query, spaceId, tabs }: DockInput): DockSection[] {
  const q = query.trim()
  let sections: DockSection[]
  if (q === '') {
    sections = [
      {
        title: 'Recent Tabs',
        rows: recentFirst(tabs.filter((t) => t.spaceId === spaceId))
          .slice(0, DOCK_SECTION_LIMIT)
          .map((t) => tabRow(t, spaceId)),
      },
    ]
  } else {
    const byId = new Map(tabs.map((t) => [t.id, t]))
    const tabMatches = rankTabs(q, tabs)
      .slice(0, DOCK_SECTION_LIMIT)
      .flatMap(({ id }) => byId.get(id) ?? [])
    sections = [
      { title: null, rows: [openRow(q)] },
      { title: 'Recent Tabs', rows: tabMatches.map((t) => tabRow(t, spaceId)) },
    ]
  }
  return sections.filter((s) => s.rows.length > 0)
}
