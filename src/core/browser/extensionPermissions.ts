// A readable summary of what a Chrome extension asks for, shown before it is installed.
export interface PermissionManifest {
  permissions?: string[]
  host_permissions?: string[]
  optional_permissions?: string[]
}

const ALL_SITES = new Set(['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*'])
const ALL_SITES_SENTENCE = 'Read and change all your data on all websites'

const API_SENTENCES: Record<string, string> = {
  tabs: 'See the addresses and titles of your open tabs',
  activeTab: 'Access the tab you are using when you click the extension',
  history: 'Read and change your browsing history',
  downloads: 'Manage your downloads',
  cookies: 'Read and change your cookies',
  clipboardRead: 'Read data you copy and paste',
  clipboardWrite: 'Write to the clipboard',
  nativeMessaging: 'Communicate with other programs on your computer',
  storage: 'Store data in the browser',
  unlimitedStorage: 'Store an unlimited amount of data',
  bookmarks: 'Read and change your bookmarks',
  webRequest: 'See and block the requests your tabs make',
  declarativeNetRequest: 'Block content on pages',
  notifications: 'Show notifications',
  contextMenus: 'Add items to the page menu',
  scripting: 'Run scripts on the pages it can access',
  webNavigation: 'See how you move between pages',
  geolocation: 'Know your location',
  management: 'Manage your other extensions',
  idle: 'Know when you are away',
  alarms: 'Schedule tasks',
  offscreen: 'Run hidden pages in the background',
  sidePanel: 'Show a side panel',
}

/** The hostname of a match pattern (`https://*.example.com/*` → `*.example.com`), or the pattern. */
function hostOf(pattern: string): string {
  const match = /^(?:\*|https?|wss?|ftp|file):\/\/([^/]*)/.exec(pattern)
  return match?.[1] || pattern
}

/** One short sentence per distinct permission, host access first, unknown ones by name. */
export function permissionSummary(manifest: PermissionManifest): string[] {
  const entries = [...(manifest.host_permissions ?? []), ...(manifest.permissions ?? [])]
  const allSites = entries.some((entry) => ALL_SITES.has(entry))
  const hosts = new Set<string>()
  const apis = new Set<string>()
  for (const entry of entries) {
    if (ALL_SITES.has(entry)) continue
    if (/^[a-z*]+:\/\//.test(entry)) hosts.add(hostOf(entry))
    else apis.add(API_SENTENCES[entry] ?? entry)
  }
  return [
    ...(allSites ? [ALL_SITES_SENTENCE] : []),
    ...[...hosts].map((host) => `Read and change your data on ${host}`),
    ...apis,
  ]
}
