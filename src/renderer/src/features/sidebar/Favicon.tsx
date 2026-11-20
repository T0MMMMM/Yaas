import { Globe } from '@phosphor-icons/react'
import type { TabView } from '../workspace/workspace'

/** Only inline images: a remote favicon would load in the UI's own session, outside the space. */
export function Favicon({ tab, className }: { tab: TabView; className?: string }) {
  if (tab.faviconUrl?.startsWith('data:')) {
    return <img className={className} src={tab.faviconUrl} alt="" />
  }
  return <Globe className={className} />
}
