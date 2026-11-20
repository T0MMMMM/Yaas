# Big Browser sidebar finish, part A: look and motion — implementation plan (step 1, plan 3b-A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** make the sidebar and its menus look and move like the owner's yab references: system
font, bigger rows, faded titles, opaque white/grey menus with a connector to their button,
in/out motion everywhere, sliding tooltips, a stronger (switchable) magnetic effect, and a fixed,
adjustable icon-only mode.

**Architecture:** almost all renderer work. Visual values become tokens in `tokens.css`. Logic
that can be pure (width snapping, list presence, the tooltip state machine, connector geometry)
lives in small `.ts` modules with Vitest unit tests (the unit environment is `node`, no DOM);
behaviour on screen is covered by Playwright e2e. Tooltips and menus float over the page, so they
are drawn in plan 2's overlay view; main gains a non-focusing tooltip mode for it and a command to
hide the macOS window buttons.

**Tech stack:** Electron 45, React 19 + Zustand, zod, Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-20-big-browser-sidebar-finish-design.md`](../specs/2026-11-20-big-browser-sidebar-finish-design.md)
(approved). This plan covers its goals **1–2 (look of the existing menus only), 11–25, 27**.
Part B (`2026-11-20-big-browser-sidebar-finish-structure.md`, written after this one is merged) covers
goals 1 and 3 (drawn menus replacing the native ones), 4–10 (dock, history, space section,
nested folders, folder icons), 26 (lifted drag) and 28 (downloads). Also obey `CLAUDE.md`.

## Global constraints

- Branch `feat/big-browser-sidebar-finish` cut from `feat/big-browser-organisation`. Claude never pushes.
- `npm run check` after every task; every task here touches UI, so also `npm run test:e2e`.
- CSS: design tokens only; every new token goes in `tokens.css` **and** `docs/DESIGN.md` §3.
- Menus are **opaque white / light grey** (dark scheme: dark grey) — **no glass, no
  backdrop-filter, no blur** on menus, cards or tooltips [owner].
- An action never waits for an animation: the click's effect is sent first, the exit animation
  only delays hiding.
- Motion uses `--dur-*` / `--ease-*` tokens, which are already zeroed under
  `prefers-reduced-motion` (`tokens.css`).
- IPC additions follow `CLAUDE.md` rule 3 (channels → contract → handler → `window.bigBrowser`).
- Every user-visible string in English.

## Decisions made for this plan [Claude's calls within the spec]

- **Values:** `--row-h` 34 → **38**; favicon **18** px (`--favicon-size`); compact snap below
  **120** px (`SIDEBAR_COMPACT_FROM`); compact width **48–72** px (`SIDEBAR_COMPACT_MIN`,
  `SIDEBAR_COMPACT_MAX`), default **56**; tooltip delay **500 ms**; tooltip fades out **150 ms**
  after the pointer leaves the sidebar.
- **Search button** at the top of the sidebar is removed. The spec brings it back only when a
  site's bar stops showing the URL, which nothing does before step 2's modules; ⌘K and the
  finder are unchanged. DESIGN.md says so.
- **Tooltips** replace the native `title` on tab rows, pinned rows and favourite tiles (both
  sidebar modes). Folder rows and buttons keep `title`.
- **Connector:** a neck of the card's own fill, `--connector-w` 14 px wide, bridging the
  `POPOVER_GAP` between the card and its button, centred on the button (clamped inside the card's
  rounded corners). The button that opened the menu takes the menu's fill while it is open
  (`aria-expanded="true"`), so button, neck and card read as one shape.
- **Magnetic:** strength 0.35 → **0.5** and a scale of **1.08** while hovered; setting
  `magneticButtons` (default `true`) in Settings → Appearance; off = no movement at all.

## Review focus

1. **A stored sidebar width from before this plan (e.g. 57–159 or 160 exactly)** — on load it
   is normalised by `snapWidth`, never shown half-compact. Test: Task 4 unit (`snapWidth`).
2. **Closing several tabs fast (Clear, ⌘W repeated)** — exiting rows never duplicate, never
   reorder the remaining ones, and are gone after the exit. Test: Task 6 unit (`withPresence`).
3. **Opening a menu while a tooltip shows, or hovering the sidebar while a menu is open** — the
   menu wins; a tooltip never replaces or covers an open menu. Test: Task 7 unit
   (`OverlayView` tooltip ignored while a popover is open) + e2e.
4. **Moving from the sidebar straight onto the page while a tooltip shows** — the first click on
   the page reaches the page (the tooltip strip never swallows it for long). Test: Task 7 e2e.
5. **Compact mode on Windows / non-mac** — the window-buttons command is a no-op and never
   throws; the context bar keeps clear of `titleBarOverlay`. Test: Task 4 unit for the handler's
   platform guard.

---

### Task 1: Font, sizes and colours (tokens)

**Files:**
- Modify: `src/renderer/src/theme/tokens.css`, `src/renderer/index.html` (Satoshi preload /
  `@font-face`), `src/renderer/src/features/sidebar/TabRow.module.css`,
  `FavoriteTiles.module.css`, `Sidebar.module.css`, `src/renderer/src/ui/Popover.module.css`,
  `src/renderer/src/ui/Menu.module.css`, `docs/DESIGN.md` (§3.0 font, §3 token tables, sidebar
  section), `README.md`, `CLAUDE.md` (Commands), `HANDOFF.md` (Gotchas), `package.json`,
  `.gitignore`
- Delete: `scripts/setup-fonts.mjs`
- Test: `tests/e2e/browser.spec.ts`

**Interfaces:**
- Produces tokens used by later tasks: `--row-h: 38px`, `--favicon-size: 18px`,
  `--bg-menu`, `--bg-menu-hover`, `--border-menu`, `--shadow-menu`, `--bg-tile`,
  `--tile-min-w: 64px`, `--connector-w: 14px`, `--title-fade: 24px`,
  `--title-fade-hover: 44px`, `--folder-bar-w: 2px`.

- [ ] **Step 1: Write the failing e2e test** `the sidebar uses the system font and 38 px rows`:
  open one tab; assert `getComputedStyle(document.body).fontFamily` does not contain `Satoshi`
  and starts with `system-ui` or `-apple-system`; the tab row's `getBoundingClientRect().height`
  is `38`; the open + menu card's computed `backdrop-filter` is `none`.
- [ ] **Step 2: Run it** — `npx playwright test tests/e2e/browser.spec.ts -g "system font"`
  (after `npm run build`); expected FAIL (Satoshi in the stack, 34 px rows).
- [ ] **Step 3: Implement.** `--font-sans: system-ui, -apple-system, 'Segoe UI Variable',
  'Segoe UI', sans-serif`. Remove everything Satoshi: `@font-face`/preload, `setup:fonts`
  script and file, `.gitignore` entry, docs mentions (DESIGN §3.0 becomes "the platform's UI
  font; the font setting comes in plan 5"). Add the tokens above with these values —
  light: `--bg-menu #f7f7f8`, `--bg-menu-hover rgb(0 0 0 / 0.06)`, `--border-menu rgb(0 0 0 /
  0.08)`, `--shadow-menu 0 8px 24px rgb(0 0 0 / 0.14), 0 1px 3px rgb(0 0 0 / 0.08)`,
  `--bg-tile rgb(0 0 0 / 0.08)`; dark (`[data-scheme='dark']`): `--bg-menu #2b2b30`,
  `--bg-menu-hover rgb(255 255 255 / 0.08)`, `--border-menu rgb(255 255 255 / 0.08)`,
  `--shadow-menu 0 8px 24px rgb(0 0 0 / 0.5)`, `--bg-tile rgb(255 255 255 / 0.08)`. The popover
  card (`Popover.module.css`) and `Menu` use `--bg-menu` / `--border-menu` / `--shadow-menu`,
  drop `backdrop-filter`, `--glass-sheen` and the liquid-glass override. Favourite tiles use
  `--bg-tile` (replacing their raw rgb values). Rows use `--row-h`; favicons `--favicon-size`.
- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e`; expected all PASS (fix any e2e
  that measured 34 px rows).
- [ ] **Step 5: Commit** — `feat(theme): use the system font, bigger rows and opaque menus`.

### Task 2: Sidebar rows and layout

**Files:**
- Modify: `src/renderer/src/features/sidebar/Sidebar.tsx`, `Sidebar.module.css`, `TabRow.tsx`,
  `TabRow.module.css`, `FavoriteTiles.tsx`, `FavoriteTiles.module.css`, `docs/DESIGN.md`
  (browser sidebar section)
- Test: `tests/e2e/organisation.spec.ts`, `tests/e2e/finder.spec.ts` (drop the "sidebar's
  Search button" test)

**Interfaces:**
- Consumes: Task 1 tokens.

- [ ] **Step 1: Write the failing e2e tests** in `organisation.spec.ts`:
  - `a tab's close button only shows on hover`: the row's `Close tab` button has computed
    `opacity` `0`; after `hover()` on the row, `1`.
  - `long titles fade instead of ellipsing`: a tab titled with 80 characters; its title's
    computed `text-overflow` is `clip` and `mask-image` is not `none`.
  - `New tab sits right under the separator`: with two today tabs, `new-tab`'s top is greater
    than `today-header`'s bottom and less than the first `tab` row's top in `today`.
  - `Clear only shows while the separator is hovered`: `Clear` has `opacity` `0`; after hovering
    `today-header`, `1`.
  - `favourite tiles fill the width`: 3 favourites → same `top`, widths equal within 1 px, total
    span ≥ 90 % of the scroll area's width; 5 favourites → a second row exists (two distinct
    `top` values).
  - `no Search button at the top of the sidebar`: `getByRole('button', { name: 'Search' })` in
    the sidebar has count 0.
- [ ] **Step 2: Run them**; expected FAIL.
- [ ] **Step 3: Implement.** Title: `text-overflow: clip`, `mask-image:
  linear-gradient(to right, #000 calc(100% - var(--title-fade)), transparent)`; on row hover the
  fade width is `--title-fade-hover` and the × (opacity 0 → 1, `--dur-fast`) sits in that room;
  keyboard focus inside the row also shows it (`:focus-within`). Move the New tab button to the
  top of the today list (still `data-testid="new-tab"`, outside the drop list so drags are
  unchanged). `Clear` is opacity 0 unless `.separator:hover` or `:focus-visible`. Favourite tiles:
  `display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--tile-min-w), 1fr))`;
  compact keeps one column. Remove the Search button.
- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 5: Commit** — `feat(sidebar): fade long titles and tidy the today header`.

### Task 3: Stronger magnetic buttons, with a setting

**Files:**
- Modify: `src/shared/ipc/contract.ts` (settings schema), `src/core/settings/settingsStore.ts`
  (default), `src/renderer/src/theme/applyTheme.ts`, `src/renderer/src/ui/useMagnetic.ts`,
  `src/renderer/src/features/settings/panels.tsx`, `docs/DESIGN.md` (settings table)
- Test: `src/core/settings/settingsStore.test.ts`, `tests/e2e/browser.spec.ts`

**Interfaces:**
- Produces: setting `magneticButtons: boolean` (default `true`); `<html data-magnetic="on|off">`;
  `useMagnetic<T>(strength = 0.5)` unchanged signature.

- [ ] **Step 1: Write the failing tests.** Unit: a stored settings document without
  `magneticButtons` loads with `magneticButtons === true`. E2e `magnetic buttons follow the
  setting`: move the mouse over a space dot (off-centre) → its inline `translate` is not empty
  and its `scale` is `1.08`; set `magneticButtons: false` via `settings.update` → after a mouse
  move, `translate` and `scale` are empty.
- [ ] **Step 2: Run them**; expected FAIL.
- [ ] **Step 3: Implement.** `applyTheme` sets `data-magnetic`. `useMagnetic` returns early
  when `document.documentElement.dataset['magnetic'] === 'off'`; while hovered it sets
  `translate` (strength 0.5) and `scale: 1.08`, both cleared on leave (the existing
  `--dur-spring` transition springs back). A Switch "Magnetic buttons" in Appearance, under
  "Askew cards".
- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 5: Commit** — `feat(theme): stronger magnetic buttons with an off switch`.

### Task 4: Icon-only sidebar — widths, folder bars, window buttons

**Files:**
- Modify: `src/shared/ipc/contract.ts` (`SIDEBAR_*` constants, new command),
  `src/shared/ipc/channels.ts`, `src/main/index.ts` (handler), `src/main/windows/mainWindow.ts`
  (`setWindowControlsVisible`), `src/renderer/src/app/useSidebarResize.ts`,
  `src/renderer/src/app/Shell.tsx`, `Shell.module.css`, `src/renderer/src/features/sidebar/
  FolderRow.tsx`, `TabRow.tsx`, `TabRow.module.css`,
  `src/renderer/src/features/browser/AddressBar.module.css`, `docs/DESIGN.md`,
  `docs/ARCHITECTURE.md` (IPC table)
- Create: `src/renderer/src/features/sidebar/FolderTrailContext.ts`,
  `src/renderer/src/app/useSidebarResize.test.ts` (the existing `snapWidth` tests move here if
  they live elsewhere), `src/main/windows/mainWindow.test.ts`
- Test: `tests/e2e/browser.spec.ts`

**Interfaces:**
- Produces: `SIDEBAR_MIN = 48`, `SIDEBAR_COMPACT_MIN = 48`, `SIDEBAR_COMPACT_MAX = 72`,
  `SIDEBAR_COMPACT = 56` (default compact width), `SIDEBAR_COMPACT_FROM = 120`;
  `snapWidth(px: number): number`; command `window.setControlsVisible` `{ visible: boolean }` →
  `void`; `setWindowControlsVisible(win: BrowserWindow, visible: boolean, platform =
  process.platform): void`; `FolderTrailContext` = `React.Context<string[]>` (the hues of the
  folders a row sits in, outermost first).

- [ ] **Step 1: Write the failing unit tests.** `snapWidth`: `200 → 200`, `121 → 121`,
  `120 → 120`, `119 → 72`, `90 → 72`, `60 → 60`, `40 → 48`, `160 → 160`, `500 →
  SIDEBAR_MAX`. `setWindowControlsVisible`: with a fake window `{ setWindowButtonVisibility }`
  and platform `'darwin'` it is called with the value; with `'win32'` and `'linux'` it is not
  called and nothing throws.
- [ ] **Step 2: Run** `npx vitest run src/renderer/src/app/useSidebarResize.test.ts
  src/main/windows/mainWindow.test.ts`; expected FAIL.
- [ ] **Step 3: Implement.** `snapWidth`: `px >= SIDEBAR_COMPACT_FROM` → clamp to
  `[SIDEBAR_COMPACT_FROM, SIDEBAR_MAX]`; else clamp to `[SIDEBAR_COMPACT_MIN,
  SIDEBAR_COMPACT_MAX]`. `useSidebarResize` applies `snapWidth` to the saved width too (old
  stored values), and `compact` is `width < SIDEBAR_COMPACT_FROM`. Shell: while compact, call
  `window.setControlsVisible({ visible: false })`; a `no-drag` hot zone (top-left, 80 ×
  `--titlebar-h`) shows them on `pointerenter` and hides them on `pointerleave`; leaving compact
  shows them. Context bar on Windows: `padding-right` reserves the overlay's width with
  `env(titlebar-area-*)` (only under `[data-platform='win32']`). Folder bars: `FolderRow`
  provides `[...outer, hue]` (hue from the YAAS folder hash for real folders, from the host for
  automatic ones); in compact, `TabRow` draws one `--folder-bar-w` bar per entry on its left,
  each in `hsl(hue …)` via a token-based colour mix.
- [ ] **Step 4: Write the failing e2e test** `icon-only mode hides the window buttons and marks
  filed tabs`: stub `setWindowButtonVisibility` in main via `app.evaluate` to record calls; drag
  the sidebar to 90 px → width settles at 72 and the last recorded value is `false`; hover the
  top-left corner → `true`; drag to 40 → width 48; a tab inside a folder has one folder bar
  element (`data-testid="folder-bar"`), a today tab none; drag back to 300 → `true`.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 6: Commit** — `feat(sidebar): adjustable icon-only mode without window buttons`.

### Task 5: Menu cards — connector and exit animation

**Files:**
- Create: `src/renderer/src/ui/connector.ts`, `src/renderer/src/ui/connector.test.ts`
- Modify: `src/renderer/src/ui/Menu.tsx`, `Menu.module.css`, `Popover.module.css`,
  `src/renderer/src/features/browser/SiteMenu.tsx`, `SiteMenu.module.css`,
  `src/renderer/src/app/Overlay.tsx`, `src/renderer/src/features/finder/Picker.module.css`,
  `src/renderer/src/features/sidebar/Sidebar.module.css` (+ button open state),
  `src/renderer/src/features/browser/AddressBar.module.css` (site button open state),
  `docs/DESIGN.md` (popovers)
- Test: `tests/e2e/overlay.spec.ts`

**Interfaces:**
- Produces: `connectorLeft(anchor: PageBounds, cardLeft: number, cardWidth: number, radius:
  number, width: number): number` — the neck's left edge relative to the card;
  Overlay's close is now `close(): void` that marks the card `data-state="closing"`, invokes
  `overlay.close` after `EXIT_MS` (= 120, `--dur-fast`), and ignores repeated calls.

- [ ] **Step 1: Write the failing unit tests** for `connectorLeft`: button centred inside the
  card → neck centred on the button (`anchor.x + anchor.width/2 - cardLeft - width/2`); button
  left of the card's first `radius` px → clamped to `radius`; right of it → clamped to
  `cardWidth - radius - width`.
- [ ] **Step 2: Run** `npx vitest run src/renderer/src/ui/connector.test.ts`; expected FAIL.
- [ ] **Step 3: Implement** `connectorLeft`; `Menu` and `SiteMenu` render
  `<span className={popover.connector} data-testid="connector">` on the side facing the button
  (`placement`), `--connector-w` wide, `POPOVER_GAP` tall, card fill and border without the
  border on the card side. The opening buttons (+, site menu) use `--bg-menu` while
  `aria-expanded="true"`. Exit: cards (`Menu`, `SiteMenu`, `TabFinder`, `CommandField`) play
  a reverse of their `open` keyframes while `data-state="closing"`; the chosen item's action
  runs before the exit starts.
- [ ] **Step 4: Write the failing e2e tests** in `overlay.spec.ts`: `the + menu is joined to
  its button` — the connector's centre x is within 2 px of the + button's centre x, and its
  bottom touches the button's top within 1 px; `menus animate out` — press Escape in the + menu,
  then the menu immediately has `data-state="closing"`, then it is gone and the + button's
  `aria-expanded` is `false`.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 6: Commit** — `feat(renderer): join menus to their button and animate them out`.

### Task 6: Motion in the sidebar and cards

**Files:**
- Create: `src/renderer/src/ui/presence.ts`, `src/renderer/src/ui/presence.test.ts`,
  `src/renderer/src/ui/usePresence.ts`
- Modify: `src/renderer/src/features/sidebar/Sidebar.tsx` (`Rows`), `TabRow.tsx`,
  `TabRow.module.css`, `FolderRow.tsx`, `FolderRow.module.css`,
  `src/renderer/src/features/settings/SettingsView.tsx`, `SettingsView.module.css`,
  `docs/DESIGN.md` (motion)
- Test: `tests/e2e/organisation.spec.ts`

**Interfaces:**
- Produces: `type Present<T> = { item: T; exiting: boolean }`;
  `withPresence<T>(previous: Present<T>[], next: T[], key: (item: T) => string): Present<T>[]`
  — every item of `next` in its order, not exiting; each item of `previous` missing from `next`
  kept right after the item that preceded it in `previous` (or first), `exiting: true`;
  `usePresence<T>(items: T[], key, exitMs: number): Present<T>[]` drops exiting entries after
  `exitMs`.

- [ ] **Step 1: Write the failing unit tests** for `withPresence`: removal in the middle keeps
  the removed item at its place with `exiting`; two removals at once both kept, in order; an
  item that comes back is not exiting and not duplicated; additions appear in `next` order; an
  already-exiting item still missing stays once (no duplicates across calls).
- [ ] **Step 2: Run** `npx vitest run src/renderer/src/ui/presence.test.ts`; expected FAIL.
- [ ] **Step 3: Implement** `withPresence` and `usePresence` (timers per exiting key, cleared on
  unmount). `Rows` renders through `usePresence(nodes, nodeKey, 200)`; exiting tab rows get
  `data-testid="tab-exiting"` (not `tab`), `inert`, and an out animation (height and opacity to
  0, `--dur-base`); new rows animate in. Folders: children stay mounted when collapsed and
  animate height with the `grid-template-rows: 0fr ↔ 1fr` technique, `inert` while collapsed.
  Settings view: in/out like the cards (Task 5's closing pattern, local to the view).
- [ ] **Step 4: Write the failing e2e test** `closing a tab animates its row out`: close the
  second of three tabs → a `tab-exiting` row is present right after, then count 0; the `tab`
  rows read the two remaining titles throughout; collapsing a folder keeps its tab rows in the
  DOM but hidden from the accessibility tree.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS (existing tests
  count `tab` rows, which exclude exiting ones).
- [ ] **Step 6: Commit** — `feat(sidebar): animate rows, folders and settings in and out`.

### Task 7: Sliding tooltips

**Files:**
- Create: `src/renderer/src/features/sidebar/tooltip.ts`, `tooltip.test.ts`,
  `src/renderer/src/features/sidebar/useTooltip.ts`,
  `src/renderer/src/app/OverlayTooltip.tsx`, `OverlayTooltip.module.css`,
  `src/main/browser/overlayView.test.ts` (or extend an existing one)
- Modify: `src/shared/ipc/channels.ts`, `src/shared/ipc/contract.ts`, `src/main/index.ts`,
  `src/main/browser/overlayView.ts`, `src/renderer/src/app/Overlay.tsx`, `TabRow.tsx`,
  `FavoriteTiles.tsx`, `Sidebar.tsx`, `docs/ARCHITECTURE.md` (overlay modes, IPC),
  `docs/DESIGN.md` (tooltips)
- Test: `tests/e2e/organisation.spec.ts`

**Interfaces:**
- Produces: `tooltipSchema = z.object({ anchor: pageBoundsSchema, title: z.string(), detail:
  z.string() }).strict()`; command `overlay.tooltip` input `tooltipSchema.nullable()` output
  `void`; event `overlay.tooltip` same payload (to the overlay only);
  `OverlayView.tooltip(tooltip: Tooltip | null): void` — ignored while a popover is open;
  shows the view sized to a strip `TOOLTIP_STRIP_W = 320` px wide starting at the anchor's
  right edge, full height, **never focused**; `null` emits `null` then hides after 150 ms unless
  a tooltip or popover came meanwhile. Opening a popover replaces any tooltip.
  Renderer state machine in `tooltip.ts`:
  `type TooltipState = { shown: Tooltip | null; pending: Tooltip | null }`;
  `tooltipReducer(state, event)` with events `{ type: 'enter', tooltip }`, `{ type: 'delay' }`
  (500 ms after the first `enter`), `{ type: 'leave' }`, `{ type: 'press' }` (pointer down /
  drag start); returns the next state — while shown, `enter` replaces `shown` at once (slide);
  while not shown, `enter` sets `pending` and `delay` promotes it; `leave` and `press` clear both.

- [ ] **Step 1: Write the failing unit tests.** `tooltipReducer`: enter then delay → shown;
  enter, enter (other row), delay → shown is the second; shown + enter → shown replaced, no
  pending; leave → both null; press while shown → both null. `OverlayView.tooltip` (with a fake
  `WebContentsView`/window as the existing pattern allows, else extract the decision into a pure
  `tooltipBounds(anchor, windowSize)` and test that): bounds start at `anchor.x +
  anchor.width`, width 320 clamped to the window, full height; ignored when a popover is open.
- [ ] **Step 2: Run** the new unit tests; expected FAIL.
- [ ] **Step 3: Implement.** `useTooltip()` in the sidebar drives the reducer and sends
  `overlay.tooltip` on `shown` changes; rows call `onPointerEnter` with `{ title, detail: host }`
  and the sidebar `nav` sends `leave` on `pointerleave`. Remove native `title` on tab rows and
  tiles. `OverlayTooltip` draws one card (same `--bg-menu`, `--shadow-menu`) whose `top` follows
  the anchor's vertical centre with a `--dur-base` transition (the slide), fades in on first
  show and out on `null`. In tooltip mode the overlay page sends `overlay.tooltip(null)` on its
  first `pointermove` so the page under the strip gets the next click.
- [ ] **Step 4: Write the failing e2e test** `tooltips slide from row to row`: hover tab A
  600 ms → the overlay's `tooltip` shows A's title and host; hover tab B → the same element
  (`data-testid="tooltip"`, a `data-key` set once at mount) now shows B without disappearing
  in between (poll its count stays 1); move the mouse onto the page and click a link in the
  fixture page → the page navigates (click not swallowed); open the + menu while hovering a tab
  → no tooltip shows.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 6: Commit** — `feat(sidebar): add sliding tooltips over the page`.

### Task 8: Docs and handoff

**Files:**
- Modify: `HANDOFF.md` (next steps: plan 3b-A done → write and follow 3b-B, then plan 4),
  `docs/DESIGN.md` (check every token and behaviour added above is listed),
  `docs/superpowers/specs/2026-11-20-big-browser-design.md` (§5.1: menus opaque white/grey, not glass;
  plan list gains 3b)

- [ ] **Step 1:** Update the three docs.
- [ ] **Step 2:** Run `npm run check`; expected PASS.
- [ ] **Step 3: Commit** — `docs: record plan 3b-A in the handoff and the design`.
