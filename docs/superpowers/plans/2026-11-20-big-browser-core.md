# Big Browser browser core — implementation plan (step 1, plan 1 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** turn the YAAS shell into a working browser: spaces and tabs that persist, one
`WebContentsView` per tab, a yab-style address bar tinted to the site, and the app renamed to Big Browser.

**Architecture:** the tab model (spaces, tabs, order, active tab) lives in `src/core/browser/`
on SQLite and knows nothing of Electron. `src/main/browser/` turns that model into one
`WebContentsView` per tab, placed over the page card whose rectangle the renderer reports. The
renderer only draws the chrome (sidebar, address bar) from a `browser.changed` snapshot and sends
commands through `window.bigBrowser`. Shortcuts are application-menu accelerators in main, because a
focused web page swallows renderer key events.

**Tech stack:** Electron 45 (`WebContentsView`, `session.fromPartition`), React 19 + Zustand,
`node:sqlite`, zod, Vitest, Playwright `_electron`.

**Spec:** [`docs/superpowers/specs/2026-11-20-big-browser-design.md`](../specs/2026-11-20-big-browser-design.md)
(§4 tab hosting, §5.1 step 1, browser chrome). Also obey `CLAUDE.md`.

## Where this fits — step 1 is split into six plans

Each plan leaves `main` building and usable. Only plan 1 is written in detail; each next plan is
written when the previous one is merged.

1. **Browser core** (this plan): rename, spaces, tabs, tab views, address bar, basic shortcuts,
   YAAS UI hidden.
2. **Extensions & site menu**: Chrome Web Store, the two spike fixes, Ghostery ad blocker, the
   transparent overlay view for UI floating over the page, the yab-shaped site menu.
3. **Organisation**: pins, favourite tiles, folders, nested tabs, automatic folders for tabs of
   the same site, icon-only sidebar when narrow, ⌘K tab finder, ⌘T field over the page, ⌘Z, the
   full + menu.
4. **Window features**: split view, downloads (sidebar footer button), several windows (⌘N),
   default-browser registration.
5. **Settings**: yab-shaped settings window with the step 1 categories, including the UI font.
6. **Onboarding**: import (Chromium browsers — Chrome, Arc, Edge, Brave — then Safari and
   Firefox), the font step, the customizable 2-character logo (`:]` by default) and its opening
   animation (characters and font swap).

## Global constraints

- Work on a branch `feat/big-browser-core` cut from `style/visual-pass`. Claude never pushes.
- `npm run check` passes after every task; tasks touching UI also pass `npm run test:e2e`.
- Layering (`CLAUDE.md` rule 2): `src/core` and `src/shared` never import `electron` or `react`;
  the renderer never imports Node, `electron` or `@core/*`.
- Every IPC command/event goes through `channels.ts` → `contract.ts` → `main/index.ts` (rule 3).
- Security defaults stay on for the UI window **and** for every tab view: `contextIsolation`,
  `sandbox`, no `nodeIntegration`. Tab views get **no preload** in this plan.
- CSS: design tokens only. The site's theme colour is runtime data and may be set inline.
- Spaces are browser spaces, never tied to a Claude account (spec §5.1).
- No migration of YAAS data: the app is pre-alpha (spec §8).
- Address bar is always shown (spec, browser chrome). The URL shows host bright, path dimmed.
- Commits: Conventional Commits, scope from `CLAUDE.md`, `Co-Authored-By:` trailer.

## Review focus

1. **Dangerous input in the address bar** (`javascript:…`, `file:///…`, `data:…`) — must become a
   search, never load. Test: Task 2, `resolveInput` cases.
2. **Window or sidebar resized** — the page must follow the card exactly. Test: Task 7 e2e reads
   the view bounds from main after a sidebar drag.
3. **Settings opened over a page** — the native page view would cover the dialog; it must be
   hidden while settings are open and shown again after. Test: Task 7 e2e.
4. **Closing the active or last tab** — the neighbour below (else above) becomes active; no tab →
   empty state, no crash. Test: Task 3 unit, Task 7 e2e.
5. **A page opening a popup / `target=_blank`** — opens a tab in the same space, never a window.
   Test: Task 5 e2e.

---

### Task 1: Rename YAAS → Big Browser

**Files:**
- Modify: `package.json`, `electron-builder.yml`, `src/renderer/index.html`,
  `src/main/windows/mainWindow.ts`, `src/main/index.ts`, `src/preload/index.ts`,
  `src/shared/ipc/contract.ts`, `src/renderer/src/env.d.ts`, `src/renderer/src/stores/*.ts`,
  `src/renderer/src/features/onboarding/TechnicalSetup.tsx`, `tests/e2e/launch.spec.ts`,
  `README.md`, `CLAUDE.md`

**Interfaces:**
- Produces: the bridge is `window.bigBrowser` of type `BigBrowserBridge` (was `window.yaas` / `YaasBridge`);
  env vars `BIG_BROWSER_USER_DATA`, `BIG_BROWSER_ONBOARDING`; database file `big-browser.db`.

- [ ] **Step 1:** In `tests/e2e/launch.spec.ts`, rename env vars to `BIG_BROWSER_USER_DATA` and drop
  `YAAS_PROVIDER` (nothing reads it), change the temp prefix to `big-browser-e2e-`, the button to
  `Open Big Browser`, and the isolation check to `globalThis.acab?.invoke` with key `acab`.
- [ ] **Step 2:** Run `npm run test:e2e` — expected FAIL (bridge and button still YAAS).
- [ ] **Step 3:** Rename everywhere listed above:
  - `package.json`: `"name": "acab"`, `"productName": "Big Browser"`,
    `"description": "AI Custom Another Browser — a web browser you customize with your own AI."`,
    script `dev:onboarding` sets `BIG_BROWSER_ONBOARDING=1`.
  - `electron-builder.yml`: `appId: dev.bigbrowser.app`, `productName: Big Browser`, copyright
    `Big Browser contributors`, mac `category: public.app-category.productivity`.
  - window `title: 'Big Browser'`, `<title>Big Browser</title>`, db file `big-browser.db`, env var names, bridge name
    and type, the onboarding button `Open Big Browser`.
  - `README.md` and `CLAUDE.md`: product name and one-line description become Big Browser; rule 2 and 3
    say `window.bigBrowser`; keep the YAAS docs as the AI-tabs reference (ADR-0006).
- [ ] **Step 4:** Run `grep -rniI yaas src tests package.json electron-builder.yml README.md` —
  expected: no hits except comments that point to YAAS docs on purpose.
- [ ] **Step 5:** Run `npm run check && npm run test:e2e` — expected PASS.
- [ ] **Step 6:** Commit `refactor: rename yaas to acab`.

### Task 2: URL helpers (address bar input and display)

**Files:**
- Create: `src/shared/url.ts`, `src/shared/url.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_SEARCH = 'https://www.google.com/search?q=%s'`
  - `resolveInput(text: string, search?: string): string` — always returns an `http:`, `https:`
    or `about:blank` URL (`URL.href` form).
  - `displayUrl(url: string): { host: string; rest: string }`

- [ ] **Step 1: Write the failing tests**

```ts
describe('resolveInput', () => {
  it.each([
    ['https://example.com/a', 'https://example.com/a'],
    ['  github.com/x  ', 'https://github.com/x'],
    ['example.com', 'https://example.com/'],
    ['localhost:5173', 'http://localhost:5173/'],
    ['127.0.0.1:8080/x', 'http://127.0.0.1:8080/x'],
    ['about:blank', 'about:blank'],
    ['what is acab', 'https://www.google.com/search?q=what%20is%20acab'],
    ['acab', 'https://www.google.com/search?q=acab'],
    ['javascript:alert(1)', 'https://www.google.com/search?q=javascript%3Aalert(1)'],
    ['file:///etc/passwd', 'https://www.google.com/search?q=file%3A%2F%2F%2Fetc%2Fpasswd'],
    ['data:text/html,hi', 'https://www.google.com/search?q=data%3Atext%2Fhtml%2Chi'],
  ])('%s → %s', (input, expected) => expect(resolveInput(input)).toBe(expected))

  it('uses a custom search template', () =>
    expect(resolveInput('a b', 'https://duckduckgo.com/?q=%s')).toBe('https://duckduckgo.com/?q=a%20b'))
})

describe('displayUrl', () => {
  it.each([
    ['https://demo.agencebigmama.com/d/preview/', { host: 'demo.agencebigmama.com', rest: '/d/preview/' }],
    ['https://www.github.com/', { host: 'github.com', rest: '' }],
    ['http://127.0.0.1:4000/a?q=1#x', { host: '127.0.0.1:4000', rest: '/a?q=1#x' }],
    ['about:blank', { host: '', rest: '' }],
    ['not a url', { host: '', rest: '' }],
  ])('%s', (url, expected) => expect(displayUrl(url)).toEqual(expected))
})
```

- [ ] **Step 2:** Run `npx vitest run src/shared/url.test.ts` — expected FAIL (module missing).
- [ ] **Step 3:** Implement in `src/shared/url.ts`. Rules for `resolveInput`, in order: trim;
  `about:blank` as is; `^https?://` (case-insensitive) → `new URL(text).href`, search if it does
  not parse; text matching
  `^(localhost|\d{1,3}(\.\d{1,3}){3}|[a-z0-9-]+(\.[a-z0-9-]+)+)(:\d+)?([/?#].*)?$`
  (case-insensitive, so `localhost:5173` is a host, not a scheme) → prefix `http://` for
  localhost/IPv4, `https://` otherwise, and return `.href`; anything else, including every other
  scheme → search with `encodeURIComponent`. `displayUrl` strips a leading `www.`, and drops a
  `rest` that is only `/`.
- [ ] **Step 4:** Run the test — expected PASS.
- [ ] **Step 5:** Commit `feat(shared): resolve address bar input and display urls`.

### Task 3: Browser store (spaces and tabs in SQLite)

**Files:**
- Modify: `src/core/store/database.ts` (append migration 3), `src/shared/model.ts`
- Create: `src/core/browser/browserStore.ts`, `src/core/browser/browserStore.test.ts`

**Interfaces:**
- Produces, in `src/shared/model.ts`:

```ts
export interface BrowserSpace { id: string; name: string; color: string; position: number }
export interface BrowserTab {
  id: string; spaceId: string; url: string; title: string; faviconUrl: string | null; position: number
}
export interface BrowserSnapshot {
  spaces: BrowserSpace[]           // by position
  activeSpaceId: string
  tabs: BrowserTab[]               // all spaces, by spaceId then position
  activeTabIds: Record<string, string | null> // per space
}
```

- Produces, `BrowserStore` in `browserStore.ts`:
  `constructor(db: Database, options: { defaultSpace: { name: string; color: string } })` —
  creates the default space when there is none;
  `snapshot(): BrowserSnapshot`;
  `createSpace(name: string, color: string): BrowserSpace` (appended, becomes active);
  `activateSpace(id: string): void`;
  `openTab(spaceId: string, url: string, options?: { activate?: boolean }): BrowserTab`
  (inserted right after the space's active tab, else at the end; `activate` defaults to true);
  `closeTab(id: string): void`; `activateTab(id: string): void` (also activates its space);
  `updateTab(id: string, patch: Partial<Pick<BrowserTab, 'url' | 'title' | 'faviconUrl'>>): void`;
  `subscribe(listener: (s: BrowserSnapshot) => void): () => void`.
  Unknown ids throw `BrowserError` with `code: 'not_found'`.

Migration 3 (append, never edit 1–2):

```sql
CREATE TABLE spaces (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, position INTEGER NOT NULL,
  active_tab_id TEXT, created_at TEXT NOT NULL
);
CREATE TABLE tabs (
  id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL, title TEXT NOT NULL, favicon_url TEXT, position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX tabs_space ON tabs(space_id, position);
```

The active space id is stored in the `settings` table under key `browser.activeSpace`.

- [ ] **Step 1: Write the failing tests** (`openDatabase(':memory:')`), named:
  - `creates the default space once` — two stores on the same db → one space `Personal`.
  - `opens a tab after the active one` — tabs A, B; activate A; open C → order A, C, B; C active.
  - `opens in the background` — `activate: false` keeps the active tab.
  - `closing the active tab activates the one below, else above` — A, B, C, active B: close B →
    C active; close C → A active; close A → `activeTabIds[space] === null`, `tabs` empty.
  - `activating a tab of another space switches space`.
  - `persists across instances` — new store on same db returns same snapshot.
  - `notifies subscribers on every change` — count calls for open, update, close.
  - `throws not_found for unknown ids` — `expect(() => store.closeTab('x')).toThrow(BrowserError)`.
  - `deleting a space row cascades its tabs` (guards the foreign key).
- [ ] **Step 2:** Run `npx vitest run src/core/browser` — expected FAIL.
- [ ] **Step 3:** Implement. Keep `position` contiguous (0..n-1) per space by shifting rows in a
  transaction. Bump `SCHEMA_VERSION` comes for free from the array length.
- [ ] **Step 4:** Run `npm test` — expected PASS (including `database.test.ts`).
- [ ] **Step 5:** Commit `feat(core): add the browser store for spaces and tabs`.

### Task 4: IPC contract for the browser

**Files:**
- Modify: `src/shared/ipc/channels.ts`, `src/shared/ipc/contract.ts`,
  `src/shared/ipc/contract.test.ts`

**Interfaces:**
- Produces schemas `browserSpaceSchema`, `browserTabSchema`, `tabRuntimeSchema`,
  `browserStateSchema` and types:

```ts
export interface TabRuntime { loading: boolean; canGoBack: boolean; canGoForward: boolean; themeColor: string | null }
export type BrowserState = BrowserSnapshot & { runtime: Record<string, TabRuntime> } // keyed by tab id
export interface PageBounds { x: number; y: number; width: number; height: number } // ints ≥ 0, DIP
```

- Commands (all inputs `.strict()`; ids are non-empty strings):

| Channel | Input | Output |
|---|---|---|
| `browser.state` | void | `BrowserState` |
| `browser.openTab` | `{ spaceId?: string; input?: string }` (input through `resolveInput`, default `about:blank`) | `BrowserTab` |
| `browser.closeTab` / `browser.activateTab` | `{ tabId }` | void |
| `browser.navigate` | `{ tabId; input: string }` | void |
| `browser.goBack` / `browser.goForward` / `browser.reload` | `{ tabId }` | void |
| `browser.createSpace` | `{ name: string (1–40); color: #RRGGBB }` | `BrowserSpace` |
| `browser.activateSpace` | `{ spaceId }` | void |
| `browser.setPageBounds` | `PageBounds` | void |
| `browser.setPageVisible` | `{ visible: boolean }` | void |

- Events: `browser.changed` → `BrowserState`; `browser.shortcut` →
  `z.enum(['focus-address', 'settings'])`.

- [ ] **Step 1:** Add to `contract.test.ts`: `rejects a negative page bound`,
  `rejects an unknown field on browser.openTab`, `rejects a bad space color` (each
  `safeParse(...).success === false`). The existing channels-match test covers the names.
- [ ] **Step 2:** Run `npx vitest run src/shared` — expected FAIL.
- [ ] **Step 3:** Add the channels and schemas; `browserTabSchema` etc. `satisfies` the model
  types like `accountSchema` does.
- [ ] **Step 4:** Run `npx vitest run src/shared` — PASS. Do **not** commit yet: `registerCommands`
  needs every handler, so `npm run typecheck` stays red until Task 5; Tasks 4 and 5 land in one
  commit at the end of Task 5.

### Task 5: Tab views in main

**Files:**
- Create: `src/main/browser/tabViews.ts`, `src/core/browser/userAgent.ts`,
  `src/core/browser/userAgent.test.ts`, `tests/e2e/fixtures/site.ts`, `tests/e2e/browser.spec.ts`
- Modify: `src/main/index.ts`, `docs/ARCHITECTURE.md` (new "Browser" section: model in core,
  one view per tab, partitions, bounds from renderer, lazy loading)

**Interfaces:**
- Consumes: `BrowserStore` (Task 3), contract (Task 4), `resolveInput` (Task 2).
- Produces:
  - `chromeUserAgent(electronUa: string): string` — removes the `Electron/x.y.z` and
    `Big Browser/x.y.z` tokens, nothing else.
  - `class TabViews` — `constructor(win: BrowserWindow, store: BrowserStore, onRuntime: () => void)`;
    `sync(snapshot: BrowserSnapshot): void`; `setBounds(b: PageBounds): void`;
    `setVisible(visible: boolean): void`; `navigate(tabId: string, url: string): void`;
    `goBack/goForward/reload(tabId: string): void`; `runtime(): Record<string, TabRuntime>`.
  - `tests/e2e/fixtures/site.ts`: `startSite(): Promise<{ url: (path: string) => string; close: () => Promise<void> }>`
    — `node:http` on `127.0.0.1:0` serving `/a` (`<title>Page A</title>`,
    `<meta name="theme-color" content="#123456">`, `<a id="b" href="/b">`, `<a id="pop" href="/b" target="_blank">`),
    `/b` (`<title>Page B</title>`, `<meta name="theme-color" content="#f5f5f0">`), `/c` (no theme-color).

Behaviour of `TabViews` (decided):
- A view is created **lazily** the first time its tab is active (restored tabs don't load until
  visited); views of closed tabs are destroyed (`webContents.close()`).
- Each view uses `session.fromPartition('persist:space-<spaceId>')`, `sandbox: true`,
  `contextIsolation: true`, no preload; the session's user agent is `chromeUserAgent(...)`.
- Only the active tab of the active space is visible; `setBounds` applies to it;
  `view.setBorderRadius(PAGE_RADIUS)` with `PAGE_RADIUS = 9` (must equal `--radius-lg`).
- Events → store/runtime: `did-navigate` and `did-navigate-in-page` → `updateTab(url)`;
  `page-title-updated` → title; `page-favicon-updated` → first favicon;
  `did-start-loading`/`did-stop-loading` → `loading`; `did-change-theme-color` → `themeColor`
  (null when cleared); after each navigation update `canGoBack`/`canGoForward` from
  `webContents.navigationHistory`.
- `setWindowOpenHandler` on every tab → `store.openTab(sameSpace, url)` and `deny`.
- `will-navigate` to a non-http(s) scheme is prevented.
- In `main/index.ts`: create the store with `defaultSpace: { name: 'Personal', color: settings.accent }`,
  register the commands, and on every store change or `onRuntime` call `tabViews.sync` and
  `emit('browser.changed', { ...store.snapshot(), runtime: tabViews.runtime() })`.
  `browser.createSpace` from the UI uses the given name and colour.

- [ ] **Step 1:** Write `userAgent.test.ts`:
  `chromeUserAgent('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Big Browser/0.0.1 Chrome/140.0.0.0 Electron/45.4.1 Safari/537.36')`
  → `'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'`.
- [ ] **Step 2:** Write `tests/e2e/browser.spec.ts` test `a page opens, navigates and reports
  back`. The UI comes in Task 7, so after finishing onboarding it calls the bridge from the UI
  page with `page.evaluate(() => window.bigBrowser.invoke(...))`:
  `openTab({ input: site.url('/a') })` → poll `browser.state` until the tab title is `Page A`
  and `runtime[tabId].themeColor === '#123456'`; `navigate` to `/b` → title `Page B`,
  `canGoBack: true`; `goBack` → `Page A`. Then the **popup** case: click `#pop` inside the page with
  `app.evaluate(({ webContents }) => webContents.getAllWebContents().find((w) => w.getURL().endsWith('/a'))?.executeJavaScript("document.getElementById('pop').click()"))`
  → poll: 2 tabs, both in the first space, and `BrowserWindow.getAllWindows().length === 1`.
- [ ] **Step 3:** Run both tests — expected FAIL.
- [ ] **Step 4:** Implement `userAgent.ts`, `tabViews.ts` and the wiring.
- [ ] **Step 5:** Run `npm run check && npm run test:e2e` — PASS.
- [ ] **Step 6:** Commit Tasks 4 and 5 together: `feat(main): show each tab in its own web contents view`
  (body mentions the new `browser.*` IPC commands and events).

### Task 6: Application menu and shortcuts

**Files:**
- Create: `src/main/menu.ts`
- Modify: `src/main/index.ts`, `src/renderer/src/app/shortcuts.ts`, `docs/DESIGN.md` §8,
  `tests/e2e/browser.spec.ts`

**Interfaces:**
- Produces: `buildAppMenu(actions: MenuActions): Menu` where
  `MenuActions = { newTab(): void; closeTab(): void; focusAddress(): void; reload(): void; back(): void; forward(): void; nextTab(): void; previousTab(): void; settings(): void }`.
  Each item has an `id` equal to its action name (tests click them by id).

Accelerators: `CmdOrCtrl+T` newTab, `CmdOrCtrl+W` closeTab, `CmdOrCtrl+L` focusAddress,
`CmdOrCtrl+R` reload, `CmdOrCtrl+[` back, `CmdOrCtrl+]` forward, `Ctrl+Tab` nextTab,
`Ctrl+Shift+Tab` previousTab, `CmdOrCtrl+,` settings. Keep the standard Edit menu roles
(undo, redo, cut, copy, paste, selectAll) and, on macOS, the app menu (about, hide, quit).
`newTab` opens `about:blank` in the active space then emits `browser.shortcut: 'focus-address'`;
`focusAddress` and `settings` only emit; the others act in main. `nextTab`/`previousTab` wrap.

- [ ] **Step 1:** Add e2e `shortcuts work while a page has focus`: open `/a`, focus the page via
  `executeJavaScript('document.body.focus()')`, click menu item `newTab` via
  `app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('newTab')?.click())` →
  2 tabs, the new one active and the address input focused (`toBeFocused()` once Task 7 lands —
  in this task assert the new active tab is `about:blank`); click `closeTab` → back to 1 tab.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement and set `Menu.setApplicationMenu` at ready.
- [ ] **Step 4:** Replace `SHORTCUTS` with the list above (labels in English) and update
  `docs/DESIGN.md` §8 to the same list, noting ⌘K, ⌘Z, split view, ⌘N arrive in plans 3–4.
- [ ] **Step 5:** `npm run check && npm run test:e2e` — PASS. Commit
  `feat(main): add browser shortcuts in the application menu`.

### Task 7: Browser chrome in the renderer (sidebar, address bar, page slot)

**Files:**
- Create: `src/renderer/src/stores/browser.ts`,
  `src/renderer/src/features/browser/AddressBar.tsx` + `.module.css`,
  `src/renderer/src/features/browser/PageSlot.tsx` + `.module.css`,
  `src/renderer/src/ui/Menu.tsx` + `.module.css`
- Modify: `src/renderer/src/features/workspace/workspace.ts` (+ test),
  `src/renderer/src/features/workspace/useWorkspace.ts`,
  `src/renderer/src/features/sidebar/Sidebar.tsx` + css, `src/renderer/src/app/Shell.tsx` + css,
  `src/renderer/src/stores/ui.ts`, `CLAUDE.md` rule 7, `tests/e2e/browser.spec.ts`

**Interfaces:**
- Consumes: contract types (Task 4), `displayUrl` (Task 2), `onAccentColor` from
  `theme/color.ts` for text on the site colour.
- Produces, in `workspace.ts` (pure, tested):

```ts
export interface TabView {
  id: string; title: string; url: string; faviconUrl: string | null
  host: string; rest: string            // from displayUrl
  loading: boolean; canGoBack: boolean; canGoForward: boolean; themeColor: string | null
}
export interface BrowserView {
  spaces: SpaceSummary[]                // { id, label: name, color }
  space: SpaceSummary
  tabs: TabView[]                       // active space, by position
  activeTab: TabView | null
}
export function browserView(state: BrowserState): BrowserView
```

  `SpaceSummary` becomes `{ id: string; label: string; color: string }`. The YAAS session
  functions (`sidebarTree`, `openSession`, `usageView`) stay in the file, unused until step 3.
- `useWorkspace(): BrowserView | null` (null until the first state arrives) — the only data entry
  point for components (rule 7; reword the rule to "spaces, tabs and the active tab").
- `useBrowser` store: `{ state: BrowserState | null; init(): () => void }` fed by `browser.state`
  then `browser.changed`.

Layout and behaviour (decided):
- `Shell`: sidebar | column with `AddressBar` on top and `PageSlot` filling the card. No
  `ContextBar`, no `SessionView`. With no active tab, `PageSlot` shows the empty state
  "No tab open" / "Press ⌘T to open one" (`data-testid="empty-state"`).
- `PageSlot` measures its box with a `ResizeObserver` (and on window resize) and sends rounded
  `browser.setPageBounds`; it sends `setPageVisible(false)` while `ui.view === 'settings'` and
  `true` otherwise.
- `AddressBar` (`data-testid="address-bar"`): back, forward, reload buttons (disabled from
  runtime); the URL centred as two spans `host` (`data-testid="url-host"`) and `rest`
  (`data-testid="url-rest"`, dimmed token colour); clicking it swaps to an input
  (`aria-label="Address"`) prefilled with the full URL, selected; Enter →
  `browser.navigate`, Escape → back to display. On `browser.shortcut: 'focus-address'` it enters
  edit mode. Background = `themeColor` inline when set, else the card token; text colour =
  `onAccentColor(themeColor)` when set. No right-hand icons yet (plans 2 and 4).
- `Sidebar`: keep titlebar, search button (inert until plan 3) and the visual style; the list is
  the active space's tabs (`data-testid="tab"`, favicon or a globe glyph, title, close button
  `aria-label="Close tab"` shown on hover and on the active tab), then a "New tab ⌘T" row.
  Footer: an empty left slot (downloads, plan 4), the spaces as **dots** in the middle with
  `useMagnetic` (`role="tab"`, `aria-label` = space name), a **+** on the right opening `Menu`
  with "New tab", "New space", "Settings". "New space" creates `Space N` (N = count + 1) with the
  accent colour. Settings button leaves the footer (now in the + menu and ⌘,).
- `Menu` (`ui/Menu.tsx`): yab-shaped popover — rounded glass card, rows of icon + label +
  optional shortcut, separators; opens upward from its anchor (plan 2 moves it to the overlay view, over the page);
  closes on Escape, outside click or choice. Props:
  `{ anchor: HTMLElement | null; items: MenuItem[]; onClose(): void }`,
  `MenuItem = { id: string; label: string; icon: Icon; shortcut?: string; onSelect(): void } | 'separator'`.
- `ui.ts`: drop `activeSpaceId`, `activeSessionId`, `openSession`, `closedEnvironments`,
  `toggleEnvironment` (state now comes from main); keep `view`, `openSettings`, `closeSettings`.

- [ ] **Step 1:** Unit tests in `workspace.test.ts`: `browserView lists the active space's tabs in
  order`, `browserView picks the active tab and its runtime`, `browserView falls back to empty
  runtime for an unloaded tab` (loading false, no theme colour).
- [ ] **Step 2:** e2e in `browser.spec.ts`, all through the UI:
  - `open, navigate, go back` — click "New tab", type `site.url('/a')` + Enter → a `tab` named
    `Page A`, `url-host` = `127.0.0.1:<port>`, `url-rest` = `/a`, address bar background
    `rgb(18, 52, 86)` with white text; on `/b` the text is black; on `/c` no inline background;
    back button → `Page A`.
  - `close tabs down to the empty state` — two tabs, close both with "Close tab" → `empty-state`.
  - `page follows the card` — drag `sidebar-resizer` 80 px right, then
    `app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.find(v => v.getVisible())?.getBounds())`
    equals the `page-slot` bounding box (rounded).
  - `settings hide the page` — open Settings from the + menu → the visible-view lookup returns
    none; Escape → the view is visible again.
  - `spaces keep their own tabs` — + → New space → its tab list is empty; open `/c` there; click
    the first dot → only the first space's tabs.
  - `tabs survive a relaunch` — two tabs, second active; relaunch with the same user data → same
    titles in order, second active, address bar shows its URL.
  - Extend the Task 6 shortcut test: after `newTab`, the `Address` input is focused.
- [ ] **Step 3:** Run — FAIL. **Step 4:** Implement. **Step 5:** `npm run check && npm run
  test:e2e` — PASS. **Step 6:** Commit `feat(renderer): browser sidebar, address bar and page slot`.

### Task 7b: Unloaded tabs at low opacity

Added by the owner during execution (spec, "Added by the owner on 2026-11-20").

**Files:**
- Modify: `src/renderer/src/features/workspace/workspace.ts` (+ test),
  `src/renderer/src/features/sidebar/Sidebar.tsx` + css, `tests/e2e/browser.spec.ts`

**Interfaces:**
- Consumes: `BrowserState.runtime` — main only has a runtime entry for a tab whose view exists,
  i.e. whose page has been loaded at least once in this run.
- Produces: `TabView.loaded: boolean` (`true` when `state.runtime[tab.id]` exists).

- [ ] **Step 1:** Unit test `browserView marks tabs without runtime as not loaded`.
- [ ] **Step 2:** e2e `restored tabs stay dim until visited`: two tabs, relaunch → the inactive
  `tab` has `data-loaded="false"` and the active one `"true"`; click the inactive one → `"true"`.
- [ ] **Step 3:** Run — FAIL. **Step 4:** Implement: the tab row gets `data-loaded`, and CSS
  lowers its opacity with a new token `--opacity-unloaded` (add it to `tokens.css` and
  `docs/DESIGN.md`); hover and the active row stay at full opacity.
- [ ] **Step 5:** `npm run check && npm run test:e2e` — PASS. Commit
  `feat(sidebar): dim tabs that are not loaded yet`.

### Task 8: Hide the YAAS UI in onboarding and settings

**Files:**
- Modify: `src/renderer/src/features/onboarding/Onboarding.tsx`,
  `src/renderer/src/features/onboarding/VisualSetup.tsx`,
  `src/renderer/src/features/settings/catalog.tsx`, `src/renderer/src/features/settings/panels.tsx`,
  `src/main/index.ts`, `tests/e2e/launch.spec.ts`

Decided: the onboarding is intro → visual setup, whose button becomes "Open Big Browser" and finishes
(`onboardingDone: true`). `TechnicalSetup.tsx`, `SessionView`, `ContextBar`, meters and the
accounts code stay in the repo, unreferenced by the UI (spec: hidden until step 3). The
`accounts.*` and `claude.detect` IPC commands stay registered. Settings sections shown: General,
Appearance, Shortcuts, Privacy & data, Advanced, About; the Appearance row for meters placement and
the space-switcher style row are removed (spaces are always dots, spec). Settings contents are
rebuilt in plan 5.

- [ ] **Step 1:** Rewrite `launch.spec.ts`: `first launch shows onboarding, then the browser`
  (intro → visual → pick `#2BB673` → "Open Big Browser" → `sidebar`, `address-bar`, `empty-state`;
  resizer minimum 200 px; isolation check) and `settings survive a relaunch` (accent kept, no
  onboarding). Settings test: the section list has exactly the six labels above.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. Remove `technical` from `Stage` and its
  keyboard handling.
- [ ] **Step 4:** `npm run check && npm run test:e2e` — PASS; `npm run dev` launches, a site
  loads and is usable by hand (log in to a site, reload, relaunch).
- [ ] **Step 5:** Commit `feat(onboarding): hide the claude setup until ai tabs`, then update
  `HANDOFF.md` "Next steps" to point at plan 2 and commit `docs: point the handoff at plan 2`.
