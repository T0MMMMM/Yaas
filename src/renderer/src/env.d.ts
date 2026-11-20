/// <reference types="vite/client" />
import type { AcabBridge } from '@shared/ipc/contract'

declare global {
  interface Window {
    readonly acab: AcabBridge
  }
}

/** `<browser-action-list>` from electron-chrome-extensions, defined by the overlay's preload. */
interface BrowserActionListProps extends React.HTMLAttributes<HTMLElement> {
  /** The session whose extensions are listed. */
  partition?: string
  /** Web contents id of the tab the actions act on (a number: the element's setter drops strings). */
  tab?: number
  /** Where an action's popup opens, e.g. `bottom right`. */
  alignment?: string
  ref?: React.Ref<HTMLElement>
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'browser-action-list': BrowserActionListProps
    }
  }
}
