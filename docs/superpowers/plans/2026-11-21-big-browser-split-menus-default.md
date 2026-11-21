# Big Browser plan 4: split screen, richer menus, default browser — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** a persistent two-page split screen kept as one sidebar row, right-click menus with an icon
on every row and the options of a real browser, and Big Browser as the system's default browser.

**Architecture:** the split is a model rule in `core/` (the second tab points at the first with
`tabs.split_of`, migration 8); main shows two `WebContentsView`s side by side; the renderer draws one
row and a divider through `useWorkspace()`. Menus extend the existing builders (`pageMenu`,
`sidebarMenus`, `MenuItemDef` with Phosphor icon names). Default browser is main-only plus a
Settings row.

**Tech stack:** Electron 45, React 19 + Zustand, zod, `node:sqlite`, Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-21-big-browser-split-menus-default-design.md`](../specs/2026-11-21-big-browser-split-menus-default-design.md)
(approved). Also obey `CLAUDE.md`.

## Global constraints

- Branch `feat/split-menus-default`, cut from `feat/sidebar-structure`. Claude never pushes.
- `npm run check` after every task; also `npm run test:e2e`. On this Windows machine:
  `cli.test.ts` findCli fails (pre-existing); e2e "reopen closed tab" and two tooltip tests fail
  even on old commits (environmental); other parallel-load failures pass alone (`--workers=1`).
- CSS: design tokens only; new tokens in `tokens.css` **and** `docs/DESIGN.md` §3.
- Menus stay owned by main (`MenuRegistry`), drawn in the overlay; opaque cards, no blur.
- **Every menu row has an icon** (Phosphor name in `MenuSpecItem.icon`, or an extension's data URL).
- IPC additions follow CLAUDE.md rule 3. Components get data only from `useWorkspace()`.
- Never two files whose names differ only by case. Keep LF.
- Never a code path that calls a model. English UI strings.

## Decisions made for this plan [Claude's calls within the spec]

- **Migration 8:** `tabs.split_of TEXT NULL REFERENCES tabs(id) ON DELETE SET NULL`,
  `tabs.split_ratio REAL NULL` (on the first tab; null = 0.5). The second tab's `section`,
  `folder_id`, `parent_id` mirror the first's; its `position` is ignored and it is left out of every
  list (`visibleOrder`, `listLength`, sidebar nodes). Ratio clamped to **0.25–0.75**.
- **Store API:** `splitTabs(firstId, secondId)` (same space; neither already split; second taken out
  of its list), `separate(firstId)` (second goes right after the first in the same list),
  `setSplitRatio(firstId, ratio)`. `moveTab` of either moves the pair; `closeTab`/`removeTab` of
  one half separates first (the other stays where the row was); `activateTab` of either half keeps
  the pair shown and records which half is active (`spaces.active_tab_id` = that half).
- **Model:** `BrowserTab.splitOf: string | null`, `BrowserTab.splitRatio: number | null`.
  `SidebarNode` gains `{ kind: 'split'; first: TabView; second: TabView; ratio: number; depth }`.
- **Display:** page bounds split at `ratio`, with a `--split-gap` (= `--frame-gap`) gap where the UI
  draws a divider (`data-testid="split-divider"`); dragging it sends `browser.setSplitRatio`. A
  click in a page (`webContents` `focus`) activates that half.
- **Creating:** ⌃⌘\ and the + menu's "Split View" split the active tab with the next row of its list
  (else the previous); "Open in Split View" (tab menu) splits with the active tab; "Open Link in
  Split View" opens the link as the second half of the shown tab; dropping a tab on the shown tab's
  row (middle half) splits them. "Separate" in the split row's menu.
- **Icons:** Phosphor names, one per row, listed in each task.
- **Default browser:** `app.setAsDefaultProtocolClient` for `http`/`https` when the user clicks;
  `app.isDefaultProtocolClient('https')` for the status; electron-builder `protocols` for both
  schemes; macOS `open-url`, Windows `second-instance` + launch argv; on Windows "Make default"
  opens `ms-settings:defaultapps` after registering.

## Review focus

1. **Closing the shown half, or the whole space, of a split** — the other half stays as a normal
   tab in the row's place, never lost or duplicated. Test: Task 1 unit.
2. **Moving or dragging a split row into a folder, pinned or today** — both tabs move, one row.
   Test: Task 1 unit + Task 3 e2e.
3. **A link from another app while Big Browser is closed, or while it runs** — it opens once, in
   the active space, never in a second instance. Test: Task 6 unit (argv/URL parsing) + e2e.
4. **A menu row's action on a tab or page that went away** — no error (registry swallows
   `not_found`; page actions guard `isDestroyed`). Test: Task 4/5 unit.
5. **Old databases** — migration 8 on a v7 database keeps every tab unsplit. Test: Task 1 unit.

---

### Task 1: Split model (store, migration, IPC)

**Files:** `src/core/store/database.ts` (+test), `src/core/browser/browserStore.ts` (+test),
`src/shared/model.ts`, `src/shared/ipc/channels.ts`, `contract.ts` (+test), `src/main/index.ts`,
`src/renderer/src/features/workspace/workspace.ts` (+test), `docs/ARCHITECTURE.md`

**Interfaces:**
- Produces: migration 8 and the store API / model fields above; commands `browser.splitTabs
  { firstId, secondId }`, `browser.separate { tabId }`, `browser.setSplitRatio { tabId, ratio }`
  (0.25–0.75); `SidebarNode` kind `split`; `BrowserView.activeSplit: { first; second; ratio;
  activeHalf: 'first' | 'second' } | null`.

- [ ] **Step 1: Failing unit tests:** split then snapshot → second has `splitOf`, is out of its
  list (positions closed); moveTab of the second moves the pair; close of the first → second takes
  the row's place, no split left; separate → second right after first; ratio clamped; splitting a
  tab already split or across spaces throws `invalid_move`; v7→v8 migration keeps rows; workspace:
  a split yields one `split` node with both views; `activeSplit` follows the active half.
- [ ] **Step 2: Run** `npx vitest run src/core src/renderer/src/features/workspace src/shared`;
  expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e`; expected PASS (known exceptions only).
- [ ] **Step 5: Commit** — `feat(core): pair two tabs as a split`.

### Task 2: Two pages on screen

**Files:** `src/main/browser/tabViews.ts` (+test where a seam exists), `src/main/index.ts`,
`src/renderer/src/features/browser/PageSlot.tsx` (+css), `src/renderer/src/theme/tokens.css`,
`docs/DESIGN.md`, `docs/ARCHITECTURE.md`
**Interfaces:** consumes Task 1. Produces: `splitBounds(bounds, ratio, gap): { first: Rect;
second: Rect }` (pure, in `src/core/browser/splitBounds.ts`); the divider in PageSlot.

- [ ] **Step 1: Failing unit tests** for `splitBounds`: 1000 px wide, ratio 0.5, gap 5 → first
  width 497/498, second starts after the gap, heights equal, rounded to integers, widths ≥ 0.
- [ ] **Step 2: Run** them; FAIL.
- [ ] **Step 3: Implement.** TabViews shows both views of the active split (raise the overlay
  after), focus in a page activates that half, the divider drag sends `browser.setSplitRatio`
  (one IPC per drag end, live preview locally).
- [ ] **Step 4: Failing e2e** `a split shows two pages`: split two fixture tabs via IPC → two views
  shown side by side (main's view bounds), the divider exists; drag it → ratio stored; click the
  right page → address bar shows the right page's URL.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; PASS.
- [ ] **Step 6: Commit** — `feat(main): show both pages of a split`.

### Task 3: The split row and creating a split

**Files:** `src/renderer/src/features/sidebar/SplitRow.tsx` (+css), `SidebarRows.tsx`,
`useTabDrag.ts` (+test), `src/main/browser/sidebarMenus.ts` (+test), `src/main/menu.ts`
(⌃⌘\ accelerator), `src/renderer/src/app/Overlay.tsx` (+ menu "Split View"), `docs/DESIGN.md`
**Interfaces:** consumes Tasks 1–2.

- [ ] **Step 1: Failing tests:** unit — dropping a tab on the shown tab's row middle targets
  `splitTabs`; a split row drags as one; split menu has Separate. E2e — `a split is one row`:
  ⌃⌘\ with two tabs → one `data-testid="split-row"` with both titles, `tab` count drops by one;
  drag the row into a folder → both tabs in it; Separate → two rows; relaunch keeps a split.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement** (row: two favicons + "Title A | Title B",
  clicking a half's title activates it; icon-only: the two favicons stacked).
- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e`; PASS.
- [ ] **Step 5: Commit** — `feat(sidebar): keep a split as one row`.

### Task 4: The page's right-click menu, complete and with icons

**Files:** `src/core/browser/pageMenu.ts` (+test), `src/main/browser/tabViews.ts`,
`src/main/menus/fromElectron.ts` (if needed), `docs/DESIGN.md`
**Interfaces:** consumes Task 1's split commands ("Open Link in Split View").

- [ ] **Step 1: Failing unit tests** for `pageMenu`: link → the 7 link rows (mailto adds Copy Email
  Address, non-web hides Open/Download); image → 4 rows; video → 6 rows, audio without Picture in
  Picture; selection that is a URL → Go to first; editable → suggestions, Add to Dictionary, Cut,
  Copy, Paste, Paste and Match Style, Select All; blank page → Back, Forward, Reload, Copy Page URL,
  Save Page As…, Print…, View Page Source; Inspect last; **every entry has an icon**.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement** (icons e.g. ArrowSquareOut, Columns, LinkSimple,
  DownloadSimple, ShareNetwork, Envelope, Image, Copy, Repeat, PictureInPicture, MagnifyingGlass,
  Scissors, Clipboard, TextAa, ArrowLeft, ArrowRight, ArrowClockwise, FloppyDisk, Printer, Code,
  Wrench; add them to the renderer's name→icon map).
- [ ] **Step 4: E2e** `the page menu fits what was clicked`: right-click a fixture link → rows with
  icons incl. Open Link in Split View (choosing it makes a split); right-click blank → Copy Page URL
  copies the URL.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; PASS.
- [ ] **Step 6: Commit** — `feat(main): a complete page menu with icons`.

### Task 5: Sidebar menus with icons and more options

**Files:** `src/main/browser/sidebarMenus.ts` (+test), `src/core/browser/browserStore.ts` (Close
Tabs Below, Open All), `src/main/browser/tabViews.ts` (mute), contract/channels if a command is
added, `docs/DESIGN.md`

- [ ] **Step 1: Failing unit tests:** tab menu rows in order — Reload, Duplicate, Mute/Unmute,
  Open in Split View (or Separate on a split), Copy Link, separator, Pin/Unpin, Add to/Remove from
  Favourites, Move to Folder, separator, Close Tabs Below, Close/Remove — each with an icon; folder
  menu — Rename, Change Icon…, Move to Folder, Open All, separator, Delete Folder — each with an
  icon; space menu rows get icons too; Close Tabs Below closes the today tabs drawn after it (its
  subtree first) and is disabled when none.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement.**
- [ ] **Step 4: E2e** `the tab menu has icons`: every menuitem in the drawn tab menu contains an
  icon element; Mute toggles `webContents.isAudioMuted()`.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; PASS.
- [ ] **Step 6: Commit** — `feat(sidebar): richer tab and folder menus with icons`.

### Task 6: Default browser

**Files:** `src/main/defaultBrowser.ts` (+test), `src/main/index.ts`, `electron-builder.yml`,
contract/channels (`app.defaultBrowser` → `{ isDefault: boolean }`, `app.makeDefaultBrowser`),
`src/renderer/src/features/settings/panels.tsx`, `docs/ARCHITECTURE.md`

- [ ] **Step 1: Failing unit tests:** `urlFromArgv(argv)` returns the first http(s) argument (never
  a flag or file path); `openExternalUrl` opens a today tab in the active space and focuses the
  window; non-web URLs are ignored.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement** (single-instance lock already exists: handle
  `second-instance` argv and macOS `open-url`, queue URLs that arrive before the window exists).
- [ ] **Step 4: E2e** `a link from outside opens a tab`: launch with a fixture URL in argv → one
  new today tab with it; Settings → General shows the default-browser row.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; PASS.
- [ ] **Step 6: Commit** — `feat(main): open links from other apps as the default browser`.

### Task 7: Docs and handoff

**Files:** `HANDOFF.md` (plan 4 done → next: plan 5 settings), `docs/DESIGN.md`,
`docs/ARCHITECTURE.md`, `docs/superpowers/specs/2026-11-20-big-browser-design.md` (plan 4 =
split, menus, default browser; several windows dropped by the owner).

- [ ] **Step 1:** Update the docs; add hand checks (split with a real mouse, default browser on
  each OS). **Step 2:** `npm run check`. **Step 3: Commit** — `docs: record plan 4`.
