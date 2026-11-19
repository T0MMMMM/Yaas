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
│ ● ● ●                   │  Fix login redirect        Work · Sonnet · ~/app │  ← drag region
│ ┌─────────────────────┐ │ ─────────────────────────────────────────────────│
│ │ ⌕ Search…        ⌘K │ │                                                  │
│ └─────────────────────┘ │   you  The login page loops after OAuth…         │
│ ┌──────────┐┌─────────┐ │                                                  │
│ │ ✦ Release││ ✦ Infra │ │   claude  Looking at src/auth/callback.ts …      │  ← pinned sessions
│ └──────────┘└─────────┘ │     ▸ Read src/auth/callback.ts                  │
│ 📌 app             ▾    │     ▸ Edit  +12 −3                               │  ← pinned environment
│    Fix login redirect ! │                                                  │
│    Refactor billing   × │   ┌───────────────────────────────────────────┐  │
│ ▸ website          2    │   │ Allow Bash: npm test ?                    │  │  ← collapsed environment
│ ▾ infra-scripts         │   │ [Allow once ⏎] [Always for project ⌘⏎] [Deny]│ │
│    Write tests        ✓ │   └───────────────────────────────────────────┘  │
│ + New session      ⌘T   │                                                  │
│                         │                                                  │
│ ◔ Context 42k / 200k    │  ┌────────────────────────────────────────────┐  │  ← only in a session
│ 5h ▬▬▬▬▬▭▭ 57%  7d 53%  │  │ Message Claude…                             │  │
│        ●  ○  ○          │  │ ⚙ Minimal profile · Sonnet · ~/app      ⏎   │  │  ← space switcher
└─────────────────────────┴──┴────────────────────────────────────────────┴──┘
   sidebar 200–360 px (default 248), resizable, collapsible (⌘S)
```

**Sidebar (top → bottom)**
- Traffic lights (macOS, `titleBarStyle: 'hiddenInset'`, positioned inside the sidebar) / custom
  window controls on the right edge of the main pane (Windows, `titleBarOverlay`).
- Search / palette trigger.
- **Pinned sessions** of the active space: compact tiles (Arc "favorites"), always on top.
- **Environments**: sessions are grouped by environment (= the project folder a session runs in).
  Pinned environments come first, then the others by last activity. Each group is collapsible and
  shows its session count when collapsed. Pin/unpin an environment or a session from its context
  menu or with `Mod+D`. Pins are per space.
- `+ New session` (in the active environment, or asks for a folder).
- **Context indicator** — only while a session is open: ring + "42k / 200k" for the session's
  context window; turns `--warn` above 80 %. Click → context details (profile, what is loaded).
- Usage of the active account (5 h / 7 d, reset time on hover).
- **Space switcher**, centered: one item per account, either **icons** (the account's emoji/icon)
  or **dots** — a setting (Settings → Appearance → Space switcher). No `+` here: accounts are added
  from Settings, the command palette or `Mod+Shift+N`. Two-finger swipe also switches spaces.

**Tab status glyphs**: `◐` running · `!` needs approval (accent, pulses once) · `✓` done (unread) ·
`×` error · `⏸` account limited · none = idle/read.

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
| `--ok` / `--warn` / `--danger` | Status (done / approval-limited / error) |

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
| 2 | **Visual setup** | One page, live preview on the right (a mini sidebar that reflects every choice): accent color (presets + custom), appearance (light / dark / system), glass on/off, grain on/off + intensity, space switcher style (icons / dots) |
| 3 | **Technical setup** | First account: **Import existing Claude Code** (`~/.claude`, shows plan/email from `auth status`) and/or **Sign in a new account** (browser); default context for new sessions (**Clean** / **Inherit `~/.claude`**); Claude Code CLI detection (path + version). `Open YAAS` finishes |

`←` / `→` move between screens 2 and 3. `prefers-reduced-motion` replaces the intro animation by a
short fade. All choices are editable later in Settings. Onboarding state is stored in `settings`.

## 7. Keyboard shortcuts

`Mod` = ⌘ on macOS, Ctrl on Windows.

| Action | Shortcut |
|---|---|
| Command palette | `Mod+K` |
| New session (active space) | `Mod+T` |
| Close tab (stops the live process, keeps the session) | `Mod+W` |
| Reopen last closed | `Mod+Shift+T` |
| Switch to space 1…9 | `Mod+1…9` |
| Next / previous session | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Toggle sidebar | `Mod+S` |
| Search in session / all sessions | `Mod+F` / `Mod+Shift+F` |
| Interrupt Claude | `Esc` (in composer) or `Mod+.` |
| Approval: allow once / always for project / deny | `⏎` / `Mod+⏎` / `Esc` |
| Pin / unpin session or environment | `Mod+D` |
| Settings | `Mod+,` |
| New space (add account) | `Mod+Shift+N` |

Shortcuts are defined in one registry (renderer) that also feeds the palette, so they can be
remapped later.

## 8. Accessibility

- Body text contrast ≥ 4.5:1 in both schemes. Body text never sits on the accent; labels on the
  accent (buttons, badges — short and bold) use `--on-accent`: white when it reaches 3:1, else black.
- Full keyboard navigation with visible focus rings (`--accent`).
- Status glyphs always have a text label (tooltip + `aria-label`), never color alone.
- `prefers-reduced-motion` and `prefers-reduced-transparency` (forces glass off) respected.
