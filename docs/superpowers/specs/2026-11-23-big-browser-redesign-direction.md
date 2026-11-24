# Big Browser — redesign direction (look and motion)

> Status: **approved by the owner, 2026-11-23** ("vraiment comme le browser yab ou ardia… reprendre
> tout l'UI, pas exactement l'UX, repenser toutes les animations"; Ardia leads, yab fills gaps).
> Product truth: `PRODUCT.md`. Value-level reference with sources: `docs/design-references/
> ardia-yab-audit.md` (Ardia is GPL: take values and shapes, never copy its code).
> Impeccable mode: **Operate**. The world lends type, palette, density and one signature move;
> layout, navigation and controls stay ours (sidebar, space section, footer, address bar, dock).

## 1. Thesis

A calm, warm frame tinted by the space colour, holding one floating page card. Chrome recedes:
controls appear on hover, the active tab lifts as a soft white card, titles dissolve instead of
ellipsing. Motion is brisk and damped; keyboard surfaces are instant.

**Signature move:** the space colour is the window. Switching space recolours the whole frame
gradient (and its grain) in one 400 ms ease fade, while the page card stays still.

## 2. Frame and page

- Frame = vertical gradient from the space colour over a warm neutral (Ardia `windowTint`:
  light `top = mix(#FBFAF9, tint, 0.27)`, `bottom = mix(#FBFAF9, lighten(tint,+0.25), 0.27)`;
  dark `under ≈ #29292A`, `a = 0.18`; neutral spaces use `a = 0.09` light / `0.06` dark), plus grain
  (light 0.05, dark 0.006). Replaces the lilac flat frame.
- Page card: radius **10 px**, bezel **8 px** around it (top margin stays the window-controls strip),
  **no border, no shadow** (contrast with the frame only). Concentric radii everywhere inside a
  rounded parent: child = parent − inset.
- Address bar lives **inside the page card**, on the page's own colour (theme-color tint kept):
  height 38, transparent field at rest, `ink 0.05` fill on hover/edit, host bright + path faint,
  page-action icons hover-revealed; nav buttons 28 px, radius 6.

## 3. Sidebar (Ardia density)

- Default width **228**, inner inset **9 px**; rows **34 px**, radius **8**, gap **3**, text
  **13 px / 400**, favicon 16. Active row: `rgba(255,255,255,0.70)` card, hairline top rim
  `rgba(255,255,255,0.6)`, shadow `0 1px 3px rgb(0 0 0/0.08), 0 4px 12px rgb(0 0 0/0.05)`;
  dark: `rgba(255,255,255,0.10)`. Hover: `ink 0.05`. Never bold for active.
- Favourite tiles **41 px** tall, radius **10**, gap **6**, fill `ink 0.06`, active = card + a
  3 px ring in the favicon/space colour.
- Space header 30 px, name 13/600; separator = hairline `ink 0.10` with hover-revealed Clear.
  New Tab row like a tab row with a 16 px plus. Folders: same row metrics, children indent 14.
- Footer 36 px: downloads, space dots (6 px dots / emoji), + button — icon buttons 28, radius 7.
- Titles fade with a right mask (already ours). Close × hover-only.

## 4. Overlay surfaces

- Menus / popovers / cards: opaque fill (light `#FFFFFF`, dark `#2C2C2E`), radius **10**,
  border `0.5px ink 0.12` (light) / `rgba(255,255,255,0.10)` (dark), shadow
  `0 8px 24px rgb(0 0 0/0.14), 0 1px 3px rgb(0 0 0/0.10)`; padding 5; rows 28 px, radius 6,
  13 px text, 16 px icons, hover/selected `ink 0.08` (neutral, like yab — not macOS blue).
  Separators hairline with 5 px margin. Funnel connector kept (our signature), same fill.
- Tooltips: same card, radius 8, 12/13 px, appear after 500 ms, warm swap between rows.
- Command dock (⌘T) / finder (⌘K): Ardia command bar — width **652**, radius **20**, input
  **15 px**, rows 36 px radius 10, selected row tinted with the space colour at 12 %.
- Split: two 10 px cards with the 8 px frame trough between; divider invisible, a 3×28 px pill
  on hover. Each half is its own 10 px card separated by the full-height 8 px trough: the active
  half holds the address bar at its top and the unfocused half holds a quiet 38 px click-to-focus
  header (same height so both cards stay aligned and switching halves never reflows page height).

## 5. Motion (improve-ux-motion rules win over the references)

Tokens (replace ad-hoc ones):
- `--ease-out: cubic-bezier(0.2, 0.4, 0.1, 0.98)` (enters), `--ease-in-out: cubic-bezier(0.4,
  0.05, 0.2, 1)` (moves between states, exits), `--ease: ease` (fades, presses),
  `--ease-morph: cubic-bezier(0.35, 0.05, 0, 0.95)`.
- Frequent (menus, popovers, tooltips, context menus, folder toggle): enter = fade 150 ms +
  move 250 ms ease-out, scale from 0.97 at the trigger-facing origin; exit = fade 180 ms, no move.
  Warm state: moving between sibling menus/tooltips swaps content instantly.
- Constant (⌘T, ⌘K, ⌘L, tab switching, arrow keys): fade 100 ms only, no move.
- Occasional (settings view, confirm, downloads card): enter fade 400 ms / move by mass; exit
  fade 300 ms.
- Rows: tab open = enter 250 ms (height + fade 150); close = fade 180 ms then height collapse
  250 ms ease-in-out. Folder expand/collapse and space section = morph 400 ms `--ease-morph`.
- Drag: lifted row follows the pointer; others shift with a stiff spring feel (~150 ms
  ease-out); drop settles 250 ms.
- Press 75 ms ease (scale 0.97), release 350 ms. Hover in `@media (hover: hover)`.
- Space switch (signature): frame gradient crossfade 400 ms ease; sidebar content swaps fast
  (old out 150 ms, new in after 75 ms).
- Reduced motion: keep fades, drop moves (already zeroed via tokens; fades keep duration).

## 6. Type

System UI font (as today). Scale: 11 / 12 / 13 (body, rows) / 15 (dock input) / 20; weights 400 /
500 / 600. Tabular numerals in downloads and sizes.

## 7. What stays ours (UX)

Sidebar structure (tiles, space section, separator, today, footer), the address bar inside the
card, drawn menus in the overlay with the funnel, the top window-controls strip, split row, dock
sections. Only their look and motion change.
