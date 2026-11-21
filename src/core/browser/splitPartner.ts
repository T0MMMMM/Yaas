// Which tab a new split pairs the active tab with (⌃⌘\, the + menu's Split View).
import type { BrowserTab } from '@shared/model'

/**
 * The tab `tabId` splits with: the nearest row after it in its own list (same section and
 * folder), else the nearest before it, skipping rows that already are splits. `order` is the
 * space's drawn order (`visibleOrder`, second halves left out). Null when `tabId` is already a
 * half of a split or has no such neighbour.
 */
export function splitPartner(
  tabs: readonly BrowserTab[],
  order: readonly string[],
  tabId: string,
): string | null {
  const byId = new Map(tabs.map((t) => [t.id, t]))
  const firsts = new Set(tabs.flatMap((t) => (t.splitOf === null ? [] : [t.splitOf])))
  const split = (t: BrowserTab): boolean => t.splitOf !== null || firsts.has(t.id)
  const tab = byId.get(tabId)
  if (!tab || split(tab)) return null
  const list = order
    .map((id) => byId.get(id))
    .filter(
      (t): t is BrowserTab =>
        t !== undefined && t.section === tab.section && t.folderId === tab.folderId,
    )
  const at = list.indexOf(tab)
  const free = (t: BrowserTab): boolean => !split(t)
  const next = list.slice(at + 1).find(free) ?? list.slice(0, at).reverse().find(free)
  return next?.id ?? null
}
