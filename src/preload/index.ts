// The only bridge between the sandboxed renderer and main. Exposes `window.bigBrowser`, plus the
// extension actions' `browserAction` in the overlay (below).
// Type-only imports from the contract: zod is never bundled here.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { injectBrowserAction } from 'electron-chrome-extensions/browser-action'
import { COMMAND_CHANNELS, EVENT_CHANNELS } from '@shared/ipc/channels'
import type { IpcResult, BigBrowserBridge } from '@shared/ipc/contract'

const commandChannels: ReadonlySet<string> = new Set(COMMAND_CHANNELS)
const eventChannels: ReadonlySet<string> = new Set(EVENT_CHANNELS)

const bridge: BigBrowserBridge = {
  async invoke(channel, ...args) {
    if (!commandChannels.has(channel)) throw new Error(`Unknown IPC command: ${channel}`)
    const result = (await ipcRenderer.invoke(channel, args[0])) as IpcResult<never>
    if (!result.ok)
      throw new Error(`${channel} failed (${result.error.code}): ${result.error.message}`)
    return result.data
  },
  on(channel, listener) {
    if (!eventChannels.has(channel)) throw new Error(`Unknown IPC event: ${channel}`)
    const wrapped = (_event: IpcRendererEvent, payload: unknown) => listener(payload as never)
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  },
}

contextBridge.exposeInMainWorld('bigBrowser', bridge)

// The site menu (overlay only) lists the tab's extension actions with the library's
// `<browser-action-list>` element; this defines it and its `browserAction` bridge, which only reads
// and activates browser actions. The UI window never gets it.
// (The preload is type-checked without the DOM library; `location` is the page's.)
const { location } = globalThis as unknown as { location: { hash: string } }
if (location.hash === '#overlay') injectBrowserAction()
