// The ad blocker's rules that need no Electron: which filters allow a site, and the offline rule.

/**
 * The filters that turn blocking off on the pages of `host` (the per-site toggle): every request
 * those pages make, and their element hiding. Ghostery's `$document` only matches the page
 * request itself, so a `@@||host^$document` exception would not let the page's ads through.
 */
export function exceptionFilters(host: string): string[] {
  return [`@@*$domain=${host}`, `@@||${host}^$elemhide`]
}

/** The hosts allowed and no longer allowed when the allowed hosts go from `before` to `after`. */
export function diffHosts(
  before: string[],
  after: string[],
): { added: string[]; removed: string[] } {
  return {
    added: after.filter((host) => !before.includes(host)),
    removed: before.filter((host) => !after.includes(host)),
  }
}

/** The exception filters to add and remove when the allowed hosts go from `before` to `after`. */
export function diffAllowed(
  before: string[],
  after: string[],
): { added: string[]; removed: string[] } {
  const { added, removed } = diffHosts(before, after)
  return { added: added.flatMap(exceptionFilters), removed: removed.flatMap(exceptionFilters) }
}

/** How long the cached filter lists are used before a launch downloads them again. */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Whether a cache written at `mtimeMs` is too old to use without trying a fresh download. */
export function isCacheStale(mtimeMs: number, nowMs: number): boolean {
  return nowMs - mtimeMs > CACHE_MAX_AGE_MS
}

/** Runs `load`; a failure (offline, corrupt cache) is logged and gives null: no blocking. */
export async function loadEngine<T>(
  load: () => Promise<T>,
  log: (message: string, error: unknown) => void,
): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    log('Ad blocker failed to load, browsing without it:', error)
    return null
  }
}
