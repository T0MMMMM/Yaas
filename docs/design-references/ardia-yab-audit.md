

I have inspected the screenshots from both Ardia and yab to ground the visual analysis. Now waiting for the 5 research subagents to finish extracting the concrete values and file paths across both codebases.

Received the first research report (Ardia address bar, menus, popovers, tooltips, and command bar). Waiting for the remaining 4 subagents to complete.

Received the second research report (yab split view, downloads, settings, motion, and typography). Waiting for the remaining 3 subagents.

Received the third research report (Ardia split view, downloads, settings, motion, and typography). Waiting for the final 2 subagents (`Ardia Window & Sidebar` and `Yab Window, Sidebar, Address Bar & Menus`).

Received the fourth research report (yab window frame, sidebar, address bar, menus, tooltips, and command bar). Waiting for the final subagent (`Ardia Window & Sidebar`).

# Ardia & yab Desktop Browser UI — Value-Level Design Specification

> **Purpose:** Value-level visual and motion specification for rebuilding the Ardia look (lead reference) alongside yab (secondary reference) in an Electron + React + CSS desktop browser. All values are extracted directly from the `ardia/` and `yab/` source trees and screenshots (`ardia/apps/site/src/assets/shots/*.webp`, `ardia/docs/windows/*.png`, `yab/docs/images/readme/*.jpg`). Where a feature or value does not exist in a codebase, this is stated explicitly. All dimensions are CSS `px` / macOS `pt` (`1 pt = 1 CSS px`). Note: Ardia's native macOS `packages/shell` and `packages/shaders` Swift packages are not present in this checkout; macOS chrome values come from `apps/browser/macos/`, `packages/ardiacore/`, and `apps/browser/src/`, while web/CSS implementations come from `apps/desktop/src/`.

---

## 1. Window Frame and Sidebar

### 1.1 Window Frame Background, Space/Theme Tinting, Blur & Grain

#### Ardia (Lead Reference)
- **Window dimensions & native fallback fill** ([ardia/apps/browser/macos/Ardia-macOS/BrowserWindow.swift](`refs/ardia/apps/browser/macos/Ardia-macOS/BrowserWindow.swift`), [ardia/packages/ardiacore/ios/ArdiaTrafficLights.mm](`refs/ardia/packages/ardiacore/ios/ArdiaTrafficLights.mm`), [ardia/apps/browser/src/lib/windowLayout.ts](`refs/ardia/apps/browser/src/lib/windowLayout.ts`)):
  - Default window: `1360 × 860 px`; min window: `500 × 460 px` (`720 × 460 px` in `BrowserWindow.swift`).
  - Fallback background before vibrancy paints: Dark `rgb(43, 31, 36)` / `#2B1F24` (sRGB `0.17, 0.12, 0.14`); Light `rgb(237, 232, 230)` / `#EDE8E6` (sRGB `0.93, 0.91, 0.90`).
  - Outer macOS window corner radius: dynamically read from `NSThemeFrame`, fallback `19 px` ([ardia/packages/ardiacore/ios/ArdiaTrafficLights.mm](`refs/ardia/packages/ardiacore/ios/ArdiaTrafficLights.mm`)). Web preview shell `.ardia-window` ([ardia/apps/desktop/src/base.css](`refs/ardia/apps/desktop/src/base.css`)): `border-radius: 14px`, `box-shadow: 0 0 0 0.5px rgba(0,0,0,0.5), inset 0 0 0 0.5px rgba(255,255,255,0.25), 0 22px 70px rgba(0,0,0,0.45)`.
- **Preset Space/Profile Swatches** ([ardia/apps/browser/src/components/ui/tokens.ts](`refs/ardia/apps/browser/src/components/ui/tokens.ts`)):
  - `plum` (default): swatch `#C07A98`, tint `#B25B6B`, powerUp `#B5556B`, action `#DD899B`.
  - Other swatches: `blue #4691C3`, `purple #7873AF`, `pink #D37B8B`, `red #C1575C`, `orange #D87249`, `yellow #E3AC38`, `green #3EB489`, `neutral #8E8E93`; `incognito #3A3A3C` (forced dark).
  - Non-plum preset tint derivation ([ardia/apps/browser/src/lib/windowTint.ts](`refs/ardia/apps/browser/src/lib/windowTint.ts`)): keeps swatch hue `h`, sets HSL `(h, grey ? 0 : 0.36, 0.527)`; `tintAlpha = 0.36` (colored) or `0.12` (neutral/incognito); bottom stop lifts lightness `+0.25`.
- **How the Preset Window Gradient Is Composited** ([ardia/apps/desktop/src/shims/web/gl/Vibrancy.tsx](`refs/ardia/apps/desktop/src/shims/web/gl/Vibrancy.tsx`), [ardia/apps/desktop/src/shims/web/gl/material.ts](`refs/ardia/apps/desktop/src/shims/web/gl/material.ts`), [ardia/apps/browser/src/lib/windowTint.ts](`refs/ardia/apps/browser/src/lib/windowTint.ts`)):
  - **Dark**: base material `rgb(68.3, 68.0, 68.4)`, black base tint at `alpha 0.4` → `under = 0.6 × material`, `gradientOpacity = 0.5` → effective tint alpha `a = 0.18` (colored) / `0.06` (neutral).
  - **Light**: base material `rgb(211.2, 206.7, 206.0)`, white base tint at `alpha 0.8` → `under = 0.8 × white + 0.2 × material`, `gradientOpacity = 0.75` → effective tint alpha `a = 0.27` (colored) / `0.09` (neutral).
  - Rendered as vertical `linear-gradient(to bottom in display-p3, top, bottom)` where `top = mix(under, tint, a)` and `bottom = mix(under, lighten(tint, +0.25), a)`.
  - Opaque/inactive window reference fill (`INACTIVE_FILL`): Dark `rgb(40.7, 33.1, 31.8)`, Light `rgb(235, 231, 230)`. No separate unfocused-window CSS dim layer is added in React; macOS behind-window vibrancy naturally deactivates.
- **Custom Multi-Stop Themes & Grain** ([ardia/packages/core/src/theme.ts](`refs/ardia/packages/core/src/theme.ts`), [ardia/apps/desktop/src/shims/web/gl/themeSwatch.ts](`refs/ardia/apps/desktop/src/shims/web/gl/themeSwatch.ts`), [ardia/apps/browser/src/components/ui/tokens.ts](`refs/ardia/apps/browser/src/components/ui/tokens.ts`)):
  - Up to `3` stops, default angle `135°`, stops 0→1 interpolated linearly in **Oklab** (`16` SVG stops on web); optional stop 2 overlaid at `angle + 45°`.
  - Layer alpha: `arc = 0.2 + 0.55 × intensity`, `layerAlpha = 1 - translucency × (1 - arc)`.
  - Preset grain opacity: **Dark `0.006`**, **Light `0.05`** (non-vibrancy WebGL fallback `0.09`). Custom textures (`128×128 px` tile rendered at `64×64 px`, `image-rendering: pixelated`): multipliers `grain 0.8`, `sand 0.15`, `denim 0.6`, `tweed 0.4`.
- **Adaptive Ink Flip** ([ardia/apps/browser/src/components/ui/theme.ts](`refs/ardia/apps/browser/src/components/ui/theme.ts`)): automatically flips dark/light ink on the sidebar if worst WCAG contrast against the tint stops drops below `3.0` (`MIN_INK_CONTRAST = 3`).

#### yab (Secondary Reference)
- **Window & Swatches** ([yab/Sources/Fast/App.swift](`refs/yab/Sources/Fast/App.swift`), [yab/Sources/Fast/Design.swift](`refs/yab/Sources/Fast/Design.swift`), [yab/Sources/Fast/WindowBackdrop.swift](`refs/yab/Sources/Fast/WindowBackdrop.swift`), [yab/Sources/Fast/WindowGlass.swift](`refs/yab/Sources/Fast/WindowGlass.swift`), [yab/docs/grain.md](`refs/yab/docs/grain.md`)):
  - Default window: `1180 × 780 px`, outer radius `18 px` (`Radius.window`, `0` in fullscreen).
  - Default backdrop mode is `.site` (samples active page's top color, falling back to space swatch). Swatches (Light / Dark): `gray #E3E3E5 / #202022` (default), `paper #ECEAE4 / #1F1E1C`, `coral #F2837C / #55282A`, `peach #F5BB8C / #553823`, `sage #A8C3A0 / #28372A`, `sky #8DB6E6 / #1D304B`, `lavender #B6A6E6 / #2E274C`, `rose #EEA2C4 / #4C2338`, `graphite #3B3B3E / #18181A`, `plain #FFFFFF / #0F0F0F`; private window solid `rgb(31, 31, 31)` (`white 0.12`).
  - Stack: behind-window blur (`NSVisualEffectView .hudWindow`) → black/white `BackdropVeil` (`0.6` opacity) → diagonal `topLeading → bottomTrailing` color/gradient coating at opacity `1 - 0.84 × transparency` → **tactile paper grain** (`128×128 px` tile at `64×64 pt`, standard amount `0.35` → **`0.07` opacity**).
  - Liquid Glass option (macOS 26+): `NSGlassEffectView` (`.clear` dark with `≥ 0.58` black veil / `.regular` light), `1 px` rim (`rgba(255,255,255,0.16)` dark / `rgba(0,0,0,0.12)` light).
  - Adaptive OKLCH ink (`Shades` in [yab/Sources/YabDesign/Design.swift](`refs/yab/Sources/YabDesign/Design.swift`), [yab/docs/card-ink.md](`refs/yab/docs/card-ink.md`)): contrast floors `strong ≥ 6.0`, `muted ≥ 4.2`, `faint ≥ 1.9`.

---

### 1.2 Sidebar Widths, Paddings, Resize & Floating Peek

| Metric | Ardia ([windowLayout.ts](`refs/ardia/apps/browser/src/lib/windowLayout.ts`), [SidebarDock.tsx](`refs/ardia/apps/browser/src/components/window/SidebarDock.tsx`), [ResizeHandle.tsx](`refs/ardia/apps/browser/src/components/sidebar/ResizeHandle.tsx`)) | yab ([Fast/Design.swift](`refs/yab/Sources/Fast/Design.swift`), [SidebarWidthDetent.swift](`refs/yab/Sources/Fast/SidebarWidthDetent.swift`), [Peek.swift](`refs/yab/Sources/Fast/Peek.swift`)) |
|---|---|---|
| **Default width** | `190 px` | `228 px` (magnetic detent: snaps within `4 px`, releases past `8 px`) |
| **Min / Max width** | `160 px` / `400 px` (min `310 px` left for page) | `164 px` / `475 px` (rubber-band over-stretch `95 px` past max; snaps shut past `64 px` inward) |
| **Internal horizontal padding** | `9 px` (`layout.sidebarInset = CARD_INSET`) | `8 px` (`SideBar.margin`) |
| **Resize handle hit strip** | `8 px` centered on inner edge (`top: 46px` to bottom); dbl-click resets | `20 px` centered on inner hairline; tooltip after `1.0 s` rest |
| **Auto-hide edge trigger** | `3 px` (`8 px` during tab drag); hold zone `width + 40 px` | `3 px`, `300 ms` dwell; safe overhang `56 px` past inner edge |
| **Floating peek geometry** | Inset `9 px` (`max(1, inset)`) on left/top/bottom; radius `10 px` concentric (`18 px` if borderless) | Flush with outer window edge (`floatInset = 0`, `40 px` overshoot bleed); inner corners `18 px` continuous |
| **Floating peek border & shadow** | Border `0.5 px` `rgba(255,255,255,0.10)` (Dark) / `rgba(0,0,0,0.10)` (Light); shadow `0 6px 40px rgba(0,0,0,0.50)` Dark / `0.18` Light (`radius 20 × 2`) | Border `1 px` `Palette.ink 0.10` (when carded); `Shadow.card` (`0 8px 24px rgba(0,0,0,0.14)`) |

---

### 1.3 Page Card Bezel/Gap, Corner Radius, Shadow & Border

| Metric | Ardia ([windowLayout.ts](`refs/ardia/apps/browser/src/lib/windowLayout.ts`), [TabPane.tsx](`refs/ardia/apps/browser/src/components/window/TabPane.tsx`), [ui/tokens.ts](`refs/ardia/apps/browser/src/components/ui/tokens.ts`)) | yab ([Fast/Design.swift](`refs/yab/Sources/Fast/Design.swift`), [Reshape.swift](`refs/yab/Sources/Fast/Reshape.swift`)) |
|---|---|---|
| **Bezel / gap around page card** | Default **`9 px`** (`pageFrame` configurable `0–12 px`; `0` in borderless/minimalism/fullscreen). With sidebar open, sidebar's right `9 px` padding forms the gap between rows and page card (`width + max(0, frame - 9)`). Top-tabs mode: `42 px` top, `9 px` left/right/bottom. | **`8 px`** (`Backdrop.inset`) on top, bottom, and outer edge (`0 px` in edge-to-edge `.none` or fullscreen with tabs hidden). Sidebar's `8 px` inner margin creates the visual gap on the sidebar side. |
| **Page card corner radius** | **`10 px`** at default `9 px` inset (concentric: `windowRadius 19 - inset 9 = 10 px`; `0 px` if `inset <= 0` or fullscreen). | **`10 px`** continuous (`Radius.surface`; concentric `18 - 8 = 10 px`; `0 px` edge-to-edge). |
| **Page card fill** | Dark `rgba(18, 18, 18, 0.50)`; Light `rgba(255, 255, 255, 0.70)` (composited over tint midpoint for webview backing). | `Palette.ground`: `#FFFFFF` (Light) / `#1C1C1C` (Dark), inset `1 px` inside edge to prevent AA fringe. |
| **Page card border / hairline** | **None rendered** on `TabPane` (tokens `cardEdge` exist in `ui/tokens.ts` at `rgba(0,0,0,0.35)` Dark / `0.08` Light, unused on pane). | **`1 px` outer hairline** strictly outside card edge: `Palette.ink` at **`0.06` opacity** (`rgba(23,23,23,0.06)` Light / `rgba(237,237,237,0.06)` Dark). |
| **Page card shadow** | **None rendered** on `TabPane`. | **`0 1px 5px`** black at **`0.10` opacity (Light)** / **`0.35` opacity (Dark)**, masked outside card outline. |

- **Traffic Lights Placement**:
  - **Ardia** ([ardia/apps/browser/src/state/windows/dockMotion.ts](`refs/ardia/apps/browser/src/state/windows/dockMotion.ts`), [ardia/apps/desktop/src/shims/web/windowChrome.tsx](`refs/ardia/apps/desktop/src/shims/web/windowChrome.tsx`)): `14 px` circles, `23 px` center-to-center (`78 px` reserved width). Close-button center: `[25, 30]` in top-bar mode (`y = frame + 21`; `[25, 23]` compact), `[25, 24]` in sidebar-address mode, `[20.75, 20.75]` in top-tabs mode. Windows/Linux caption buttons ([ardia/apps/browser/src/components/window/tokens.ts](`refs/ardia/apps/browser/src/components/window/tokens.ts`)): `30 × 30 px` (`7 px` radius, `3 px` gap, `12 px` right edge; Close hover `#C42B1C`, pressed `#B3271A`).
  - **yab** ([yab/Sources/Fast/Lights.swift](`refs/yab/Sources/Fast/Lights.swift`)): close-button center `20 px` from leading edge, standard macOS `20 px` spacing, vertically centered in `52 px` sidebar header (`Metrics.strip = 52`).

---

## 2. Sidebar Contents

### 2.1 Favourite Tiles (Top Apps / Pins)

#### Ardia ([PinnedGrid.tsx](`refs/ardia/apps/browser/src/components/sidebar/PinnedGrid.tsx`), [TileFace.tsx](`refs/ardia/apps/browser/src/components/sidebar/TileFace.tsx`), [sidebar/tokens.ts](`refs/ardia/apps/browser/src/components/sidebar/tokens.ts`), [ui/tokens.ts](`refs/ardia/apps/browser/src/components/ui/tokens.ts`), [desktop/src/TileFace.tsx](`refs/ardia/apps/desktop/src/TileFace.tsx`))
- **Layout & Size**: Height **`41 px`** (`47 px` Large / `54 px` Larger text), min width **`50 px`**, horizontal & vertical gap **`6 px`**. Columns `= floor((innerWidth + 6) / 56)` (at default `190 px` sidebar → `172 px` inner → 3 tiles are `53 × 41 px` each). Stays docked above scroll list up to `40%` of sidebar height.
- **Corner radius**: **`10 px`** (`radius.pinned`).
- **Favicon**: **`16 × 16 px`** (`border-radius: 2px`; fallback initial tile `14 × 14 px`, radius `4.48 px`, fill `rgba(247,245,255,0.20)` Dark / `rgba(0,0,0,0.13)` Light). Sleeping tile icon `opacity: 0.45`.
- **Fills & Borders (macOS Classic)**:
  - **Rest**: Dark `rgba(255,255,255,0.10)` + `0.5 px` border `rgba(255,255,255,0.14)` | Light `rgba(0,0,0,0.05)` + `0.5 px` border `rgba(0,0,0,0.20)`. *(Desktop flat override uses `rgba(255,255,255,0.04)` Dark / `rgba(0,0,0,0.03)` Light).*
  - **Hover**: Dark `rgba(255,255,255,0.16)` | Light `rgba(255,255,255,0.55)`.
  - **Pressed**: Dark `rgba(255,255,255,0.31)` | Light `rgba(255,255,255,0.70)`.
  - **Active (selected)**: Favicon-accented `3 px` ring (`DockSelection`, `10 px` radius), or neutral fallback: `1 px` outer rim (`rgba(0,0,0,0.85)` Dark / `rgba(0,0,0,0.12)` Light) + `0 0.5px 3px` glow (`rgba(255,255,255,0.15)` Dark / `rgba(0,0,0,0.12)` Light) + inner `9 px`-radius card filled `rgba(255,255,255,0.25)` Dark / `rgba(255,255,255,0.70)` Light with `1 px` top highlight (`rgba(255,255,255,0.20)` Dark / `rgba(255,255,255,0.98)` Light).
- **Badges**: Unread dot `6 px` top-right (`5.5 px` inset) or count pill `11 px` tall (`9 px` semibold, `#55555A` Dark / `#D4D4D8` Light); optional PiP (`8 px` bottom-left) & audio (`9.5 px` bottom-right); mic/cam `7 px` red dot (`#FF453A`/`#FF3B30`).

#### yab ([Side.swift](`refs/yab/Sources/Fast/Side.swift`), [Prefs.swift](`refs/yab/Sources/Fast/Prefs.swift`), [PinCards.swift](`refs/yab/Sources/Fast/PinCards.swift`))
- **Layout & Size**: Max `4` columns (balanced rows, e.g. 5 → 3+2), min width `47 px`, gap **`8 px`**, height **`45 px`** (comfortable) / **`34 px`** (compact), radius **`10 px`** / **`8 px`**.
- **Fills**: Rest Dark `rgba(255,255,255,0.10)` / Light `Palette.ink 0.055`; Hover Dark `rgba(255,255,255,0.15)` / Light `Palette.ink 0.08`; Active uses `SelectionPlate` (same elevated white/translucent card as active tab row, no favicon-colored ring).

---

### 2.2 Tab Rows

| Property | Ardia ([TabRow.tsx](`refs/ardia/apps/browser/src/components/sidebar/TabRow.tsx`), [SidebarRow.tsx](`refs/ardia/apps/browser/src/components/sidebar/SidebarRow.tsx`), [ui/tokens.ts](`refs/ardia/apps/browser/src/components/ui/tokens.ts`), [RowCloseButton.tsx](`refs/ardia/apps/browser/src/components/sidebar/RowCloseButton.tsx`)) | yab ([Side.swift](`refs/yab/Sources/Fast/Side.swift`), [Prefs.swift](`refs/yab/Sources/Fast/Prefs.swift`), [ColumnEdges.swift](`refs/yab/Sources/Fast/ColumnEdges.swift`)) |
|---|---|---|
| **Height & vertical gap** | **`34 px`** (`39/44 px` large/larger), gap **`3 px`** (pitch `37 px`) | **`36 px`** comfortable / **`28 px`** compact, gap **`5 px`** / **`4 px`** (pitch `41 / 32 px`) |
| **Corner radius** | **`10 px`** (`radius.chrome`; user-adjustable `0–20 px`) | **`10 px`** comfortable / **`8 px`** compact |
| **Padding** | `padding-left: 9px`, `padding-right: 6px` | `padding-left: 10px`, trailing inset `11 px` / `7 px` |
| **Favicon & gap** | **`16 × 16 px`** (`radius: 2px`), gap **`5 px`** (`14 px` in split/quiet) | **`16 × 16 px`** / **`15 × 15 px`**, gap **`10 px`** / **`8 px`** |
| **Font size / weight** | **`13 px` `400`** (regular; stays `400` when active), line-height `16 px`, right-edge fade mask (no `...`) | **`14 px` `400`** default (`13/14/16 px` tracks macOS sidebar size), trailing fade `28–40 px` (no `...`) |
| **Text color** | Rest `#FFFFFFC7` (Dark) / `#000000AD` (Light); Active `#FFFFFF` / `#000000` | Rest `Palette.muted(tone)`; Hover `strong(tone)`; Active `Palette.ink` |
| **Active row style** | **Elevated translucent card:**<br>• **Light**: `rgba(255,255,255,0.70)` (`0.80` custom theme), `0.5 px` gradient border (`rgba(255,255,255,0.98)` top → `rgba(0,0,0,0.06)` bottom), shadow `0 0.5px 25px rgba(0,0,0,0.12)` (`radius 12.5 × 2`)<br>• **Dark**: `rgba(18,18,18,0.50)` (`rgba(255,255,255,0.24)` custom theme), `0.5 px` border `rgba(255,255,255,0.15)`, glow `0 0.5px 30px rgba(255,255,255,0.15)` (`radius 15 × 2`) | **Elevated `SelectionPlate`:**<br>• **Light**: `rgba(255,255,255,0.62)` (`0.72` near-white) + `rgba(255,255,255,0.18)` sheen, shadow `0 1px 4px rgba(0,0,0,0.14)`<br>• **Dark**: `rgba(255,255,255,0.13)` + `rgba(255,255,255,0.18)` sheen, `1 px` rim `rgba(255,255,255,0.10)`, shadow `0 1px 4px rgba(0,0,0,0.06)` |
| **Hover / Pressed fill** | Hover: Dark `rgba(255,255,255,0.16)` / Light `rgba(255,255,255,0.55)`<br>Pressed: Dark `rgba(255,255,255,0.31)` / Light `rgba(255,255,255,0.70)` | Hover: Dark `rgba(255,255,255,0.07)` / Light `rgba(255,255,255,0.30)` (plain `ink 0.06`), flat (no shadow) |
| **Close button** | **Hover-only**: `22 × 22 px`, radius `4 px`, `10 px` semibold `xmark` (or `minus` to unload pin), hover fill `rgba(255,255,255,0.10)` Dark / `rgba(0,0,0,0.06)` Light | **Hover-only**: `24 × 24 px` / `20 × 20 px`, radius `4 px`, `16 / 14 px` stroke `2 / 1.75 px`, hover `ink 0.10`, press `ink 0.14`, scale `0.90`. Kept awake tab shows `−` morphing to `×`. |
| **Split tab row** | Outer `34 px` row (`4 px` inset), inner mini-panes `26 px` tall, `6 px` radius, `4 px` gap, `14 px` icon, `12 px` title, `22 × 22` close | `36 / 28 px` row (`4 / 3 px` inset), two chips `28 / 22 px` tall, `6 / 5 px` radius, `1 × 16 px` center divider (`ink 0.18`) when inactive |

---

### 2.3 Space Header, Separator, "New Tab" Row, Folders, Footer & Icon-Only Mode

- **Space / Profile Header**:
  - **Ardia** ([ardia/apps/browser/src/components/sidebar/Sidebar.tsx](`refs/ardia/apps/browser/src/components/sidebar/Sidebar.tsx`), [ProfileIndicator.tsx](`refs/ardia/apps/browser/src/components/profiles/ProfileIndicator.tsx`)): Top header band `46 px` tall (`padding-left: 84px` on macOS to clear traffic lights). Profile chip: `34 px` tall, `10 px` radius, `9 px` horizontal padding, **`13 px` semibold** tinted via `mix(accent, #FFF, 0.6)` (Dark) or `mix(accent, #000, 0.4)` (Light). Right-aligned `DownloadsButton` (`34 × 34 px`) when downloads exist.
  - **yab** ([yab/Sources/Fast/Side.swift](`refs/yab/Sources/Fast/Side.swift`)): Sits *below* pinned tiles (Arc-style). Row height `36 / 28 px`, radius `10 / 8 px`, `10 px` left padding, `11.5 px` space icon (swaps to `9 px` semibold chevron on hover if collapsible), **`14 px` semibold** `Palette.muted`, trailing `•••` menu button (`24 × 24 px` hover plate, three `3 px` dots, `2 px` gap).
- **Separator (Pinned vs Today's Tabs)**:
  - **Ardia** ([ardia/apps/browser/src/components/sidebar/ClearDivider.tsx](`refs/ardia/apps/browser/src/components/sidebar/ClearDivider.tsx`)): `21 px` tall band (`9 px` side inset) with **`1 px` dashed line** (`rgba(255,255,255,0.09)` Dark / `rgba(0,0,0,0.09)` Light). On hover reveals left `"Pinned"` fold toggle (`8 px` chevron + `10 px` medium label) and right `"Tidy"` / `"Clear"` buttons (`10 px` medium, `textTertiary` → `textPrimary` hover).
  - **yab** ([yab/Sources/Fast/KeptViews.swift](`refs/yab/Sources/Fast/KeptViews.swift`), [Prefs.swift](`refs/yab/Sources/Fast/Prefs.swift`)): `12 / 9 px` band (`10 px` side inset) with solid hairline (`lineDrop = 5 / 3 px`); reveals inline `"Tidy"` and `"Clear"` (`11 px` medium, `faint` → `ink`) on hover.
- **"New Tab" Row**:
  - **Ardia** ([ardia/apps/browser/src/components/sidebar/NewTabRow.tsx](`refs/ardia/apps/browser/src/components/sidebar/NewTabRow.tsx`)): `34 px` tall, `10 px` radius, `padding-left: 9px`. `plus` icon `13 px` medium (`#FFFFFF40` Dark / `#00000042` Light), `"New Tab"` `13 px` regular (`#FFFFFF8C` Dark / `#00000080` Light, `5 px` gap), trailing overflow chevron button (`22 × 22 px`, `10 px` `chevron.down`). Hover uses `tabHover`. Docks to bottom of sidebar when list overflows (`9 px` hPad, `6 px` vPad).
  - **yab** ([yab/Sources/Fast/Side.swift](`refs/yab/Sources/Fast/Side.swift`)): `36 / 28 px` tall, `10 / 8 px` radius, `10 px` hPad, `11 px` medium `+` icon in `16 / 15 px` slot, `14 px` regular label in `Palette.quiet(tone)` (no trailing chevron). Hover uses `SelectionPlate(.hover)`; lights up with `SelectionPlate(.selected)` when command bar is open.
- **Folders / Tab Groups**:
  - **Ardia** ([ardia/apps/browser/src/components/sidebar/GroupBlock.tsx](`refs/ardia/apps/browser/src/components/sidebar/GroupBlock.tsx`), [sidebarMetrics.ts](`refs/ardia/apps/browser/src/lib/sidebarMetrics.ts`), [state/groups/tokens.ts](`refs/ardia/apps/browser/src/state/groups/tokens.ts`)): Wrapped in a rounded tray (`border-radius: 12px`, `0.5 px` border). Uncolored tray is invisible at rest and fades in on hover (`rgba(255,255,255,0.10)` Dark / `rgba(0,0,0,0.05)` Light, border `0.10`); colored groups show `16%` fill + `30%` border at rest (`blue #4C8DF6`, `red #E5534B`, `yellow #E3B341`, `green #3FB06C`, `pink #DB61A2`, `purple #9B6CF0`, `cyan #35B8C6`, `orange #EE8434`, `grey #8E8E93`). Header row `34 px`, `16 × 16 px` animated folder icon, `13 px` **medium** title (`#FFFFFF` Dark / `#000000D9` Light), inline `9 px` semibold `chevron.down` (`50%` alpha, rotates `-90° ↔ 0°`). Child indent: **`16 px`** per level (`padding-right: 3px`, `padding-bottom: 2.5px`); active child stays visible when collapsed. Shared folders add a `10 px` `person.2.fill` mark before the chevron.
  - **yab** ([yab/Sources/Fast/KeptViews.swift](`refs/yab/Sources/Fast/KeptViews.swift`), [Kept.swift](`refs/yab/Sources/Fast/Kept.swift`), [AgentFolders.swift](`refs/yab/Sources/Fast/AgentFolders.swift`)): No container box around uncolored folders; row height `36 / 28 px`, `21.33 / 20 px` folder icon, `14 px` medium title, child indent **`15 px`** per level (max depth `5`). Custom folder tint wash `0.13` Light / `0.20` Dark.
- **Footer (Space Switcher & Buttons)**:
  - **Ardia** ([ardia/apps/browser/src/components/profiles/ProfileDots.tsx](`refs/ardia/apps/browser/src/components/profiles/ProfileDots.tsx`), [profiles/tokens.ts](`refs/ardia/apps/browser/src/components/profiles/tokens.ts`), [sidebar/geometry.ts](`refs/ardia/apps/browser/src/components/sidebar/geometry.ts`)):
    - Height **`41 px`** (collapses to `0` if only 1 space and no footer downloads).
    - **Dots**: **`6 × 6 px`** circle in `12 px` cell, color `#FFFFFF` (Dark) / `#000000` (Light); opacity **selected `0.85`**, **hover `0.40`**, **idle `0.20`**.
    - **Custom Space Icons** (when all fit): `11 px` semibold in `26 px` cell; opacity `1.0` / `0.70` / `0.42`.
    - **Downloads button** (when sidebar-address mode or narrow header): `34 × 34 px`, `10 px` radius, `16 px` `arrow.down.circle`, at `left: 5px, bottom: 5px`.
    - **Not found in Ardia**: There is **no `+` button, no settings button, and no sidebar toggle** in the footer.
  - **yab** ([yab/Sources/Fast/SpaceFoot.swift](`refs/yab/Sources/Fast/SpaceFoot.swift`)):
    - Height **`34 px`** (`26 px` buttons + `8 px` bottom margin, `8 px` side padding).
    - **Left**: Downloads button (`26 × 26 px`). **Center**: Space switcher — defaults to `12 px` icons (`13 px` emoji; inactive emoji desaturated at `0.50` opacity, inactive symbol `0.40`), auto-falls back to dots when per-space room `< 22 px`; explicit dots mode uses `14 px` pitch, **active `7 px` circle** (`strong`) vs **inactive `4 px` circle** (`ink 0.40`). **Right**: **`+` button (`FootPlus`)** `26 × 26 px`, `11 px` medium `+` rotating `45° → ×` over `100 ms ease-out` when space menu is open.
- **Icon-Only Vertical Sidebar Mode**: **Not found in either Ardia or yab.** Both hide the vertical sidebar completely and reveal it via a `3 px` edge hover-peek. (Only yab's optional horizontal *top* tab bar shrinks tabs down to `36 px` icon-only pills; [yab/Sources/Fast/StripWidths.swift](`refs/yab/Sources/Fast/StripWidths.swift`).)

---

## 3. Address Bar / Top Bar

Both browsers support **both** a top address bar integrated into the top of the rounded page card (Ardia's default; yab's optional mode / split pane header) and an Arc-style sidebar address bar (yab's default; Ardia's optional mode).

### 3.1 Top Address Bar (On Top of the Page Card)

| Property | Ardia ([Toolbar.tsx](`refs/ardia/apps/browser/src/components/toolbar/Toolbar.tsx`), [toolbarRow.ts](`refs/ardia/apps/browser/src/lib/toolbarRow.ts`), [toolbarColors.ts](`refs/ardia/apps/browser/src/components/ui/toolbarColors.ts`)) | yab ([AddressBar.swift](`refs/yab/Sources/Fast/AddressBar.swift`), [SiteControls.swift](`refs/yab/Sources/Fast/SiteControls.swift`)) |
|---|---|---|
| **Height** | **`41 px`** regular / **`28 px`** compact (`20 px` auto-hide collapsed strip) | **`36 px`** carded (or with top strip) / **`46 px`** (`40 px` compact) edge-to-edge |
| **Bottom border** | `0.5 px` hairline (`rgba(255,255,255,0.09)` Dark / `rgba(0,0,0,0.09)` Light) | `1 px` `Palette.ink` at `0.06` opacity |
| **Website color tint** | Extends page's `<meta name="theme-color">` across band (`150 ms`), auto-switching ink (`#000000E6` on light / `#FFFFFF` on dark) | Uses sampled page top color `tone?.color ?? Palette.ground` (`#161616` private) |
| **URL field height & radius** | **`30 px`** tall, **`8 px`** radius (compact: `22 px`, `4 px`); spans from `x = 145 px` (or `110 px` without sidebar toggle) to trailing actions | **`30 px`** tall, **`8 px`** radius, centered pill |
| **URL field fill** | **Idle**: transparent (no border/shadow). **Hover / popover open**: `rgba(255,255,255,0.07)` Dark / `rgba(0,0,0,0.05)` Light (`0.10` / `0.06` on site-tinted bar). **Focus**: opens floating Command Bar directly over field (0 px text shift). | **Idle**: transparent. **Hover**: `Palette.hover(tone)`. **Focus**: opens Command Bar. |
| **Text: Host vs Path** | **Host** (`www.` stripped): **`13 px` `500` (medium)**, `#FFFFFF` (Dark) / `#000000` (Light).<br>**Path / query** (shown on hover or `showFullUrl`): **`13 px` `400` (regular)**, `#FFFFFF80` (50% Dark) / `#00000080` (50% Light).<br>**Dev mode**: `13 px` `Menlo`. | **Registrable domain**: **`13 px` `500`**, `Palette.ink`.<br>**Subdomain / `"Not secure"` / Path**: **`13 px` `500`** (dev `12 px` `400` mono), `Palette.muted` (dev path `ink 0.62`). |
| **Security indicator** | **No lock on HTTPS**; shows `12 px` `lock.open.trianglebadge.exclamationmark.fill` only on HTTP (`secondary`) or cert error (`#FF453A`/`#FF3B30`). | `"Not secure  "` text prefix in `Palette.muted` on HTTP; lock icon only in Dev mode. |
| **Nav & toolbar buttons** | Leading `[sidebar, back, fwd, reload]` centers at `x = [21, 56, 92, 127]` (`35–36 px` pitch): **`30 × 30 px`**, radius **`7 px`** (`22 × 22 / 4 px` compact), glyph `13 px`. Hover `rgba(255,255,255,0.10)` Dark / `rgba(0,0,0,0.06)` Light; Pressed `0.18` / `0.10`.<br>In-field actions (Copy/Bookmark, Split, Site Controls): **`24 × 24 px`**, radius `5 px`, hover-only by default.<br>Extensions: **`28 × 28 px`**, `16 px` icon, `2 px` gap. | Leading nav & pinned extensions (up to `6`): **`30 × 30 px`**, radius **`8 px`**, `4 px` gap, `13 px` glyph (`14.5 px` arrows, `16 px` sidebar mark, `1.5 px` stroke).<br>In-pill Copy & Bookmark buttons: **`24 × 24 px`**, `3 px` inset, concentric **`5 px`** radius, `10 px` medium glyph. |

### 3.2 Sidebar Address Bar Variant
- **Ardia** ([ardia/apps/browser/src/components/sidebar/SidebarField.tsx](`refs/ardia/apps/browser/src/components/sidebar/SidebarField.tsx`), [AddressBar.tsx](`refs/ardia/apps/browser/src/components/sidebar/AddressBar.tsx`)):
  - Height **`34 px`**, radius **`10 px`**, inset `9 px` left/right (`top: 46px` below `32 × 32` header nav tools).
  - Fill: idle `rgba(255,255,255,0.10)` Dark / `rgba(0,0,0,0.05)` Light; hover `rgba(255,255,255,0.16)` Dark / `rgba(255,255,255,0.55)` Light; border `0.5 px` `rgba(255,255,255,0.14)` Dark / `rgba(0,0,0,0.20)` Light.
  - Text: `13 px` medium host + `13 px` `FadeLabel` (`14 px` fade) secondary trail; placeholder `#FFFFFF87` / `#00000066`. Leading Site Controls button `24 × 24 px`, `5 px` radius, fill `rgba(255,255,255,0.08)` Dark / `rgba(255,255,255,0.75)` Light.
- **yab** ([yab/Sources/Fast/SiteControls.swift](`refs/yab/Sources/Fast/SiteControls.swift`)):
  - Height **`36 px`** (comfortable) / **`34 px`** (compact), radius **`10 / 8 px`**, `8 px` bottom gap above pins.
  - Fill: `Palette.resting(tone)` (`wash × 0.55` rest / `wash × 0.80` hover), no border. Text `12.5 px` regular (`20 px` trailing fade). Inline hover buttons `28 × 28 px` / `26 × 26 px` (`6 / 4 px` concentric radius, `2 px` gap).

---

## 4. Menus, Popovers & Context Menus

### 4.1 Popovers & Drawn Panel Menus (Ardia `PopoverSurface` & `.ardia-menu` vs yab `ActionMenu` & `DropMenu`)

| Property | Ardia Popovers (`PopoverSurface` / `MenuRow` / `FolderMenu`) ([Popover.tsx](`refs/ardia/apps/browser/src/components/ui/Popover.tsx`), [Menu.tsx](`refs/ardia/apps/browser/src/components/ui/Menu.tsx`), [FolderMenu.tsx](`refs/ardia/apps/browser/src/components/bookmarks/FolderMenu.tsx`)) | Ardia Desktop Context Menu (`.ardia-menu`) ([menus.tsx](`refs/ardia/apps/desktop/src/menus.tsx`), [base.css](`refs/ardia/apps/desktop/src/base.css`)) | yab Context Menu (`ActionMenu`) & Dropdown (`DropMenu`) ([ActionMenu.swift](`refs/yab/Sources/Fast/ActionMenu.swift`), [DropMenu.swift](`refs/yab/Sources/Fast/DropMenu.swift`), [YabDesign/Design.swift](`refs/yab/Sources/YabDesign/Design.swift`)) |
|---|---|---|---|
| **Card fill & blur** | Dark `rgba(38,38,38,0.94)` + `blur(24px) saturate(180%)` + `0.72` tint<br>Light `rgba(255,255,255,0.96)` + `blur(24px) saturate(180%)` + `0.70` tint | Dark `rgba(40,40,40,0.78)` / Light `rgba(246,246,246,0.78)` + **`backdrop-filter: blur(30px) saturate(180%)`** | macOS 26+: `.regularMaterial` + Liquid Glass; fallback solid `Palette.ground` (`#FFF` / `#1C1C1C`) |
| **Corner radius** | **`12 px`** (`radius.panel`) | **`10 px`** | **`14 px`** continuous (`Radius.floating`) |
| **Border** | **`0.5 px`** `rgba(255,255,255,0.14)` Dark / `rgba(0,0,0,0.12)` Light | **`0.5 px`** inset outline `rgba(255,255,255,0.16)` Dark / `rgba(0,0,0,0.18)` Light | **`1 px`** `Palette.hairline` (`#E8E8E8` Light / `#333333` Dark) |
| **Shadow** | `0 8px 36px rgba(0,0,0,0.45)` Dark / `0.16` Light (`radius 18 × 2`) | `0 10px 30px rgba(0,0,0,0.40)` Dark / `0.20` Light | `0 6px 14px rgba(0,0,0,0.16)` (fallback `PickerPlate`: `0 12px 30px rgba(0,0,0,0.18)`) |
| **Width & outer padding** | Widths `260` (Folder), `288` (Site), `300/340/360 px`; list `padding: 10px 6px` (`6px` for `FolderMenu`) | `min-width: 240px`, `max-width: 420px`, `padding: 5px` | `ActionMenu`: `160–340 px`, `padding: 6px`; `DropMenu`: `min 180 px`, `max-h: 360px`, `padding: 6px` |
| **Row height, padding & radius** | `min-height: 32px` (`28px` FolderMenu, `40px` Downloads, `42px` Site row), `padding: 6px 10px`, radius **`6 px`** (concentric `12 - 6`) | **`22 px`** tall, `padding: 0 8px 0 4px`, radius **`5 px`** | `ActionMenu`: **`24 px`** tall (`0 px` gap); `DropMenu`: **`28 px`** (`+14 px` with note, `2 px` gap); hPad `8 px`, radius **`8 px`** (concentric `14 - 6`) |
| **Icon size & gap** | `13 px` glyph in `20 × 20 px` slot, **`10 px`** gap | `12 px` glyph in `16 × 16 px` slot, `6 px` gap (check col `14 px`, swatch `10 × 10 px`) | `11 px` glyph (`13 px` emoji) in `15 × 15 px` slot, **`6 px`** gap |
| **Separator** | `0.5 px` hairline, `margin: 5px 16px`, `rgba(255,255,255,0.09)` / `rgba(0,0,0,0.09)` | `1 px` high, `margin: 5px 8px`, `rgba(255,255,255,0.12)` / `rgba(0,0,0,0.10)` | `1 px` divider inset `8 px` inside `12 px` band (`6 px` top/bottom) |
| **Hover / active row** | Hover **`rgba(255,255,255,0.07)`** Dark / **`rgba(0,0,0,0.07)`** Light; Pressed `0.12` / `0.10`; Destructive `#FF453A` / `#FF3B30`; Disabled `opacity: 0.45` | Hover & `.expanded` parent: **`#0A63E0`** fill, **`#FFFFFF`** text (macOS accent highlight). Disabled `opacity: 0.30`. (No destructive color defined.) | Hover & keyboard focus: **`Color.primary` at `0.10` opacity** (`8 px` radius). Disabled `Palette.faint`. |
| **Submenu** | `FolderMenu`: `10 px` semibold `chevron.right`, opens right with **`4 px` overlap** (`top = row.y - 6`), **`160 ms`** hover open delay | `"›"` in `.ardia-menu-key` (`12 px`, `0.55` opacity), opens right with **`4 px` overlap** (`top = row.y - 5`), **`0 ms`** delay | `9 px` semibold `chevron.right`, opens **`4 px` gap** outside parent, diagonal aim corridor (`±8 px`) + **`250 ms`** grace |
| **Keyboard focus** | `MenuRow` drop/focus ring: `1.5 px` `theme.accent` (`#4A77D4` / `#6395FC`) | Linux buttons: `outline: 2px solid #5a9bff; outline-offset: 2px`; control pills `2px solid rgba(255,255,255,0.6)` | Uses same `Color.primary 0.10` row plate; `ActionMenu` includes an inline `30 px` search bar (`13 px` font) at top (or bottom if rising up) |
| **Arrow / connector** | **None** on `PopoverSurface`, `FolderMenu`, `SiteControls`, `SelectionPopover`. **Has smooth beak arrow** *only* on `Downloads` via `PopoverBubble` ([PopoverBubble.tsx](`refs/ardia/apps/desktop/src/shims/web/PopoverBubble.tsx`)): `20 px` wide × `9 px` tall, `3 px` shoulder radius, `2.5 px` tip radius, `1 px` gap from button. | **None** (Note: Windows build [MenuPopup.h](`refs/ardia/apps/browser/windows/Ardia/MenuPopup.h`) delegates to native Win32 `TrackPopupMenuEx` with no custom draw). | **None** on `ActionMenu`, `DropMenu`, `GlanceCard`, `FolderPreview`, `SpaceTray`, `Tray`. Native `NSPopover` arrow used only on `SiteControls` (`280 px` wide) and `IconPicker`. |

---

## 5. Tooltips, Command Bar, Split View, Downloads & Settings

### 5.1 Tooltips & Sidebar Hover Cards
- **Ardia Tooltips (`TooltipAbove`)** ([ardia/apps/browser/src/components/ui/TooltipAbove.tsx](`refs/ardia/apps/browser/src/components/ui/TooltipAbove.tsx`), [ui/tokens.ts](`refs/ardia/apps/browser/src/components/ui/tokens.ts`)):
  - Fill: `#262626` (Dark) / `#FFFFFF` (Light); double border (`1 px` `panelBorder` inside `0.5 px` outer ring `rgba(0,0,0,0.40)` Dark / `0.12` Light); radius **`4 px`** (`4.5 px` outer); shadow `0 1px 8px rgba(0,0,0,0.15)` Dark / `0.08` Light.
  - Padding: `5px 6.5px`, max-width `280 px`, text **`12 px` `500`**, `rgba(255,255,255,0.85)` / `rgba(0,0,0,0.85)`. Show delay **`500 ms`**, fade-in `100 ms`.
- **Ardia Sidebar Hover Card (`HoverCard` / `SidebarHoverCard`)** ([ardia/apps/browser/src/components/sidebar/HoverCard.tsx](`refs/ardia/apps/browser/src/components/sidebar/HoverCard.tsx`), [TabCardSummary.tsx](`refs/ardia/apps/browser/src/components/sidebar/TabCardSummary.tsx`), [hoverPlacement.ts](`refs/ardia/apps/browser/src/components/sidebar/hoverPlacement.ts`), [state/sidebar/hover.ts](`refs/ardia/apps/browser/src/state/sidebar/hover.ts`)):
  - Width **`264 px`**, padding **`10 px`**, gap from sidebar **`8 px`**, radius **`12 px`**, fill `#2A2A2A` Dark / `#FFFFFF` Light (`blur(24px) saturate(180%)` on glass desktop), border `0.5 px` `rgba(255,255,255,0.10)` / `rgba(0,0,0,0.10)`, shadow `0 6px 32px rgba(0,0,0,0.40)` Dark / `0.144` Light.
  - Content: `16 px` favicon + `13 px` medium title (`FadeLabel`, `18 px` row, `5 px` gap); URL `11 px` `textSecondary` (`margin-top: 4px`); quick-action tiles `44 px` tall (`8 px` radius, `4 px` gap, `13 px` glyph + `10 px` label). Show delay **`800 ms`**, hide delay **`160 ms`** (`0 ms` when moving away), safe-triangle aim grace **`200 ms`**.
- **yab Tooltips (`KeyTipView`) & Tab Glance Cards (`GlanceBody`)** ([yab/Sources/Fast/Hotkeys.swift](`refs/yab/Sources/Fast/Hotkeys.swift`), [HUD.swift](`refs/yab/Sources/YabDesign/HUD.swift`), [Glance.swift](`refs/yab/Sources/Fast/Glance.swift`)):
  - **Tooltip**: dark HUD surface (`#1D1D1D` / `white 0.114` or tinted glass), radius **`8 px`**, `1 px` edge (`white 0.14` dark / `black 0.18` light), shadow `0 3px 7px rgba(0,0,0,0.22)`, padding `6px 10px` (`min-height: 28px` with shortcut keycaps `20 px` tall, `5 px` radius, `12 px` glyphs at `0.60` alpha), max-width `320 px`, font **`12 px` `500`**, `8 px` offset from anchor, dwell **`350 ms`** (`500 ms` warm instant handoff).
  - **Glance card**: width **`264 px`**, `16 px` beside sidebar (`6 px` below strip), radius **`14 px`**, `Palette.ground` + `1 px Palette.hairline`, shadow `0 6px 16px rgba(0,0,0,0.12)`, includes **`264 × 132 px` live page thumbnail** above `12 px`-padded text, dwell `500 ms`.

### 5.2 Command Bar (⌘T / ⌘L Field and Suggestions)

#### Ardia ([CommandPanel.tsx](`refs/ardia/apps/browser/src/components/omnibox/CommandPanel.tsx`), [OmniboxFrame.tsx](`refs/ardia/apps/browser/src/components/omnibox/OmniboxFrame.tsx`), [SuggestionRow.tsx](`refs/ardia/apps/browser/src/components/omnibox/SuggestionRow.tsx`), [GoButton.tsx](`refs/ardia/apps/browser/src/components/omnibox/GoButton.tsx`), [omnibox/tokens.ts](`refs/ardia/apps/browser/src/components/omnibox/tokens.ts`))
- **Placement & Geometry**:
  - **Centred floating (⌘T / centred ⌘L)**: responsive width `652 px` (normal `708–1699 px` viewport), `774 px` (`≥ 1700 px`), `616 px` (`637–707 px`), `viewWidth - 20` (`≤ 636 px`); top offset **`22%`** of page card height; radius **`20 px`**.
  - **Top-bar anchored (⌘L)**: left-aligned so typed text has `0 px` shift from toolbar breadcrumb, `top = anchor.top - 5.5`, `min-width: 420 px` (anchor + `40 px`), radius **`20 px`**.
  - **Sidebar anchored**: `width = max(350, anchor.width + 137)`, radius **`12 px`**, no bottom action row.
- **Backdrop**: **No scrim/dimming** behind the Command Bar.
- **Card Surface**: solid `#2D2D2D` (Dark) / `#FEFFFF` (Light), border `0.5 px` `rgba(120,125,134,0.32)` Dark / `rgba(0,0,0,0.07)` Light, shadow **`0 10px 48px rgba(0,0,0,0.50)`** Dark / **`0.18`** Light (`radius 24 × 2`).
- **Input Row**: height **`55 px`** (panel; `60 px` NTP hero; `44 px` sidebar dropdown), padding `0 18px 0 21px`, `15 px` leading icon (`18 × 18` slot), input font **`15 px`** floating/sidebar (`13 px` top-bar anchored; `17 px` NTP hero). Inline completion selection highlight: `rgba(120,125,134,0.70)` Dark / `0.40` Light.
- **Suggestion Rows**: flat list (**no section headers**), max **`8`** rows while typing (`5` idle in sidebar dropdown). List padding `0 8px 2px`; row height **`36 px`** (`margin: 2px 0`, `40 px` pitch), radius **`8 px`**, `padding: 0 13px`, `11 px` gap, `16 × 16 px` favicon (`13 px` SF Symbol). Combined single-line `15 px` text: title (`textPrimary`) + `" — " + accessory` (`textSecondary`), trailing hint `12 px` `textTertiary`.
  - **Selected row fill**: profile `powerUpColor` at **`0.56` alpha (Dark)** / **`0.30` alpha (Light)** (e.g. plum `#B5556B` tint seen in `command-bar.png`); fallback `rgba(255,255,255,0.145)` Dark / `rgba(15,24,44,0.08)` Light.
  - **Hover (unselected)**: `rgba(120,125,134,0.32)` Dark / `rgba(15,24,44,0.05)` Light.
- **Bottom Action Row** (floating/anchored panel, `52 px` tall, `padding: 0 13px 0 14px`): left `"Open a tab or file"` capsule (`32 px` tall, `1 px` border `rgba(255,255,255,0.15)` / `rgba(0,0,0,0.12)`, `13 px`), right dictate mic + **`Go` / Search Engine pill** (`min-width: 99px`, `height: 32px`, capsule, fill **`#DCCBD8`** + black text Dark / **`#0F182C`** + white text Light, `15 px` semibold + `11 px` `↵` at `60%`).

#### yab ([Omnibox.swift](`refs/yab/Sources/Fast/Omnibox.swift`), [FieldViews.swift](`refs/yab/Sources/Fast/FieldViews.swift`), [yab/docs/field-like-arc.md](`refs/yab/docs/field-like-arc.md`))
- **Full Mode (Raycast-like)**: **`750 × 475 px`** (`58 px` input + `417 px` body), radius **`26 px`**, top offset `18%` of window. Material `.regularMaterial` + glass (fallback `#FFFFFF` / `#212121`), `1 px` hairline border (`black 0.13` / `white 0.12`), dual shadows: near `0 1px 3px rgba(0,0,0,0.06 / 0.30)` + far `0 16px 36px rgba(0,0,0,0.14 / 0.42)`. Input **`20 px` regular**; rows **`38 px`** tall (`10 px` radius, `13.5 px` text, `22 × 22` icon tile, active fill `Palette.ink 0.08`), section headers `12 px` muted, `50 px` footer bar.
- **Compact Mode (Arc-like)**: **`540 px`** wide, radius **`18 px`**, `52 px` input + `5` fixed `40 px` rows (`212 px` body). Top specular rim (`white 0.70` Light / `0.18` Dark → `0`). Selected row (`12 px` concentric radius) is filled with the **space color** (darkened for `≥ 4.5:1` contrast with white text) + `0 3px 6px rgba(0,0,0,0.22)` shadow.

### 5.3 Split View

| Property | Ardia ([SplitChrome.tsx](`refs/ardia/apps/browser/src/components/split/SplitChrome.tsx`), [split/tokens.ts](`refs/ardia/apps/browser/src/components/split/tokens.ts`), [windowLayout.ts](`refs/ardia/apps/browser/src/lib/windowLayout.ts`)) | yab ([Split.swift](`refs/yab/Sources/Fast/Split.swift`), [SplitRule.swift](`refs/yab/Sources/Fast/SplitRule.swift`)) |
|---|---|---|
| **Max panes & min width** | Up to `3` panes; min **`220 px`** | `2` panes (`25%–75%` share); min **`320 px`** |
| **Gap between panes** | **`9 px`** (`max(inset, 2)`; `2 px` borderless) | **`8 px`** (`Pair.gap`) |
| **Divider hit area** | `gap + 4 px` (**`13 px`** at default `9 px` gap); dbl-click resets 50/50 | `8 px` full height; dbl-click resets 50/50 |
| **Divider handle look** | **`4 × 36 px`** pill (`2 px` radius), `#FFFFFF` Dark / `#000000` Light; opacity: rest **`0`**, hover **`0.32`**, drag **`0.55`** | **`3 × 28 px`** pill (`1.5 px` radius), `Palette.ink`; opacity: rest **`0`** (edge-to-edge shows `1 px` `ink 0.06` line), hover **`0.28`**, drag **`0.50`** |
| **Active pane indicator** | **`2 px` outer focus ring** (`1 px` outset, `paneRadius + outset`) in `theme.powerUpColor ?? theme.accent`; inactive pane's **toolbar** dims to `opacity: 0.50` (`150 ms`) | **`1 px` outline** in `Palette.ink` at **`0.30` opacity** (`Pair.ring`); inactive half's `AddressBar` fades extra controls (`140 ms`) |
| **Per-pane chrome** | Each pane is an independent rounded card (`10 px` radius) with its own `Toolbar` (independently light/dark per site color) + split & close (`×`) buttons | Each half is an independent `10 px` rounded card with its own `36 px` `AddressBar` + close (`×`) |

### 5.4 Downloads

- **Ardia** ([ardia/apps/browser/src/components/downloads/Downloads.tsx](`refs/ardia/apps/browser/src/components/downloads/Downloads.tsx`), [DownloadsButton.tsx](`refs/ardia/apps/browser/src/components/downloads/DownloadsButton.tsx`), [downloads/tokens.ts](`refs/ardia/apps/browser/src/components/downloads/tokens.ts`), [ProgressTrack.tsx](`refs/ardia/apps/browser/src/components/ui/ProgressTrack.tsx`)):
  - **Trigger**: `34 × 34 px`, `10 px` radius, `16 px` `arrow.down.circle`. **No progress ring or badge on the button** (instead a `44 × 44` file icon arcs into it on download start).
  - **Card (`PopoverBubble`)**: width **`300 px`**, max list height **`320 px`** (`8` rows × `40 px`), radius **`12 px`**, smooth `20 × 9 px` beak arrow (`1 px` gap from button), fill `rgba(40,40,42,0.82)` Dark / `rgba(246,246,246,0.82)` Light + `blur(24px) saturate(180%)` + `0.30` tint, border `0.5 px` `popoverBorder`, shadow `0 8px 36px rgba(0,0,0,0.45 / 0.16)`.
  - **Header**: `24 px` tall, `"RECENT DOWNLOADS"` `11 px` `600` uppercase (`letter-spacing: 0.4px`), `"Clear"` `12 px`.
  - **Row**: height **`40 px`**, `padding: 0 10px` (list inset `6 px`), `6 px` radius, `10 px` gap, **`24 × 24 px`** file icon, `13 px` filename + `11 px` status; progress track **`3 px`** tall capsule (`#717782` Dark / `#CED7E7` Light, fill `#4A77D4` / `#6395FC`); `22 × 22 px` pause/cancel/reveal action buttons (`13 px` glyph; reveal is hover-only). Footer: `"View all downloads ›"` `32 px` tall.
- **yab** ([yab/Sources/Fast/Hoard.swift](`refs/yab/Sources/Fast/Hoard.swift`), [HoardStack.swift](`refs/yab/Sources/Fast/HoardStack.swift`), [Tray.swift](`refs/yab/Sources/Fast/Tray.swift`)):
  - **Trigger**: `26 × 26 px` button in sidebar footer with **circular progress dial** (`19 px` → shrinks to `13 px`, `1.1 px` track / `1.5 px` active arc; `12 × 12 px` count badge `8.5 px` semibold).
  - **Two layouts**: (1) **Popover `HoardList`** (from strip/bar): `280 px` wide, `14 px` radius, `6 px` gap, `.hudWindow` blur + `ground 0.70`, `1 px` hairline, `40 px` rows (`20 × 20` icon), max `4` items; (2) **Sidebar `HoardStack`** (hover `180 ms` on footer button): **cardless/shadowless** floating rows (`56 px` tall, `40 × 40` thumbnails `5 px` radius, max `4` items) rising directly over dimmed sidebar tabs.

### 5.5 Settings Window / View

- **Ardia** ([ardia/apps/browser/src/components/settings/SettingsWindow.tsx](`refs/ardia/apps/browser/src/components/settings/SettingsWindow.tsx`), [settings/tokens.ts](`refs/ardia/apps/browser/src/components/settings/tokens.ts`), [Form.tsx](`refs/ardia/apps/browser/src/components/settings/Form.tsx`), [ui/Row.tsx](`refs/ardia/apps/browser/src/components/ui/Row.tsx`), [ui/Switch.tsx](`refs/ardia/apps/browser/src/components/ui/Switch.tsx`), [ui/Segmented.tsx](`refs/ardia/apps/browser/src/components/ui/Segmented.tsx`), `privacy.webp`):
  - **Window**: macOS System Settings split layout; default size delegated to native host (`min-width: 700px` on Linux in `styles.css`). Content background: `#1E1E1E` (Dark) / `#F2F2F2` (Light).
  - **Left nav sidebar**: width **`214 px`**, vibrancy `sidebar` material, `1 px` right divider (`rgba(0,0,0,0.60)` Dark / `0.10` Light). `52 px` top header, `28 px` search field (`8 px` radius, `10 px` hMargin). Nav rows: `30 px` tall, `8 px` radius, `8 px` hPad, `4 px` gap, **`20 × 20 px` colored squircle icon** (`5 px` radius, `11 px` white semibold glyph; tints `#8E8E93`, `#0A84FF`, `#FF9500`, `#5856D6`, `#AF52DE`, `#FF2D55`, `#30B0C7`). Active row fill: **`#0A84FF` (Dark) / `#007AFF` (Light)** with `#FFFFFF` text; hover `rowHover`.
  - **Right pane**: `52 px` toolbar (Back/Forward `26 × 26` + `15 px` semibold title); centered content `max-width: 600px`, `padding: 0 24px 40px`.
  - **Grouped section cards**: radius **`12 px`**, fill `rgba(255,255,255,0.045)` Dark / `rgba(0,0,0,0.028)` Light, border `1 px` `rgba(255,255,255,0.07)` / `rgba(0,0,0,0.07)`, internal row dividers inset `12 px`. Section header: `margin: 20px 6px 6px`, `13 px` semibold.
  - **Rows & controls**: row `min-height: 34px` (`padding: 6px 12px`, `13 px` title + `11 px` secondary caption). Toggle switch: **`26 × 15 px`** (`13 px` white knob, `1 px` inset; on `#0A84FF`/`#007AFF`, off `rgba(255,255,255,0.14)`/`rgba(0,0,0,0.10)`). Segmented control: `20 px` segment inside `4 px`-radius bordered track with sliding `#0A84FF` thumb. Push buttons: `22 px` tall, `4 px` radius, `10 px` hPad. TextField: `24 px` tall, `4 px` radius. Theme swatches: `20 px` disc, `2 px` ring, `8 px` gap (`ColorPad` `172 × 172 px` wheel).
- **yab** ([yab/Sources/Fast/SettingsWindow.swift](`refs/yab/Sources/Fast/SettingsWindow.swift`), [SettingsCards.swift](`refs/yab/Sources/Fast/SettingsCards.swift`)):
  - **Window**: fixed width **`760 px`**, default height `540 px` (min `760 × 440 px`).
  - **Left nav**: **`180 px`** (`170–210 px`), `32 px` capsule glass search bar, `28 px` rows (`8 px` radius, `20 × 20` icon well `5 px` radius in subtle `labelColor 0.04` + gradient rim — monochrome rather than colored squircles; selected fill `unemphasizedSelectedContentBackgroundColor`).
  - **Right pane**: native SwiftUI grouped `Form` (`~10 px` card radius), `56 × 56 px` hero tile + `22 px` bold title, small macOS switches, `32 px` capsule `GlassTrack` segmented control (`26 px` thumb), `28 px` `.yab` buttons (`8 px` radius).

---

## 6. Motion

> **Spring Conversion Note for CSS / JS (Framer Motion / WAAPI):** Both codebases parameterize springs by `(response, dampingFraction ζ)` with `mass = 1`: `ω = 2π / response`, `stiffness = ω²`, `damping = 2 · ζ · ω`.

### 6.1 Core Primitives
- **Ardia** ([ardia/apps/browser/src/components/ui/motion.ts](`refs/ardia/apps/browser/src/components/ui/motion.ts`), [tabstrip/tokens.ts](`refs/ardia/apps/browser/src/components/tabstrip/tokens.ts`)):
  - Curves: `enter` = cubic ease-out (`cubic-bezier(0.215, 0.61, 0.355, 1)`), `exit` = quad ease-in (`cubic-bezier(0.55, 0.085, 0.68, 0.53)`), `move` = quad ease-in-out, `fade` = `cubic-bezier(0.25, 0.46, 0.45, 0.94)`, `cssEase` = `cubic-bezier(0.25, 0.1, 0.25, 1)`, `cssEaseOut` = `cubic-bezier(0, 0, 0.58, 1)`.
  - Springs (`mass = 1`): `snappy` (`response: 0.20s, ζ: 0.90` → `k = 987, c = 56.5`), `smooth` (`0.40s, 0.85` → `k = 247, c = 26.7`), `press` (`0.12s, 1.0` → `k = 2742, c = 104.7`), `release` (`0.28s, 0.55` → `k = 504, c = 24.7`), `SLIDE` reorder (`ω = 90, ζ = 1.0` → `response ≈ 0.07s, k = 8100, c = 180`).
- **yab** ([yab/Sources/YabDesign/Design.swift](`refs/yab/Sources/YabDesign/Design.swift`), [Buttons.swift](`refs/yab/Sources/YabDesign/Buttons.swift`)):
  - Curves: `arrive` `220 ms` / `reshape` `300 ms` / `room` `200 ms` / `leave` `140 ms` all use **`cubic-bezier(0.2, 0.8, 0.2, 1)`**; `depart` `150 ms` **`cubic-bezier(0.4, 0, 0.8, 0.4)`**; `quick` `140 ms` `ease-out`; `chatIn` `300 ms` `cubic-bezier(0.19, 1, 0.22, 1)`.
  - Springs: `glide` (`0.34s, 0.82`), `settle` (`0.30s, 0.86`), `markTurn` (`0.30s, 0.70`), `keptShift` (`0.12s, 0.90`), `Press.down` (`160 ms, bounce 0`), `Press.up` (`280 ms, bounce 0`).

### 6.2 Interaction-by-Interaction Animation Catalog

| Interaction | Ardia (Duration, Curve/Spring, Transforms + Source) | yab (Duration, Curve/Spring, Transforms + Source) |
|---|---|---|
| **Popovers & Downloads** | Open **`150 ms`** cubic-out; Close **`100 ms`** quad-in. `opacity: 0↔1`, `scale: 0.94↔1`, `translateY: ±4px↔0`, origin `"top right"`/`"top left"` (Downloads: `[arrowX, 0 or 100%]`) ([Popover.tsx](`refs/ardia/apps/browser/src/components/ui/Popover.tsx`), [Downloads.tsx](`refs/ardia/apps/browser/src/components/downloads/Downloads.tsx`)) | `Tray`: Open **`260 ms`** `cubic-bezier(0.32, 0.72, 0, 1)` `scale: 0.1→1` from button center (or **`240 ms`** `0.94→1` from edge) + `opacity 140/160 ms`; Close **`120 ms`** ease-in `scale: 1→0.96, opacity→0` ([Tray.swift](`refs/yab/Sources/Fast/Tray.swift`)). `HoardStack`: rise spring `(0.18s, 0.88)`, rows stagger `15 ms` ([HoardStack.swift](`refs/yab/Sources/Fast/HoardStack.swift`)). |
| **Context menus** | Desktop `.ardia-menu`: **instant (0 ms)** mount/unmount ([menus.tsx](`refs/ardia/apps/desktop/src/menus.tsx`)). `FolderMenu`: same `150/100 ms` popover motion, `160 ms` submenu hover delay. | `ActionMenu`: **instant (0 ms)** open/close ([ActionMenu.swift](`refs/yab/Sources/Fast/ActionMenu.swift`)). `DropMenu`: `120 ms` fade in, instant close ([DropMenu.swift](`refs/yab/Sources/Fast/DropMenu.swift`)). |
| **Tooltips & Hover cards** | `TooltipAbove`: `500 ms` delay, **`100 ms`** `cubic-bezier(0.25, 0.46, 0.45, 0.94)` `opacity: 0→1`, instant hide ([TooltipAbove.tsx](`refs/ardia/apps/browser/src/components/ui/TooltipAbove.tsx`)).<br>`HoverCard`: `800 ms` delay, **`100 ms`** `curve.fade` `opacity: 0↔1` (no scale/offset) ([hoverMotion.ts](`refs/ardia/apps/browser/src/components/sidebar/hoverMotion.ts`)). | `KeyTip`: `350 ms` dwell, open **`120 ms`** `cubic-bezier(0.2, 0.8, 0.2, 1)` `opacity: 0→1` + **`4 px` slide** toward anchor; close **`100 ms`** linear fade ([Hotkeys.swift](`refs/yab/Sources/Fast/Hotkeys.swift`)).<br>`GlanceCard`: **instant (0 ms)** after `500 ms` dwell ([Glance.swift](`refs/yab/Sources/Fast/Glance.swift`)). |
| **Sidebar collapse / expand** | Dock toggle: **`200 ms`** `cubic-bezier(0.42, 0, 0.58, 1)` (`100 ms` cubic-out for Arc-mode hide), animates `translateX(∓width ↔ 0)` & page card inset ([SidebarDock.tsx](`refs/ardia/apps/browser/src/components/window/SidebarDock.tsx`), [dockMotion.ts](`refs/ardia/apps/browser/src/components/window/dockMotion.ts`)). | Dock toggle: **`300 ms`** `cubic-bezier(0.2, 0.8, 0.2, 1)` (`Reshape.Pace.reshape`); drag snap-shut **`150 ms`** `depart`; over-stretch snap-back **`250 ms`** ([Reshape.swift](`refs/yab/Sources/Fast/Reshape.swift`), [Side.swift](`refs/yab/Sources/Fast/Side.swift`)). |
| **Sidebar hover peek** | In: **`150 ms`** cubic-out (`translateX: ∓12px → inset`, `opacity: 0→1`). Out: `200 ms` close delay, **`150 ms`** cubic-out (Arc mode cubic-in-out) ([usePeek.ts](`refs/ardia/apps/browser/src/components/window/usePeek.ts`), [SidebarDock.tsx](`refs/ardia/apps/browser/src/components/window/SidebarDock.tsx`)). | Arrive: CA spring **`(response: 0.21s, ζ: 0.78)`** (`k ≈ 895, c ≈ 46.7`), slides from `-(width + 20)` to `0`. Leave: **`120 ms`** `cubic-bezier(0.67, 0.85, 0.73, 0.86)` ([Peek.swift](`refs/yab/Sources/Fast/Peek.swift`)). |
| **Tab open / close / reflow** | Sibling reflow (`translateY`): **`140 ms`** `cubic-bezier(0.25, 0.1, 0.25, 1)`. Open appear (`opacity: 0→1`): **`140 ms`** `ease-out`. Close ghost (`opacity→0`): **`100 ms`** `ease-out`. Selection switch: **instant** ([ListMotion.tsx](`refs/ardia/apps/browser/src/components/sidebar/ListMotion.tsx`)). | Open reflow: **`200 ms`** `(0.2, 0.8, 0.2, 1)`, row insertion instant. Close reflow: **`140 ms`** `(0.2, 0.8, 0.2, 1)`, removed row **`opacity→0` + `scale(0.96)`** (center origin). Selection switch: **instant** ([Side.swift](`refs/yab/Sources/Fast/Side.swift`)). |
| **Folder / group open & close** | **`150 ms`** cubic-out (`[0.33, 1, 0.68, 1]` native layout), animates `height: 0↔travel`, `opacity: 0↔1`, chevron `rotate(-90deg ↔ 0deg)`. Tile `FolderPanel`: `SLIDE` spring (`ω = 90, ζ = 1`), `scale: 0.92→1` ([Fold.tsx](`refs/ardia/apps/browser/src/components/sidebar/Fold.tsx`), [FolderPanel.tsx](`refs/ardia/apps/browser/src/components/sidebar/FolderPanel.tsx`)). | Open: **`220 ms`** `(0.2, 0.8, 0.2, 1)`, child rows stagger `50 ms + idx × 30 ms` (`opacity: 0→1`, `translateY: -6px→0`). Close: **`140 ms`** `ease-out` ([AgentFolders.swift](`refs/yab/Sources/Fast/AgentFolders.swift`), [ColumnCells.swift](`refs/yab/Sources/Fast/ColumnCells.swift`)). |
| **Hover & press feedback** | Hover fill (`HoverFill`): **`50 ms` in / `200 ms` out**, `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.<br>Press (`snappy` `0.20s, 0.90`): icons `scale(0.96)`, controls `scale(0.985)` (optional bounce mode: `press` `0.12s, 1.0` → `release` `0.28s, 0.55`; icon `0.90`, tile `0.94`, row `0.975`) ([motion.ts](`refs/ardia/apps/browser/src/components/ui/motion.ts`)).<br>Toggle switch: **`150 ms`** cubic-out. | Hover fill: **`140 ms` `ease-out`** (`Motion.quick`).<br>Press: `Press.down` (`160 ms, bounce 0`) → `Press.up` (`280 ms, bounce 0`); scale `.small 0.94`, `.regular 0.95`, `.large/Door/Pin 0.96`, close `0.90` ([Buttons.swift](`refs/yab/Sources/YabDesign/Buttons.swift`)).<br>Back/fwd arrow kick: `±3.5 px` (`90 ms`) → spring `(0.30s, 0.60)`. Reload rotates `90°` (`100 ms`). |
| **Drag & drop** | Ghost: **no scale-up** (`scale: 1`), `opacity: 0.96`, shadow `0 4px 20px rgba(0,0,0,0.45 / 0.18)`. Row↔tile morph: spring **`(0.10s, 1.0)`**. Sibling gaps & drop settle: **`SLIDE` spring (`ω = 90, ζ = 1.0`)** ([DragGhost.tsx](`refs/ardia/apps/browser/src/components/sidebar/DragGhost.tsx`), [sidebar/tokens.ts](`refs/ardia/apps/browser/src/components/sidebar/tokens.ts`)). | Lift shadow `0 4px 12px rgba(0,0,0,0.14)` (`0 3px 10px 0.16` pin). Sibling step-aside & drop settle: **`settle` spring `(0.30s, 0.86)`**. Drag over shut folder shrinks to `scale(0.88)` (`.topLeading`) then sinks `0.60` + `opacity: 0` on drop ([Side.swift](`refs/yab/Sources/Fast/Side.swift`)). |
| **Split view** | Pane open/close/resize: **instant**. Drag drop zones slide in **`110 ms`** (`enter`/`exit`) and morph size on **`snappy` (`0.20s, 0.90`)**. Inactive toolbar dim: **`150 ms`** cubic-out ([SplitChrome.tsx](`refs/ardia/apps/browser/src/components/split/SplitChrome.tsx`), [Toolbar.tsx](`refs/ardia/apps/browser/src/components/toolbar/Toolbar.tsx`)). | Enter/separate/swap/equalize: **`300 ms`** `(0.2, 0.8, 0.2, 1)` CA path + carry; drag room **`200 ms` in / `160 ms` out**; divider drag **`0 ms`** live ([Reshape.swift](`refs/yab/Sources/Fast/Reshape.swift`), [SplitDeck.swift](`refs/yab/Sources/Fast/SplitDeck.swift`)). |
| **Command bar (⌘T / ⌘L)** | Open & close: **instant (0 ms)** — full size on frame 1 ([CommandPanel.tsx](`refs/ardia/apps/browser/src/components/omnibox/CommandPanel.tsx`)). Site-search `ScopePulse`: rise `100 ms` → settle to `0.25` over `400 ms` → exit `150 ms` ([ScopePulse.tsx](`refs/ardia/apps/browser/src/components/omnibox/ScopePulse.tsx`)). | Open, close & row selection: **instant (0 ms)** ([App.swift](`refs/yab/Sources/Fast/App.swift`), [Omnibox.swift](`refs/yab/Sources/Fast/Omnibox.swift`)). Invalid URL shake: `sin(6πt)·7·(1-t)` over `350 ms ease-out`. |
| **Space / Profile swipe** | Critically damped settle spring **`(response: 0.25s, ζ: 1.0)`**, rubber-band `0.15`, crossfades backdrop tint ([pager.ts](`refs/ardia/apps/desktop/src/shims/web/motion/pager.ts`)). | Critically damped CA spring **`(response: 0.20s, ζ: 1.0)`** (`k ≈ 987, c ≈ 62.8`), rubber-band `0.15` ([SpacePager.swift](`refs/yab/Sources/Fast/SpacePager.swift`)); footer dot size morph `140 ms ease-out`. |
| **Link Peek overlay** | Web shim (`PeekStage`): open spring **`(0.20s, 0.90)`** `overshootClamping` from `scale(0.12)` at link center → `1`; close **`150 ms`** quad-in; promote **`150 ms`** cubic-out ([PeekStage.tsx](`refs/ardia/apps/desktop/src/shims/web/PeekStage.tsx`), [docs/peek-motion.md](`refs/ardia/docs/peek-motion.md`)). | Grow from link: **`340 ms`** `cubic-bezier(0.32, 0.72, 0, 1)`; shrink back **`260 ms`** `(0.4, 0, 0.2, 1)`; underlying page recesses `12 px` on CA spring `(k = 420, c = 38)` ([LinkPeek.swift](`refs/yab/Sources/Fast/LinkPeek.swift`), [PeekDepth.swift](`refs/yab/Sources/Fast/PeekDepth.swift`)). |
| **Other chrome motion** | Reload↔Stop: `150/250 ms` (`scale 0.72`, `28°` rotate), Stop breathes `1420 ms` sine (`scale 0.96↔1.06`); Auto-hide toolbar `150 ms` (`scale 0.94`); Download magnet arc `400 ms` (`-90 px`); Toast `150 ms` in / `250 ms` out (`opacity`). | Toast slides from top `220 ms` `arrive` / `150 ms` `depart`; Download arc `670 ms` + button bounce; Copy URL link→checkmark `90 ms` + `160 ms` trim. |

---

## 7. Typography

- **Font Families**:
  - **Ardia** ([ardia/apps/desktop/src/base.css](`refs/ardia/apps/desktop/src/base.css`), [themeLook.ts](`refs/ardia/apps/browser/src/lib/themeLook.ts`)): System sans (`-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Inter, sans-serif`); Monospace `"Menlo"` (dev URLs, code).
  - **yab** ([yab/Sources/Fast/SidebarTypography.swift](`refs/yab/Sources/Fast/SidebarTypography.swift`), [YabDesign/Design.swift](`refs/yab/Sources/YabDesign/Design.swift`)): System SF Pro everywhere; SF Mono only for dev URLs and custom CSS; `.rounded` is never used in browser chrome.
- **Letter-spacing / Tracking**:
  - **Ardia** ([ardia/apps/browser/src/components/ui/tokens.ts](`refs/ardia/apps/browser/src/components/ui/tokens.ts`)): Default optical (`0`) on almost all chrome; uppercase section headers (e.g. `"RECENT DOWNLOADS"`) use **`+0.4 px`** (`tracking.caps`); large display headings `-0.4 px`, wordmark `-1.5 px`, sync codes `+3 px`; `tabular-nums` on badges/counts.
  - **yab**: **No explicit tracking/kerning** anywhere in UI chrome (relies solely on SF Pro optical tracking); `monospacedDigit` on badges/downloads/counters.

| UI Role | Ardia (Size / Weight / Line-Height / Tracking) | yab (Size / Weight) |
|---|---|---|
| **Space / Profile Header** | `13 px` / `600` / `16 px` | `14 px` (`13/14/16`) / `600` |
| **Sidebar Section Header** | `11 px` / `600` / `14 px` | `11 px` / `500` (Tidy/Clear) |
| **Sidebar Tab Row (Idle & Active)** | `13 px` / **`400`** / `16 px` (`12 px` quiet; scales ×`15/13` & `17/13`) | `14 px` (`13/14/16`) / **`400`** |
| **Sidebar Folder / Group Header** | `13 px` / `500` / `18 px` slot | `14 px` (`13/14/16`) / `500` |
| **Address Bar (Host / Path)** | Host `13 px` `500`; Path `13 px` `400`; Sidebar field `13 px`; Dev `13 px` `Menlo`; Collapsed strip `11 px` `500` | Top bar `13 px` `500` (Dev `12 px` `400` mono); Sidebar plate `12.5 px` `400` |
| **Command Bar Input** | `15 px` `400` floating/sidebar (`13 px` top-anchored, `17 px` NTP hero) | **`20 px` `400`** |
| **Command Bar Suggestions** | `15 px` `400` / `20 px` (title + `— accessory`); hint `12 px` `400` | `13.5 px` `400`; section header `12 px` `400` |
| **Menus & Popovers** | Popover row: `13 px` `400` / `16 px`, detail `11 px` / `14 px`. Context menu: `13 px` `400`, shortcut `12 px` (`0.55` alpha) | `ActionMenu`: `13 px` `400` (items & shortcuts). `DropMenu`: `13 px` `400`, note `11 px`, header `11 px` `600` |
| **Tooltips & Hover Cards** | Tooltip `12 px` `500`. Hover card: title `13 px` `500`, URL `11 px` `400` | Tooltip `12 px` `500`. Glance card: title `13 px` `400`, meta `11.5 px` `400` |
| **Downloads** | Header `11 px` `600` (`+0.4 px` tracking); filename `13 px` `400`; status `11 px` `400` | Popover: `12.5 px` `400` / `11 px` `400` mono-digit. Stack: `14 px` `400` / `12 px` `400` |
| **Settings** | Toolbar `15 px` `600`; Nav `13 px` `400`; Section `13 px` `600`; Row `13 px` `400`; Caption `11 px` `400` / `14 px` | Hero `22 px` `700`; Toolbar `15 px` `600`; Nav `13 px` (`600` active); Row `13 px` `400`; Detail `12 px` `400` |
| **Badges** | Small `9 px` `700` (`14 px` pill); Medium `10 px` `600` (`18 px` pill) | `8.5–10.5 px` `600` (`monospacedDigit`) |

---

## 8. What Makes the Look Recognisable & Where yab Differs from Ardia

### What Makes the Look Immediately Recognisable
1. **Concentric window-to-card framing**: A tinted/vibrant outer frame (`18–19 px` radius) wraps a `8–9 px` uniform bezel around a `10 px`-radius floating page card — every nested control follows concentric radii (`12 → 6`, `10 → 5`, `14 → 8`).
2. **Soft, low-saturation space-tinted backdrop + subtle grain**: Rather than flat gray chrome, the entire sidebar and frame share a continuous space-colored translucent gradient (with subtle noise/grain) that adapts text ink automatically for contrast.
3. **Floating light/dark card for the active tab — with regular font weight**: Active tabs never turn bold or shouty blue; they lift off the sidebar as a translucent white card in light mode (`rgba(255,255,255,0.70)` + hairline top rim + soft drop shadow) or dark frosted card in dark mode, keeping `400` weight text.
4. **Right-edge fade masks instead of `...` truncation**: Long tab titles, sidebar URLs, and hover-card titles smoothly dissolve via a linear alpha mask rather than hard ellipses, making narrow (`190–228 px`) sidebars feel calm and airy.
5. **Zero-chrome idle states, hover-revealed controls**: Top URL fields are transparent at rest; close (`×`) buttons, divider `Clear`/`Tidy` actions, and page action icons stay hidden until hovered, keeping resting chrome visually quiet.
6. **Zero-latency, zero-animation command bar (`⌘T` / `⌘L`) & instant tab switching**: Both browsers deliberately turn **off** open/close animations on the command bar and active tab highlight so navigation feels instantaneous, saving smooth easing/springs strictly for spatial motion (peek, folders, drag reorder, popovers).
7. **Unified split-view cards & paired sidebar row**: Split panes render as sibling `10 px` rounded cards separated by an `8–9 px` transparent trough showing the tinted window frame (with an invisible divider that reveals a tiny `3–4 px` centered pill on hover), mirrored as a split twin-capsule row in the sidebar.
8. **Integrated website-tinted page header**: When the address bar sits atop the page card, it lives *inside* the rounded card and inherits each page's theme color independently — even side-by-side in split view (`split.webp`: dark MDN left, light Wikipedia right).

### Where yab Differs from Ardia
- **Default layout philosophy (Arc vs Dia)**: yab defaults to an **Arc-style sidebar** (`228 px` wide, address plate inside the sidebar under nav buttons, Space name + `•••` below favourite tiles, footer with Downloads + Space icons + `+` button). Ardia defaults to a **Dia-inspired layout** (`190 px` narrow sidebar, Profile chip beside traffic lights, address bar integrated at the top of the page card, subtle `6 px` profile dots at the bottom with no footer `+` button).
- **Tactile paper grain & page-card hairline**: yab's signature backdrop has a much more visible paper grain (`0.07` opacity vs Ardia's subtle `0.006` dark / `0.05` light) and gives the page card a crisp `1 px` outer `ink 0.06` hairline + `0 1px 5px` drop shadow (Ardia's page card relies purely on contrast against the tinted frame, with no border or shadow).
- **Tight vs plush density & active tab glow**: Ardia uses a tighter vertical rhythm (`34 px` rows, `3 px` gap, `41 px` tiles, `6 px` gap, `13 px` text) with a wide soft ambient glow behind the active tab (`radius 12.5–15`) and a favicon-colored `3 px` ring on active favourite tiles. yab defaults to a roomier rhythm (`36 px` rows, `5 px` gap, `45 px` tiles, `8 px` gap, `14 px` text) with a tighter crisp card shadow (`0 1px 4px`) and uniform `SelectionPlate` across tabs and tiles.
- **Command Bar personality**: Ardia's command bar (`652 px`, `20 px` radius, `15 px` input) has a bottom action bar with a bold capsule `Go` / search-engine button (`#0F182C` / `#DCCBD8`) and tints the selected suggestion with the space's `powerUpColor`. yab's default command bar is a larger Raycast-like glass launcher (`750 × 475 px`, `26 px` radius, `20 px` input, neutral `ink 0.08` selection), with an optional `540 px` Arc-compact mode that fills the selected row solidly in the space color.
- **Menus, Downloads & Hover Cards**:
  - Ardia's desktop context menus highlight rows in macOS blue (`#0A63E0`), popovers animate in/out (`150/100 ms`), and Downloads uses a smooth beak-arrow `PopoverBubble` (`300 px`) with no progress indicator on its trigger button.
  - yab's `ActionMenu` has an inline search bar, highlights rows in neutral `primary 0.10`, opens/closes instantly (`0 ms`), its tab `GlanceCard` renders a `264 × 132 px` live page thumbnail, and its sidebar Downloads button sports a circular progress dial that pops a cardless floating `HoardStack` over dimmed tabs.
- **Motion character**: Ardia's spatial motion is brisk and damped (`100–200 ms` cubic/quad curves, very stiff `ω = 90` reorder spring, instant split view). yab's motion is slightly more theatrical and spring-choreographed (`220–300 ms` `cubic-bezier(0.2, 0.8, 0.2, 1)`, animated `300 ms` split reshapes, staggered folder row reveals, `340 ms` link-grow Peek with `12 px` background depth recession, and physical button press springs).