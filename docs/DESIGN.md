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
context bar, the content card takes the full height. On Windows the right edge leaves room for the
caption buttons.

**Sidebar (top → bottom)**
- Title row: traffic lights (macOS, `titleBarStyle: 'hiddenInset'`); drag region. The sidebar is
  always visible (no auto-hide mode).
- Search / palette trigger: a soft borderless field.
- **Pinned section**: pinned environments (with their sessions) and pinned sessions, in the user's
  order. No pin icon — being above the separator *is* the pinned state.
- Separator: a faint hairline.
- **Askew cards**: the selected item sits slightly askew (`--tilt-selected`, −0.8°) and hovered
  items tilt a little (`--tilt-hover`, −0.4°), with a small bounce (`--ease-bounce`). Only the card layer tilts — the text never
  moves. Same motion in
  the sidebar (sessions, folders) and the Settings navigation.
- Accounts and the Settings gear are **magnetic**: they lean toward the pointer and spring back
  (`ui/useMagnetic`, CSS `translate` so it composes with their own transforms).
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

**Browser sidebar (ACAB, top → bottom of the scroll area)** — the tree comes from
`sidebarSections` in `features/workspace` (same order as the store's `visibleOrder`); the rows
are `TabRow`, `FolderRow` and `FavoriteTiles` in `features/sidebar`.
- **Favourites**: no header. A 4-column grid of tiles (`--tile-h` 44, favicon
  `--tile-icon-size` 22) on a soft card; the active tile is lifted and askew like a selected row.
- **Pinned**: pinned tabs and folders in one ordering. A folder row (folder / open-folder icon)
  opens and closes on click; a closed folder shows its tab count on the right. Its tabs are listed
  one `--space-3` indent below. "New Folder…" and "Rename" (native menus) put its name in an
  inline field: Enter or leaving it saves, Esc cancels.
- **Separator**: a hairline, with **Clear** on the right when today has tabs — it closes all of
  today's tabs (children first), and ⌘⇧T reopens them one by one.
- **Today**: tabs opened from another tab are indented under it, `--space-3` per level (max 3).
  **Automatic folders**: 3 or more top-level tabs of one site (`www.` ignored) are drawn as a
  folder named after the host, where the first of them was; open/closed per host for the session
  (UI store), never stored. Settings → Appearance → Automatic folders turns them off.
- Every row and tile: right-click opens its native menu (tab: pin, favourites, folders, copy,
  close; folder: rename, delete). A tab whose page is not loaded is dimmed
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
glass card (`ui/Popover.module.css`, composed by each popover's own CSS module).

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
| `--fill-raised-hover` | Hovered row on a raised surface (menus) |
| `--glass-sheen` | Lit-top gradient of glass cards (menus); stronger in liquid glass |
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

- **Type**: **Satoshi** (variable, 300–900) for the whole UI; mono only for numbers, paths and keys.
  The font files are not in git (ITF Free Font License forbids redistribution through a
  repository): `npm run setup:fonts -- <path to Satoshi_Complete>` installs them locally.
- **Icons**: **Phosphor**, **duotone** by default (`IconContext` in `App.tsx`), 15–18 px. Folders
  are **illustrated glyphs** (two-tone folder, paper peeking out when open), colored per folder name;
  sessions get a small chat-bubble glyph.
- **Askew cards**: hovered and selected items tilt slightly; every item has **its own angle**
  (stable hash of its id, ±0.3–1.1° hover, ±0.6–1.5° selected) so a list never moves in lockstep.
  Only the card layer tilts — text never moves. Hover/selected fills are **neutral** (a light lift
  on the frame), never the accent.
- **Drawn controls**: sliders draw what they do (§3.4); the accent picker is a wheel (§3.1).
- **Animations everywhere** come in a later pass; for now only hover/press motion.

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
| Font | `--font-sans`: `system-ui, -apple-system, "Segoe UI Variable", sans-serif` · `--font-mono`: `ui-monospace, "SF Mono", "Cascadia Code", monospace` |
| Size | `--text-xs` 11 · `--text-sm` 12 · `--text-md` 13 (base) · `--text-lg` 15 · `--text-xl` 20 |
| Layout | `--sidebar-w` 248 · `--titlebar-h` 44 · `--addressbar-h` 38 · `--frame-gap` 5 (between the frame's panels) · `--row-h` 34 (sidebar rows) · `--tile-h` 44 (favourite tiles) |
| Controls | `--control-size` 30 (icon buttons, menu rows, space dots) · `--control-size-sm` 28 (address bar) · `--control-size-xs` 24 (in-row buttons) · `--icon-size` 16 (favicons) · `--tile-icon-size` 22 (favourite tile favicons) |
| Motion | `--dur-fast` 120 ms · `--dur-base` 200 ms · `--dur-spring` 260 ms (magnetic spring-back) · `--dur-spin` 900 ms (loading spinner) · `--ease` `cubic-bezier(.2,.8,.2,1)` |
| Opacity | `--opacity-unloaded` 0.5 (sidebar tabs whose page is not loaded yet; full on hover and on the active tab) · `--opacity-dragged` 0.5 (a sidebar tab while it is dragged) |
| Drag and drop | `--drop-line-w` 2 (the `--accent` insertion line of a tab dragged in the sidebar) |

## 4. Transparency, per platform

| | macOS | Windows 11 | Windows 10 / fallback |
|---|---|---|---|
| Window | `transparent: true` (always; set at creation) | normal | normal |
| Frosted (0 < t < 0.9) | `vibrancy: 'under-window'` | `backgroundMaterial: 'acrylic'` | none: transparency forced to 0 |
| Clear / liquid (t ≥ 0.9) | no vibrancy: the transparent window shows the desktop as is | acrylic (no clear mode) | — |
| Title bar | `titleBarStyle: 'hiddenInset'`, traffic lights in the sidebar | `titleBarStyle: 'hidden'` + `titleBarOverlay` | same as Win 11 |
| Switching | `applyMaterial()` only when the material changes (opaque / frosted / clear), never on every slider tick | same | — |

How see-through the frame is, and the liquid glass look, are pure CSS (§3.2).

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
| | Automatic folders (3+ today tabs of one site grouped) | **On** · Off | ✅ |
| | Address bar | Own card · Attached to the page (separator line) | ✅ |
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
| New tab (active space) | `Mod+T` |
| Close tab (a favourite or pinned tab is unloaded) | `Mod+W` |
| Reopen closed tab | `Mod+Shift+T` |
| Focus the address bar | `Mod+L` |
| Reload | `Mod+R` |
| Back / forward | `Mod+[` / `Mod+]` |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Settings | `Mod+,` |

Shortcuts are bound in the main-process application menu (`src/main/menu.ts`), because a focused
web page swallows renderer key events. Command palette (`Mod+K`), reopen closed tab from the UI
(`Mod+Z`), split view and new window (`Mod+N`) arrive in plans 3–4.

Shortcuts are defined in one registry (renderer) that also feeds the palette, so they can be
remapped later.

## 9. Accessibility

- Body text contrast ≥ 4.5:1 in both schemes. Body text never sits on the accent; labels on the
  accent (buttons, badges — short and bold) use `--on-accent`: white when it reaches 3:1, else black.
- Full keyboard navigation with visible focus rings (`--accent`).
- Status glyphs always have a text label (tooltip + `aria-label`), never color alone.
- `prefers-reduced-motion` and `prefers-reduced-transparency` (forces glass off) respected.
