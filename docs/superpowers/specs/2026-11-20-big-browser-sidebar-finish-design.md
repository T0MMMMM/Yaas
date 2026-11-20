# Big Browser — sidebar, menus and motion finish (step 1, plan 3b) — design

> Status: **approved by the owner, 2026-11-20** (builder check done; owner answered favourites per space and hidden window controls). When approved, it
> replaces HANDOFF's "next: plan 4" with plan 3b, then plan 4. Legend: **[owner]** = the owner asked for it
> (list of 2026-11-20, with yab screenshots); **[call]** = Claude's call, correct if wrong.
> Parent design: `2026-11-20-big-browser-design.md` (§5.1). Plans 1–3 are done; this plan comes **before
> plan 4** (window features).

## 1. Intent

Plans 1–3 built the features of the sidebar, but the owner tried them and found them short of the
yab/Arc level they want to leave Arc for: the menus look flat and native, things appear without
motion, the rows are cramped, pinned items do not belong to their space, folders cannot nest or
move. This plan is the finish pass that makes the sidebar, its menus and the ⌘T field feel like a
finished browser. Screenshots of yab are the reference for shape and colour (not for branding).

## 2. Goals, non-goals, anti-goals

Goals — the owner's list, grouped:

**A. Menus** [owner]
1. **Every menu is drawn by Big Browser, never native**: the tab, folder, space, + and site menus, and
   the **web page's right-click menu**. Opaque, **white / light grey** cards like yab's (no glass,
   no blur) [owner]; the dark scheme uses the matching dark grey [call].
2. A **connector** joins an icon button to the menu it opens (the card grows a small neck towards
   its button) [owner].
3. The page's right-click menu is complete, shaped like the owner's screenshot 1: Back, Forward,
   Reload; the extensions' items (`chrome.contextMenus`, e.g. 1Password, with their submenus and
   icons); Inspect Element; plus the contextual entries that exist today (link, image, selection,
   editing). Spelling suggestions on a misspelled word are redrawn by Big Browser [call, agreed]. macOS
   "Look Up" and "Services" are dropped [owner agreed]. Capture, Hide Element and Translate are
   **not** added: they are step 2 modules (parent design §5.1) [call].
4. The **space menu** (screenshot 6), opened by the "…" of the space header: a search field,
   Rename Space…, Change Space Icon…, Edit Look…, New Folder, Space Settings…, Delete Space…
   (⌘⌫ shown). "New Live Folder" is left out (live folders are a step 2 module) [call]; Space
   Settings… opens Settings (plan 5 fills it) [call]. **Edit Look…** opens the colour picker for
   the space's colour (the existing `color`), nothing more for now [call]. **Rename Space…** edits
   the name in place in the space header [call]. **Delete Space…** asks for confirmation ("its
   tabs, sign-ins, cookies and extensions will be deleted"), then removes the space and wipes its
   session (`persist:space-<id>`) and its history from disk; no ⌘Z undo; disabled for the last
   space [call]. ⌘⌫ is only shown as a label; no global accelerator (it would fire while typing)
   [call].

**B. ⌘T dock** (screenshot 2) [owner]
5. The command field becomes a dock: the field, then sections **Recent Tabs** (open tabs, most
   recently active first, with "In <folder>" on the right when filed), **Frequent** (most visited
   sites of this space, each with a "−" to forget it), **Quick Actions** (a fixed list:
   docs.new, meet.new, sheets.new, github.com/new [call]). A footer shows the Enter action
   ("Open in New Tab ↵", "Switch to Tab ↵") on the right [owner]. Recent Tabs lists the current
   space only; once the user types, open tabs and history of **all spaces** match, and switching to
   a tab of another space activates that space (as ⌘K does today) [call]. "Invite a Friend", "Set up" and
   the footer's left button are left out [call]. Typing filters every section and adds the search
   / go-to row first (today's behaviour).
6. This needs a **browsing history** (none exists): every top-level navigation of a tab is
   recorded per space — url, title, visit count, last visit — in SQLite, local only [call]. It
   feeds Frequent and the matching. Forgetting a row deletes it. Clearing history is plan 5.

**C. Sidebar structure** [owner]
7. **Space section** (screenshot 3): below the favourite tiles, a header row with the space's
   **icon (an emoji)** and name, and "…" on its right; on hover the icon turns into a small
   chevron that collapses / expands the section. **Pinned tabs and folders live inside it.**
   Today's tabs stay below the separator, outside the section.
8. A space gets an **icon** (emoji, chosen in Change Space Icon…; default: none → the space's
   colour dot) [owner + call]. The footer dots stay.
9. **Folders in folders**, and **folders can be moved** (drag, and "Move to Folder" in the folder
   menu). No depth limit in the model; indentation stops growing after 4 levels [call].
10. **Folder icons are customizable**: the YAAS folder glyph (`glyphs.tsx`) in a chosen hue
    (the 7 YAAS hues, default from the name as today), or an emoji instead [owner + call]. Opening
    a folder plays a **real opening animation** of the glyph (front flap swings open, paper rises)
    [owner].

**D. Sidebar look** [owner]
11. **Bigger tab rows** (`--row-h` 34 → 38, favicon 16 → 18) [owner; sizes are a call].
12. Long titles **fade to white on the right edge** (a mask, not an ellipsis); on hover the fade
    widens to make room for the close button, and **the × only appears on hover** (screenshot 4).
13. The **favourite tiles and the space-section rows** are a darker grey than today (screenshot 5),
    not a light tint; same for the sidebar's search field.
14. **Favourite tiles stay per space** [owner]: each space keeps its own tiles, as today (no
    model change). **Auto-layout**: they fill the sidebar width in a grid that adapts to the
    width and the count (as yab: 3 per row at default width, more when wider, wrap to new rows)
    [owner; rule is a call].
15. **New tab** sits **right under the separator**, at the top of today's tabs, not at the end.
16. **Clear** only shows while the pointer is over the separator.
17. **No search button at the top of the sidebar while the context bar shows the URL** (the
    default). It comes back when a site's bar no longer shows the URL (parent design §5.1) [owner].
    ⌘K keeps working.
18. **Font**: drop Satoshi; use the platform's UI font (`-apple-system` / Segoe UI Variable)
    [owner]. `setup:fonts` and its docs are removed [call]. The font setting stays in plan 5.
19. **Magnetic buttons**: a stronger effect (pull and scale) [owner], and an **"Magnetic buttons"
    on/off** setting in the current settings' Appearance [owner] (plan 5 will move it).

**E. Icon-only sidebar** [owner]
20. The normal sidebar can be made narrower before it snaps to icons (snap below 120 px instead of
    160) [owner; value is a call].
21. The icon-only width is adjustable a little: 48–72 px by dragging, default 56 [owner + call].
22. In icon-only mode, a thin **bar on the left** of tabs that are inside a folder shows they are
    filed (one bar per nesting level, in the folder's hue) [owner + call].
23. **Fix**: in icon-only mode the macOS traffic lights overflow onto the context bar [owner].
    Decided [owner]: **in icon-only mode the window controls are hidden and come back while the
    pointer is over the top-left corner** (macOS `setWindowButtonVisibility`); the context bar
    never moves. On Windows the `titleBarOverlay` controls sit top-right in every mode; the context
    bar keeps a right inset of their width so they never cover its icons [call].

**F. Motion** [owner]
24. **Every popover, menu and card animates in and out** (today they only animate in; closing is
    instant). Folders and the space section expand / collapse with a height animation; tabs
    animate in when opened and out when closed.
25. **Tooltips** on tabs, pinned tabs and favourite tiles after a short hover (~500 ms [call]):
    title and host. Moving to another row **slides the same tooltip** to the new row (it does not
    disappear and re-appear); it fades out shortly after the pointer leaves the sidebar.
26. **Real drag**: the dragged row (tab, folder or tile) **lifts** (scale, shadow) and follows the
    pointer; the other rows **move aside with animation** to show where it will land, instead of
    a drop line [owner]. Applies to tabs, folders and favourite tiles. Escape cancels and the row
    flies back.
27. All motion respects `prefers-reduced-motion` [call].

**G. Downloads** [owner]
28. A **downloads button at the bottom left** of the sidebar footer (the slot plan 1 left empty).
    It opens a downloads menu (the same card style): current downloads with progress, finished
    ones with "Show in Finder / Explorer", and "Clear". Files go straight to the system Downloads
    folder, no dialog (Arc-style); one list for all spaces (each space's session gets the hook);
    the list is kept in SQLite across restarts; Clear empties the list, never the files [call]. This pulls the downloads part of plan 4
    into this plan [call]; plan 4 keeps split view, windows and default browser.

Non-goals: glass / blur on menus [owner]; Capture, Hide Element, Translate, live folders (step 2
modules); the full Settings window (plan 5); sync.

Anti-goals: a menu that looks native on one platform and custom on the other; motion that delays
a click (an action never waits for an animation to finish); any code path that spends tokens.

## 3. Constraints

- `CLAUDE.md` rules: IPC through the contract, layering, `useWorkspace()` as the only data source
  for components, design tokens only (new tokens go in `tokens.css` + `DESIGN.md`), tests next to
  code, e2e for UI flows.
- Menus that float over the page must be drawn in the **overlay view** (plan 2), since the page is
  its own `WebContentsView`. Today's native `Menu.popup` calls (`sidebarMenus.ts`, the page menu in
  `tabViews.ts`) are replaced by overlay requests. Main keeps the actions; the overlay only shows
  items and reports which one was chosen (by id), so extension items' `click` still runs in main.
- A tooltip next to the sidebar may cover the page, so it is also drawn in the overlay — without
  stealing focus or clicks from the sidebar [call: the overlay view is sized to the tooltip's
  column while a tooltip shows, and never focused].
- History is personal data: stored only on disk, never sent anywhere.

## 4. Approaches considered

For the menus' look the owner decided **opaque white / grey menus** after three options were
weighed (blur of a page capture; native vibrancy windows; translucent as today). Glass is dropped.

For drawing the menus:
- **A. All menus in the overlay view, one shared menu component** (chosen [call]): a single
  `Menu` / card with connector and in/out animation; native menus are replaced by overlay requests
  carrying their items from main. One look on both platforms, testable with Playwright.
- B. Keep native menus for right-clicks and custom ones for buttons — rejected: the owner wants
  every menu in the same style.
- C. A separate small window per menu — rejected: heavier, animations and connectors are harder,
  no gain now that there is no blur.

For the drag: a pointer-driven drag with FLIP animations of the other rows (extend
`useTabDrag`) [call]; the HTML5 drag-and-drop API cannot animate the other rows.

## 5. Parts the owner decided, as decided

Menus opaque white / grey, everywhere including the page right-click; extension items kept; Look
Up / Services lost. Pinned items inside a collapsible space section with an emoji that becomes a
chevron on hover. Folder icons from YAAS with an opening animation. Everything listed in §2 marked
[owner].

## 6. Left to the builder

Exact sizes, durations and easings (as tokens); the FLIP implementation; how the overlay is sized
for tooltips; the history schema; the split into tasks. The plan may be split in two (look &
motion first, structure & menus second) if it grows past ~8 tasks.
