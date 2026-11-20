# Spike — Chrome extensions in Electron

- **Date:** 2026-11-20
- **Environment:** Windows 11, Electron `45.4.1`, `electron-chrome-extensions` `4.10.0`,
  `electron-chrome-web-store` `0.13.0`, `@ghostery/adblocker-electron` `2.20.3`
- **Question:** can ACAB stay on Electron (ADR-0001) and still be a daily-driver browser where
  Chrome extensions work — first of all **1Password**, plus an ad blocker?
- **Code:** [`scripts/spikes/chrome-extensions/`](../../scripts/spikes/chrome-extensions/)
  (throwaway; `npm install && npx electron .` inside that folder)
- **Status legend:** ✅ confirmed · ⚠️ confirmed with caveats · ❓ not tested yet

| # | Item | Status | Verdict |
|---|------|--------|---------|
| 1 | Install from the Chrome Web Store | ✅ | `installChromeWebStore()` — the store's "Add to Chrome" works |
| 2 | 1Password loads and runs | ✅ | Only with the `browser.*` mirror fix (below) |
| 3 | 1Password popup + "add account" sign-in | ✅ | Only with the window.open → tab fix (below) |
| 4 | 1Password fills a login | ✅ | Confirmed by the user |
| 5 | 1Password ↔ desktop app (unlock with app / biometrics) | ❌ | Native messaging is not available in Electron |
| 6 | Built-in ad blocker (Ghostery engine) | ❓ | Enabled in the spike, not checked on a real site |
| 7 | Other extensions (uBlock Lite, Dark Reader…) | ❓ | Not tested |
| 8 | Toolbar icon updates | ⚠️ | `chrome.action.setIcon` / `setPopup` log "not supported in Electron" |

## Fix 1 — mirror `chrome.*` onto `browser.*`

Electron ≥ 44 gives extension workers a native `browser` global separate from `chrome`.
`electron-chrome-extensions` only adds its APIs (tabs, windows, action…) to `chrome`. 1Password
prefers `browser` when it exists, reads `browser.windows.WINDOW_ID_NONE` at load, throws, and ends
up with no background. Fix: a preload registered for `frame` **and** `service-worker` that copies
every missing key of `chrome` onto `browser` in the main world
(`browser-mirror.preload.js`, `session.registerPreloadScript`).

## Fix 2 — window.open from an extension page opens a tab

The 1Password popup calls `window.open('https://start.1password.com/signin/?auth-only=1')`.
Electron's default creates a new `BrowserWindow`; it takes focus, the library's `PopupView`
closes on blur (`maybeClose`), and the new window closes with its opener. Chrome instead opens such
pages as a tab of the browser window. Fix: `app.on('web-contents-created')` installs a
`setWindowOpenHandler` on every web contents that denies the window and opens a tab instead (real
tabs install their own handler right after). After this, sign-in happens in a tab and the
extension picks it up.

## Other things learned

- Set a Chrome-like user agent (strip `Electron/x` and the app name), or Google sign-in and the
  Web Store may refuse the browser.
- Extension popups and browser actions come from `<browser-action-list>`
  (`electron-chrome-extensions/browser-action`), injected by the UI preload. The UI window needs
  `ElectronChromeExtensions.handleCRXProtocol(session)` for icons.
- Extensions are stored per Electron session (`persist:<partition>`). One session per space gives
  per-space extensions for free, which is what Arc and yab do ("extensions follow sign-ins").
- Electron 45 no longer downloads its binary in `postinstall`; it does so on first run. In the main
  repo `node node_modules/electron/install.js` forces it.

## Comparison with yab

[yab](https://github.com/yetanotherbrowser/yab) (Apache-2.0, macOS only, Swift) gets broader
extension support by embedding a **patched CEF** in a separate C++ helper process, plus WebKit.
That is far heavier than Electron and would not fit a solo, cross-platform, AI-editable project.
The two gaps found here were each fixed in a few lines on our side, so the decision is to stay on
Electron (ADR-0006) and fix extension gaps as they show up.

## Next checks

- ❓ 6 and 7 above: ad blocker on a real site, and 3–5 everyday extensions.
- ❓ Same spike on macOS.
- ❓ Whether 1Password's desktop-app integration can be reached another way (e.g. 1Password CLI
  `op`, as yab does when the extension is off).
