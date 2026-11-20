# Big Browser sidebar finish, part B: structure, menus, dock, drag, downloads — implementation plan (step 1, plan 3b-B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** finish the sidebar's structure after plan 3b-A's look: every menu drawn by Big Browser
(tab, folder, space, page right-click with extension items), a space section with an emoji and a
menu, nested and movable folders with custom icons, a ⌘T dock fed by a new browsing history, a
lifted drag where rows move aside, and a downloads button.

**Architecture:** the model grows in `core/` (one migration: nested folders, icons, space
section state, tab activation time; new `history` and `downloads` tables, each behind its own
store with unit tests on `:memory:`). Menus stay **owned by main**: main builds a serializable
`MenuSpec`, keeps the actions in a `MenuRegistry` keyed by item id, and asks the overlay to draw
it; the overlay only reports the chosen id (spec §3). The renderer gets everything through
`useWorkspace()` and `window.bigBrowser`.

**Tech stack:** Electron 45, React 19 + Zustand, zod, `node:sqlite`, Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-20-big-browser-sidebar-finish-design.md`](../specs/2026-11-20-big-browser-sidebar-finish-design.md)
(approved). This plan covers goals **1 and 3** (drawn menus replacing the native ones), **4–10**,
the space section part of **24**, **26** and **28**. Part A
([`2026-11-20-big-browser-sidebar-finish-look.md`](2026-11-20-big-browser-sidebar-finish-look.md))
is done. Also obey `CLAUDE.md`.

## Global constraints

- Branch `feat/sidebar-structure`, cut from `refactor/rename-big-browser`. Claude never pushes.
- `npm run check` after every task; every task touches UI or IPC, so also `npm run test:e2e`.
  Known on Windows: `cli.test.ts` "findCli prefers PATH" fails (pre-existing, not this plan's).
- CSS: design tokens only; every new token goes in `tokens.css` **and** `docs/DESIGN.md` §3.
- Menus and cards are **opaque white / light grey** (`--bg-menu`, `--border-menu`,
  `--shadow-menu`; dark scheme dark grey) — **no glass, no backdrop-filter, no blur** [owner].
- Every menu is drawn by Big Browser; after this plan **no `Menu.popup`** remains in `src/main`
  except the macOS share menu (`ShareMenu`) and the app menu bar.
- An action never waits for an animation; motion uses `--dur-*` / `--ease-*` (zeroed under
  `prefers-reduced-motion`).
- IPC additions follow `CLAUDE.md` rule 3 (channels → contract → handler → `window.bigBrowser`).
- History and downloads are personal data: SQLite on disk only, never sent anywhere.
- Never a code path that calls a model (CLAUDE.md rule 1).
- Every user-visible string in English.

## Decisions made for this plan [Claude's calls within the spec]

- **One migration (5)** for the browser model: `folders.parent_id TEXT NULL REFERENCES
  folders(id) ON DELETE CASCADE`, `folders.icon TEXT NULL`, `spaces.icon TEXT NULL`,
  `spaces.section_collapsed INTEGER NOT NULL DEFAULT 0`, `tabs.last_active_at TEXT NULL`.
  Migration 6: `history`; migration 7: `downloads` (each owned by its task).
- **Folder icon** is stored as text: `hue:<deg>` (one of the 7 `FOLDER_HUES`) or an emoji;
  `null` = hue from the name (today's behaviour). **Space icon**: an emoji or `null` (= colour dot).
- **Folder tree:** a folder belongs to the pinned list of its space or to a parent folder; tabs
  and child folders of one parent share one ordering (as pinned's top level does today).
  Indent grows per level up to **4** (`MAX_FOLDER_INDENT`), the model has no limit. A folder can't
  move into itself or a descendant (`BrowserError('invalid_move')`).
- **Menu wire format:** `MenuSpec = { id: string; items: MenuSpecItem[] }`, items
  `{ kind: 'item'; id; label; enabled; icon?: string /* data URL or a Phosphor name */;
  shortcut?: string; checked?: boolean; submenu?: MenuSpecItem[] } | { kind: 'separator' }`,
  plus an optional `{ kind: 'filter' }` first entry (the space menu's search field).
  Overlay request `{ kind: 'context-menu', at: { x, y }, menu: MenuSpec }` (at the pointer) or
  `{ kind: 'anchored-menu', anchor, placement, menu }` (from a button, with Task-5 connector).
  The overlay answers `overlay.choose { menuId, itemId }`; stale menu ids are ignored.
- **Delete Space…** confirmation is drawn in the overlay (kind `confirm`); deleting wipes
  `persist:space-<id>` (`session.clearStorageData()` + `clearCache()`), the space's history and
  its rows; disabled for the last space.
- **Recent Tabs** order: `last_active_at` desc (set by `activateTab` and by `openTab` when it
  activates); never-active tabs last, by position. **Frequent**: this space's history by
  `visit_count` desc, then `last_visit` desc, **6** rows. **Quick Actions**: docs.new, meet.new,
  sheets.new, github.com/new (open in a new tab).
- **History** records each top-level `did-navigate` (not in-page) of a tab with an http(s) URL:
  upsert on `(space_id, url)`; title updated on `page-title-updated`.
- **Downloads** go to `app.getPath('downloads')` with no dialog; a name clash gets ` (1)`,
  ` (2)`… before the extension (`uniqueDownloadPath`). States: `progressing | completed |
  cancelled | interrupted`. Clear deletes finished rows only, never files.
- **Drag:** pointer-driven (extends `useTabDrag`); the lifted row is a fixed-position clone
  (`--shadow-lift`, scale **1.03**), the others animate their `translate` (FLIP, `--dur-base`).
  The drop line is removed. Escape flies the row back (`--dur-base`) and moves nothing.

## Review focus

1. **Deleting a folder that has child folders** — every descendant folder and tab goes, and ⌘⇧T
   brings back the whole subtree in place. Test: Task 1 unit.
2. **A menu item whose tab, folder or space vanished while the menu was open** (closed by a
   shortcut, another window) — choosing it does nothing, never throws in main. Test: Task 3 unit
   (`MenuRegistry` + store `not_found`).
3. **An extension's context-menu item with a submenu and an icon** — drawn with both, and its
   `click` runs in main with the right `webContents`. Test: Task 4 unit (`toMenuSpec`) + e2e with
   the fixture extension.
4. **Deleting the active space, or the space that has a download in progress** — another space
   becomes active, the download keeps its row and finishes. Test: Task 2 unit + Task 10 unit.
5. **The same file downloaded twice** — the second never overwrites the first. Test: Task 10
   unit (`uniqueDownloadPath`).

---

### Task 1: Nested, movable folders (model)

**Files:**
- Modify: `src/core/store/database.ts` (migration 5), `src/core/browser/browserStore.ts`,
  `src/shared/model.ts`, `src/shared/ipc/channels.ts`, `src/shared/ipc/contract.ts`,
  `src/main/index.ts`, `src/renderer/src/features/workspace/workspace.ts`,
  `src/renderer/src/features/sidebar/FolderRow.tsx`, `FolderRow.module.css`,
  `src/main/browser/sidebarMenus.ts` (`endOf` counts child folders), `docs/ARCHITECTURE.md`
- Test: `src/core/browser/browserStore.test.ts`, `src/core/store/database.test.ts`,
  `src/renderer/src/features/workspace/workspace.test.ts`, `tests/e2e/organisation.spec.ts`

**Interfaces:**
- Produces: migration 5 (all columns in Decisions); `BrowserFolder` gains `parentId: string |
  null` and `icon: string | null`; `BrowserSpace` gains `icon: string | null` and
  `sectionCollapsed: boolean`; `BrowserTab` gains `lastActiveAt: string | null`.
  `createFolder(spaceId, name, parentId: string | null = null): BrowserFolder` (end of its
  parent's list); `moveFolder(id, to: { parentId: string | null; index: number }): void`;
  `moveTab`'s `folderId` may now name any folder of the space; `deleteFolder` removes the whole
  subtree (one undo entry). Commands `browser.createFolder` gains `parentId?`;
  `browser.moveFolder { folderId, parentId: string | null, index }`.
  `SidebarNode` folder nodes nest: `{ kind: 'folder'; folder; depth: number; children }`;
  `MAX_FOLDER_INDENT = 4` in `workspace.ts`.

- [ ] **Step 1: Write the failing unit tests** in `browserStore.test.ts`: `createFolder` with a
  parent puts it at the end of the parent's list (tabs and folders counted together);
  `moveFolder` into a sibling folder renumbers both lists without gaps; moving a folder into
  itself or into its own child throws `invalid_move`; `deleteFolder` on a parent with a child
  folder and 3 tabs removes all of them, and one `reopenClosed()` restores all 3 tabs **and** both
  folders with the same parents and positions; `activateTab` sets `lastActiveAt`. In
  `database.test.ts`: a v4 database migrates to v5 keeping its rows (new columns null / 0).
  In `workspace.test.ts`: a folder in a folder yields nested nodes with `depth` 0 and 1; depth
  6 indents as 4.
- [ ] **Step 2: Run** `npx vitest run src/core src/renderer/src/features/workspace`; expected FAIL.
- [ ] **Step 3: Implement.** The closed-tab undo entry becomes `{ folders: ClosedFolder[];
  tabs: ClosedTab[] }` so a folder subtree comes back whole (a single closed tab is a one-tab
  entry with no folders). `FolderRow` renders child folders through `Rows` (Task 6 of plan 3b-A
  presence keeps working: folder keys are `folder:<id>`) and indents by
  `min(depth, MAX_FOLDER_INDENT) × --space-3` (the step tab rows already use).
- [ ] **Step 4: Write the failing e2e test** `folders nest`: create two folders through IPC,
  `browser.moveFolder` the second into the first → the second's row is inside the first's
  children in the DOM and indented more; collapsing the outer hides both (rows stay mounted,
  hidden from the accessibility tree).
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 6: Commit** — `feat(sidebar): nest and move folders`.

### Task 2: Space model — rename, icon, colour, section state, delete

**Files:**
- Modify: `src/core/browser/browserStore.ts`, `src/shared/ipc/channels.ts`, `contract.ts`,
  `src/main/index.ts`, `src/main/browser/spaceSessions.ts`, `src/main/browser/tabViews.ts`
  (destroy a deleted space's views), `docs/ARCHITECTURE.md`
- Test: `src/core/browser/browserStore.test.ts`, `src/main/browser/spaceSessions.test.ts`
  (create if absent)

**Interfaces:**
- Consumes: Task 1's columns.
- Produces: store `renameSpace(id, name)`, `setSpaceIcon(id, icon: string | null)`,
  `setSpaceColor(id, color)`, `setSpaceSectionCollapsed(id, collapsed)`,
  `deleteSpace(id): void` (throws `BrowserError('last_space')` for the last one; activates the
  next space by position, else the previous; not reopenable). `SpaceSessions.wipe(spaceId):
  Promise<void>`. Commands `browser.renameSpace { spaceId, name (1–40) }`,
  `browser.setSpaceIcon { spaceId, icon: string | null }` (icon: 1–16 chars),
  `browser.setSpaceColor { spaceId, color }`, `browser.setSpaceSectionCollapsed { spaceId,
  collapsed }`, `browser.deleteSpace { spaceId }`. `SpaceSummary` gains `icon` and
  `sectionCollapsed`.

- [ ] **Step 1: Write the failing unit tests:** rename / icon / colour / collapsed round-trip
  through `snapshot()`; `deleteSpace` of the active space activates the next one by position
  (and the previous one when it was last); its tabs and folders are gone; the last space throws
  `last_space`; `wipe` calls `clearStorageData` and `clearCache` on the space's session (fake
  session object) and drops its extensions entry.
- [ ] **Step 2: Run** them; expected FAIL.
- [ ] **Step 3: Implement.** Main's `browser.deleteSpace` handler: destroy the space's tab
  views, `store.deleteSpace`, then `sessions.wipe` (history is wiped by Task 7, which adds that
  call here).
- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 5: Commit** — `feat(core): rename, decorate and delete spaces`.

### Task 3: Drawn menus — the wire format, the overlay menu, the sidebar's menus

**Files:**
- Create: `src/shared/menuSpec.ts` (zod schema + types), `src/main/menus/menuRegistry.ts`,
  `menuRegistry.test.ts`
- Modify: `src/shared/ipc/channels.ts`, `contract.ts` (overlay request kinds `context-menu`,
  `anchored-menu`; command `overlay.choose`), `src/main/browser/overlayView.ts`,
  `src/main/index.ts`, `src/main/browser/sidebarMenus.ts` (returns `MenuSpec` + actions instead
  of popping), `src/renderer/src/ui/Menu.tsx`, `Menu.module.css`,
  `src/renderer/src/app/Overlay.tsx`, `src/renderer/src/features/sidebar/menus.ts`,
  `docs/ARCHITECTURE.md` (overlay modes, IPC), `docs/DESIGN.md` (menus)
- Test: `tests/e2e/overlay.spec.ts`, `tests/e2e/organisation.spec.ts` (tab and folder menu tests
  switch from native-menu stubs to the drawn menu)

**Interfaces:**
- Produces: `MenuSpec`, `MenuSpecItem` (Decisions); `class MenuRegistry { open(items:
  MenuItemDef[]): MenuSpec; choose(menuId: string, itemId: string): void; clear(): void }` where
  `MenuItemDef` is a `MenuSpecItem` whose items carry `run(): void` (stripped from the spec);
  `choose` ignores an unknown or stale `menuId` and swallows `BrowserError` (`not_found`) like
  today's `ignoreVanished`. Main helper `showMenu(request: { at } | { anchor; placement },
  items: MenuItemDef[]): void` opens the overlay. `Menu` (renderer) takes `MenuSpecItem[]`,
  `anchor` **or** `at`, renders submenus (opens on hover / →, closes on ←), checked marks, icons
  (data URL `<img>` or Phosphor by name), and calls `onChoose(itemId)`.
  `sidebarMenus.ts`: `tabMenu(host, tabId): MenuItemDef[]`, `folderMenu(host, folderId):
  MenuItemDef[]` — folder menu gains **Move to Folder** (submenu: Top level, then every folder
  of the space not in its own subtree) and **Change Icon…** (Task 6 wires its action; until
  then the item is omitted).

- [ ] **Step 1: Write the failing unit tests** for `MenuRegistry`: `open` strips `run` and
  assigns a fresh `menuId`; `choose` runs the matching item's `run` once; a second `choose` or a
  `choose` on an older `menuId` runs nothing; a `run` that throws `BrowserError('not_found')`
  is swallowed, any other error propagates; nested submenu items are reachable by id.
- [ ] **Step 2: Run** `npx vitest run src/main/menus`; expected FAIL.
- [ ] **Step 3: Implement.** The overlay view treats both new kinds like popovers (full window,
  focused). `browser.showTabMenu` / `showFolderMenu` take the pointer position from the renderer
  (`{ tabId, at: { x, y } }`), build items and call `showMenu`. Remove the native `popup`.
- [ ] **Step 4: Write the failing e2e tests:** `the tab menu is drawn`: right-click a tab → the
  overlay shows `data-testid="menu"` with Pin, Add to Favourites, Move to Folder, Copy Link,
  Duplicate, Close; hover Move to Folder → a submenu with New Folder…; choose Pin → the tab is in
  `pinned`. `the folder menu moves a folder`: Move to Folder → another folder → nested.
  `a vanished tab's menu item does nothing`: open a tab's menu, close the tab via IPC, choose
  Pin → no error in main's log, menu closes.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 6: Commit** — `feat(renderer): draw the tab and folder menus`.

### Task 4: The page's right-click menu, drawn

**Files:**
- Create: `src/main/menus/fromElectron.ts`, `fromElectron.test.ts`
- Modify: `src/core/browser/pageMenu.ts` (+ test), `src/main/browser/tabViews.ts`,
  `docs/DESIGN.md`
- Test: `tests/e2e/extensions.spec.ts`, `tests/e2e/browser.spec.ts`

**Interfaces:**
- Consumes: `showMenu`, `MenuItemDef` (Task 3).
- Produces: `toMenuItemDefs(items: (MenuItemConstructorOptions | MenuItem)[], invoke: (item,
  event) => void): MenuItemDef[]` — label, enabled, checked, submenu (recursive), separators,
  `icon` as a data URL from `NativeImage.toDataURL()` (resized to 16 px), `run` calling the
  original `click`. `PageMenuContext` gains `misspelledWord: string` and `suggestions:
  string[]`; `PageMenuId` gains `` `suggestion:${number}` `` (first group when a word is
  misspelled, max **5**, then "No suggestions" disabled when none).

- [ ] **Step 1: Write the failing unit tests:** `pageMenu` with a misspelled word and 2
  suggestions → first group is the 2 suggestion entries; with none → one disabled entry.
  `toMenuItemDefs`: a submenu of 2 items keeps its order and nesting; a separator stays a
  separator; an item with an icon gets a `data:image/png` icon; `run` calls the original click.
- [ ] **Step 2: Run** them; expected FAIL.
- [ ] **Step 3: Implement.** `showPageMenu` builds `MenuItemDef[]` (labels as today, suggestion
  entries call `contents.replaceMisspelling(word)`), splices the extension items before Inspect
  exactly as today, and calls `showMenu({ at: { x: params.x + pageBounds.x, y: params.y +
  pageBounds.y } }, …)`. No macOS Look Up / Services.
- [ ] **Step 4: Write the failing e2e tests:** `the page menu is drawn`: right-click the fixture
  page (via `webContents.sendInputEvent` rightClick, or emitting `context-menu` from main with
  `app.evaluate`) → the overlay menu shows Back, Forward, Reload, Inspect; choosing Reload
  reloads. In `extensions.spec.ts`: the fixture extension registers a `contextMenus` item with
  one child → the drawn page menu shows it with a submenu; choosing the child fires the
  extension's `onClicked` (the fixture records it).
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 6: Commit** — `feat(main): draw the page's right-click menu`.

### Task 5: The space section and the space menu

**Files:**
- Create: `src/renderer/src/features/sidebar/SpaceHeader.tsx`, `SpaceHeader.module.css`,
  `src/renderer/src/features/sidebar/EmojiField.tsx` (+ css)
- Modify: `Sidebar.tsx`, `Sidebar.module.css`, `src/main/browser/sidebarMenus.ts`
  (`spaceMenu`), `src/shared/ipc/contract.ts` (overlay kinds `confirm`, `space-icon`; shortcut
  `rename-space`), `src/renderer/src/app/Overlay.tsx`, `docs/DESIGN.md`
- Test: `tests/e2e/organisation.spec.ts`

**Interfaces:**
- Consumes: Task 2 commands; Task 3 `showMenu` (anchored, filter entry).
- Produces: `spaceMenu(host, spaceId): MenuItemDef[]` = filter field, Rename Space…, Change
  Space Icon…, Edit Look…, New Folder, Space Settings…, separator, Delete Space… (shortcut label
  `⌘⌫`, no accelerator; disabled for the last space). Rename edits the name in place in the
  header (shortcut `rename-space`). Change Space Icon… opens overlay kind `space-icon` (an
  `EmojiField`: one text input that keeps the first grapheme, a row of 16 common emojis, and
  "No icon"). Edit Look… opens the existing `ColorPicker` in the overlay for the space colour.
  Space Settings… opens Settings. Delete Space… opens kind `confirm` with the text "Delete
  “<name>”? Its tabs, sign-ins, cookies and extensions will be deleted." and buttons Cancel /
  Delete.

- [ ] **Step 1: Write the failing e2e tests:** `the space section holds pinned items`: the
  header (`data-testid="space-header"`) shows the space name; pinned rows are inside
  `data-testid="space-section"`; today's rows are outside. `the space icon becomes a chevron`:
  with icon 🚀 the header shows 🚀; on hover a chevron button `Collapse space section` shows;
  clicking it hides the section (rows stay mounted, `inert`) and persists
  `sectionCollapsed`. `the space menu`: "…" opens a drawn menu with the 7 entries; typing
  "del" leaves Delete Space…; Delete Space… → confirm → Delete removes the space and activates
  the other one; with one space the entry is disabled. `rename in place`: Rename Space… →
  the header becomes an input; Enter saves.
- [ ] **Step 2: Run** them; expected FAIL.
- [ ] **Step 3: Implement.** The section animates its height with the `grid-template-rows: 0fr
  ↔ 1fr` technique already used by folders (spec goal 24). Footer dots show the space's emoji
  when it has one.
- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 5: Commit** — `feat(sidebar): add the space section and its menu`.

### Task 6: Folder icons and the opening animation

**Files:**
- Modify: `src/core/browser/browserStore.ts` (`setFolderIcon`), `contract.ts` (command
  `browser.setFolderIcon { folderId, icon: string | null }`; overlay kind `folder-icon`),
  `src/main/browser/sidebarMenus.ts` (Change Icon…), `glyphs.tsx`, `glyphs.module.css`,
  `hash.ts`, `FolderRow.tsx`, `src/renderer/src/app/Overlay.tsx`, `docs/DESIGN.md`
- Test: `src/core/browser/browserStore.test.ts`, `src/renderer/src/features/sidebar/hash.test.ts`,
  `tests/e2e/organisation.spec.ts`

**Interfaces:**
- Consumes: Task 5's `EmojiField`.
- Produces: `folderIcon(folder: { name: string; icon: string | null }): { kind: 'hue'; hue:
  number } | { kind: 'emoji'; emoji: string }` in `hash.ts` (`hue:<deg>` must be one of
  `FOLDER_HUES`, anything else non-empty is an emoji, `null` → hue from the name).
  `FolderGlyph` takes `hue` instead of `name`. The `folder-icon` card: the 7 hue swatches, the
  `EmojiField`, and "Default".

- [ ] **Step 1: Write the failing unit tests:** `folderIcon` for `null`, `hue:262`, `hue:999`
  (→ name hue), `📁`; `setFolderIcon` round-trips and validates through the command schema.
- [ ] **Step 2: Run** them; expected FAIL.
- [ ] **Step 3: Implement.** Opening animation in `glyphs.module.css`: on `data-open` change
  the front flap swings open (`transform: skewX` + `scaleY` from the bottom edge) and the paper
  rises (`translateY`), `--dur-base`, `--ease-bounce`; nothing moves under reduced motion
  (tokens are zeroed).
- [ ] **Step 4: Write the failing e2e test** `a folder takes a hue or an emoji`: folder menu →
  Change Icon… → pick the 3rd hue → the glyph's `--hue` is that hue; pick 🎧 → the row shows
  🎧 instead of the glyph; Default → the glyph is back.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 6: Commit** — `feat(sidebar): customizable folder icons that open`.

### Task 7: Browsing history

**Files:**
- Create: `src/core/browser/historyStore.ts`, `historyStore.test.ts`
- Modify: `src/core/store/database.ts` (migration 6), `src/main/browser/tabViews.ts`
  (record), `src/main/index.ts` (wipe on space delete), `channels.ts`, `contract.ts`,
  `docs/ARCHITECTURE.md` (data), `docs/DESIGN.md` (privacy note)
- Test: `historyStore.test.ts`, `src/core/store/database.test.ts`

**Interfaces:**
- Produces: migration 6 `history (id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES
  spaces(id) ON DELETE CASCADE, url TEXT NOT NULL, title TEXT NOT NULL, visit_count INTEGER NOT
  NULL, last_visit TEXT NOT NULL, UNIQUE(space_id, url))`.
  `class HistoryStore { record(spaceId, url, title): void; setTitle(spaceId, url, title): void;
  frequent(spaceId, limit = 6): HistoryEntry[]; search(query, limit = 8): HistoryEntry[]
  /* all spaces, title or url contains, by visit_count then last_visit */; forget(id): void;
  wipeSpace(spaceId): void }`; `HistoryEntry = { id; spaceId; url; title; visitCount;
  lastVisit }`. Commands `history.frequent { spaceId? }`, `history.search { query }`,
  `history.forget { id }`.

- [ ] **Step 1: Write the failing unit tests:** two `record`s of one URL → one row,
  `visitCount` 2; non-http(s) URLs are ignored; `frequent` orders by count then recency and
  only returns that space; `search('git')` matches title or URL across spaces, case-insensitive;
  `forget` removes one row; `wipeSpace` removes only that space's rows.
- [ ] **Step 2: Run** them; expected FAIL.
- [ ] **Step 3: Implement.** `tabViews` calls `record` on `did-navigate` (top level only, not
  `did-navigate-in-page`) and `setTitle` on `page-title-updated`.
- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 5: Commit** — `feat(core): record browsing history per space`.

### Task 8: The ⌘T dock

**Files:**
- Create: `src/renderer/src/features/finder/dock.ts`, `dock.test.ts`
- Modify: `src/renderer/src/features/finder/CommandField.tsx`, `Picker.tsx`,
  `Picker.module.css`, `src/renderer/src/features/workspace/workspace.ts` (recent order),
  `docs/DESIGN.md`
- Test: `tests/e2e/finder.spec.ts`

**Interfaces:**
- Consumes: `lastActiveAt` (Task 1), history commands (Task 7).
- Produces: `dockSections(input: { query: string; spaceId: string; tabs: FinderTab[];
  frequent: HistoryEntry[]; matches: HistoryEntry[] }): DockSection[]` where `DockSection =
  { title: 'Recent Tabs' | 'Frequent' | 'Quick Actions' | null; rows: DockRow[] }` and
  `DockRow = { key; kind: 'go' | 'search' | 'tab' | 'history' | 'action'; label; hint?;
  url?; tabId?; historyId? }`. Empty query: Recent Tabs (this space, by `lastActiveAt`, max
  **6**, hint "In <folder>" when filed), Frequent (max **6**), Quick Actions (the 4 URLs).
  With a query: first section `null` with the go/search row, then matching tabs of **all
  spaces** and matching history, each filtered by the query; Quick Actions filtered too.
  `Picker` gains sections, a "−" button on history rows (`history.forget`) and a footer showing
  the Enter action: "Open in New Tab ↵" or "Switch to Tab ↵" for the selected row.

- [ ] **Step 1: Write the failing unit tests** for `dockSections`: empty query → the three
  titles in order, Recent Tabs sorted by `lastActiveAt` with never-active last, other spaces'
  tabs excluded; query "doc" → go/search row first, docs.new kept in Quick Actions, a tab of
  another space included; a filed tab's hint is "In <folder name>".
- [ ] **Step 2: Run** them; expected FAIL.
- [ ] **Step 3: Implement.** `CommandField` fetches `history.frequent` on mount and
  `history.search` as the query changes (no debounce needed: local SQLite). Running a tab row of
  another space activates it (the store already activates its space).
- [ ] **Step 4: Write the failing e2e test** `the dock shows recent, frequent and quick
  actions`: visit two fixture pages, open ⌘T → three section titles; the footer reads "Switch to
  Tab ↵" on a tab row and "Open in New Tab ↵" on a Quick Action; "−" on a Frequent row removes
  it.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 6: Commit** — `feat(finder): turn the command field into a dock`.

### Task 9: Lifted drag (tabs, folders, tiles)

**Files:**
- Create: `src/renderer/src/features/sidebar/flip.ts`, `flip.test.ts`
- Modify: `useTabDrag.ts` (+ its test), `Sidebar.tsx`, `Sidebar.module.css`, `TabRow.tsx`,
  `TabRow.module.css`, `FolderRow.tsx`, `FavoriteTiles.tsx`, `FavoriteTiles.module.css`,
  `src/renderer/src/theme/tokens.css` (new `--shadow-lift`, light and dark), `docs/DESIGN.md`
- Test: `tests/e2e/organisation.spec.ts`

**Interfaces:**
- Consumes: `browser.moveTab`, `browser.moveFolder` (Task 1).
- Produces: `gapOffsets(rows: { id: string; top: number; height: number }[], dragged: string,
  target: number): Record<string, number>` in `flip.ts` — the `translateY` each row takes so a
  gap of the dragged row's height opens at drawn index `target` (rows after the gap shift down,
  rows the dragged row left shift up). Folders become draggable (`DropKey` `folder:` as a
  source); a folder dropped on a folder moves into it. Tiles reorder among tiles with the same
  rule on x. `drop-line` is removed (tests that used it switch to `data-drop-target` / final
  order).

- [ ] **Step 1: Write the failing unit tests** for `gapOffsets`: dragging row 0 to index 2 of 4
  equal rows → rows 1 and 2 move up by one row height, row 3 stays; dragging row 3 to index 1 →
  rows 1 and 2 move down; target equal to the source → all 0. `useTabDrag.test.ts`: a folder
  dropped on another folder targets `moveFolder` into it; a folder dropped on itself or its
  descendant is no move.
- [ ] **Step 2: Run** them; expected FAIL.
- [ ] **Step 3: Implement.** While dragging, the source row is hidden (`visibility: hidden`,
  keeps its slot until the gap moves), the clone follows the pointer, rows get `translate`
  from `gapOffsets` with a `--dur-base` transition. Escape: the clone animates back to the
  source rect, then everything resets; no IPC sent.
- [ ] **Step 4: Write the failing e2e tests:** `dragging lifts the row and opens a gap`:
  pointer-down on tab A, move over tab C → a `data-testid="drag-clone"` exists with a scale of
  1.03 and the rows between have a non-zero `translate`; release → order updated. `Escape
  cancels a drag`: same, press Escape → no move, clone gone. `a folder drags into a folder`.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 6: Commit** — `feat(sidebar): lift dragged rows and move the others aside`.

### Task 10: Downloads

**Files:**
- Create: `src/core/browser/downloadsStore.ts`, `downloadsStore.test.ts`,
  `src/core/browser/downloadPath.ts`, `downloadPath.test.ts`,
  `src/main/browser/downloads.ts`, `src/renderer/src/features/downloads/DownloadsMenu.tsx`
  (+ css)
- Modify: `src/core/store/database.ts` (migration 7), `src/main/browser/spaceSessions.ts`
  (hook every session), `src/main/index.ts`, `channels.ts`, `contract.ts` (overlay kind
  `downloads`; event `downloads.changed`), `Overlay.tsx`, `Sidebar.tsx` (footer button in the
  `.slot`), `docs/ARCHITECTURE.md`, `docs/DESIGN.md`
- Test: the two unit files, `tests/e2e/downloads.spec.ts` (create)

**Interfaces:**
- Produces: migration 7 `downloads (id TEXT PRIMARY KEY, url TEXT NOT NULL, path TEXT NOT
  NULL, filename TEXT NOT NULL, total_bytes INTEGER NOT NULL, received_bytes INTEGER NOT NULL,
  state TEXT NOT NULL, started_at TEXT NOT NULL)` (no space id: one list for all spaces).
  `uniqueDownloadPath(dir: string, filename: string, exists: (path: string) => boolean):
  string`. `class DownloadsStore { start(d): Download; progress(id, received, total): void;
  finish(id, state): void; list(): Download[] /* newest first */; clear(): void /* finished
  only */ }`; on startup, rows still `progressing` become `interrupted`. Commands
  `downloads.list`, `downloads.clear`, `downloads.show { id }` (`shell.showItemInFolder`).
  Progress events are throttled to one per **250 ms** per download.

- [ ] **Step 1: Write the failing unit tests:** `uniqueDownloadPath` → `a.pdf`, then `a (1).pdf`,
  `a (2).pdf`; a name without extension → `a (1)`. `DownloadsStore`: start/progress/finish
  round-trip; `clear` keeps a progressing download; a progressing row loaded on startup becomes
  `interrupted`; `list` is newest first.
- [ ] **Step 2: Run** them; expected FAIL.
- [ ] **Step 3: Implement.** `downloads.ts` attaches `will-download` once per space session
  (`item.setSavePath(uniqueDownloadPath(app.getPath('downloads'), …))`, no dialog) and keeps the
  store and `downloads.changed` up to date; deleting a space (Task 2) doesn't cancel downloads.
  The footer button (`aria-label="Downloads"`) opens the drawn `downloads` card (same card
  style, anchored above the button): rows with filename, a progress bar while progressing,
  "Show in Finder" (mac) / "Show in Explorer" (windows), and Clear.
- [ ] **Step 4: Write the failing e2e test** `downloads land in the folder and the list`: point
  `app.getPath('downloads')` at a temp dir via `app.evaluate` (`app.setPath`), click a fixture
  link with `download` → the file exists in the temp dir; the Downloads card lists it as
  completed; downloading it again creates `name (1).ext`; Clear empties the list and both files
  remain.
- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`; expected PASS.
- [ ] **Step 6: Commit** — `feat(sidebar): add downloads`.

### Task 11: Docs and handoff

**Files:**
- Modify: `HANDOFF.md` (plan 3b done → next: plan 4), `docs/DESIGN.md` (every token and
  behaviour above listed), `docs/ARCHITECTURE.md` (menus owned by main, overlay kinds, new
  tables), `docs/superpowers/specs/2026-11-20-big-browser-design.md` (plan list: 3b done;
  downloads moved out of plan 4)

- [ ] **Step 1:** Update the four docs.
- [ ] **Step 2:** Run `npm run check`; expected PASS.
- [ ] **Step 3: Commit** — `docs: record plan 3b-B in the handoff and the design`.
