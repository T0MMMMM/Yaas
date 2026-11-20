import type { AcabBridge } from '../../src/shared/ipc/contract'

// The UI page's bridge, for tests that call it with `page.evaluate`.
declare global {
  interface Window {
    readonly acab: AcabBridge
  }
}
