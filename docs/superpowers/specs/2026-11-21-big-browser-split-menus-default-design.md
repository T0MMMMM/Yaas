# Big Browser — split screen, richer menus, default browser (step 1, plan 4) — design

> Status: **approved by the owner, 2026-11-21** ("continue sans interruption" after the playback of
> each part). Legend: **[owner]** = the owner asked for it; **[call]** = Claude's call, correct if
> wrong. Parent design: `2026-11-20-big-browser-design.md` (plan list: plan 4 = window features).

## 1. Intent

The owner compares pages side by side every day and wants it in the browser, kept like a tab; the
right-click menus drawn in plan 3b-B are "too bare — no icons, a few options"; and Big Browser must
open the links other apps send so it can be the daily browser. Several windows are dropped [owner].

## 2. Goals, non-goals, anti-goals

**A. Split screen** [owner]
1. Two pages side by side, **two at most** [owner]. It is how the owner compares [owner].
2. **Persistent** [owner]: the two tabs **combine** into one sidebar row (both favicons and titles)
   [owner], kept across restarts, moved as one row (pinned, folders, today, drag).
3. Clicking the row shows both pages; the **active half** is the last one clicked (it drives the
   address bar) [call]. A **divider** between the pages is dragged to resize (50/50 at first, kept)
   [call].
4. Created by ⌃⌘\ (the active tab and the next tab of the list), "Split View" in the + menu, "Open in
   Split View" on a tab's menu and on a link's right-click, or by dropping a tab on the shown tab
   [call]. "Separate" turns it back into two tabs; closing one half leaves the other as a plain
   tab [call].

**B. Richer right-click menus** [owner: "trop nul sans icons rien avec juste quelques options"]
5. Every row has an icon. The page menu adapts to what was clicked, like yab's (reference only, not
   copied) [call]:
   - link: Open Link in New Tab, **Open Link in Split View**, Open Link Here, Download Linked File,
     Copy Link, Share…, Copy Email Address (mailto);
   - image: Open Image in New Tab, Download Image, Copy Image, Copy Image Address;
   - video/audio: Open in New Tab, Download, Copy Address, Loop, Show/Hide Controls, Picture in
     Picture (video);
   - selection: Go to "<url>" (when the text is an address), Search Google for "…", Copy;
   - editable: spelling suggestions + Add to Dictionary, Cut, Copy, Paste, Paste and Match Style,
     Select All;
   - page: Back, Forward, Reload, Copy Page URL, Save Page As…, Print…, View Page Source;
   - extensions' items, then Inspect Element (always last).
6. The sidebar menus get icons and more options: tab — Reload, Duplicate, Mute/Unmute, Open in
   Split View / Separate, Copy Link, Pin/Unpin, Add to/Remove from Favourites, Move to Folder, Close
   Tabs Below, Close; folder — Rename, Change Icon…, Move to Folder, Open All, Delete Folder [call].
   Capture, Hide Element, Ask AI stay step 2 modules (parent design) [call].

**C. Default browser** [parent design]
7. Big Browser can be the system's default browser; links from other apps open as a new today tab
   of the active space, on launch and while running [call]. Settings → General shows whether it is
   the default and a "Make default" button (macOS: the system prompt; Windows: opens the system's
   Default apps page, as Windows forbids setting it silently) [call].

Non-goals: several windows [owner]; more than two panes; step 2 modules. Anti-goals: a split that
forgets itself after a restart; a menu row without an icon; any code path that calls a model.

## 3. Constraints

`CLAUDE.md` (IPC via the contract, layering, `useWorkspace()`, tokens only, tests next to code); menus
stay owned by main (`MenuRegistry`), drawn in the overlay; opaque cards, no blur.

## 4. Approaches

- **Split model.** A: a `splits` table pairing two tab ids. B: the second tab points at the first
  (`tabs.split_of`), carries no position of its own and is hidden from the lists, the first holds
  the row's place; the store moves and closes them together. C: a new "split" node kind owning two
  child tabs. **B chosen [call]**: no new ordering rules, every list/drag/presence path keeps
  counting one row, and a broken pair degrades to two normal tabs.
- **Split display.** Two `WebContentsView`s side by side in the page bounds, the gap between them
  showing the UI's divider (the UI sends the ratio) — chosen; one view with an iframe compositor is
  impossible for real tabs.
- **Menus.** Extend the existing `pageMenu()` / `sidebarMenus` builders with icons (Phosphor names,
  already supported by `MenuSpec`) and the new entries — chosen; no new wire format.
- **Default browser.** Electron `app.setAsDefaultProtocolClient('http'|'https')` + packaging
  protocol declarations, `open-url` (macOS) and `second-instance` argv (Windows) — chosen.

## 5. Left to the builder

Exact icons per row, the divider's size and look (tokens), the migration number and column names,
how "Close Tabs Below" counts in today's tree, task split.
