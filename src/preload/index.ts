// The only bridge between the sandboxed renderer and main. Exposes `window.acab` and nothing else.
// Type-only imports from the contract: zod is never bundled here.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { COMMAND_CHANNELS, EVENT_CHANNELS } from '@shared/ipc/channels'
import type { IpcResult, AcabBridge } from '@shared/ipc/contract'

const commandChannels: ReadonlySet<string> = new Set(COMMAND_CHANNELS)
const eventChannels: ReadonlySet<string> = new Set(EVENT_CHANNELS)

const bridge: AcabBridge = {
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

contextBridge.exposeInMainWorld('acab', bridge)
