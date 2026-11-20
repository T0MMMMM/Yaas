// Sites sniff the user agent: tabs present themselves as plain Chrome, not as an Electron app.
const APP_TOKENS = / (?:Electron|Big ?Browser)\/\S+/gi

/** Removes the `Electron/x.y.z` and `Big Browser/x.y.z` tokens from Electron's default user agent. */
export function chromeUserAgent(electronUa: string): string {
  return electronUa.replace(APP_TOKENS, '')
}
