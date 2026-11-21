// How the tab finder (⌘K) and the dock (⌘T, dock.ts) rank open tabs for a query. Pure, so the
// ranking is unit-tested; the components only render it.
import type { BrowserView } from '../workspace/workspace'

/** An open tab as the finder sees it: any space, in the spaces' drawn order. */
export interface FinderTab {
  id: string
  title: string
  url: string
  spaceId: string
  spaceName: string
  /** In the active space: the tabs an empty query lists. */
  current: boolean
  /** When it was last activated (ISO), or null when it never was. */
  lastActiveAt: string | null
  /** The name of the pinned folder it is filed in, or null. */
  folder: string | null
}

/** Every open tab, as the finder ranks them. */
export function finderTabs(workspace: BrowserView): FinderTab[] {
  const folders = new Map(workspace.folders.map((f) => [f.id, f.name]))
  return workspace.allTabs.map((t) => ({
    id: t.id,
    title: t.title,
    url: t.url,
    spaceId: t.space.id,
    spaceName: t.space.label,
    current: t.space.id === workspace.space.id,
    lastActiveAt: t.lastActiveAt,
    folder: t.folderId === null ? null : (folders.get(t.folderId) ?? null),
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

/** Every word of the query (lower-cased, split on spaces) is in the title or the host and path. */
export function matchesWords(words: string[], title: string, url: string): boolean {
  const t = title.toLowerCase()
  const where = hostAndPath(url)
  return words.every((w) => t.includes(w) || where.includes(w))
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
    if (!matchesWords(words, tab.title, tab.url)) continue
    const title = tab.title.toLowerCase()
    const score = title.startsWith(q) ? 3 : words.every((w) => title.includes(w)) ? 2 : 1
    ranked.push({ id: tab.id, score })
  }
  // Array.prototype.sort is stable: ties stay in the tabs' order.
  return ranked.sort((a, b) => b.score - a.score)
}
