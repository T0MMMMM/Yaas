const { contextBridge, ipcRenderer } = require('electron')
const { injectBrowserAction } = require('electron-chrome-extensions/browser-action')

injectBrowserAction()

contextBridge.exposeInMainWorld('spike', {
  newTab: (url) => ipcRenderer.send('new-tab', url),
  selectTab: (id) => ipcRenderer.send('select-tab', id),
  closeTab: (id) => ipcRenderer.send('close-tab', id),
  navigate: (input) => ipcRenderer.send('navigate', input),
  nav: (cmd) => ipcRenderer.send('nav', cmd),
  onTabs: (cb) => ipcRenderer.on('tabs', (_e, s) => cb(s)),
})
