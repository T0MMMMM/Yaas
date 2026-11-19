/// <reference types="vite/client" />
import type { YaasBridge } from '@shared/ipc/contract'

declare global {
  interface Window {
    readonly yaas: YaasBridge
  }
}
