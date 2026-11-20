// Sites sniff the user agent: tabs present themselves as plain Chrome, not as an Electron app.
const APP_TOKENS = / (?:Electron|ACAB)\/\S+/gi

/** Removes the `Electron/x.y.z` and `ACAB/x.y.z` tokens from Electron's default user agent. */
export function chromeUserAgent(electronUa: string): string {
  return electronUa.replace(APP_TOKENS, '')
}
