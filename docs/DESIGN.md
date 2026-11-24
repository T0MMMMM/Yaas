# YAAS — design

Inspired by Arc: a quiet, fast UI where the **vertical sidebar is the app**. Accounts are
*spaces*, sessions are *tabs* inside them. Everything is reachable from the keyboard.

## 1. Principles

1. **Content first.** Chrome recedes: no toolbar, no tab strip, the titlebar is the sidebar.
2. **Fast over fancy.** Every interaction under 100 ms; animations ≤ 200 ms and skippable
   (`prefers-reduced-motion` disables them).
3. **Keyboard everywhere.** Every action is in the command palette; frequent ones have a shortcut.
4. **One accent at a time.** The active space's color tints the chrome; the rest stays neutral.
5. **Status at a glance.** A tab tells you if Claude is running, waiting for you, or done — without opening it.

## 2. Layout

```
┌─────────────────────────┬──────────────────────────────────────────────────┐
│ ● ● ●                   │ ╭ Write tests · ~/scripts  ◔ Context 21% 42k/200k  ◔ Session 45% 17:30 (3h11)  ◔ Week 61% Fri. 14:00 (23h41) ╮ │ ← context bar (only in a session)
│ ┌─────────────────────┐ │ ┌──────────────────────────────────────────────┐ │
│ │ ⌕ Search…        ⌘K │ │ │                                              │ │
│ └─────────────────────┘ │ │  you  The login page loops after OAuth…      │ │
│ 📂 app                  │ │                                              │ │ ← pinned environment
│    Fix login redirect ! │ │  claude  Looking at src/auth/callback.ts …   │ │
│    Refactor billing   × │ │    ▸ Read src/auth/callback.ts               │ │
│ Release notes         ◐ │ │    ▸ Edit  +12 −3                            │ │ ← pinned session
│ ─────────────────────── │ │                                              │ │ ← separator
│ 📁 website          2   │ │  ┌────────────────────────────────────────┐  │ │ ← closed folder
│ 📂 infra-scripts        │ │  │ Allow Bash: npm test ?                 │  │ │ ← open folder
│    Write tests        ✓ │ │  │ [Allow once ⏎] [Always ⌘⏎] [Deny Esc]  │  │ │
│ + New session      ⌘T   │ │  └────────────────────────────────────────┘  │ │
│                         │ │  ┌────────────────────────────────────────┐  │ │
│                         │ │  │ Message Claude…                     ⏎  │  │ │
│ 💼 🏠              [⚙]  │ │  └────────────────────────────────────────┘  │ │
└─────────────────────────┴─┴──────────────────────────────────────────────┴─┘
  accounts (left)  settings      session content card
```

**Context bar** — the **header of the session card** (38 px, separated from the transcript by a gray
hairline running edge to edge), shown **only while a session is open**. It is also the window drag region.
Left: session title (editable inline) and environment path. Right, each stat as *ring + label*:
- **Context** of the open session: `◔ Context 21% 42k / 200k` (`--warn` above 80 %; click → what the
  session loads).
- **Account usage**, with reset time and time left: `◔ Session 45% 17:30 (3h11)` (5-hour window)
  and `◔ Week 61% Fri. 14:00 (23h41)` (7-day window). Same day → time only; otherwise short
  weekday + time. Time left as `3h11`, or `2d 4h` beyond 48 h.

Both meters can move to the bottom of the sidebar instead (Settings → Appearance → Meters).
Wherever they are, the meters follow the same rule as the session title: **shown only while a
session is open**. Without a session and with meters in the
context bar, the content card takes the full height. The page card has no border: it sits on the
frame by its fill and rounded corners alone. The window buttons wait in the top margin (§4).

**Sidebar (top → bottom)**
- Title row: a drag region (the window buttons wait in the window's top margin above it, §4). The
  sidebar is always visible (no auto-hide mode).
- Search / palette trigger: a soft borderless field.
- **Pinned section**: pinned environments (with their sessions) and pinned sessions, in the user's
  order. No pin icon — being above the separator *is* the pinned state.
- Separator: a faint hairline.
- **Askew cards**: the selected item sits slightly askew (`--tilt-selected`, −0.8°) and hovered
  items tilt a little (`--tilt-hover`, −0.4°), with a small bounce (`--ease-bounce`). Only the card layer tilts — the text never
  moves. Same motion in
  the sidebar (sessions, folders) and the Settings navigation.
- Accounts and the Settings gear are **magnetic**: they lean toward the pointer and spring back
  (`ui/useMagnetic`, CSS `translate` so it composes with their own transforms). They stay still
  under `prefers-reduced-motion`.
- Hovering a session shows a **⋯** button on the right (session actions) in place of its status dot.
- Rows (environments and sessions) are 34 px high; the sidebar has a 6 px side padding so search,
  rows and folders use almost its full width.
- **Resizable**: drag its right edge (48–72 px icon-only or 120–440 px normal, default 228
  `SIDEBAR_DEFAULT`, saved in settings; existing users keep their saved width); double-click the
  edge to reset.
- **Environments** (= project folders) as **folders** that open and close (folder / open-folder
  icon; a closed folder shows its session count), sorted by last activity, each listing its
  sessions. Pins are per space; pin/unpin from the context menu or `Mod+D`.
- `+ New session` (in the active environment, or asks for a folder).
- Bottom row: **accounts on the left** (switch spaces) and **Settings** on the right. Accounts are
  shown as their **emoji**, their **first letter**, or **dots** (setting) — no card: inactive ones
  are faded, the active one is full opacity and a bit bigger; on hover they lift, tilt and grow. No `+`: accounts are
  added from Settings, the palette or `Mod+Shift+N`.
- Optional (v1): a custom icon or emoji on an environment or a session replaces the default
  folder / no icon.

**Browser sidebar (Big Browser, top → bottom of the scroll area)** — the tree comes from
`sidebarSections` in `features/workspace` (same order as the store's `visibleOrder`); the rows
are `TabRow`, `FolderRow` and `FavoriteTiles` in `features/sidebar`.
- **Icon-only mode**: dragging the sidebar narrower than 120 px (`SIDEBAR_COMPACT_FROM`) settles
  it in 48–72 px (`SIDEBAR_COMPACT_MIN` / `_MAX`; 56 is the default `SIDEBAR_COMPACT`; `SIDEBAR_MIN`
  is 48) and sets `data-compact="true"` on it. Stored widths are normalised by `snapWidth`. A tab
  filed in a folder shows one `--folder-bar-w` bar per folder, in the folder's hue, on its left.
  Only favicons show, in one column: tiles stack, rows lose title and ×, folders show their icon
  (tabs stay listed under them, unindented), spaces stack as dots (an emoji when the space has one), New tab is an icon.
  The overlay's tooltips carry the titles; drag and drop keeps working (it only measures vertically). Dragging
  past 120 px restores the normal layout.
- **Favourites**: no header. An auto-fit grid of tiles (at least `--tile-min-w` wide, stretched to fill the width, wrapping to more rows; `--tile-h` 44, favicon
  `--tile-icon-size` 22) on a `--bg-tile` card; the active tile is lifted and askew like a selected row.
- **Space section** (`SpaceHeader`, then the pinned list): a header with the space's emoji (or its
  `--space-dot` colour dot), its name and a "…" button (shown on hover, while its menu is open or
  focused). Hovering the header turns the emoji into a chevron that folds the section like a
  folder (`grid-template-rows` 1fr ↔ 0fr, rows kept mounted and `inert`; stored per space,
  `sectionCollapsed`). "…" (or a right-click on the header) opens the **space menu** below it:
  a filter field, Rename Space… (the name becomes an inline field: Enter or leaving it saves, Esc
  cancels), Change Space Icon… (a card: an emoji field keeping the first character typed, 16
  common emojis, No icon), Edit Look… (a card with the colour picker, applied live), New Folder
  (its name edited at once), Space Settings… (opens Settings), then Delete Space… (`⌘⌫` shown,
  no accelerator; disabled for the last space), which asks first in a card: "Delete “name”? Its
  tabs, sign-ins, cookies and extensions will be deleted." with Cancel (focused) and Delete
  (`--danger`). The cards open from the "…" button with the funnel. Icon-only, the header is only
  the emoji or dot, and Rename Space… (from a right-click) does nothing.
- **Pinned**: pinned tabs and folders in one ordering. A folder row (the folder glyph, or an emoji)
  opens and closes on click; opening swings the glyph's front flap up from its bottom edge and
  lifts the paper (`--dur-base`, `--ease-bounce`; instant under reduced motion, where those tokens
  are zeroed). "Change Icon…" opens a card from the row: the 7 folder hues, an emoji field
  (letters are refused with a hint; choosing the current emoji closes the card) and Default (the
  hue of the name). Icon-only, the filed-tab bars use the chosen hue (the name's hue for an
  emoji); a closed folder shows its tab count on the right. Its tabs are listed one `--space-3`
  indent below. "New Folder…" and "Rename" (its menus) put its name in an inline field: Enter or
  leaving it saves, Esc cancels.
- **Separator**: a hairline, with **Clear** on the right when today has tabs — shown only while
  the separator is hovered or Clear has keyboard focus. It closes all of today's tabs (children
  first), and ⌘⇧T reopens them one by one. **New tab** sits right under it, above today's rows.
- **Tab titles** never ellipse: the end fades out (`--title-fade`, widening to `--title-fade-hover`
  on hover or focus inside the row), and the × appears in that room (hover or focus only).
  There is no Search button at the top of the sidebar (⌘K opens the finder).
- **Today**: tabs opened from another tab are indented under it, `--space-3` per level (max 3).
  **Automatic folders**: 3 or more top-level tabs of one site (`www.` ignored) are drawn as a
  folder named after the host, where the first of them was; open/closed per host for the session
  (UI store), never stored. Settings → Appearance → Automatic folders turns them off.
- **Split rows** (`SplitRow`, `data-testid="split-row"`): a split is one row in its first tab's
  place — both favicons, then "Title A | Title B". A click on a half's title shows the split with
  that half active (it is bold while the split is shown; elsewhere on the row, the half already
  active or the first). Its tooltip names both; right-click opens the menu of the half under the
  pointer (Separate instead of Open in Split View). Its × closes **both** tabs
  (`browser.closeSplit`; to keep one, use Separate first). A pinned or favourite split is only
  unloaded and stays a split: its ×, or closing either half while it is shown (⌘W, Close), unloads
  both; closing a half of one not shown unloads that half. A today split's tabs are
  deleted, and ⌘⇧T reopens them one by one as two plain tabs. Icon-only: the two favicons stacked. A favourite split is one
  tile with both favicons. **Creating a split**: `⌃⌘\` (Windows: `Ctrl+Shift+\`) or the + menu's
  Split View pairs the active tab with the next row of its list, else the previous (rows already
  split are skipped; nothing with no such row); Open in Split View (a tab's menu, hidden on the
  active tab and on splits) pairs that tab with the active one; dropping a tab on the middle half
  of the shown tab's row pairs them (the row gets the `--accent-soft` fill; not onto or from a
  split or a favourite tile).
- Every row and tile: right-click opens its menu, drawn at the pointer with a Phosphor icon on
  every row (tab: Reload, Duplicate, Mute/Unmute, Open in Split View or Separate, Copy Link |
  Pin/Unpin, Add to/Remove from Favourites, Move to Folder ▸ | Close Tabs Below, Close/Remove;
  folder: Rename, Change Icon…, Move to Folder ▸, Open All | Delete Folder). A tab whose page is
  not loaded is dimmed (`--opacity-unloaded`). Cards tilt per item (askew cards), none when the
  setting is off.
- **Drag and drop** (`useTabDrag`, pointer events): drag a tab row, a tile or a pinned folder to
  reorder it, pin it, favourite it or file it into a folder. The upper half of a row drops before
  it, the lower half after it; the middle half of a pinned folder's row files into it; the tiles
  grid adds a tab to the end of the favourites, and a dragged tile moves among the tiles (the
  left half of a tile is before it, the right half after). **Lifted drag**: the dragged row lifts
  — a clone at `scale: 1.03` with `--shadow-lift` follows the pointer while the row keeps its
  slot, hidden — and the other rows move aside (`translate`, `--dur-base`) to open a gap where it
  will land (`flip.ts`: `gapOffsets` for rows, `slotShifts` for the wrapping tiles); a list it
  comes into grows by its height. A folder or list the drop goes into gets the `--accent-soft`
  fill instead. Empty favourites and pinned lists appear while a tab is dragged so it can be
  dropped on them. A today tab moves with its subtree; a drop on a nested tab lands after its
  top-level tab's subtree. For a tab of another site, an automatic folder is one block (before or
  after it); a tab of its own site joins it. A folder moves with its rows, only within pinned
  (`browser.moveFolder`); a drop on itself or one of its descendants is no move, like a drop on
  the dragged tab itself. Esc (or a release outside the lists) cancels: the rows close the gap
  and the clone flies back to the row. Under reduced motion the clone still follows the pointer;
  nothing else animates.

**Popovers** (the + menu, the site menu, anchored cards) float over the page in the overlay view
and share one opaque card (`ui/Popover.module.css`, composed by each popover's own CSS module:
`--bg-popover` / `--bg-menu` `#ffffff` light or `#2c2c2e` dark, `--border-menu-w` `0.5 px` hairline
`--border-menu`, `--radius-popover` / `--radius-menu` `10 px`, `--shadow-menu`, rows hovered with
neutral `--bg-menu-hover` `ink 0.08`). A smooth bell-curve bump (`ui/PopoverNeck`, an SVG) leaves
the card's border tangentially in the card's fill (`--card-bg`) and hairline border and crests 4 px
short of the opener button (never touching it). It is centred on the button and kept clear of the
card's rounded corners (`ui/connector.ts`; `.alignLeft`/`.alignRight` in `Popover.module.css` use
`--card-radius`). The opener stays visibly pressed as a rounded card while open (`--fill-pressed`
on the toolbar button; `--bg-menu` with `×` on the + button). Frequent popovers enter with split
phase timing — opacity `150 ms ease` (`--dur-frequent-fade`) and scale from `0.97` (`--scale-enter`)
at the trigger-facing origin over `250 ms` `--ease-out` (`--dur-frequent-move`) — and exit with an
opacity-only `180 ms ease` fade (`--dur-frequent-exit`, `data-state="closing"`, `inert`) before the
overlay hides; Occasional cards (`downloads`, `confirm`) enter in `400 ms` fade / `450 ms` move and
exit with the same `180 ms` fade, no move. Input never waits for an exit: the keyboard goes back as
the exit starts (`overlay.closing`), and since the overlay view takes every click until it hides (a
`WebContentsView` cannot let clicks through), no overlay exit lasts longer than
`--dur-frequent-exit`; a second press during the fade hides it at once. Because enters
and exits are driven by `@starting-style` transitions, interrupting mid-flight retargets smoothly
from the on-screen value. A chosen item's action always runs first, never after the animation. Under
`prefers-reduced-motion`, move/scale tokens zero out while fades keep their duration. The + menu
puts its filter field at the bottom (Enter picks the first match) and orders its items as New space,
New folder | Split View (`⌃⌘\`), New tab (`⌘T`) | Settings (`⌘,`).

**Menus** (`ui/Menu`) — every menu is drawn by Big Browser, never a native one (except macOS
Share and the menu bar). Outer padding `--menu-inset` (`5 px`), rows `--menu-row-h` (`28 px`) tall
with `--radius-menu-row` (`6 px`), `13 px` regular text, a leading `--icon-size` (`16 px`) slot
(the item's icon, a check for the checked item, or empty so labels line up; only when some row of
the card has one), the label, then the shortcut (`12 px`) or a submenu's caret. Hover and open
states use neutral ink (`--bg-menu-hover`, never blue); keyboard focus adds a visible
`--space-accent` ring; separators are `0.5 px` hairlines with `5 px` margin. A disabled row is
`--text-faint` and takes no hover. A menu opened from a button keeps the funnel and grows from it;
a menu opened at the pointer (a right-click) has no neck: its top-left corner sits on the pointer
and it grows from there, flipped left of / above the pointer where there is no room (`placeCard`,
kept `POPOVER_GAP` inside the window; taller than the window, it scrolls). A **submenu** is a
second card of the same look beside its row (4 px from the card, its first row level with the row;
flipped to the left side when there is no room), opened by hovering the row, → or Enter, closed by
← or by resting on another row for 250 ms (`SUBMENU_GRACE_MS`: the pointer can cross rows on its
way into the submenu); its row keeps the hover fill while open, and moving between sibling submenus
swaps content in place (warm state). Keyboard: ↓/↑ within a card (↓ from a menu opened at the
pointer reaches its first row), Enter or Space chooses, Escape or a click outside closes every
card. Hovering a row moves the keyboard to it, except while a filter field has it: typing still
goes to the field.

**Page menu** — right-clicking a page draws its menu at the pointer, with a Phosphor icon on every
row (extensions use their own 16 px icon or `PuzzlePiece`): spelling suggestions (at most 5, or a
disabled "No Suggestions") and Add to Dictionary for a misspelled word; links (Open Link in New
Tab, Open Link in Split View, Open Link Here, Download Linked File, Copy Link, Share… on macOS,
plus Copy Email Address for `mailto:`; non-web links hide Open/Download); images (Open Image in New Tab,
Download Image, Copy Image, Copy Image Address); video/audio (Open in New Tab, Download, Copy
Address, Loop, Show/Hide Controls, plus Picture in Picture for video); selection (Go to "…" when
the text is a URL, Search Google for "…", Copy); editable (Cut, Copy, Paste, Paste and Match Style,
Select All); blank spot (Back, Forward, Reload, Copy Page URL, Save Page As…, Print…, View Page
Source); the extensions' items (their icons, submenus and checks) in their own group; then Inspect
Element last. No Look Up / Services on macOS.

**Tooltips** — tab rows, pinned rows and favourite tiles (both sidebar modes) have no native
`title`: resting on one for 500 ms shows a tooltip over the page, beside the sidebar (its strip
starts at the sidebar's right edge; rows send an anchor spanning to that edge) and centred on the
row, on the popovers' opaque card (`--bg-menu`, `0.5 px` `--border-menu`, `--shadow-menu`,
`--radius-tooltip` `8 px`, at most `--tooltip-max-w` wide; no blur): the row's favicon in a small
`--bg-tile` tile (a globe without an inline one), then the title (`13 px` medium, two lines at
most) over the host (`12 px` in `--text-secondary`). Frequent tier motion: enters with a `150 ms`
fade + `250 ms` `--ease-out` scale from `0.97` at the left (sidebar-facing) edge, and fades out in
`180 ms` (`--dur-frequent-exit`, opacity only). Once shown, hovering another row swaps the card's
position and content in place instantly (warm state, same DOM element, no enter replay). Leaving
the sidebar, or resting 80 ms (`TOOLTIP_GRACE_MS`) off the tab rows and tiles (a folder row, a
button, a gap), fades it out, moving onto it hides it at once so the page gets the click, and a
press or a drag start clears it. A menu always wins: opening one drops the tooltip, and none shows
while a menu is open. Folder rows and buttons keep their native `title` (`app/OverlayTooltip`,
`features/sidebar/useTooltip`).

**Tab finder and command field** (`features/finder`) — Ardia command bar geometry on the shared
opaque card: `--finder-w` `652 px` wide, radius `--radius-command` (`20 px`), `--shadow-command`,
centred horizontally over the web window (offset by the sidebar width) and `--finder-top` (20 % of
the window) from the top, in the overlay. Constant tier motion: `100 ms ease` fade only
(`--dur-constant`) on both enter and exit, with no scale or translation and instant arrow-key
selection. No internal dividers: a search row (`--finder-field-h` `44 px`, `15 px` `--text-lg`
input) over a list of `36 px` (`--dock-row-h`) rows with `10 px` (`--radius-dock-row`) concentric
corners whose selected row is tinted with the active space colour at 12 % (`--bg-dock-selected`;
`Overlay.tsx` calls `applySpaceAccent` on the overlay document's `:root` too). ↑/↓ move, Enter runs,
Escape or a click outside closes. The finder (`Mod+K`) ranks the tabs of every space — every word
must be in the title or the host and path; a title that starts with the query first, then title
matches, then URL matches — and activates the one picked, switching space; an empty query lists the
space's tabs. The command field (`Mod+T`) is the **new-tab dock** (`dock.ts`): **Recent Tabs** (this
space's open tabs, most recently active first, up to three, with "In <folder>" or the address beside
the title) and a floating pill footer holding **Quick Actions** (`Docs`, `Meet`, `Sheets`, `GitHub`
→ `docs.new`, `meet.new`, `sheets.new`, `github.com/new`) on the left and a high-contrast Enter
capsule (`--status-on-bg` / `--status-on-fg`, "Switch to Tab ↵" or "Open in New Tab ↵") on the
right. Typing puts "Go to <url>" (or "Search Google for "…"") first and matches open tabs across
**all spaces** (picking another space's tab switches space). The list scrolls inside the window; no
tab is created until Enter.

**Address bar buttons** — lives **inside the page card**, on the page's own colour (`theme-color`
tint kept; opaque `#RRGGBB`, `#RGB`, `rgb()`/`rgba()` and CSS named colours are normalised while
translucent or unsupported values skip tinting; foreground text picks black or white by higher
WCAG contrast, guaranteed ≥ 4.5:1 for 13 px text; height `--addressbar-h` 38 px): transparent URL
field at rest, `--fill-subtle` (`ink 0.05`) fill on hover/edit, host bright (500) + path faint
(400). Left: Back, Forward, Reload (28 px, radius `--radius-toolbar` 6 px, concentric with the
10 px page card). Right: Copy link (`browser.copyLink`; a check mark for 1.2 s) and the site menu
(below; it holds the extensions) — hover-revealed (or visible on focus / while open / while
copied). Both groups are three buttons wide so the URL stays centred (and shrink to content in
split view).

**Page card and split trough** — the floating page card sits inside an `--frame-gap` (8 px) bezel
with `--radius-lg` (10 px, `= PAGE_RADIUS` in main), **no border and no shadow** (contrast with the
tinted frame alone). Native `WebContentsView`s always receive `PAGE_RADIUS` (10 px) in both
attached and card modes so all four corners of the page card stay rounded (in attached mode the
card backing behind the view shares `--bg-surface`, seamlessly joining the address bar). In split
view, each half is its own 10 px card separated from top to bottom by the `--split-gap` (8 px,
`= SPLIT_GAP` in main) frame trough that lets the tinted frame gradient and grain show through:
the focused half carries `AddressBar` at its top and the unfocused half carries a quiet 38 px
click-to-focus header (`SplitInactiveBar`, tinted with its own `theme-color`) so both cards stay
aligned and switching halves never reflows page height. The divider (`SplitDivider`) is invisible
at rest and reveals a centred 3×28 px pill (`--split-handle-w` × `--split-handle-h`) on hover,
keyboard focus or drag. Double-clicking the divider resets 50/50.

**Sidebar title row** — the drag row at the top of the sidebar holds its own buttons: the icons-only
switch on the left (icons only ↔ the width it had, `sidebarExpandedWidth`) and Settings on the
right (`GearSix`, opens Settings). Icon-only mode keeps only the switch, centred. Window
minimize / maximize / close buttons appear at the top right on both macOS and Windows when the top
margin expands (`WindowControls`).

**Site menu** — the sliders button at the right of the address bar opens it, right-aligned under
the button (`features/browser/SiteMenu`). yab's shape, top to bottom:

| Part | Content | Live now |
|---|---|---|
| Quick actions | Icon buttons (`--quick-action-h` 32, `--fill-neutral`, radius `--radius-control` 10), four per row. **Share** (macOS share menu at the pointer; elsewhere copies the URL) | Share. Capture, hide an element and translate are not shown until their modules exist |
| Extensions | Title with **Manage** (disabled, "Soon" tag — plan 5) and **+** (opens the Chrome Web Store in a tab); the tab's extension actions (`<browser-action-list>` of the space's partition, 52×32 tiles via `::part(action)` / `::part(badge)`); "No extensions yet" when empty | Actions, + |
| This site | Rows with a `--status-icon-size` (28 px) status circle (`--status-on-*` / `--status-off-*`), a title and a status line: **Block ads and trackers** (switch; off = the host is in `adBlock.allowedHosts`, disabled when blocking is off everywhere), **Developer tools** (opens the page's DevTools, detached) | Both |
| Footer | "Secure" (https) or "Not secure" (http) pill (`--pill-h` 28, `--fill-neutral`) with a lock, nothing for other schemes; the host on the right in `--text-secondary` | Yes |

Pages that are not web pages (about:blank) show only the extensions. Actions that open something
else (share, DevTools, the Web Store) close the menu; the ad-block switch keeps it open.

**Session status dots** (5 px, like the Claude apps): **gray, blinking** = running · **orange** = waiting
for your action (approval, question) · **blue** = finished, not yet seen · **red** = error ·
**orange ring** = account limited · nothing = idle / seen. Always with a tooltip + `aria-label`.

**Session view** (`features/session`, demo content until sessions are wired):
- the user's messages are notes handed to Claude, right-aligned and slightly askew;
- Claude's text flows as plain prose; tool steps sit on a **dotted timeline** with an icon node each
  (search, read, edit, bash); edits expand into an inline diff;
- the **approval sheet** docks above the composer, tinted with the waiting color, with
  Deny / Always for project / Allow once and their keys;
- the **composer** has chips for context profile and model, the folder path, and a round send button.

**Main pane**
- Header (also the window drag region): title (editable inline), account, model, cwd.
- Transcript: user / assistant blocks, collapsible tool calls, inline diffs (v1), virtualized.
- Inline banners: handoff suggestion, errors.
- Approval sheet docked above the composer — never a modal that hides the transcript.
- Composer: multiline, `⏎` send, `⇧⏎` newline; chips below for context profile, model, cwd.

## 3. Design tokens

All visual values are CSS custom properties on `:root`, toggled by `data-*` attributes on `<html>`.
Components only ever reference tokens — never raw colors or pixel values.

```html
<html data-scheme="light" data-glass="on" data-platform="mac" style="--accent:…; --transparency:…; --grain:…; --frame-top:…; --frame-bottom:…">
```

### 3.1 Color

The user picks **one accent** (onboarding; default `DEFAULT_ACCENT = '#7C5CFF'`); each space has
its own colour (`space.color`) that drives the window frame and space-tinted tokens (`applySpaceAccent`
sets `--space-accent`, `--space-accent-soft`, `--bg-dock-selected`, and `--selection-bg` on
`document.documentElement` so derived tokens resolve to the active space everywhere). The frame is
a vertical gradient over a warm neutral (`theme/windowTint.ts`, `theme/FrameBackdrop.tsx`):
chromatic space colours are normalised in HSL (`S = 0.36`, `L = 0.527`, bottom stop lifted `+0.25`
in lightness) so every hue carries calm, uniform visual weight, then blended over `#FBFAF9` in
light (`a = 0.27`, or `0.09` for neutral spaces) and `#29292A` in dark (`a = 0.18`, or `0.06` for
neutral spaces). Neutral detection uses sRGB chroma `(max − min) / 255 < 0.06` (rather than HSL
saturation) so near-white and near-black colours (`#F8F8FA`, `#0A0A0C`) stay neutral instead of
getting an inflated chromatic tint. Switching spaces crossfades stacked gradient + grain layers in
400 ms `ease` (`--dur-space-switch`, preserving the settled bottom layer when capping rapid
switches) while colour-scheme changes flip in place with the rest of the tokens. Secondary, muted,
faint and placeholder text use WCAG AA alpha ink (`0.65 / 0.58 / 0.58 / 0.58` light `rgb(0 0 0 / α)`,
`0.70 / 0.62 / 0.60 / 0.60` dark `rgb(255 255 255 / α)`) so it harmonises with any space tint.

| Token | Role |
|---|---|
| `--accent` / `--space-accent` | Chosen app accent / active space colour (set on `:root` via `applySpaceAccent`) |
| `--accent-soft` / `--space-accent-soft` | `color-mix(in oklch, var(--accent) 16%, transparent)` / space colour at 12 % (`--bg-dock-selected`) |
| `--on-accent` / `--on-danger` | Text/icon on accent (computed from luminance) / always white on `--danger` |
| `--knob` | Control knobs and thumbs (switch, slider, colour picker ring, pressed liquid-glass cell rim): `#ffffff` in both schemes |
| `--danger-hover` | Destructive button hover: `--danger` mixed 88 % with `--text` |
| `--key-bg` | Keycap fill in the command dock's Enter pill: the surrounding text colour at 16 % |
| `--frame-base` | Warm neutral base behind the frame gradient (`#fbfaf9` light / `#29292a` dark) |
| `--frame-top` / `--frame-bottom` | Vertical frame gradient stops computed from the space colour (`windowTint.ts`) |
| `--frame-alpha` | Frame opacity (`1` opaque, fades with `--transparency`, `0.3` in liquid glass) |
| `--bg-window` | Window fallback background (`var(--frame-base)`, `transparent` when glass is on) |
| `--bg-sidebar` | Frame vertical gradient derived from `--frame-top`/`--frame-bottom` and `--frame-alpha` (used by onboarding) |
| `--bg-surface` / `--neutral-surface` | Page card surface (`#ffffff` light / `#1c1c1e` dark) |
| `--bg-raised` / `--bg-popover` / `--bg-menu` | Opaque overlay cards (`#ffffff` light / `#2c2c2e` dark) |
| `--bg-menu-hover` / `--bg-backdrop` / `--bg-settings-group` | Neutral menu hover/selected row (`ink 0.08`), Settings modal backdrop scrim, and Settings grouped section card fill (`ink 0.028` light / `white 0.045` dark) |
| `--bg-dock-selected` | Command dock selected row (`--space-accent` at 12 %) |
| `--bg-row-hover` / `--bg-row-active` / `--border-row-active` / `--shadow-row-active` | Sidebar row hover (`ink 0.05`) and active elevated card (`rgba(255,255,255,0.70)` light + hairline rim + soft shadow / `rgba(255,255,255,0.10)` dark) |
| `--bg-pill` / `--bg-pill-hover` / `--shadow-pill` | Floating pill buttons inside popovers and the command dock |
| `--fill-subtle` / `--fill-neutral` / `--fill-neutral-hover` / `--fill-pressed` | Ink-based neutral fills (`0.05` / `0.06` / `0.08` / `0.12–0.14`) for URL hover/edit, quick actions, tiles, rows and pressed buttons |
| `--border-menu` / `--border-menu-w` / `--shadow-menu` / `--shadow-command` | Overlay card hairline (`0.5px`, `ink 0.12` light / `white 0.10` dark), popover shadow (`0 8px 24px rgb(0 0 0/0.14), 0 1px 3px rgb(0 0 0/0.10)`), and command-dock shadow |
| `--shadow-lift` | A sidebar row lifted while it is dragged (light and dark) |
| `--bg-tile` / `--bg-tile-hover` | Favourite tile card (`ink 0.06` at rest, hover lift) |
| `--border` / `--border-strong` / `--border-separator` | Hairlines (`ink 0.09`, `ink 0.16`, sidebar separator `ink 0.10`) |
| `--split-handle` / `--split-handle-active` | Split divider hover pill (`ink 0.28` light / `white 0.32` dark) and drag pill (`0.50` / `0.55`) |
| `--selection-bg` / `--scrollbar-thumb` / `--scrollbar-thumb-hover` | Palette-themed browser selection and custom scrollbars |
| `--text` / `--text-muted` / `--text-secondary` / `--text-faint` / `--text-placeholder` | Text hierarchy (`#1c1c1e` light / `#f5f5f7` dark + alpha ink steps) |
| `--status-on-bg` / `--status-on-fg` / `--status-off-bg` / `--status-off-fg` | Site-menu row status circle fills and glyphs |
| `--switch-off` / `--caret` | Switch off-track and text selection / focus caret (`#0a84ff`) |
| `--tint-sage` … `--tint-teal` | Six muted pastel tints (light and dark) for the Settings offset-ink icons |
| `--ok` / `--warn` / `--danger` | Generic success / warning / error |
| `--status-running` / `--status-waiting` / `--status-done` | Session dots: gray / orange / blue |
| `--control-active` | Selected segment / active control fill |

**Accent picker** (`ui/ColorPicker`): eight presets on top, then a **dot field** — dots colored by hue
(across) and lightness (down) that **swell like under a lens** around the chosen color and around
the pointer; a big ringed knob marks the pick. Below: an **Intensity** wave slider (saturation) and a
hex field that applies as soon as the value is valid. Drag, click or arrow keys.

### 3.0 Art direction

The goal: a UI that feels unique and makes you want to touch it — not a stack of buttons seen a
thousand times.

- **Type**: the platform's UI font (`system-ui`) for the whole UI; mono only for numbers, paths
  and keys. A font setting comes in plan 5.
- **Icons**: **Phosphor**, **duotone** by default (`IconContext` in `App.tsx`), 15–18 px for the
  browser UI. The **Settings** navigation uses the **"offset ink"** set
  (`src/renderer/src/ui/icons/`, `InkIcon` / `inkIcon()`, `--tint-*` tokens). Folders are
  **illustrated glyphs** (two-tone folder, paper peeking out when open), colored per folder name;
  sessions get a small chat-bubble glyph.
- **Askew cards**: hovered and selected items tilt slightly; every item has **its own angle**
  (stable hash of its id, ±0.3–1.1° hover, ±0.6–1.5° selected) so a list never moves in lockstep.
  Only the card layer tilts — text never moves. Hover/selected fills are **neutral** (a light lift
  on the frame), never the accent.
- **Drawn controls**: sliders draw what they do (§3.4); the accent picker is a wheel (§3.1).
- **Motion**: hover/press, plus rows and cards that enter and leave. A closed tab row shrinks and
  fades out (`--dur-base`, `ui/usePresence` keeps it mounted, inert, as `tab-exiting`); folders fold
  with a `grid-template-rows` 1fr to 0fr transition and keep their tabs mounted but inert; the
  Settings view and the overlay cards play their open animation backwards (`--dur-fast`) before
  they go. All of it uses `--dur-*` / `--ease-*`, so `prefers-reduced-motion` removes it.

### 3.2 Material

Two settings drive the material, both 0–1 and set as CSS variables:

| Setting | Effect |
|---|---|
| `transparency` → `--transparency` | `0` = opaque (`--frame-alpha: 1`). The **slider** covers the frosted range (0–0.89): native blur of the desktop under a fading tinted gradient (`--frame-alpha: calc(1 - var(--transparency) * 0.88)`). **Liquid glass** is a separate cell at the end of the slider (value 1, `data-glass="liquid"`): no blur, the frame thins to `--frame-alpha: 0.3` and the **desktop shows through it**; the sidebar floats as a glass panel. `FrameBackdrop` applies `--frame-alpha` on its wrapper so space-switch crossfades never double-alpha over vibrancy. |
| `grain` → `--grain` | Scales the per-scheme grain target (`--grain-base`: `0.05` light, `0.006` dark; `--grain-opacity: calc(var(--grain-base) * var(--grain) / 0.35)` so default `0.35` hits exact target and `0` = off). |

### 3.4 Sliders

`ui/Slider` draws its track; the thumb is a **bump** — a white shape, **flat on its left side**, with a **half-circle bulging out on its right side** — and
a transparent native range input sits on top for keyboard, pointer and screen readers:

| Variant | Track | Used for |
|---|---|---|
| `wave` | a ripple up to the thumb whose amplitude grows to the right; flat line after | Transparency (followed by the Liquid glass cell), color intensity |
| `speckle` | grain dots, denser to the right; dimmed past the thumb | Grain |
| `gradient` | a color ramp from the caller | Brightness in the color picker |

### 3.3 Shape, space, type, motion

| Group | Tokens |
|---|---|
| Spacing (4 px scale) | `--space-hair` 2 (tight icon rows) · `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-6` 24 · `--space-8` 32 |
| Radius (concentric) | `--radius-sm` 4 · `--radius-md` 6 · `--radius-toolbar` 6 (address bar nav buttons) · `--radius-menu-row` 6 · `--radius-footer-btn` 7 · `--radius-row` 8 (sidebar rows) · `--radius-tooltip` 8 · `--radius-lg` 10 (page card `= PAGE_RADIUS`) · `--radius-tile` 10 · `--radius-dock-row` 10 · `--radius-control` 10 · `--radius-menu` 10 · `--radius-popover` 10 · `--radius-command` 20 (dock / finder) · `--radius-pill` 999 |
| Font | `--font-sans`: `system-ui, -apple-system, "Segoe UI Variable", "Segoe UI", sans-serif` · `--font-mono`: `ui-monospace, "SF Mono", "Cascadia Code", monospace` |
| Type scale & weights | `--text-xs` 11 · `--text-status` 11.5 · `--text-sm` 12 · `--text-menu` 13 · `--text-md` 13 (body, rows, address bar) · `--text-lg` 15 (dock input) · `--text-xl` 20 · `--weight-regular` 400 · `--weight-medium` 500 · `--weight-semibold` 600 |
| Layout | `--sidebar-w` 228 · `--sidebar-inset` 9 · `--titlebar-h` 44 · `--addressbar-h` 38 · `--frame-gap` 8 (bezel around the page card) · `--split-gap` 8 (frame trough between split cards `= SPLIT_GAP` in main) · `--split-handle-w` 3 / `--split-handle-h` 28 (invisible divider pill revealed on hover/focus/drag) · `--row-h` 34 · `--row-gap` 3 · `--space-header-h` 30 · `--folder-indent` 14 · `--footer-h` 36 · `--footer-btn-size` 28 · `--tile-h` 41 · `--tile-gap` 6 · `--tile-ring-w` 3 · `--tile-min-w` 64 · `--connector-w` 28 · `--tooltip-max-w` 280 · `--title-fade` 24 / `--title-fade-hover` 44 · `--folder-bar-w` 2 · `--folder-hue-s` 70% / `--folder-hue-l` 48% · `--window-controls-h` 32 (`= WINDOW_CONTROLS_H`) · `--window-control-w` 44 · `--finder-w` 652, `--finder-top` 20vh, `--finder-field-h` 44, `--dock-row-h` 36 · `--menu-row-h` 28 · `--menu-row-h-tall` 42 · `--menu-row-pad` 10 · `--menu-inset` 5 · `--border-menu-w` 0.5px · `--popover-pad` 12 · `--downloads-w` 300 · `--downloads-row-h` 40 · `--progress-h` 3 · `--settings-nav-w` 214 · `--settings-header-h` 52 (Settings pane header) |
| Controls | `--control-size` 30 · `--control-size-sm` 28 (address bar buttons and field) · `--control-size-xs` 24 (in-row buttons) · `--icon-size` 16 · `--space-dot` 6 · `--favicon-size` 16 · `--tile-icon-size` 20 · `--status-icon-size` 28 · `--quick-action-h` 32 · `--ext-tile-w` 52 · `--pill-h` 28 · Switch: `--switch-w` 30 × `--switch-h` 17, `--switch-thumb` 13, `--switch-travel` (track − thumb − 2 × `--space-hair`) · `--key-size` 18 (keycap) · `--focus-ring-inset-w` 1.5 (keyboard ring inside menu rows) |
| Motion curves | `--ease`: `ease` (fades, presses) · `--ease-out`: `cubic-bezier(0.2, 0.4, 0.1, 0.98)` (enters) · `--ease-in-out`: `cubic-bezier(0.4, 0.05, 0.2, 1)` (state moves, exits) · `--ease-morph`: `cubic-bezier(0.35, 0.05, 0, 0.95)` (folder/section morphs) · legacy aliases `--ease-in` / `--ease-bounce` kept for un-migrated consumers |
| Motion durations (by frequency tier) | Press/release/hover: `--dur-press` 75 ms, `--dur-release` 350 ms, `--dur-hover` 200 ms · Constant (`⌘T`, `⌘K`, `⌘L`, tab switch): `--dur-constant` 100 ms (fade only) · Frequent (menus, popovers, tooltips, controls): `--dur-frequent-fade` 150 ms, `--dur-frequent-move` 250 ms, `--dur-frequent-exit` 180 ms, `--delay-tooltip` 500 ms · Occasional (settings, confirm, downloads): `--dur-occasional-fade` 400 ms, `--dur-occasional-move` 450 ms, `--dur-occasional-exit` 300 ms · Rows & morph: `--dur-row-fade` 150 ms, `--dur-row-enter` 250 ms, `--dur-row-exit` 180 ms, `--dur-row-collapse` 250 ms, `--dur-morph` 400 ms · Drag: `--dur-drag-shift` 150 ms, `--dur-drag-settle` 250 ms · Space switch: `--dur-space-switch` 400 ms, `--dur-swap-out` 150 ms, `--dur-swap-delay` 75 ms · Scales: `--scale-press` 0.97, `--scale-enter` 0.97, `--scale-hover-swatch` 1.14 (colour preset), `--scale-hover-thumb` 1.08 (slider thumb) · Legacy durations (`--dur-fast`, `--dur-base`, `--dur-popover-in/out`, `--dur-command`, `--dur-spin`, `--dur-intro*`) kept for un-migrated consumers. Under `prefers-reduced-motion: reduce`, move/scale tokens zero out while fade durations stay active. |
| Opacity | `--opacity-unloaded` 0.5 (sidebar tabs whose page is not loaded yet; full on hover and on the active tab) |

## 4. Transparency, per platform

| | macOS | Windows 11 | Windows 10 / fallback |
|---|---|---|---|
| Window | `transparent: true` (always; set at creation) | normal | normal |
| Frosted (0 < t < 0.9) | `vibrancy: 'under-window'` | `backgroundMaterial: 'acrylic'` | none: transparency forced to 0 |
| Clear / liquid (t ≥ 0.9) | no vibrancy: the transparent window shows the desktop as is | acrylic (no clear mode) | — |
| Title bar | `titleBarStyle: 'hiddenInset'`, traffic lights in the sidebar | `titleBarStyle: 'hidden'`, no native caption buttons: the UI draws them in the top margin (below) | same as Win 11 |
| Switching | `applyMaterial()` only when the material changes (opaque / frosted / clear), never on every slider tick | same | — |

How see-through the frame is, and the liquid glass look, are pure CSS (§3.2).

**Window buttons in the top margin** (macOS and Windows; Linux keeps its native title bar). The
window's top margin runs along the whole window, above the sidebar and the page, `--frame-gap`
high, and the window buttons wait in it, hidden. When the pointer rests on it for 120 ms
(`REVEAL_DELAY_MS`) it grows to `--window-controls-h` (`--dur-frequent-fade`, 150 ms; instant under
reduced motion), pushing everything down, and
the buttons come; it closes 250 ms (`HIDE_DELAY_MS`) after the pointer leaves. Passing over the
margin opens nothing (`app/WindowControls`, `app/controlsReveal`).
- **Windows**: no native caption buttons. Minimize, maximize / restore and close are drawn at the
  top right and slide in; Close turns `--danger` on hover. Snap layouts on the maximize button
  are lost (the buttons are not native).
- **macOS**: the traffic lights are hidden (`window.setControlsVisible`) and shown in the open
  margin (`trafficLightPosition` 14, 9).
- Closed, the margin is not a drag region (Windows sends no pointer events over one, and the hover
  is what opens it). Open, it drags the window (its buttons do not); since the page then gets no
  pointer events there, main watches the pointer every 50 ms and reports leaving the top band
  (`window.topHover`), on both platforms. The sidebar's top and the address bar drag the window
  too. During the onboarding the margin floats over the screen.

## 5. Grain

`FrameBackdrop` (in the main shell) and `.grainy` containers (the onboarding page) render a
pre-rendered `128×128 px` fine SVG noise tile at `64×64 px` (`image-rendering: pixelated`) **under**
their children — the grain lives on the window frame, never over content, and crossfades with the
frame gradient on space switch. Opacity follows `--grain-opacity` (`0.05` light, `0.006` dark at
default grain `0.35`; `0` = off); no live filter, so it costs nothing at runtime.

## 6. Onboarding (first launch)

A **full-window page**, not a dialog: it owns the whole window (glass, grain and traffic lights
included) until it's done. Three moments:

| # | Screen | Content |
|---|---|---|
| 1 | **Intro** | The YAAS logo alone, centered. After ~1.2 s (or a click / `⏎`) the logo shrinks and glides to the top-left, and the visual setup fades in — the animation *leads* into screen 2 |
| 2 | **Visual setup** | One page, live preview on the right (a mini sidebar that reflects every choice): accent color (wheel, hex, presets), appearance (light / dark / system), transparency slider, grain slider, account switcher style (emoji / letter / dots) |
| 3 | **Technical setup** | First account: **Import existing Claude Code** (`~/.claude`, shows plan/email from `auth status`) and/or **Sign in a new account** (browser); default context for new sessions (**Clean** / **Inherit `~/.claude`**); Claude Code CLI detection (path + version). `Open YAAS` finishes |

`←` / `→` move between screens 2 and 3. `prefers-reduced-motion` replaces the intro animation by a
short fade. All choices are editable later in Settings. Onboarding state is stored in `settings`.

## 7. Settings

A **modal dialog** (centered panel, 880 × up to 640 px, radius `--radius-command` `20 px`, hairline
`--border-menu`, `--shadow-command`, over `--bg-backdrop`), opened from the gear at the top right
of the sidebar, the + menu, or `Mod+,`; `Esc`, the close button or a click on the backdrop closes
it. Occasional tier motion: enters with a `400 ms ease` fade + `450 ms --ease-out` scale from `0.97`
and retraces on a `300 ms` exit (`--dur-occasional-exit`, `inert` while closing). **Left
navigation** (`--settings-nav-w` `214 px`, warm neutral `--neutral-sidebar`) lists the sections
with offset-ink icons; the right pane shows grouped section cards (`--bg-settings-group`, `10 px`
radius, `12 px`-inset hairline dividers). Each option is a row: label + one-line description on the
left, control on the right. Options not built yet are shown disabled with a "Soon" tag so the full
scope stays visible.

| Section | Option | Values (default) | Stage |
|---|---|---|---|
| **General** | Default browser | Make default / Default (Windows opens OS Default apps) | ✅ |
| | Open at login | Off | v1 |
| | Restore open sessions on launch | On | MVP |
| | Default folder for new sessions | Last used · Ask every time · Fixed folder | MVP |
| | Confirm before closing a running session | On | MVP |
| | Language | English (more later) | later |
| | Check for updates | Automatically · Manually | later |
| **Appearance** | Color (wheel + hex + presets), scheme, transparency (→ liquid glass), grain | as in onboarding | MVP ✅ |
| | Account switcher | Emoji · First letter · Dots | MVP ✅ |
| | Meters (context + usage) | Context bar · Sidebar | MVP ✅ |
| | Askew cards | On · Off | ✅ |
| | Magnetic buttons (lean toward the pointer, scale 1.08) | **On** · Off | ✅ |
| | Automatic folders (3+ today tabs of one site grouped) | **On** · Off | ✅ |
| | Address bar | Own card · **Attached to the page** (separator line) | ✅ |
| | Interface density | Comfortable · Compact | v1 |
| | Transcript font size | 12 · 13 · 14 · 15 | v1 |
| **Accounts** | List: emoji, name, color, plan, sign-in status; add / sign out / remove | — | MVP |
| | Per account: default model, default context profile | — | MVP |
| | Custom usage reset schedule, per account and per weekday | — | later |
| **Sessions** | Default model for new sessions | Account default · Opus · Sonnet · Haiku | MVP |
| | Default permission mode | Ask · Accept edits · Plan | MVP |
| | Close idle Claude processes after | 5 · 10 · 30 min · Never (10 min) | MVP |
| | Auto-archive inactive sessions | Off · after 1 / 3 / 7 / 14 / 30 days | v1 (UI ✅) |
| **Context profiles** | Profiles list (Clean, Inherit `~/.claude`, custom): skills, MCP servers, plugins, CLAUDE.md | — | MVP |
| | Default profile for new sessions | Clean | MVP |
| **Permissions** | Saved rules (tool pattern · project/account · allow/deny), revoke | — | MVP |
| | Require a second confirmation for account-wide rules | On | MVP |
| **Handoff** | Suggest a handoff when usage reaches | 80 % · 90 % · Only when limited (90 %) | MVP |
| | Fallback account order | drag to reorder | MVP |
| | Default handoff mode | Full transcript · Hybrid | v1 |
| **Crew** | Allow Claude to propose delegation | Off | v1 |
| | Max parallel delegates | 1–5 (2) | v1 |
| | Run delegates in git worktrees | On | v1 |
| **Notifications** | Session waiting for your action | On | MVP |
| | Session finished (window not focused) | On | MVP |
| | Account limited / usage reset | On | v1 |
| | Sound | Off | v1 |
| **Shortcuts** | List of all shortcuts (read-only); remapping | — | MVP / later |
| **Privacy & data** | Data folder (reveal), export settings, rebuild search index | — | v1 |
| | Block ads (default on) — per-site toggle in the site menu | On · Off | plan 5 (Privacy panel) |
| | Statement: no telemetry, no hidden model calls | — | MVP |
| **Advanced** | Claude Code CLI: bundled · system (path + version) | Bundled | MVP |
| | Open logs folder, developer tools | — | MVP |
| | Replay onboarding (also `npm run dev:onboarding`) | — | MVP ✅ |
| **About** | Version, docs, license, acknowledgements | — | MVP |

Auto-archive only archives (never deletes); pinned sessions are never auto-archived.
Every option that spends tokens is absent by design (FEATURES.md principle 1).

## 8. Keyboard shortcuts

`Mod` = ⌘ on macOS, Ctrl on Windows.

| Action | Shortcut |
|---|---|
| New tab: the command field over the page (a URL or a search; a tab opens on Enter) | `Mod+T` |
| Find a tab, in any space (the tab finder) | `Mod+K` |
| Close tab (a favourite or pinned tab is unloaded) | `Mod+W` |
| Reopen closed tab | `Mod+Shift+T` |
| Reopen closed tab, while the UI has focus and no text field does (else the text undo) | `Mod+Z` |
| Focus the address bar | `Mod+L` |
| Reload | `Mod+R` |
| Back / forward | `Mod+[` / `Mod+]` |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Split view: the active tab with the next row of its list, else the previous | `⌃⌘\` (macOS) / `Ctrl+Shift+\` (Windows) |
| Settings | `Mod+,` |

Shortcuts are bound in the main-process application menu (`src/main/menu.ts`), because a focused
web page swallows renderer key events. `Mod+Z` is the exception: a keydown handler of the UI
(`app/Shell.tsx`), so in a page or a field it stays the normal undo. Several windows (`Mod+N`) were
dropped by the owner.

Shortcuts are defined in one registry (renderer) that also feeds the palette, so they can be
remapped later.

### Privacy note: browsing history

Browsing history (pages visited, per space) is personal data. It is kept only in the local
database, never sent anywhere, shown only in the new-tab dock's suggestions, and each entry can be
forgotten there. Deleting a space deletes its history.

### Downloads

The sidebar footer's left button (aria-label "Downloads") opens the downloads card (overlay kind
`downloads`, a `300 px`-wide `--downloads-w` `AnchoredCard` opening upward on the funnel with
Occasional tier motion). It lists every space's downloads, newest first, in `40 px`
(`--downloads-row-h`) rows with a `24 px` leading icon tile, the saved file name, a `3 px`
(`--progress-h`) progress bar while downloading (pulsing when size is unknown), and tabular-numeral
size + "Show in Finder" (macOS) / "Show in Explorer" (Windows). Clear forgets the finished rows,
never the files. Files go straight to the system Downloads folder with no dialog. Downloads are
personal data: kept only in the local database.

## 9. Accessibility

- Body text contrast ≥ 4.5:1 in both schemes. Body text never sits on the accent; labels on the
  accent (buttons, badges — short and bold) use `--on-accent`: white when it reaches 3:1, else black.
- Full keyboard navigation with visible focus rings (`--accent`).
- Status glyphs always have a text label (tooltip + `aria-label`), never color alone.
- `prefers-reduced-motion` and `prefers-reduced-transparency` (forces glass off) respected.
