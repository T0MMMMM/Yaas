# ACAB — design (draft)

- **Date:** 2026-11-20
- **Status:** **Draft — not yet approved by the owner.** Brainstorming was paused before the step 1
  scope was settled (see "Open questions"). Do not write a plan from this until it is approved.
- **Decision record:** [ADR-0005](../../adr/0005-pivot-to-acab-browser.md)
- **Evidence:** [Chrome extensions spike](../../spikes/2026-11-20-chrome-extensions-electron.md)

Legend: **[owner]** = said or chosen by the owner · **[proposed]** = Claude's proposal, not
objected to but not explicitly validated · **[open]** = still to decide.

## 1. Intent

ACAB — **AI Custom Another Browser** [owner] — is a web browser that:

- replaces the owner's daily browser (Arc, and yab) on **macOS and Windows**, with **sync** between
  the two [owner];
- is **fully customizable by an AI** connected to the user's own account (e.g. Claude). The AI adds
  or removes features **locally**, both on **websites** and on the **browser UI itself** [owner];
- makes every feature **easy to add or remove later**, so this stays simple for the AI [owner];
- has a **workshop** where people publish features/updates they made locally and others install
  them in one click [owner];
- has **AI tabs**, fully customizable, that do what YAAS was meant to do (several Claude accounts,
  session admin, handoff, crew) [owner];
- keeps the **visual base of this repo** (Arc-style sidebar, cards, tokens — see `docs/DESIGN.md`)
  [owner];
- is **open source**, for anyone to use [owner].

Why: the owner wants their own browser, shaped exactly to them, and to share it. yab is the main
inspiration; many yab features should come over [owner].

## 2. Goals, non-goals, anti-goals

**Goals**
- Good enough to be the owner's only browser: Chrome extensions (1Password + ad blocker are
  must-haves, others must work too) [owner].
- Every feature is a removable module; the AI works on modules, not on the core [proposed].
- Mac + Windows from day one, with sync [owner].

**Non-goals (for now)**
- Forking Chromium, or CEF like yab (ADR-0005).
- Mobile app.
- Workshop moderation or sandboxing beyond a permission summary: workshop installs are **at the
  user's own risk** [owner].

**Anti-goals** (would make it a failure even if it works)
- The AI breaking the browser: a bad module must never stop ACAB from starting [proposed — this is
  why modules stay out of the core and can be disabled at startup].
- Hidden token spending: the near-zero overhead rule of `CLAUDE.md` still applies — no model call
  without an explicit user action.

## 3. Constraints

- Electron (ADR-0001, ADR-0005), TypeScript strict, existing layering rules (`CLAUDE.md`).
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

## 5. Shape of the product

Build order [proposed, not objected to]:

1. **Daily-driver browser** — replaces Arc.
2. **Module system + the AI that writes modules.**
3. **AI tabs** (the YAAS scope: `docs/FEATURES.md`, ADR-0002/3/4).
4. **Workshop.**

The repo is renamed to ACAB in step 1; the YAAS docs stay as the reference for step 3 [proposed].

### 5.1 Step 1 — daily-driver browser [proposed; scope still open]

Baseline taken from Arc and yab:
- vertical tabs in the sidebar, in the repo's visual style;
- **spaces**, each with its own Electron session (`persist:space-<id>`): own cookies, sign-ins and
  extensions — matches Arc/yab "extensions follow sign-ins";
- pinned tabs and folders; command bar (Ctrl/⌘+T over the page, Ctrl/⌘+K to find a tab);
  split view;
- Chrome Web Store + extensions (spike fixes included), built-in ad blocker (Ghostery engine);
- the UI is already split into **slots** (sidebar, toolbar, panels, menus, shortcuts, theme) that
  modules will plug into in step 2;
- sync of spaces, tabs, folders, bookmarks and settings between Mac and Windows [owner wants sync;
  design proposed]: port yab's design (`docs/sync.md` in yab: hybrid logical clocks, per-field
  merge, end-to-end encryption) to TypeScript and reuse its Cloudflare Worker sync server.

**Which yab features are in step 1 and which become later modules is [open]** — see §7.

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

1. **Which yab features are needed on day one** (step 1) vs later modules? This was the question
   on the table when the session ended.
2. Sync: reuse yab's server on the owner's own Cloudflare account, or something else? Which data
   syncs (modules too?).
3. Workshop: hosting, publishing identity, update model.
4. How the AI is connected for module editing: Claude Code CLI per account (as YAAS planned) vs
   another provider — and how the user reviews what the AI changed.
5. Import from Arc (bookmarks, spaces, pins) on first launch?

## 8. Left to the builder

Process layout for tabs (`WebContentsView` per tab), module loader internals, storage format
(SQLite as in ADR-0001), test strategy — within `CLAUDE.md` and the ADRs.
