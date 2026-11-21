// What the new-tab dock (⌘T) lists for a query, section by section. Pure, so the rules are
// unit-tested; the command field only fetches the history and renders the rows.
import type { HistoryEntry } from '@shared/model'
import { DEFAULT_SEARCH, displayUrl, resolveInput } from '@shared/url'
import { recentFirst } from '../workspace/workspace'
import { matchesWords, rankTabs, type FinderTab } from './finder'

export interface DockRow {
  key: string
  /** go / search open the query in a new tab, history / action their URL; tab switches to it. */
  kind: 'go' | 'search' | 'tab' | 'history' | 'action'
  label: string
  /** Dimmed, on the right: "In <folder>", another space's name, a page's host. */
  hint?: string
  url?: string
  tabId?: string
  historyId?: string
}

export interface DockSection {
  /** null: the go-to / search row on top, without a title. */
  title: 'Recent Tabs' | 'Frequent' | 'Quick Actions' | null
  rows: DockRow[]
}

/** Rows of Recent Tabs and of Frequent, at most. */
export const DOCK_SECTION_LIMIT = 6

/** Key of the go-to / search row, which opens what was typed in a new tab. */
export const OPEN_ROW = 'open'

/** Pages that create something, always offered (filtered by the query). */
export const QUICK_ACTIONS: ReadonlyArray<{ label: string; url: string }> = [
  { label: 'docs.new', url: 'https://docs.new/' },
  { label: 'meet.new', url: 'https://meet.new/' },
  { label: 'sheets.new', url: 'https://sheets.new/' },
  { label: 'github.com/new', url: 'https://github.com/new' },
]

interface DockInput {
  query: string
  /** The active space: an empty query lists only its tabs. */
  spaceId: string
  /** Every open tab, any space. */
  tabs: FinderTab[]
  /** The active space's most visited pages (history.frequent). */
  frequent: HistoryEntry[]
  /** Pages of any space matching the query (history.search), possibly for an older query. */
  matches: HistoryEntry[]
}

/** Go to what looks like a URL, else search for it. Both open the query with browser.openTab. */
function openRow(q: string): DockRow {
  const url = resolveInput(q)
  const isSearch = url === DEFAULT_SEARCH.replace('%s', encodeURIComponent(q))
  return isSearch
    ? { key: OPEN_ROW, kind: 'search', label: `Search Google for "${q}"` }
    : { key: OPEN_ROW, kind: 'go', label: `Go to ${url}` }
}

function tabRow(tab: FinderTab, spaceId: string): DockRow {
  const hint =
    tab.folder !== null ? `In ${tab.folder}` : tab.spaceId !== spaceId ? tab.spaceName : undefined
  return {
    key: `tab:${tab.id}`,
    kind: 'tab',
    label: tab.title,
    ...(hint !== undefined && { hint }),
    tabId: tab.id,
  }
}

function historyRow(entry: HistoryEntry): DockRow {
  const host = displayUrl(entry.url).host
  return {
    key: `history:${entry.id}`,
    kind: 'history',
    label: entry.title || host || entry.url,
    ...(host !== '' && { hint: host }),
    url: entry.url,
    historyId: entry.id,
  }
}

const actionRow = (action: { label: string; url: string }): DockRow => ({
  key: `action:${action.url}`,
  kind: 'action',
  label: action.label,
  url: action.url,
})

/**
 * The dock's sections, empty ones left out. An empty query: this space's tabs most recently
 * active first, its most visited pages, the quick actions. A query: the go-to / search row, then
 * the open tabs and pages of every space matching it (a page already open as a listed tab is left
 * out), and the quick actions matching it.
 */
export function dockSections({
  query,
  spaceId,
  tabs,
  frequent,
  matches,
}: DockInput): DockSection[] {
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
      { title: 'Frequent', rows: frequent.slice(0, DOCK_SECTION_LIMIT).map(historyRow) },
      { title: 'Quick Actions', rows: QUICK_ACTIONS.map(actionRow) },
    ]
  } else {
    const words = q.toLowerCase().split(/\s+/)
    const byId = new Map(tabs.map((t) => [t.id, t]))
    const tabMatches = rankTabs(q, tabs)
      .slice(0, DOCK_SECTION_LIMIT)
      .flatMap(({ id }) => byId.get(id) ?? [])
    const openUrls = new Set(tabMatches.map((t) => t.url))
    sections = [
      { title: null, rows: [openRow(q)] },
      { title: 'Recent Tabs', rows: tabMatches.map((t) => tabRow(t, spaceId)) },
      {
        title: 'Frequent',
        rows: matches
          // A slower answer for an older query may still be shown: it is filtered again.
          .filter((e) => !openUrls.has(e.url) && matchesWords(words, e.title, e.url))
          .slice(0, DOCK_SECTION_LIMIT)
          .map(historyRow),
      },
      {
        title: 'Quick Actions',
        rows: QUICK_ACTIONS.filter((a) => matchesWords(words, a.label, a.url)).map(actionRow),
      },
    ]
  }
  return sections.filter((s) => s.rows.length > 0)
}
