// Mirror chrome.* APIs added by electron-chrome-extensions onto the native browser.* global.
const { contextBridge } = require('electron')

function mirror() {
  const c = globalThis.chrome
  const b = globalThis.browser
  if (!c || !b || b === c) return
  for (const key of Object.keys(c)) {
    try {
      if (!(key in b)) b[key] = c[key]
    } catch {}
  }
}

try {
  contextBridge.executeInMainWorld({ func: mirror })
} catch {}
