# ACAB — design (draft)

- **Date:** 2026-11-20
- **Status:** **Approved by the owner (2026-11-20) for step 1.** Questions in §7 that are not
  struck out concern steps 2–4 and do not block step 1.
- **Decision record:** [ADR-0006](../../adr/0006-pivot-to-acab-browser.md)
- **Evidence:** [Chrome extensions spike](../../spikes/2026-11-20-chrome-extensions-electron.md)

Legend: **[owner]** = said or chosen by the owner · **[proposed]** = Claude's proposal, not
objected to but not explicitly validated · **[open]** = still to decide.

## 1. Intent

ACAB — **AI Custom Another Browser** [owner] — is a web browser that:

- replaces the owner's daily browser (Arc, and yab) on **macOS and Windows**, with **sync** between
  the two later on [owner];
- is **fully customizable by an AI** connected to the user's own account (e.g. Claude). The AI adds
  or removes features **locally**, both on **websites** and on the **browser UI itself** [owner];
- makes every feature **easy to add or remove later**, so this stays simple for the AI [owner];
- has a **workshop** where people publish features/updates they made locally and others install
  them in one click [owner];
- has **AI tabs**, fully customizable, that do what YAAS was meant to do (several Claude accounts,
  session admin, handoff, crew) [owner];
- keeps the **visual design of the `style/visual-pass` branch** as is: Satoshi, liquid glass,
  grain, drawn controls, Arc-style sidebar, cards and tokens — see `docs/DESIGN.md` [owner,
  2026-11-20];
- is **open source**, for anyone to use [owner].

Why: the owner wants their own browser, shaped exactly to them, and to share it. yab is the main
inspiration; many yab features should come over [owner].

## 2. Goals, non-goals, anti-goals

**Goals**
- Good enough to be the owner's only browser: Chrome extensions (1Password + ad blocker are
  must-haves, others must work too) [owner].
- Every feature is a removable module; the AI works on modules, not on the core [proposed].
- Mac + Windows from day one [owner]. Sync between them comes later — not a priority
  [owner, 2026-11-20].

**Non-goals (for now)**
- Forking Chromium, or CEF like yab (ADR-0006).
- Mobile app.
- Workshop moderation or sandboxing beyond a permission summary: workshop installs are **at the
  user's own risk** [owner].

**Anti-goals** (would make it a failure even if it works)
- The AI breaking the browser: a bad module must never stop ACAB from starting [proposed — this is
  why modules stay out of the core and can be disabled at startup].
- Hidden token spending: the near-zero overhead rule of `CLAUDE.md` still applies — no model call
  without an explicit user action.

## 3. Constraints

- Electron (ADR-0001, ADR-0006), TypeScript strict, existing layering rules (`CLAUDE.md`).
- Extension support through `electron-chrome-extensions` + the two fixes from the spike.
- 1Password cannot pair with its desktop app (no native messaging in Electron).
- yab is Apache-2.0: behaviour/docs reusable, sync server reusable with attribution; its code is
  Swift, so nothing is ported as is.

## 4. Approaches considered

| Approach | Trade-off | Outcome |
|---|---|---|
| **A. Electron, in this repo** | Fast iteration in TS/React, AI can edit the UI; some extension gaps, no 1Password desktop pairing, DRM needs a special Electron build | **Chosen** [owner], after the spike |
| B. Fork Chromium | All extensions work; C++, huge builds, rebase every 4 weeks | Rejected |
| C. Start from Flow Browser | Extension support done; lose YAAS base, GPL-3.0 | Fallback if A had failed |

How pages are shown inside the UI (step 1):

| Approach | Trade-off | Outcome |
|---|---|---|
| **A. One `WebContentsView` per tab**, placed by main over the page card | Electron's recommended path; extensions attach as in the spike; isolated, fast. Pages sit above the HTML: rounded corners via `setBorderRadius`, and floating UI over the page (⌘T, ⌘K) needs a transparent overlay view on top | **Chosen** [owner, 2026-11-20] |
| B. `<webview>` tag in React | Layout is plain CSS; but officially discouraged, known bugs, `electron-chrome-extensions` targets A, untested with the spike | Rejected |
| C. Restart from the spike code | Throwaway JS, no React base, no design | Rejected |

## 5. Shape of the product

Build order [proposed, not objected to]:

1. **Daily-driver browser** — replaces Arc.
2. **Module system + the AI that writes modules.**
3. **AI tabs** (the YAAS scope: `docs/FEATURES.md`, ADR-0002/3/4).
4. **Workshop.**

The repo is renamed to ACAB in step 1; the YAAS docs stay as the reference for step 3 [proposed].

### 5.1 Step 1 — daily-driver browser

Goal: the owner can leave Arc the next day without missing anything. Day-one list [Claude's
proposal, accepted by the owner 2026-11-20]:
- vertical tabs in the sidebar, in the repo's visual style, with nested tabs under a parent and
  favourites as large tiles at the top (as in the owner's yab screenshot);
- **spaces**, each with its own Electron session (`persist:space-<id>`): own cookies, sign-ins and
  extensions — matches Arc/yab "extensions follow sign-ins";
- pinned tabs and folders; command bar (Ctrl/⌘+T over the page, Ctrl/⌘+K to find a tab);
  ⌘Z to undo window actions (e.g. a closed tab); split view; downloads;
- Chrome Web Store + extensions (spike fixes included), built-in ad blocker (Ghostery engine);
- the UI is already split into **slots** (sidebar, toolbar, panels, menus, shortcuts, theme) that
  modules will plug into in step 2;
- **not in step 1: sync** [owner, 2026-11-20 — "can really wait"]. When it comes: sync of spaces,
  tabs, folders, bookmarks and settings between Mac and Windows [design proposed]: port yab's
  design (`docs/sync.md` in yab: hybrid logical clocks, per-field
  merge, end-to-end encryption) to TypeScript and reuse its Cloudflare Worker sync server.

- **import from any installed browser at first launch, inside the onboarding** [owner,
  2026-11-20]. Agreed scope [owner approved Claude's proposal, 2026-11-20]:
  - **imported**: bookmarks, history, open tabs; from Arc also its spaces, pins and folders;
  - **extensions**: list the source browser's extensions and offer to reinstall them from the
    Chrome Web Store in one click (their data cannot be copied);
  - **not imported**: passwords and cookies (OS-encrypted; 1Password covers passwords, the user
    signs in again once);
  - **order**: Chromium browsers first (Chrome, Arc, Edge, Brave share one format, so one
    importer), then Safari (needs Full Disk Access on macOS) and Firefox.

#### Browser chrome [owner, 2026-11-20, from a yab screenshot]

```
┌──────────────┬────────────────────────────────────────────────────────┐
│ ● ● ●   ▣    │ ←  →  ⟳     host.com/path/dimmed        📷 🔑 ⓘ ◫   │ ← address bar,
│ [fav][fav]   │                                                        │   tinted to the site
│ Personal     │                    page (card)                         │
│ Inspo        │                                                        │
│ + New tab    │                                                        │
│ tab          │                                                        │
│   └ subtab   │                                                        │
│              │                                                        │
│ ⬇    • • •  +│                                                        │
└──────────────┴────────────────────────────────────────────────────────┘
```

- **Address bar on top**, exactly like yab by default: back / forward / reload, the URL centred
  (host bright, path dimmed), action icons on the right (capture, extensions, site info, split
  view). Its **background takes the site's colour**.
- **It is not hideable by default** (the AI could make it so for a user who asks). When a site's
  bar is customized and no longer shows the URL, **the URL moves into the sidebar**.
- **On AI pages** the bar shows the session instead of a URL (account, session, etc.).
- **The AI can put custom content in this bar for given sites** — so the bar is a module slot
  (step 2).
- **Sidebar footer**: a downloads button on the left, the **spaces as dots in the middle** with
  the repo's magnetic motion (`useMagnetic`), a **+** button on the right.
- **Later, not step 1**: the element inspector (DevTools) in its own card, restyled to match ACAB.

#### Menus and settings [owner, 2026-11-20, from yab screenshots]

The **shape** of yab's menus and settings is the model for all of ACAB's menus: popovers made of
grouped cards, icon-button rows, section titles with a right-hand action, rows with an icon, a
title and a status line, segmented controls, dropdowns and toggles. They are drawn **in the
`style/visual-pass` look** (Satoshi, glass, grain, drawn controls) [Claude's reading — the owner
asked to keep that visual design].

- **Site menu** (button in the address bar):
  - a row of quick actions — share, capture, hide an element, translate;
  - **Boosts** with "Add" — in ACAB these are site modules (step 2);
  - **Extensions** with "Manage": pinned extension icons and a **+**;
  - **This site**: block ads and trackers, automatic picture-in-picture, developer mode, each
    with its state for the current site;
  - a footer with the connection status ("Secure") and a **…** menu.
- **+ menu** (sidebar footer): New Space, New Folder, New Boost, Split View (⌃⌘\), New Tab (⌘T),
  and a search field.
- **Settings**: a window with a searchable category list on the left (coloured icons, in groups)
  and grouped cards on the right. Appearance in yab offers: theme (system / light / dark), window
  colour, ⌘T field style, look per space, app icon; sidebar position (left / right / off), sidebar
  button, tab icons, spaces shown as dots, density; address bar (full URL), address bar in Peek,
  bookmarks bar.

Day-one share of these [Claude's proposal]: the menus are built in step 1 as **slots**. Items
whose feature is in step 1 work from day one: share, extensions, block ads, developer mode
(opens DevTools), connection status, New Space / Folder / Tab, Split View, and the settings
categories General, ⌘T field, Appearance, Websites, Tabs, Spaces, Shortcuts, Privacy,
Extensions, Developers, About. The other items (capture, hide an element, translate, picture-in-
picture, Boosts, and the Sync, AI, Snippets, Live Folders… categories) appear when their module or
step lands. **Translate** joins the list of later modules.

#### Added by the owner on 2026-11-20 (during plan 1)

- **Unloaded tabs are shown at low opacity** in the sidebar (a restored tab whose page has not
  been loaded yet) [owner]. → plan 1 (Task 7b).
- **Tabs of the same site are grouped into a folder automatically** [owner]. When a group forms
  (how many tabs, whether the user can turn it off or undo it) is [open] for plan 3. → plan 3.
- **Icon-only sidebar**: when the sidebar is dragged narrower than a threshold it switches to a
  single column showing only the sites' icons [owner]. → plan 3.
- **The logo is customizable text of at most 2 characters, `:]` by default** [owner]. The
  opening animation only swaps the logo's characters and its font, animated [owner]. → plan 6
  (onboarding).
- **The user can change the UI font in settings, and choosing it is an onboarding step**
  [owner]. → plan 5 (settings) and plan 6 (onboarding).

**What happens to the YAAS UI in step 1** [owner, 2026-11-20]: the YAAS session features (session
view, Claude account import in the onboarding, usage meters) are **hidden until step 3**; their
code stays. The sidebar, the onboarding and the settings become the browser's own, reusing their
current design.

**Spaces are not Claude accounts** [owner, 2026-11-20]: a space is a browser space (own cookies,
sign-ins, extensions), and the user can have **as many as they want**, shown as dots at the bottom
of the sidebar. Claude accounts are managed separately, **in the AI page**, which gets a quick
account switcher (step 3). The step 1 data model must not tie a space to a Claude account.

**Later, as modules (they prove the module API in step 2)** [accepted]: hide an element for good,
dark pages, reading mode, floating video, translate, Peek, capture part of a page, snippets, PDF editor, tab
hover cards, live folders, auto folders, mail, subscriptions. Agents, routines and approvals go
to AI tabs (step 3).

### 5.2 Modules [proposed]

A module is a folder with a manifest and code. It can do two things [owner: both]:
- **change websites**: CSS/JS injected into pages matching URL patterns (like a content script or
  an Arc Boost);
- **change the browser UI**: register into named **slots** (sidebar section, toolbar button,
  panel, menu item, shortcut, theme tokens, new-tab rows…) through a small, stable module API.

Rules:
- Removing a module = deleting its folder; nothing else breaks.
- The manifest declares what the module touches (sites, slots, permissions); this summary is shown
  before installing a workshop module.
- The AI (step 2) runs on the user's own account (Claude Code, as YAAS planned) and only writes
  inside the modules folder.
- Most yab-inspired features are built as modules, which proves the module API.

### 5.3 AI tabs [owner, details in existing docs]

Everything in `docs/FEATURES.md` pillars 1–4, ADR-0002/0003/0004, shown as tabs of the browser.

### 5.4 Workshop [owner, details open]

Publish a module or an update; install in one click; at the user's own risk; permission summary
before install [proposed]. Hosting, accounts and updates are [open].

## 6. Reference: yab features worth considering

From yab's docs (`docs/index.md` in the yab repo):

| Group | Features |
|---|---|
| Basics | pins, folders, spaces, ⌘K tab finder, ⌘T field over the page, ⌘Z for window actions |
| Pages | ad blocker, hide an element for good (⇧⌘H), dark pages (Dark Reader engine), reading mode, floating video, split view, Peek |
| Tools | capture part of a page, downloads, snippets (`;name`), PDF editor |
| Smart | tab hover cards, live folders (e.g. your PRs), auto folders from opened links |
| AI | agents in tabs, routines, approvals before pay/send/delete |
| Other | sync, mail, subscriptions read from mail |

## 7. Open questions (in priority order)

1. ~~Day-one features~~ — decided, see §5.1.
2. Sync (later, not step 1): reuse yab's server on the owner's own Cloudflare account, or something else? Which data
   syncs (modules too?).
3. Workshop: hosting, publishing identity, update model.
4. How the AI is connected for module editing: Claude Code CLI per account (as YAAS planned) vs
   another provider — and how the user reviews what the AI changed.
5. ~~Import~~ — decided, see §5.1.

## 8. Left to the builder

Process layout for tabs (`WebContentsView` per tab, chosen in §4), module loader internals,
storage format (SQLite through `node:sqlite`, ADR-0005), test strategy — within `CLAUDE.md` and
the ADRs.

Calls Claude made while checking this document as a builder [Claude's call — correct if wrong]:
- **Default browser**: step 1 lets ACAB register as the system's default browser, so links from
  other apps open in it — needed to be a daily driver.
- **Several windows**: ⌘N opens another window, like Arc; tabs belong to a space, not a window.
- **⌘T search**: Google by default, changeable in settings.
- **Site colour for the address bar**: the page's `theme-color` first, else sampled from the top
  of the page; text colour picked for contrast.
- **Ad blocker**: on by default with the Ghostery engine's standard lists, with a per-site toggle.
- **No migration** of YAAS settings at the rename: the app is pre-alpha with no users.
- **Packaging**: unsigned dev builds are enough for step 1; signing, notarization and
  auto-update come before the first public release.
