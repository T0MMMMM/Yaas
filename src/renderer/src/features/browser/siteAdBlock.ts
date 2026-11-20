// The site menu's ad blocking switch: a site is an exception when its host is in `allowedHosts`.
import type { Settings } from '@shared/ipc/contract'

type AdBlock = Settings['adBlock']

/** Whether ads are blocked on the pages of `host`. */
export function blocksAdsOn(adBlock: AdBlock, host: string): boolean {
  return adBlock.enabled && !adBlock.allowedHosts.includes(host)
}

/** The ad blocker settings with blocking turned on or off for `host`. */
export function withAdsBlockedOn(adBlock: AdBlock, host: string, blocked: boolean): AdBlock {
  const others = adBlock.allowedHosts.filter((h) => h !== host)
  return { ...adBlock, allowedHosts: blocked ? others : [...others, host] }
}
