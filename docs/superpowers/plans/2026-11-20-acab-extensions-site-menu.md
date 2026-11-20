# ACAB extensions & site menu — implementation plan (step 1, plan 2 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome extensions (Web Store, 1Password) and a built-in ad blocker work in every space,
and a yab-shaped site menu opens from the address bar, floating over the page.

**Architecture:** a transparent **overlay view** (a second `WebContentsView` loading the same
renderer at `#overlay`) sits above the tab views and shows popovers (the + menu, the site menu) on
request; main opens and closes it. Each space's Electron session is set up once by a new
`SpaceSessions` class: user agent, permissions, one `ElectronChromeExtensions` instance, the Chrome
Web Store, the spike's two fixes, and the Ghostery ad blocker. Per-site ad-block exceptions are
settings, applied to the engine as `@@||host^$document` filters.

**Tech stack:** Electron 45.4.1, `electron-chrome-extensions` 4.10.0, `electron-chrome-web-store`
0.13.0, `@ghostery/adblocker-electron` 2.20.3 (the spike's versions), React 19, zod, Vitest,
Playwright `_electron`.

**Spec:** [`docs/superpowers/specs/2026-11-20-acab-design.md`](../specs/2026-11-20-acab-design.md)
(§3 constraints, §5.1 day-one list, "Menus and settings" → site menu, §8 ad blocker). Evidence:
[the extensions spike](../../spikes/2026-11-20-chrome-extensions-electron.md) and its code in
`scripts/spikes/chrome-extensions/` (read `main.js` before Task 2). Also obey `CLAUDE.md`.

## Global constraints

- Branch `feat/acab-extensions` cut from `feat/acab-browser-core`. Claude never pushes.
- `npm run check` passes after every task; UI tasks also pass `npm run test:e2e`.
- Layering (`CLAUDE.md` rule 2): `src/core`, `src/shared` never import `electron`/`react`; the
  renderer only talks to `window.acab`.
- IPC: `channels.ts` → `contract.ts` → handler in `main/index.ts` (rule 3).
- Security defaults stay on for the UI window, the overlay and every tab view (`contextIsolation`,
  `sandbox`, no `nodeIntegration`). Tab views get **no app preload**; the only script added to a
  space session is the `browser.*` mirror (spike fix 1), which exposes nothing to pages.
- The overlay is a trusted sender exactly like the UI window; nothing else is.
- E2E never touches the network: ad-block lists and extensions come from local fixtures through
  `ACAB_ADBLOCK_FILTERS` and `ACAB_TEST_EXTENSION` (Tasks 2–3).
- CSS: design tokens only. Menus follow the yab shape in the visual-pass look (`ui/Menu`).
- Ad blocker on by default, with a per-site toggle (spec §8).
- Extensions are per space: one session per space, extensions stored under
  `<userData>/extensions/<spaceId>`.
- Commits: Conventional Commits, `Co-Authored-By:` trailer.

## Review focus

1. **Clicking outside an open popover** (on the page area) — the popover closes and the click does
   not reach the page. Test: Task 1 e2e clicks the overlay's empty area.
2. **Window resized while a popover is open** — the overlay must keep covering the whole window.
   Test: Task 1 e2e resizes the window, then reads the overlay bounds from main.
3. **Ad-block lists unreachable at startup** (offline) — the app starts and browses; blocking is
   just off. Test: Task 3 unit (`loadEngine` failure → `null`, no throw).
4. **An extension calling `window.open`** — opens a tab in that extension's space, never a window.
   Test: Task 2 e2e with the fixture extension's page.
5. **Toggling "Block ads" on a site** — the exception is per host, survives a relaunch, and the
   page reloads. Test: Task 3 e2e.

---

### Task 1: Overlay view for UI floating over the page

**Files:**
- Create: `src/main/browser/overlayView.ts`, `src/renderer/src/app/Overlay.tsx`,
  `src/renderer/src/app/Overlay.module.css`, `tests/e2e/overlay.spec.ts`
- Modify: `src/shared/ipc/channels.ts`, `src/shared/ipc/contract.ts` (+ test),
  `src/main/index.ts` (trusted senders, emit to both views), `src/renderer/src/app/App.tsx`
  (route on `location.hash === '#overlay'`), `src/renderer/src/features/sidebar/Sidebar.tsx`
  (+ menu opens through the overlay), `docs/ARCHITECTURE.md` §11

**Interfaces:**
- Produces (IPC):
  - command `overlay.open` input `{ kind: 'new-menu' | 'site-menu', anchor: PageBounds }`
    (anchor = the button's rect in window DIP) → `void`
  - command `overlay.close` input `void` → `void`
  - event `overlay.opened` payload `{ kind, anchor }` (to the overlay only)
  - event `overlay.closed` payload `void` (to the UI only, so the + button resets)
- Produces (main): `class OverlayView { constructor(win: BrowserWindow, preload: string,
  rendererUrl: string); open(kind, anchor): void; close(): void; readonly webContents:
  WebContents }` — added to `win.contentView` **after** the tab views and re-added on top
  whenever a tab view is created (`TabViews` gets an `onViewAdded` callback), transparent
  (`setBackgroundColor('#00000000')`), hidden when closed, bounds = full content size, kept in
  sync on `win` `resize`.
- Produces (renderer): `Overlay` component — listens to `overlay.opened`, renders the popover for
  `kind` anchored to `anchor` (reuse `ui/Menu`, opening **downwards** from the anchor for
  `site-menu`, **upwards** for `new-menu`), closes on Escape, on a click on its empty area, and
  after an item is chosen (`overlay.close`). `site-menu` renders a placeholder card in this task
  (`data-testid="site-menu"`); Task 4 fills it.
- `isTrustedSender` accepts the UI and the overlay webContents; `settings.changed`,
  `browser.changed` go to both.

- [ ] **Step 1: Contract test** — in `contract.test.ts`: `overlay.open` accepts
  `{ kind: 'site-menu', anchor: { x: 0, y: 0, width: 10, height: 10 } }`, rejects
  `{ kind: 'popup', … }` and extra keys.
- [ ] **Step 2: Failing e2e** `tests/e2e/overlay.spec.ts`:
  - `the + menu floats over the page`: open a fixture page tab, click
    `New tab, space or settings`; the overlay page (the one whose URL ends in `#overlay`) shows a
    `menuitem` named `Settings`; its bounding box may extend right of the sidebar.
  - `a click outside closes the popover`: open the menu, click the overlay at the page's centre;
    the menu is gone, the + button has `aria-expanded="false"`, and the page's URL is unchanged.
  - `the overlay follows a resize`: open the menu, `win.setSize(1000, 700)` via `app.evaluate`,
    then assert from main that the overlay view's bounds equal the window's content size.
- [ ] **Step 3: Run** `npm run test:e2e -- overlay` → FAIL.
- [ ] **Step 4: Implement** the IPC entries, `OverlayView`, the trusted-sender change, `Overlay`
  and the `#overlay` route in `App` (the overlay renders **only** `Overlay`, with a transparent
  `body`; theme tokens still apply). Move the + menu out of `Sidebar`: its button calls
  `overlay.open({ kind: 'new-menu', anchor })` and listens to `overlay.closed`. The menu's items
  (new tab, new space, settings) now run in the overlay; "Settings" goes through a new command
  `ui.openSettings` → event `browser.shortcut` `'settings'` to the UI (reuse the existing path).
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e` → all PASS (plan 1's tests included).
- [ ] **Step 6: Docs** — ARCHITECTURE §11: "Overlay" bullet (what it is, when visible, trusted).
  Remove plan 1's "menu stays inside the sidebar" limitation wherever it is written.
- [ ] **Step 7: Commit** `feat(main): add the overlay view for ui over the page`

### Task 2: Extensions in every space (Web Store + spike fixes)

**Files:**
- Create: `src/main/browser/spaceSessions.ts`, `src/preload/browserMirror.ts`,
  `tests/e2e/fixtures/extension/` (`manifest.json` MV3 with `action.default_title`
  `"ACAB Test Action"`, `action.default_popup` `popup.html`, a `page.html` that calls
  `window.open('<url from its query string>')`), `tests/e2e/extensions.spec.ts`
- Modify: `package.json` (the three deps at the spike's exact versions),
  `electron.vite.config.ts` (second preload entry `browserMirror`; make sure the three deps stay
  **external** in the main build so their own preload files resolve),
  `src/main/browser/tabViews.ts` (sessions come from `SpaceSessions`; call the extensions hooks),
  `src/main/index.ts`, `src/shared/ipc/contract.ts` (`TabRuntime.webContentsId: number | null`),
  `docs/ARCHITECTURE.md` §11, `docs/spikes/2026-11-20-chrome-extensions-electron.md` (macOS row
  for what the e2e proves)

**Interfaces:**
- Consumes: `isPermissionGranted`, `chromeUserAgent` (core), `BrowserStore.openTab/closeTab/
  activateTab`.
- Produces: `class SpaceSessions { constructor(opts: { userData: string; mirrorPreload: string;
  host: ExtensionHost }); get(spaceId: string): Session; extensionsFor(spaceId: string):
  ElectronChromeExtensions | null; spaceOf(session: Session): string | null }` with
  `interface ExtensionHost { openTab(spaceId: string, url: string): Promise<WebContents>;
  selectTab(contents: WebContents): void; closeTab(contents: WebContents): void;
  window(): BrowserWindow | null }`.
  `get` does, once per partition: user agent, permission handlers (moved from `TabViews`), the
  mirror preload for `frame` and `service-worker` (spike fix 1), `new ElectronChromeExtensions`
  wired to `host` (its `createWindow` opens a tab, like fix 2), `installChromeWebStore({ session,
  extensionsPath: <userData>/extensions/<spaceId> })`, and — when `ACAB_TEST_EXTENSION` is set —
  `session.extensions.loadExtension(<that path>)`. Check the option names against the installed
  packages' READMEs; if `ElectronChromeExtensions` requires a `license` option, use the value its
  README gives for open-source projects and note it in the spike doc.
- Spike fix 2: `app.on('web-contents-created')` sets a window-open handler on non-tab contents
  that opens the URL as a tab in `spaceOf(contents.session)` and denies the window (tab views,
  the UI and the overlay keep their own handlers, installed after).
- `TabViews` calls `extensionsFor(spaceId)?.addTab(contents, win)` on create,
  `selectTab(contents)` when shown, and appends
  `extensionsFor(spaceId)?.getContextMenuItems(contents, params)` to the page menu (after a
  separator, before Inspect).
- `TabViews.webContentsOf(tabId): WebContents | null`; runtime gains `webContentsId`.

- [ ] **Step 1: Failing e2e** `tests/e2e/extensions.spec.ts` (launched with
  `ACAB_TEST_EXTENSION=<fixture path>`):
  - `the test extension loads in the active space`: from main,
    `session.fromPartition('persist:space-<id>').extensions.getAllExtensions()` contains
    `ACAB Test Action`.
  - `window.open from an extension page opens a tab`: load
    `chrome-extension://<id>/page.html?open=<fixture url>` in a tab; a new tab with the fixture
    URL appears in the same space; `BrowserWindow.getAllWindows().length` stays 1.
  - `a second space gets its own extensions`: create a space; its session also lists the
    extension (loaded per session), and the two sessions are different objects.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `SpaceSessions`, the mirror preload (port of
  `browser-mirror.preload.js` to TS), fix 2, the `TabViews` hooks and `webContentsId`.
- [ ] **Step 4: Run** `npm run check`, `npm run test:e2e` → PASS. Also `npm run dev` once and
  check the log has no extension error at startup (no network needed for that).
- [ ] **Step 5: Docs** — ARCHITECTURE §11 "Extensions" bullet; update the "no preload" line to
  "no app preload; the session's `browser.*` mirror only".
- [ ] **Step 6: Commit** `feat(main): load chrome extensions in every space`

### Task 3: Built-in ad blocker with a per-site toggle

**Files:**
- Create: `src/core/browser/adblock.ts` (+ test), `src/main/browser/adBlocker.ts`,
  `tests/e2e/fixtures/ads.txt` (one filter: `/ads/banner.png`), `tests/e2e/adblock.spec.ts`
- Modify: `src/shared/ipc/contract.ts` (+ test), `src/core/settings/settingsStore.ts`,
  `tests/e2e/fixtures/site.ts` (route `/ads/banner.png` → a 1×1 PNG; page `/with-ad` that shows
  it), `src/main/browser/spaceSessions.ts`, `src/main/index.ts`, `docs/ARCHITECTURE.md` §11

**Interfaces:**
- Settings: `adBlock: z.object({ enabled: z.boolean(), allowedHosts: z.array(z.string()) })`,
  default `{ enabled: true, allowedHosts: [] }`.
- Core (pure): `exceptionFilter(host: string): string` → `` `@@||${host}^$document` ``;
  `hostOf(url: string): string | null` (lower-cased hostname of an http(s) URL, else null);
  `diffAllowed(before: string[], after: string[]): { added: string[]; removed: string[] }` (as
  filters).
- Main: `class AdBlocker { static async load(opts: { cachePath: string; filtersFile?: string }):
  Promise<AdBlocker | null>; enable(session: Session): void; disable(session: Session): void;
  setAllowedHosts(hosts: string[]): void }` — `load` uses
  `ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, { path: cachePath, read, write })`, or
  `ElectronBlocker.parse(<file text>)` when `filtersFile` (from `ACAB_ADBLOCK_FILTERS`) is set;
  any failure is logged and returns `null` (the app browses without blocking).
  `setAllowedHosts` applies `diffAllowed` with `engine.updateFromDiff`. Loaded once at startup,
  without awaiting before the window opens; `SpaceSessions` enables it on every session (now and
  when it arrives later). Main reloads the active tab when its host's exception changes.

- [ ] **Step 1: Unit tests** `adblock.test.ts`: `exceptionFilter('example.com')` →
  `'@@||example.com^$document'`; `hostOf('https://WWW.Example.com/a')` → `'www.example.com'`,
  `hostOf('about:blank')` → `null`; `diffAllowed(['a.com'], ['b.com'])` →
  `{ added: ['@@||b.com^$document'], removed: ['@@||a.com^$document'] }`. Contract test: settings
  accept `{ adBlock: { enabled: false, allowedHosts: ['a.com'] } }`, reject a missing
  `allowedHosts`.
- [ ] **Step 2: Unit test for the offline case** — in `adBlocker` there is no Electron-free unit,
  so put the load-failure rule in core: `loadEngine(load: () => Promise<T>): Promise<T | null>`
  in `adblock.ts` (catches, logs through an injected `log`, returns null); test it with a
  rejecting loader.
- [ ] **Step 3: Failing e2e** `adblock.spec.ts` (with `ACAB_ADBLOCK_FILTERS=<fixtures/ads.txt>`):
  - `ads are blocked by default`: open `/with-ad`; the image's `naturalWidth` is 0.
  - `allowing the site shows the ad and survives a relaunch`: `settings.update` with the
    fixture host in `allowedHosts` (through `window.acab.invoke` in the UI page); the tab reloads
    and `naturalWidth` is 1; relaunch on the same userData → still 1.
- [ ] **Step 4: Run** → FAIL. **Step 5: Implement.** **Step 6: Run** `npm run check`,
  `npm run test:e2e` → PASS.
- [ ] **Step 7: Docs** — ARCHITECTURE §11 "Ad blocker" bullet; `docs/DESIGN.md` settings table
  row "Block ads (default on)" marked for plan 5's Privacy panel.
- [ ] **Step 8: Commit** `feat(main): block ads and trackers with a per-site toggle`

### Task 4: Site menu

**Files:**
- Create: `src/renderer/src/features/browser/SiteMenu.tsx`, `SiteMenu.module.css`,
  `tests/e2e/site-menu.spec.ts`
- Modify: `src/renderer/src/features/browser/AddressBar.tsx` (site-menu button on the right:
  Phosphor `SlidersHorizontal`, `aria-label="Site menu"`), `src/renderer/src/app/Overlay.tsx`,
  `src/preload/index.ts` (`injectBrowserAction()` from
  `electron-chrome-extensions/browser-action`), `src/renderer/index.html` (CSP `img-src` adds
  `crx:`), `src/main/index.ts` (`ElectronChromeExtensions.handleCRXProtocol` on the UI/overlay
  session), channels/contract (+ test), `docs/DESIGN.md` (site menu section)

**Interfaces:**
- Consumes: `overlay.open({ kind: 'site-menu', anchor })` (Task 1), `TabRuntime.webContentsId`
  (Task 2), `settings.adBlock` (Task 3).
- Produces (IPC): `browser.share` `{ tabId }` → `void` (macOS: `ShareMenu` with the tab URL,
  popped at the cursor; other platforms: copy the URL to the clipboard);
  `browser.toggleDevTools` `{ tabId }` → `void`; `browser.openWebStore` `void` → opens
  `https://chromewebstore.google.com/` as a tab in the active space.
- The menu, top to bottom, in the yab card shape (spec "Menus and settings"):
  1. **Quick actions row** — icon buttons: Share (`browser.share`). Capture, hide an element and
     translate are **not shown** (their modules come later — spec).
  2. **Extensions** — section title with **Manage** on the right (disabled until plan 5, with
     the "Soon" tag) and a `+` (`browser.openWebStore`); below, the active tab's extension
     actions as `<browser-action-list partition="persist:space-<id>" tab="<webContentsId>">`
     styled through its `::part`s with tokens; "No extensions yet" when empty.
  3. **This site** — rows with an icon, a title and a status line: **Block ads and trackers**
     (Switch; on = host not in `allowedHosts`; toggling updates `settings.adBlock`), **Developer
     tools** (button → `browser.toggleDevTools`).
  4. **Footer** — lock icon + "Secure" for https, "Not secure" for http, nothing for other
     schemes; the host on the right.
- Pages that are not http(s) (`about:blank`): sections 1 and 3 are hidden.

- [ ] **Step 1: Contract tests** for the three commands (accept `{ tabId: 'x' }`, reject extras).
- [ ] **Step 2: Failing e2e** `site-menu.spec.ts` (with both fixture env vars):
  - `the site menu shows the site's state`: open the fixture page, click `Site menu`; the
    overlay shows `Not secure` and the fixture host, a switch `Block ads and trackers` that is
    checked.
  - `turning off ad blocking adds the host`: click the switch; `settings.get()` has the host in
    `adBlock.allowedHosts`.
  - `extension actions are listed`: the overlay contains an element with title
    `ACAB Test Action` (pierce the shadow root).
  - `developer tools open for the tab`: click it; from main,
    `webContents.fromId(<id>).isDevToolsOpened()` is true.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** **Step 5: Run** `npm run check`,
  `npm run test:e2e` → PASS.
- [ ] **Step 6: Docs** — DESIGN.md: site menu layout and which items are live; HANDOFF "Next
  steps" → plan 3.
- [ ] **Step 7: Commit** `feat(renderer): add the site menu`
