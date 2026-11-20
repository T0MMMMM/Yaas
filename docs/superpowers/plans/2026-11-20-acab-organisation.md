# ACAB organisation — implementation plan (step 1, plan 3 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** organise tabs like Arc/yab: favourite tiles, pinned tabs, folders, nested tabs,
automatic folders for tabs of the same site, an icon-only sidebar, the ⌘K tab finder, the ⌘T
field over the page, reopening closed tabs, the full + menu and real favicons.

**Architecture:** the model grows in `src/core/browser/` (migration 4: folders, and per-tab
`section`, `folderId`, `parentId`); every rule (ordering, moves, close behaviour, undo) is a
`BrowserStore` method with unit tests. Main exposes them as IPC commands and shows the tab's
right-click menu natively. The renderer derives the sidebar tree — including the automatic
same-site folders, which are **derived, never stored** — in the workspace module
(`useWorkspace()`, rule 7). Floating UI (⌘K, ⌘T) uses plan 2's overlay view.

**Tech stack:** Electron 45, React 19 + Zustand, `node:sqlite`, zod, Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-20-acab-design.md`](../specs/2026-11-20-acab-design.md)
(§5.1 day-one list, "Browser chrome", "Menus and settings" → + menu, "Added by the owner" →
automatic folders, icon-only sidebar). Plan 1 deferred real favicons here. Also obey `CLAUDE.md`.

## Global constraints

- Branch `feat/acab-organisation` cut from `feat/acab-extensions`. Claude never pushes.
- `npm run check` after every task; UI tasks also `npm run test:e2e`.
- Layering and IPC rules of `CLAUDE.md` (rules 2, 3); renderer components get spaces, tabs,
  folders and the sidebar tree only from `useWorkspace()` (rule 7).
- Security defaults stay on; the overlay is the only place UI floats over the page.
- CSS: design tokens only; askew-card motion follows the `askewCards` setting.
- Migrations are append-only (`database.ts`); existing tabs migrate to section `'today'`.
- Every user-visible string in English.

## Decisions made for this plan [Claude's calls — the spec left them open]

- **Sections of a space:** `favorites` (tiles at the top), `pinned` (pinned tabs and folders),
  `today` (the rest). Favourites and pins are per space.
- **Closing a favourite or pinned tab** unloads it (its view is destroyed, the entry stays,
  shown dimmed like a restored tab). "Remove" in its menu deletes it. Closing a today tab
  deletes it.
- **Folders** live in the pinned section, can nest one level of tabs, are collapsible and
  renamable. Folders and top-level pinned tabs share one ordering.
- **Nested tabs:** a tab opened from another tab (popup, `target=_blank`, "Open Link in New
  Tab") gets `parentId` = opener and is drawn indented under it (depth capped at 3 levels of
  indent). Closing a parent re-parents its children to the parent's parent.
- **Automatic folders** [spec: open for plan 3]: in the today section, **3 or more top-level
  tabs with the same host** (`www.` stripped) are drawn as a folder named after the host, at the
  position of the first of them. Derived in the renderer, never stored; setting `autoFolders`
  (default on) turns it off; collapsed state is per host in the UI store.
- **Undo:** `⌘⇧T` reopens the last closed tab (menu accelerator, works over pages). `⌘Z`
  does the same only when the UI has focus and no text field is focused; in pages and fields
  ⌘Z stays the normal undo. The undo stack is in memory, 20 entries.
- **⌘T** opens the command field over the page instead of a blank tab; a tab is created only
  when the user submits. **⌘L** still focuses the address bar.
- **Icon-only sidebar:** dragging the sidebar narrower than `SIDEBAR_COMPACT_FROM` = 160 px
  snaps it to `SIDEBAR_COMPACT` = 56 px, showing only favicons (tooltips with titles); dragging
  past 160 px restores the normal layout. `SIDEBAR_MIN` becomes 56.
- **Favicons:** main fetches the page's favicon through the tab's session and stores it as a
  `data:` URL (max 64 KB, else none) — the UI CSP stays as it is.

## Review focus

1. **Closing the active tab inside a folder or under a parent** — the next active tab follows
   the visible order (neighbour below, else above, in the drawn tree). Test: Task 1 unit.
2. **Moving a tab into a collapsed folder / out of a folder that becomes empty** — the folder
   stays (empty folders are allowed) and positions stay contiguous. Test: Task 1 unit.
3. **Reopen after the space was deleted or the tab's folder was removed** — the tab comes back
   in the active space's today section, never errors. Test: Task 1 unit.
4. **A huge or non-image favicon response** — ignored, no crash, no oversized row. Test: Task 2
   unit for `faviconDataUrl` (size cap, content type check).
5. **Typing in the address bar or a page field then pressing ⌘Z** — text undo, never reopening a
   tab. Test: Task 6 e2e.

---

### Task 1: Model — sections, folders, nested tabs, close and undo rules

**Files:**
- Modify: `src/core/store/database.ts` (migration 4), `src/core/browser/browserStore.ts`,
  `src/core/browser/browserStore.test.ts`, `src/shared/model.ts`
- Create: `src/core/browser/undoStack.ts` (+ test)

**Interfaces (produced):**
- Migration 4: `CREATE TABLE folders (id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES
  spaces(id) ON DELETE CASCADE, name TEXT NOT NULL, position INTEGER NOT NULL, collapsed
  INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`; `ALTER TABLE tabs ADD COLUMN section
  TEXT NOT NULL DEFAULT 'today'`, `folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL`,
  `parent_id TEXT`, `loaded` is **not** stored.
- `model.ts`: `type TabSection = 'favorites' | 'pinned' | 'today'`; `BrowserTab` gains
  `section: TabSection; folderId: string | null; parentId: string | null`;
  `BrowserFolder { id; spaceId; name; position; collapsed: boolean }`;
  `BrowserSnapshot.folders: BrowserFolder[]` (by space then position); `ClosedTab` (what undo
  needs: spaceId, url, title, section, folderId, parentId, position).
- `BrowserStore` methods:
  - `openTab(spaceId, url, options?: { activate?: boolean; parentId?: string })` — a tab with
    a parent goes right after the parent's last descendant, same section/folder as the parent
    only if the parent is in today (children of pinned/favourite tabs go to today, top).
  - `closeTab(id): 'deleted' | 'unloaded'` — favourite/pinned → `'unloaded'` (entry kept;
    store emits so main destroys the view); today → deleted, children re-parented, pushed on
    the undo stack. Next active = next tab in **visible order** (see `visibleOrder` below),
    else previous, else null.
  - `removeTab(id)` — deletes whatever the section (pushes undo).
  - `moveTab(id, to: { section: TabSection; folderId?: string | null; index: number })` —
    reorders contiguous positions in source and target lists; moving out of today clears
    `parentId` and re-parents its children.
  - `createFolder(spaceId, name): BrowserFolder` (end of pinned), `renameFolder(id, name)`,
    `setFolderCollapsed(id, collapsed)`, `deleteFolder(id)` (its tabs are deleted and pushed on
    the undo stack as one entry).
  - `reopenClosed(): BrowserTab | null` — pops the undo stack; restores in the original space,
    section, folder and position when they still exist, else in the active space's today
    section at the end; activates it.
  - `visibleOrder(spaceId): string[]` — tab ids in drawn order: favourites, then pinned
    (folders and top-level pinned tabs interleaved by their shared position, each folder's tabs
    in order), then today in depth-first parent/child order. Used by `closeTab`; the renderer
    has its own derivation (Task 3), which must agree with it (auto folders aside).
- `UndoStack<T>`: `push(entry: T)`, `pop(): T | undefined`, capacity 20 (oldest dropped).

- [ ] **Step 1: Failing unit tests** in `browserStore.test.ts` (one `it` each): migration from
  a plan-1 database keeps tabs in `today`; `openTab` with `parentId` lands after the parent's
  last descendant; closing a pinned tab returns `'unloaded'` and keeps it; closing a today tab
  re-parents its children; next active follows visible order inside a folder (pinned: folder[b, c], then pinned d;
  activate b, close b → c; activate c, close c → d); `moveTab`
  into a folder keeps positions 0..n-1 in both lists; a folder emptied by a move stays;
  `deleteFolder` then `reopenClosed` brings back its tabs; `reopenClosed` after the tab's folder
  was deleted restores into the active space's today; `reopenClosed` on an empty stack → null.
  `undoStack.test.ts`: capacity 20, LIFO.
- [ ] **Step 2: Run** `npx vitest run src/core/browser` → FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** → PASS; `npm run check` → PASS (fix the
  renderer/main type errors the new fields cause with the smallest change; UI comes in Task 3).
- [ ] **Step 5: Commit** `feat(core): add folders, sections, nested tabs and reopen`

### Task 2: Main — commands, tab menu, unload, opener, favicons, reopen shortcut

**Files:**
- Create: `src/core/browser/favicon.ts` (+ test)
- Modify: `src/shared/ipc/channels.ts`, `contract.ts` (+ test), `src/main/index.ts`,
  `src/main/browser/tabViews.ts`, `src/main/menu.ts`, `tests/e2e/browser.spec.ts`,
  `docs/ARCHITECTURE.md` §11

**Interfaces:**
- IPC commands (zod-validated, `.strict()`): `browser.removeTab {tabId}`, `browser.moveTab
  {tabId, section, folderId?: string|null, index: int ≥ 0}`, `browser.createFolder {spaceId?,
  name}` → `BrowserFolder`, `browser.renameFolder {folderId, name (1..80 chars)}`,
  `browser.setFolderCollapsed {folderId, collapsed}`, `browser.deleteFolder {folderId}`,
  `browser.reopenClosed` void, `browser.showTabMenu {tabId}` (native context menu popped by
  main), `browser.showFolderMenu {folderId}`.
- Tab menu items: Pin / Unpin (moves to pinned end / today top), Add to Favourites / Remove
  from Favourites, Move to Folder ▸ (folders of the space + "New Folder…"), Copy Link,
  Duplicate, separator, Remove (pinned/favourite) or Close (today). Folder menu: Rename (emits
  `browser.shortcut` `'rename-folder:<id>'` — extend the event enum to an object
  `{ kind: 'rename-folder', folderId }` alongside the existing string kinds), Delete Folder.
- `TabViews`: the store's `'unloaded'` result destroys the view; runtime gains `loaded: boolean`
  (false for tabs without a view) so the sidebar can dim them; opener: `setWindowOpenHandler`
  and "Open Link in New Tab" pass `parentId` = the opener tab.
- Favicons: `faviconDataUrl(contentType: string, bytes: Uint8Array): string | null` in core —
  only `image/*`, ≤ 64 KB, else null. Main fetches `favicons[0]` with `session.fetch` on
  `page-favicon-updated` and stores the data URL; on failure stores null.
- Menu: `Reopen Closed Tab` `CmdOrCtrl+Shift+T` → `reopenClosed`. `New Tab` `CmdOrCtrl+T` now
  emits `browser.shortcut` `'command'` (Task 6 opens the field; until then it keeps today's
  behaviour by opening a blank tab when the UI doesn't handle it — implement the emit only in
  Task 6).

- [ ] **Step 1: Unit tests** `favicon.test.ts`: png ≤ 64 KB → `data:image/png;base64,…`;
  `text/html` → null; 65 KB → null. Contract tests for each new command (one accept, one
  reject).
- [ ] **Step 2: Failing e2e** in `browser.spec.ts`: `closing a pinned tab unloads it` (pin via
  `browser.moveTab`, close via ⌘W; the tab row stays, `data-loaded="false"`); `reopen closed
  tab` (close a today tab, press ⌘⇧T, it is back with its URL); `a link opened in a new tab is
  nested` (fixture page with `target=_blank` link → new tab's `parentId` equals the opener in
  `browser.state`); `favicons are fetched` (fixture serves `/favicon.png`; tab's `faviconUrl`
  starts with `data:image/png`).
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** **Step 5: Run** check + e2e → PASS.
- [ ] **Step 6: Docs** ARCHITECTURE §11 (sections, unload, undo, favicons). **Commit**
  `feat(main): add tab menu, folders, reopen and favicons`

### Task 3: Sidebar — favourites, pinned, folders, nested and automatic folders

**Files:**
- Modify: `src/renderer/src/features/workspace/workspace.ts` (+ test), `useWorkspace.ts`,
  `src/renderer/src/features/sidebar/Sidebar.tsx`, `Sidebar.module.css`,
  `src/shared/ipc/contract.ts` + `settingsStore.ts` (setting `autoFolders: boolean`, default
  `true`), `src/renderer/src/features/settings/panels.tsx` (Appearance → "Automatic folders"
  switch), `src/renderer/src/stores/ui.ts` (collapsed auto folders by host), `docs/DESIGN.md`
- Create: `src/renderer/src/features/sidebar/TabRow.tsx`, `FolderRow.tsx`,
  `FavoriteTiles.tsx` (+ CSS modules)

**Interfaces:**
- `workspace.ts`: `type SidebarNode = { kind: 'tab'; tab; depth: number } | { kind: 'folder';
  folder: BrowserFolder; children: SidebarNode[] } | { kind: 'auto-folder'; host: string;
  children: SidebarNode[] }`; `sidebarSections(state: BrowserState, space: string, opts: {
  autoFolders: boolean }): { favorites: BrowserTab[]; pinned: SidebarNode[]; today:
  SidebarNode[] }` — auto folders per the plan's decision (≥ 3 top-level today tabs, same host,
  `www.` stripped, at the first one's position; their children keep their nesting).
- Rows: right-click → `browser.showTabMenu` / `showFolderMenu`; folder click toggles collapse;
  favourite tiles are a 4-column grid of large favicons with the active one highlighted;
  unloaded tabs dimmed (`runtime.loaded === false`); nested rows indented by
  `--space-3` per depth (max 3).
- Section headers: none for favourites; a thin separator between pinned and today with
  "Clear" on the right (closes all today tabs, undoable one by one via ⌘⇧T).

- [ ] **Step 1: Unit tests** for `sidebarSections` in `workspace.test.ts`: favourites first;
  folder children ordered; nested depth; 3 tabs same host → one auto folder, 2 → none;
  `www.a.com` and `a.com` group together; `autoFolders: false` → none; auto folder sits where
  its first tab was.
- [ ] **Step 2: Failing e2e** `tests/e2e/organisation.spec.ts`: pin a tab by calling
  `browser.moveTab` from the UI page (native context menus can't be clicked from Playwright) and
  assert the row moved into the pinned list `data-testid="pinned"`; create a
  folder via `browser.createFolder`, move a tab in, collapse it by clicking the folder row → the
  tab row is hidden; open 3 fixture tabs on the same host → an `auto-folder` row with the host
  name; turn the setting off → rows back at top level.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** **Step 5: Run** check + e2e → PASS.
- [ ] **Step 6: Docs** DESIGN.md sidebar section. **Commit**
  `feat(sidebar): add favourites, pinned tabs, folders and nesting`

### Task 4: Drag and drop

**Files:** Create `src/renderer/src/features/sidebar/useTabDrag.ts` (+ test for its pure
drop-target maths); modify `TabRow.tsx`, `FolderRow.tsx`, `FavoriteTiles.tsx`, `Sidebar.tsx`,
`Sidebar.module.css`; e2e in `organisation.spec.ts`.

**Interfaces:** `dropTarget(pointerY: number, rows: Array<{ id: string; kind: 'tab' |
'folder'; section: TabSection; folderId: string | null; top: number; height: number }>):
{ section; folderId: string | null; index: number } | null` — upper half of a row = before it,
lower half = after; the middle 50 % of a folder row = into the folder (end); a drop on the
tiles grid = favourites at the end. Dragging calls `browser.moveTab` on drop; a 2 px accent
line shows the insertion point (`--accent`), the dragged row at 50 % opacity. Auto-folder rows
are not drop targets (their tabs are plain today tabs).

- [ ] **Step 1: Unit tests** for `dropTarget` (before/after/into-folder/empty list/tiles).
- [ ] **Step 2: Failing e2e**: drag the first today tab onto the pinned list (Playwright
  `dragTo`) → it is in `pinned`; drag a tab into a folder row's middle → its `folderId` set.
- [ ] **Step 3–5:** implement, run check + e2e. **Commit**
  `feat(sidebar): drag tabs to reorder, pin and file them`

### Task 5: Icon-only sidebar

**Files:** modify `src/shared/ipc/contract.ts` (`SIDEBAR_MIN` = 56, new `SIDEBAR_COMPACT` =
56 and `SIDEBAR_COMPACT_FROM` = 160) + test, `src/renderer/src/app/useSidebarResize.ts` (+
test), `Sidebar.tsx` (`data-compact`), CSS, `docs/DESIGN.md`.

**Interfaces:** `snapWidth(px: number): number` — `< 160` → 56, else clamp to
[160, `SIDEBAR_MAX`]. Compact mode: favicons only (tiles become a single column), folders show
their icon and expand inline, spaces dots stack vertically, address-bar-less rows get `title`
tooltips; the + and search buttons become icons.

- [ ] **Step 1: Unit tests** `snapWidth(100)` → 56, `snapWidth(159)` → 56, `snapWidth(160)` →
  160, `snapWidth(10_000)` → `SIDEBAR_MAX`. **Step 2: Failing e2e**: drag the resizer to x=80 →
  sidebar width 56 and `data-compact="true"`; drag back to 300 → normal. **Steps 3–5**:
  implement, check + e2e. **Commit** `feat(sidebar): snap to an icon-only sidebar when narrow`

### Task 6: ⌘K tab finder, ⌘T field, + menu, ⌘Z

**Files:**
- Create: `src/renderer/src/features/finder/TabFinder.tsx`, `CommandField.tsx`,
  `finder.ts` (+ test) and CSS modules; `tests/e2e/finder.spec.ts`
- Modify: `src/shared/ipc/contract.ts` (overlay kinds `'tab-finder' | 'command'`, the
  shortcut `'command'` and `'tab-finder'`), `src/main/menu.ts` (`Find Tab…`
  `CmdOrCtrl+K`; `New Tab` emits `'command'`), `src/main/index.ts`, `Overlay.tsx`,
  `Sidebar.tsx` (Search button opens the finder; + menu gains a filter field at the top and
  "New Folder"), `src/renderer/src/app/Shell.tsx` (⌘Z handler: only when
  `document.activeElement` is not an input/textarea/contenteditable → `browser.reopenClosed`),
  `docs/DESIGN.md` (shortcuts table)

**Interfaces:**
- `finder.ts`: `rankTabs(query: string, tabs: Array<{ id; title; url; spaceName }>):
  Array<{ id; score }>` — case-insensitive; every query word must match title or host+path;
  title-start matches rank first, then title, then URL; empty query → current space's tabs in
  visible order. `commandSuggestions(query, tabs)`: first entry "Go to <url>" when
  `resolveInput` yields a non-search URL, else "Search Google for "<query>"", then up to 6
  matching open tabs ("Switch to tab").
- Both open in the overlay as a centred card (width 560 px token) 20 % from the top; ↑/↓ move,
  Enter runs, Escape closes. The finder activates the tab (switching space). The command field
  opens a new tab with `browser.openTab { input }` or switches to the tab.

- [ ] **Step 1: Unit tests** for `rankTabs` (word AND, title-start first, host match, empty
  query) and `commandSuggestions` (URL vs search first line, tab matches capped at 6).
- [ ] **Step 2: Failing e2e** `finder.spec.ts`: ⌘K → type part of a fixture tab title → Enter
  activates it; ⌘T → type a fixture URL → Enter opens it in a new tab; ⌘T → Escape → no new tab;
  close a tab, focus the sidebar, press ⌘Z → it is back; focus the address bar, type, press ⌘Z
  → no tab reopened (tab count unchanged).
- [ ] **Step 3–5:** implement, check + e2e. **Step 6:** HANDOFF "Next steps" → plan 4.
  **Commit** `feat(renderer): add the tab finder and the command field`
