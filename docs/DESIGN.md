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

**Context bar** — its **own card** above the content card (same surface, radius and border), shown
**only while a session is open**, 34 px high (title at body size); 4 px gap to the content card. It is also the window drag region.
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
- Search / palette trigger.
- **Pinned section**: pinned environments (with their sessions) and pinned sessions, in the user's
  order. No pin icon — being above the separator *is* the pinned state.
- Separator.
- **Askew cards**: the selected item sits slightly askew (`--tilt-selected`, −0.8°) and hovered
  items tilt a little (`--tilt-hover`, −0.4°), with a small bounce (`--ease-bounce`). Same motion in
  the sidebar (sessions, folders) and the Settings navigation.
- Rows (environments and sessions) are 34 px high; the sidebar has a 6 px side padding so search,
  rows and folders use almost its full width.
- **Resizable**: drag its right edge (200–440 px, default 248, saved in settings); double-click the
  edge to reset.
- **Environments** (= project folders) as **folders** that open and close (folder / open-folder
  icon; a closed folder shows its session count), sorted by last activity, each listing its
  sessions. Pins are per space; pin/unpin from the context menu or `Mod+D`.
- `+ New session` (in the active environment, or asks for a folder).
- Bottom row: **accounts on the left** (switch spaces) and **Settings** on the right. Accounts are
  shown as their **emoji**, their **first letter**, or **dots** (setting). No `+`: accounts are
  added from Settings, the palette or `Mod+Shift+N`.
- Optional (v1): a custom icon or emoji on an environment or a session replaces the default
  folder / no icon.

**Session status dots** (5 px, like the Claude apps): **gray, blinking** = running · **orange** = waiting
for your action (approval, question) · **blue** = finished, not yet seen · **red** = error ·
**orange ring** = account limited · nothing = idle / seen. Always with a tooltip + `aria-label`.

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
<html data-scheme="dark" data-glass="on" data-grain="on" data-platform="mac">
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
| `--border` / `--border-strong` | Hairlines |
| `--text` / `--text-muted` / `--text-faint` | Text hierarchy |
| `--ok` / `--warn` / `--danger` | Generic success / warning / error |
| `--status-running` / `--status-waiting` / `--status-done` | Session dots: gray / orange / blue |
| `--control-active` | Selected segment / active control fill |

Default accent presets: `#7C5CFF` (violet, default), `#FF5C8A`, `#FF8A3D`, `#2BB673`, `#2D9CDB`, `#111111`, plus a free picker.

### 3.0 Art direction — to do

The skeleton uses system fonts and plain controls. A dedicated design pass (before the MVP UI work)
will define: typeface pairing, button/input/segmented styles, icon set usage and sizes, elevation,
and the logo. Icons: **Lucide** (`lucide-react`), 16 px, 1.75 stroke, `currentColor` — never emoji
or text glyphs for UI icons.

### 3.2 Material

| Token | Glass on | Glass off |
|---|---|---|
| `--sidebar-alpha` | `0.55` | `1` |
| `--surface-alpha` | `0.85` | `1` |
| `--blur` | `0` (native vibrancy does the blur) | `0` |
| `--grain-opacity` | `0`–`0.20` (slider, default `0.08`) when grain is on, else `0` | same |

### 3.3 Shape, space, type, motion

| Group | Tokens |
|---|---|
| Spacing (4 px scale) | `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-6` 24 · `--space-8` 32 |
| Radius | `--radius-sm` 6 · `--radius-md` 10 · `--radius-lg` 14 · `--radius-pill` 999 |
| Font | `--font-sans`: `system-ui, -apple-system, "Segoe UI Variable", sans-serif` · `--font-mono`: `ui-monospace, "SF Mono", "Cascadia Code", monospace` |
| Size | `--text-xs` 11 · `--text-sm` 12 · `--text-md` 13 (base) · `--text-lg` 15 · `--text-xl` 20 |
| Layout | `--sidebar-w` 248 · `--titlebar-h` 44 |
| Motion | `--dur-fast` 120 ms · `--dur-base` 200 ms · `--ease` `cubic-bezier(.2,.8,.2,1)` |

## 4. Glass, per platform

| | macOS | Windows 11 | Windows 10 / fallback |
|---|---|---|---|
| Window | `vibrancy: 'sidebar'`, `visualEffectState: 'followWindow'`, `transparent` background | `backgroundMaterial: 'mica'` (default) or `'acrylic'` | No material: glass is forced off |
| Title bar | `titleBarStyle: 'hiddenInset'`, `trafficLightPosition` aligned in the sidebar | `titleBarStyle: 'hidden'` + `titleBarOverlay` tinted with tokens | same as Win 11 |
| Toggle at runtime | `win.setVibrancy(null \| 'sidebar')` | `win.setBackgroundMaterial('none' \| 'mica')` | — |

Main sends the platform and whether material is supported; the renderer sets `data-platform` and
greys out the glass option when unsupported.

## 5. Grain

A fixed, full-window overlay (`pointer-events: none`, top z-index) whose background is a **pre-rendered
SVG `feTurbulence` noise tile** (data URI, 160 px, repeated) with `mix-blend-mode: overlay` and
`opacity: var(--grain-opacity)`. No live filter, so it costs nothing at runtime. Scheme-specific blend
(`soft-light` in light mode) keeps it subtle.

## 6. Onboarding (first launch)

A **full-window page**, not a dialog: it owns the whole window (glass, grain and traffic lights
included) until it's done. Three moments:

| # | Screen | Content |
|---|---|---|
| 1 | **Intro** | The YAAS logo alone, centered. After ~1.2 s (or a click / `⏎`) the logo shrinks and glides to the top-left, and the visual setup fades in — the animation *leads* into screen 2 |
| 2 | **Visual setup** | One page, live preview on the right (a mini sidebar that reflects every choice): accent color (presets + custom), appearance (light / dark / system), glass on/off, grain on/off + intensity, account switcher style (emoji / letter / dots) |
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
| **Appearance** | Color, scheme, glass, grain + intensity | as in onboarding | MVP ✅ |
| | Account switcher | Emoji · First letter · Dots | MVP ✅ |
| | Meters (context + usage) | Context bar · Sidebar | MVP ✅ |
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
| | Statement: no telemetry, no hidden model calls | — | MVP |
| **Advanced** | Claude Code CLI: bundled · system (path + version) | Bundled | MVP |
| | Open logs folder, developer tools | — | MVP |
| **About** | Version, docs, license, acknowledgements | — | MVP |

Auto-archive only archives (never deletes); pinned sessions are never auto-archived.
Every option that spends tokens is absent by design (FEATURES.md principle 1).

## 8. Keyboard shortcuts

`Mod` = ⌘ on macOS, Ctrl on Windows.

| Action | Shortcut |
|---|---|
| Command palette | `Mod+K` |
| New session (active space) | `Mod+T` |
| Close tab (stops the live process, keeps the session) | `Mod+W` |
| Reopen last closed | `Mod+Shift+T` |
| Switch to space 1…9 | `Mod+1…9` |
| Next / previous session | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Search in session / all sessions | `Mod+F` / `Mod+Shift+F` |
| Interrupt Claude | `Esc` (in composer) or `Mod+.` |
| Approval: allow once / always for project / deny | `⏎` / `Mod+⏎` / `Esc` |
| Pin / unpin session or environment | `Mod+D` |
| Settings | `Mod+,` |
| New space (add account) | `Mod+Shift+N` |

Shortcuts are defined in one registry (renderer) that also feeds the palette, so they can be
remapped later.

## 9. Accessibility

- Body text contrast ≥ 4.5:1 in both schemes. Body text never sits on the accent; labels on the
  accent (buttons, badges — short and bold) use `--on-accent`: white when it reaches 3:1, else black.
- Full keyboard navigation with visible focus rings (`--accent`).
- Status glyphs always have a text label (tooltip + `aria-label`), never color alone.
- `prefers-reduced-motion` and `prefers-reduced-transparency` (forces glass off) respected.
