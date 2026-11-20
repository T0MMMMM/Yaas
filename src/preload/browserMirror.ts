// Registered on every space session for frames and service workers (spike fix 1). Electron ≥ 44
// gives extension workers a native `browser` global separate from `chrome`, and
// electron-chrome-extensions only adds its APIs (tabs, windows, action…) to `chrome`. Copies every
// missing key of `chrome` onto `browser` in the main world. Exposes nothing to pages.
import { contextBridge } from 'electron'

// Serialized into the main world: must not use anything from this module's scope.
function mirror(): void {
  const scope = globalThis as {
    chrome?: Record<string, unknown>
    browser?: Record<string, unknown>
  }
  const { chrome, browser } = scope
  if (!chrome || !browser || browser === chrome) return
  for (const key of Object.keys(chrome)) {
    try {
      if (!(key in browser)) browser[key] = chrome[key]
    } catch {
      // A read-only or throwing property: leave it as Electron made it.
    }
  }
}

try {
  contextBridge.executeInMainWorld({ func: mirror })
} catch {
  // No main world to reach (e.g. a context without isolation): nothing to mirror.
}
