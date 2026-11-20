/// <reference types="vite/client" />
import type { AcabBridge } from '@shared/ipc/contract'

declare global {
  interface Window {
    readonly acab: AcabBridge
  }
}
