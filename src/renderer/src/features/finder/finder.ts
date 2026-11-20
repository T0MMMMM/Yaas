// What the tab finder (⌘K) and the command field (⌘T) list for a query. Pure, so the ranking is
// unit-tested; the components only render it.
import { DEFAULT_SEARCH, resolveInput } from '@shared/url'
import type { BrowserView } from '../workspace/workspace'

/** An open tab as the finder sees it: any space, in the spaces' drawn order. */
export interface FinderTab {
  id: string
  title: string
  url: string
  spaceName: string
  /** In the active space: the tabs an empty query lists. */
  current: boolean
}

/** Every open tab, as the finder ranks them. */
export function finderTabs(workspace: BrowserView): FinderTab[] {
  return workspace.allTabs.map((t) => ({
    id: t.id,
    title: t.title,
    url: t.url,
    spaceName: t.space.label,
    current: t.space.id === workspace.space.id,
  }))
}

export interface RankedTab {
  id: string
  /** Higher first: 3 the title starts with the query, 2 the title has every word, 1 the URL helps. */
  score: number
}

/** The host (without `www.`) and path of a web URL, else the URL as is (about:blank). */
function hostAndPath(url: string): string {
  try {
    const { protocol, host, pathname } = new URL(url)
    if (protocol === 'http:' || protocol === 'https:') {
      return `${host.replace(/^www\./i, '')}${pathname}`.toLowerCase()
    }
  } catch {
    // Not a URL: matched as typed.
  }
  return url.toLowerCase()
}

/**
 * The tabs matching `query`, best first: case-insensitive, every word must be in the title or in
 * the host and path. Equal scores keep the tabs' order. An empty query lists the active space's
 * tabs in their order.
 */
export function rankTabs(query: string, tabs: FinderTab[]): RankedTab[] {
  const q = query.trim().toLowerCase()
  if (q === '') return tabs.filter((t) => t.current).map((t) => ({ id: t.id, score: 0 }))
  const words = q.split(/\s+/)

  const ranked: RankedTab[] = []
  for (const tab of tabs) {
    const title = tab.title.toLowerCase()
    const where = hostAndPath(tab.url)
    if (!words.every((w) => title.includes(w) || where.includes(w))) continue
    const score = title.startsWith(q) ? 3 : words.every((w) => title.includes(w)) ? 2 : 1
    ranked.push({ id: tab.id, score })
  }
  // Array.prototype.sort is stable: ties stay in the tabs' order.
  return ranked.sort((a, b) => b.score - a.score)
}

/** Open tabs the command field offers to switch to, at most. */
export const COMMAND_TAB_LIMIT = 6

export type CommandSuggestion =
  | { kind: 'go'; label: string }
  | { kind: 'search'; label: string }
  | { kind: 'tab'; id: string; label: string; hint: string }

/**
 * The command field's rows: go to the URL typed (or search for it), then the open tabs it
 * matches. Both of the first kinds open `query` with `browser.openTab`, which resolves it again.
 */
export function commandSuggestions(query: string, tabs: FinderTab[]): CommandSuggestion[] {
  const q = query.trim()
  if (q === '') return []
  const url = resolveInput(q)
  const isSearch = url === DEFAULT_SEARCH.replace('%s', encodeURIComponent(q))
  const first: CommandSuggestion = isSearch
    ? { kind: 'search', label: `Search Google for "${q}"` }
    : { kind: 'go', label: `Go to ${url}` }

  const byId = new Map(tabs.map((t) => [t.id, t]))
  const matches = rankTabs(q, tabs)
    .slice(0, COMMAND_TAB_LIMIT)
    .flatMap(({ id }) => {
      const tab = byId.get(id)
      return tab ? [{ kind: 'tab' as const, id, label: tab.title, hint: 'Switch to tab' }] : []
    })
  return [first, ...matches]
}
