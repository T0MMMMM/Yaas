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
- **Resizable**: drag its right edge (200–440 px, default 248, saved in settings); double-click the
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
  the emoji or dot.
- **Pinned**: pinned tabs and folders in one ordering. A folder row (the folder glyph, or an emoji)
  opens and closes on click; opening swings the glyph's front flap up from its bottom edge and
  lifts the paper (`--dur-base`, `--ease-bounce`, still under reduced motion). "Change Icon…" opens
  a card from the row: the 7 folder hues, an emoji field (letters are refused with a hint;
  choosing the current emoji closes the card) and Default (the hue of the name). Icon-only, the
  filed-tab bars use the chosen hue (the name's hue for an emoji); a closed folder shows its tab count on the right. Its tabs are listed
  one `--space-3` indent below. "New Folder…" and "Rename" (its menus) put its name in an
  inline field: Enter or leaving it saves, Esc cancels.
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
- Every row and tile: right-click opens its menu, drawn at the pointer (tab: pin, favourites,
  move to folder ▸, copy, duplicate, close; folder: rename, move to folder ▸, delete). A tab whose page is not loaded is dimmed
  (`--opacity-unloaded`). Cards tilt per item (askew cards), none when the setting is off.
- **Drag and drop** (`useTabDrag`, pointer events): drag a tab row or tile to reorder it, pin it,
  favourite it or file it into a folder. The upper half of a row drops before it, the lower half
  after it; the middle half of a pinned folder's row files into it; the tiles grid adds it to the
  end of the favourites. A `--drop-line-w` `--accent` line marks the insertion point, a folder or
  list the drop goes into gets the `--accent-soft` fill, the dragged row is at
  `--opacity-dragged`. Empty favourites and pinned lists appear while dragging so a tab can be
  dropped on them. A today tab moves with its subtree; a drop on a nested tab lands after its
  top-level tab's subtree (the line is drawn there). For a tab of another site, an automatic
  folder is one block (before or after it); a tab of its own site joins it. A drop on the dragged
  tab itself, or of a favourite on the favourites, is no move. Esc cancels.

**Popovers** (the + menu, the site menu) float over the page in the overlay view and share one
opaque card (`ui/Popover.module.css`, composed by each popover's own CSS module: `--bg-menu`,
`--border-menu`, `--shadow-menu`, rows hovered with `--bg-menu-hover`). A connector joins the card
to its button: a funnel in the card's fill and border, the gap (`POPOVER_GAP` 10) tall — a
triangle pointing at the button with every corner very round: its `--connector-w` wide side
leaves the card's border tangent to it, its sides run straight in and meet in a broad round tip
resting on the button (`ui/PopoverNeck`, an SVG; it runs 1 px onto the button). It
is centred on the button but kept clear of the card's rounded corners (`ui/connector.ts`; the card
is placed so the button's centre lies that far inside its edge, `.alignLeft`/`.alignRight` in
`Popover.module.css`); the button takes the
`--bg-menu` fill while open, at rest (no hover tilt or magnetic lean). Opening, the card's shape
grows out of the funnel's tip from a tenth of its size (`--dur-spring`, `--ease-bounce`; the
centred cards from their top centre); closing plays it backwards (`--dur-fast`, the card gets `data-state="closing"`) before the overlay hides;
a chosen item's action runs first, never after the animation. The + menu has a
filter field at the top (Enter picks the first match) and New tab (the command field, like ⌘T and the sidebar's New tab row), New folder (its name is edited
at once), New space, Settings.

**Menus** (`ui/Menu`) — every menu is drawn by Big Browser, never a native one (except macOS
Share and the menu bar). Rows: a leading `--icon-size` slot (the item's icon, a check for the
checked item, or empty so labels line up; only when some row of the card has one), the label, then
the shortcut or a submenu's caret. A disabled row is `--text-faint` and takes no hover. A menu
opened from a button keeps the funnel and grows from it; a menu opened at the pointer (a
right-click) has no neck: its top-left corner sits on the pointer and it grows from there, flipped
left of / above the pointer where there is no room (`placeCard`, kept `POPOVER_GAP` inside the
window; taller than the window, it scrolls). A **submenu** is a second card of the same look
beside its row (4 px from the card, its first row level with the row; flipped to the left side
when there is no room), opened by hovering the row, → or Enter, closed by ← or by resting on another
row for 250 ms (`SUBMENU_GRACE_MS`: the pointer can cross rows on its way into the submenu); its
row keeps the hover fill while open. Keyboard: ↓/↑ within a card (↓ from a menu opened at
the pointer reaches its first row), Enter or Space chooses, Escape or a click outside closes every
card. Hovering a row moves the keyboard to it, except while a filter field has it: typing still
goes to the field.

**Page menu** — right-clicking a page draws its menu at the pointer: spelling suggestions (at most
5, or a disabled "No Suggestions") for a misspelled word, then the link, image, edit or selection
entries, Back / Forward / Reload on a blank spot, the extensions' items (their icons, submenus and
checks) in their own group, then Inspect. No Look Up / Services on macOS.

**Tooltips** — tab rows, pinned rows and favourite tiles (both sidebar modes) have no native
`title`: resting on one for 500 ms shows a tooltip over the page, beside the sidebar (its strip starts at the sidebar's right edge; rows send an anchor spanning to that edge) and centred on
the row, on the popovers' opaque card (`--bg-menu`, `--border-menu`, `--shadow-menu`,
`--radius-lg`, at most `--tooltip-max-w` wide; no blur): the row's favicon in a small `--bg-tile`
tile (a globe without an inline one), then the title (semibold, two lines at most) over the host
in `--text-muted`. Once shown, hovering another row springs the same card there (`top`,
`--dur-base`, `--ease-bounce`) with no new delay. Its shape grows out of the sidebar's edge by
its row (from 15 % of its size, `--dur-spring`, `--ease-bounce`) and shrinks back as it fades out
(`--dur-fast`); leaving the sidebar, or resting 80 ms (`TOOLTIP_GRACE_MS`) off the tab rows and tiles (a folder row, a button, a gap), fades it out (the overlay's strip hides 150 ms later), moving
onto it hides it at once so the page gets the click, and a press or a drag start clears it. A menu
always wins: opening one drops the tooltip, and none shows while a menu is open. Folder rows and
buttons keep their native `title` (`app/OverlayTooltip`, `features/sidebar/useTooltip`).

**Tab finder and command field** (`features/finder`) — the same opaque card (and exit), `--finder-w` 560 wide,
centred `--finder-top` (20 % of the window) from the top, in the overlay: a field over a list,
↑/↓ move, Enter runs, Escape or a click outside closes. The finder (`Mod+K`)
ranks the tabs of every space — every word must be in the title or the host and path; a title
that starts with the query first, then title matches, then URL matches — and activates the one
picked, switching space; an empty query lists the space's tabs. The command field (`Mod+T`) is
the **new-tab dock** (`dock.ts`): titled sections (small, faint) — **Recent Tabs** (this space's
open tabs, most recently active first, up to six, "In <folder>" on the right when filed),
**Frequent** (the space's six most visited pages, each with a "−" on the selected row that forgets
it) and **Quick Actions** (docs.new, meet.new, sheets.new, github.com/new). Typing puts "Go to
<url>" (or "Search Google for "…"") first and filters every section; open tabs and history then
match across **all spaces** (picking another space's tab switches space). A footer names what
Enter does with the selected row: "Switch to Tab ↵" or "Open in New Tab ↵". The list scrolls
inside the window; no tab is created until Enter.

**Address bar buttons** — left: the sidebar switch (icons only ↔ the width it had,
`sidebarExpandedWidth`), Back, Forward, Reload. Right: Copy link (`browser.copyLink`; a check
mark for 1.2 s), the site menu (below; it holds the extensions) and Design, which opens Settings
at Appearance for now (the browser's style editor comes later). Both groups are four buttons wide
so the URL stays centred.

**Site menu** — the sliders button at the right of the address bar opens it, right-aligned under
the button (`features/browser/SiteMenu`). yab's shape, top to bottom:

| Part | Content | Live now |
|---|---|---|
| Quick actions | Icon buttons, four per row. **Share** (macOS share menu at the pointer; elsewhere copies the URL) | Share. Capture, hide an element and translate are not shown until their modules exist |
| Extensions | Title with **Manage** (disabled, "Soon" tag — plan 5) and **+** (opens the Chrome Web Store in a tab); the tab's extension actions (`<browser-action-list>` of the space's partition, restyled through `::part(action)` / `::part(badge)`); "No extensions yet" when empty | Actions, + |
| This site | Rows with an icon, a title and a status line: **Block ads and trackers** (switch; off = the host is in `adBlock.allowedHosts`, disabled when blocking is off everywhere), **Developer tools** (opens the page's DevTools, detached) | Both |
| Footer | Lock + "Secure" (https) or open lock + "Not secure" (http), nothing for other schemes; the host on the right | Yes |

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
<html data-scheme="light" data-glass="on" data-platform="mac" style="--accent:…; --transparency:…; --grain:…">
```

### 3.1 Color

The user picks **one accent** (onboarding); each space can override it. Everything else is derived
with `oklch()` / `color-mix()`, so any accent stays legible in both schemes.

| Token | Role |
|---|---|
| `--accent` | Chosen color (app default or active space) |
| `--accent-soft` | `color-mix(in oklch, var(--accent) 16%, transparent)` — selected tab, hovers |
| `--accent-strong` | Accent adjusted for contrast with text on it |
| `--on-accent` | Text/icon on accent (black or white, computed in JS from luminance) |
| `--bg-window` | Window background (`transparent` when glass is on) |
| `--bg-sidebar` | Sidebar fill: accent-tinted neutral; translucent when glass is on |
| `--bg-surface` | Main pane |
| `--bg-raised` | Cards, approval sheet, palette, menus |
| `--bg-menu` / `--bg-menu-hover` | Opaque menu and popover card (light grey; dark grey in the dark scheme) and its hovered row |
| `--border-menu` / `--shadow-menu` | Menu card hairline and shadow |
| `--bg-tile` | Favourite tile card |
| `--border` / `--border-strong` | Hairlines |
| `--text` / `--text-muted` / `--text-faint` | Text hierarchy |
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
- **Icons**: **Phosphor**, **duotone** by default (`IconContext` in `App.tsx`), 15–18 px. Folders
  are **illustrated glyphs** (two-tone folder, paper peeking out when open), colored per folder name;
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
| `transparency` → `--transparency` | `0` = opaque. The **slider** covers the frosted range (0–0.89): native blur of the desktop under a fading frame. **Liquid glass** is a separate cell at the end of the slider (value 1, `data-glass="liquid"`): no blur, the frame thins to a light tint (30 %, never fully clear) and the **desktop shows through it**; the sidebar and the session card float on it as glass panels (semi-opaque, lit edge, soft sheen, shadow). |
| `grain` → `--grain` | Grain intensity on the frame (opacity `grain × 0.3`), `0` = off. |

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
| Radius | `--radius-sm` 6 · `--radius-md` 10 · `--radius-lg` 14 · `--radius-pill` 999 |
| Font | `--font-sans`: `system-ui, -apple-system, "Segoe UI Variable", "Segoe UI", sans-serif` · `--font-mono`: `ui-monospace, "SF Mono", "Cascadia Code", monospace` |
| Size | `--text-xs` 11 · `--text-sm` 12 · `--text-md` 13 (base) · `--text-lg` 15 · `--text-xl` 20 |
| Layout | `--sidebar-w` 248 · `--titlebar-h` 44 · `--addressbar-h` 38 · `--frame-gap` 5 (between the frame's panels) · `--row-h` 38 (sidebar rows) · `--row-gap` 1 (between sidebar rows) · `--tile-h` 44 (favourite tiles) · `--tile-min-w` 64 (narrowest favourite tile) · `--connector-w` 28 (a popover funnel's wide side) · `--tooltip-max-w` 280 (a sidebar tooltip) · `--title-fade` 24 / `--title-fade-hover` 44 (tab title fade) · `--folder-bar-w` 2 (icon-only: a filed tab's bar per folder) · `--folder-hue-s` 70% / `--folder-hue-l` 48% (a folder's colour from its hue: icon back, filed-tab bars) · `--window-controls-h` 32 (the window's top margin once open, = `WINDOW_CONTROLS_H`) · `--window-control-w` 44 (Windows: one window button) · `--finder-w` 560 and `--finder-top` 20vh (the tab finder and the command field) |
| Controls | `--control-size` 30 (icon buttons, menu rows, space dots) · `--control-size-sm` 28 (address bar) · `--control-size-xs` 24 (in-row buttons) · `--icon-size` 16 (dots, folder glyphs) · `--space-dot` 7 (a space's colour dot: footer, space header) · `--favicon-size` 18 (tab favicons) · `--tile-icon-size` 22 (favourite tile favicons) |
| Motion | `--dur-fast` 120 ms · `--dur-base` 200 ms · `--dur-spring` 260 ms (magnetic spring-back) · `--dur-spin` 900 ms (loading spinner) · `--ease` `cubic-bezier(.2,.8,.2,1)` |
| Opacity | `--opacity-unloaded` 0.5 (sidebar tabs whose page is not loaded yet; full on hover and on the active tab) · `--opacity-dragged` 0.5 (a sidebar tab while it is dragged) |
| Drag and drop | `--drop-line-w` 2 (the `--accent` insertion line of a tab dragged in the sidebar) |

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
(`REVEAL_DELAY_MS`) it grows to `--window-controls-h` (`--dur-fast`), pushing everything down, and
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

`.grainy` containers (the app shell, the onboarding page) get a pre-rendered, high-contrast SVG
noise tile on a `::before` layer **under** their children — the grain lives on the window frame,
never over content. Opacity follows `--grain`; no live filter, so it costs nothing at runtime.

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

A **modal dialog** (centered panel, 880 × up to 640 px, over a dimmed backdrop), opened from the
gear at the bottom right of the sidebar or `Mod+,`; `Esc`, the close button or a click on the
backdrop closes it. **Left navigation** lists the sections; the right pane shows one section.
Each option is a row: label + one-line description on the left, control on the right. Options not
built yet are shown disabled with a "Soon" tag so the full scope stays visible.

| Section | Option | Values (default) | Stage |
|---|---|---|---|
| **General** | Open at login | Off | v1 |
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
| Settings | `Mod+,` |

Shortcuts are bound in the main-process application menu (`src/main/menu.ts`), because a focused
web page swallows renderer key events. `Mod+Z` is the exception: a keydown handler of the UI
(`app/Shell.tsx`), so in a page or a field it stays the normal undo. Split view and new window
(`Mod+N`) arrive in plan 4.

Shortcuts are defined in one registry (renderer) that also feeds the palette, so they can be
remapped later.

### Privacy note: browsing history

Browsing history (pages visited, per space) is personal data. It is kept only in the local
database, never sent anywhere, shown only in the new-tab dock's suggestions, and each entry can be
forgotten there. Deleting a space deletes its history.

## 9. Accessibility

- Body text contrast ≥ 4.5:1 in both schemes. Body text never sits on the accent; labels on the
  accent (buttons, badges — short and bold) use `--on-accent`: white when it reaches 3:1, else black.
- Full keyboard navigation with visible focus rings (`--accent`).
- Status glyphs always have a text label (tooltip + `aria-label`), never color alone.
- `prefers-reduced-motion` and `prefers-reduced-transparency` (forces glass off) respected.
