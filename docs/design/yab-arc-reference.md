# yab / Arc UI reference — colours, shapes and popover anchoring

> Source: screenshots of yab and Arc the owner shared (2026-11-20 and 2026-11-23). The values were
> **read off the screenshots**, not taken from yab's code, so treat them as ± 1–2 px and ± a few
> points of lightness. They are the reference for Big Browser's menus, popovers, the command field and
> the sidebar. Big Browser keeps its own fonts, grain and glass (`style/visual-pass`); this page decides
> **colours, sizes, radii, spacing and how a popover attaches to what opened it**. When a value
> becomes code it goes into `src/renderer/src/theme/tokens.css` and `docs/DESIGN.md` §3 first.

Owner decisions: menus and popovers take yab/Arc's colours and styles, with the values below
(2026-11-23). Menus are **opaque white / light grey, no glass**, and an icon button is joined to
its menu by a **connector** (plan 3b spec,
[`2026-11-20-acab-sidebar-finish-design.md`](../superpowers/specs/2026-11-20-acab-sidebar-finish-design.md)
§A). Where the screenshots show yab's frosted menus, use the opaque surface instead.

## 1. Palette (light)

| Role | Value | Seen in |
|---|---|---|
| Popover / card surface | `#FFFFFF` (solid) | site menu, colour picker, command field |
| Menu surface (yab shows it frosted; Big Browser uses it opaque — owner decision) | `#FFFFFF`, or `#F7F7F8` for the light-grey variant | + menu, space menu, folder hover list |
| Page behind the window (sidebar tint) | `#A9D9DE` (yab teal, user-picked) | sidebar background |
| Hairline border of a card | `rgb(0 0 0 / 0.08)` 1 px | every popover |
| Section divider inside a menu | `rgb(0 0 0 / 0.08)` 1 px, inset 12 px each side | + menu, space menu, site menu |
| Neutral fill (buttons, pills, selected row) | `#F2F2F4` | icon-button row, "Secure" pill, "Try" pill, selected row |
| Neutral fill, hover | `#E9E9EC` | hovered icon button / row |
| Toolbar icon button, active (its popover is open) | `#E6E6E9` rounded square behind the glyph | site-menu button in the address bar |
| Primary text | `#1C1C1E` | titles, item labels |
| Secondary text | `#8A8A8E` | status lines ("On", "Off", "5 d"), section headers in the command field, URLs |
| Placeholder text | `#B0B0B5` | "Search…", "Enter a web address", "Search Inspo" |
| Status icon, on | `#1C1C1E` filled circle, white glyph | "Block ads and trackers — On" |
| Status icon, off | `#ECECEF` filled circle, `#1C1C1E` glyph | "Developer Mode — Off" |
| Destructive item | primary text, shortcut `⌘⌫` in secondary | "Delete Space…" |
| Toggle off track | `#E5E5EA`; on track = accent | "Take the site's color" |
| Selection / focus caret | system accent blue `#0A84FF` | search fields |

Dark mode was not in the screenshots; derive it from DESIGN.md's dark tokens, keeping the same
roles.

## 2. Type scale (yab shown in SF Pro; Big Browser keeps Satoshi at the same sizes)

| Use | Size / weight |
|---|---|
| Menu item, row title | 13 px / 500 |
| Section title in a popover ("Boosts", "Extensions", "This site") | 13 px / 700 |
| Status line under a row | 11.5 px / 400, secondary |
| Command field input | 20 px / 400, placeholder colour |
| Command field section header ("Recent Tabs", "Frequent") | 12 px / 600, secondary |
| Shortcut hints (`⌘T`, `^⌘\`) | 12 px / 400, secondary, right-aligned |
| Pill button ("Try", "Secure", "Open in New Tab ↩") | 12–13 px / 500 |

## 3. Shapes and spacing

| Element | Value |
|---|---|
| Popover radius (site menu, colour picker) | 16 px |
| Frosted menu radius (+ menu, space menu, folder list) | 12 px |
| Command field card | ~760 px wide, radius 18 px, ~20 % from the top of the page |
| Inner padding of a popover | 10–12 px |
| Menu item height | 28 px (frosted menus), 40–44 px (site-menu rows with a status line) |
| Menu item horizontal padding | 10 px; icon 16 px; icon → label gap 8 px |
| Selected / hovered row | full-width neutral fill, radius 8 px, inset 6 px from the card edge |
| Icon-button row (top of the site menu) | 4 equal buttons, height 32 px, radius 10 px, gap 6 px, neutral fill |
| Row status icon | 28 px circle |
| Extension tiles | 52 × 32 px, radius 10 px, neutral fill; a pin badge top-right of a pinned one |
| Pills | height 28 px, radius 10 px (not fully round) |
| Toolbar icon button | 28 × 28 px hit area, glyph 16 px, active background radius 7 px |
| Shadow of a popover | `0 10px 30px rgb(0 0 0 / 0.12), 0 1px 3px rgb(0 0 0 / 0.08)` |
| Shadow of the command field | `0 24px 60px rgb(0 0 0 / 0.18), 0 2px 6px rgb(0 0 0 / 0.08)` |

## 4. How a popover connects to the thing that opened it

yab and Arc use **no arrow or tail**: the link is made by position, alignment and the opener's
active state. Big Browser keeps all of that **and adds the connector** decided in plan 3b (the card
grows a small neck towards the button).

1. **The opener stays visibly "pressed" while its popover is open.**
   - Toolbar icon (site menu): a rounded-square neutral background (`#E6E6E9`, radius 7 px) stays
     behind the glyph until the popover closes.
   - + button at the bottom of the sidebar: it turns into a white round **×** button; clicking it
     again closes the menu.
   - Row "…" button (space menu): the row keeps its hover fill while the menu is open.
2. **Gap:** the popover sits **6 px** from its opener (toolbar → below; sidebar footer → above;
   row "…" → to the right).
3. **Alignment:**
   - Toolbar popover: its **right edge aligns with the opener's right edge** (it grows leftwards,
     staying inside the window).
   - Sidebar + menu: its **left edge aligns with the sidebar's inner padding**, its bottom edge
     6 px above the + button.
   - Row "…" menu: its **top edge aligns with the row's top edge**, opening to the right of the
     row, and it may overlap the page.
   - Folder hover list: **opens to the right of the folder row**, top edge aligned with the row,
     6 px gap (see §6).
4. **Transform origin = the opener** (ux-motion principle 11): toolbar popovers grow from their
   top-right corner, the + menu from its bottom-left, side menus from their top-left.
5. **Motion:** open 160–200 ms ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`) from scale 0.96 and
   opacity 0; close in ~100 ms ease-in, opacity only (ux-motion principles 5, 8, 18). The command
   field and ⌘K are opened many times a day: near-instant (≤ 120 ms), no scale (principle 20).
   `prefers-reduced-motion`: opacity only.
6. **Search field placement:** a menu opened from below (the + menu) has its search field at the
   **bottom**, next to the pointer; a menu opened from above or the side (space menu, folder list)
   has it at the **top**. Typing filters the items in place.

## 5. The screens, one by one

- **Site menu** (button in the address bar): icon-button row (share, capture, hide element,
  reading view) → "Boosts" with "Add ⌄" (rows with a palette icon, title, status line, "Try" pill)
  → "Extensions" with "Manage" (tiles + a "+" tile) → "This site" rows with status circles → footer:
  "Secure" pill with a lock on the left, "…" on the right.
- **+ menu** (sidebar footer): New Space… / New Folder / divider / New Boost… / divider / Split
  View `^⌘\` / New Tab `⌘T` / divider / search field at the bottom.
- **Space menu** (row "…"): search at the top / Rename Space… / Change Space Icon… / Hide Space
  Name / Edit Look… / divider / New Folder / New Live Folder › / divider / Space Settings… /
  divider / Delete Space… `⌘⌫`.
- **Colour picker** ("Edit Look…"): header icons (sparkle = auto, sun, moon, …, ×) → dot-field
  colour grid with a large selected dot and − / + for density → a row of 9 swatches with ‹ › →
  a hue/lightness slider drawn as a wave line with a round thumb → a grain slider drawn as dots of
  growing density → "Take the site's color" toggle with a status line → "Drawings" tiles (None,
  Browser, Life, Halloween…), the selected one with a 2 px dark outline.
- **Command field (⌘T)**: search icon + "Enter a web address" → sections "Recent Tabs" (bullet,
  title, URL in secondary, "In <folder>" right-aligned), "Frequent" (favicon, title, "Usually now"),
  "Quick Actions" (coloured icon, label, `docs.new`), "Set up Yab" → footer bar: a round menu
  button, an "Invite a Friend" pill on the left, "Open in New Tab ↩" and "Actions ⌘K" on the right.
- **Folder hover list**: see §6.

## 6. Folder hover list (owner request, 2026-11-23)

Hovering a folder in the sidebar opens a frosted list next to it:

- header: a search field "Search <folder name>" (placeholder colour, no icon);
- one row per tab of the folder: favicon 16 px, title (truncated with an ellipsis), the age of the
  tab right-aligned in secondary ("5 d" = last opened 5 days ago);
- the first row is selected (neutral fill); ↑/↓ move, Enter opens, typing filters;
- opaque surface, radius 12 px, ~390 px wide, opens to the right of the folder row (top aligned, 6 px gap), so it
  floats over the page (Big Browser: in the overlay view).
