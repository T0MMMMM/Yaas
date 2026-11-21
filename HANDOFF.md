# HANDOFF — read this first (temporary file)

> Temporary context for the next Claude session. **Delete this file** once its "Next steps" are
> done or moved into proper docs. Written 2026-11-20.

## Where the project is

- This repo started as **YAAS** (multi-account Claude Code app). On 2026-11-20 the owner decided
  to turn it into a real web browser (first named ACAB, renamed **Big Browser** the same day — ADR-0007), customizable by an
  AI on the user's own account, with removable feature modules, a workshop, and AI tabs that keep
  the YAAS scope. See [ADR-0006](docs/adr/0006-pivot-to-big-browser.md).
- The design is **approved for step 1** (2026-11-20):
  [docs/superpowers/specs/2026-11-20-big-browser-design.md](docs/superpowers/specs/2026-11-20-big-browser-design.md).
  Its legend marks what the owner decided vs what Claude proposed.
- A throwaway spike proved Chrome extensions (1Password) work in Electron with two fixes:
  [docs/spikes/2026-11-20-chrome-extensions-electron.md](docs/spikes/2026-11-20-chrome-extensions-electron.md),
  code in `scripts/spikes/chrome-extensions/`.
- Code in `src/` is the YAAS MVP, not just the skeleton: workspace module (`useWorkspace()`),
  persistent settings, account import, SQLite through `node:sqlite` (ADR-0005), session view and
  the visual pass (liquid glass, grain, drawn controls, colour picker). The pivot was
  written on another machine before this work was merged in; it was reconciled on 2026-11-20 and
  the pivot ADR renumbered to 0006. Nothing has been renamed yet.
- Reference browser: **yab** — https://github.com/yetanotherbrowser/yab (Apache-2.0, Swift, macOS).
  Its `docs/` folder describes each feature in detail; its `sync-server/` is TypeScript.

## Decided by the owner

- Name: **Big Browser** (was ACAB, "AI Custom Another Browser"; renamed 2026-11-20). Open source. Mac + Windows, sync later (not a priority).
- Approach A: Electron, in this repo (after the spike).
- Modules can change **websites and the browser UI**.
- Workshop installs are at the user's own risk.
- Keep this repo's visual base. Take many features from yab.
- Must-have extensions: 1Password + an ad blocker, and other extensions must work.

## Next steps (in order)

1. ~~Brainstorming and design approval~~ — done 2026-11-20.
2. ~~Plan 1 (daily-driver browser core)~~ — done: `docs/superpowers/plans/2026-11-20-big-browser-core.md`.
3. ~~Plan 2 (Extensions & site menu)~~ — done: `docs/superpowers/plans/2026-11-20-big-browser-extensions-site-menu.md`.
4. ~~Plan 3 (Organisation)~~ — done: `docs/superpowers/plans/2026-11-20-big-browser-organisation.md`.
5. ~~Plan 3b-A (sidebar look and motion)~~ — done: `docs/superpowers/plans/2026-11-20-big-browser-sidebar-finish-look.md`.
6. ~~Plan 3b-B (sidebar structure, with downloads)~~ — done: `docs/superpowers/plans/2026-11-20-big-browser-sidebar-finish-structure.md`.
   Plan 3b (A and B) is finished.
7. Next: write and follow **plan 4** (window features: split view, several windows, default
   browser; downloads moved into 3b) in `docs/superpowers/plans/` (superpowers:writing-plans),
   from the design spec's roadmap.

## To check by hand

- Hover a tab, move straight right onto the page and click a link at once: the first click must
  land (the tooltip overlay hides on entry). Playwright cannot drive real cross-view input. Check
  on macOS and Windows.
- macOS: the traffic lights show in the top margin when it opens and stay clickable (also with the
  sidebar icons-only at 48, 56 and 72 px).
- Both platforms, real mouse: the top margin opens after 120 ms of rest, drags the window once
  open, and closes 250 ms after the pointer leaves.
- Page right-click: spelling suggestions on a misspelled word.
- An extension's context-menu item with an icon shows in the page menu and runs.
- Delete a space while a download runs: the download finishes and stays in the list.

## Gotchas

- On Windows, `cli.test.ts` "findCli prefers PATH" fails; it is pre-existing.
- On the owner's Windows machine the e2e tests "reopen closed tab" and the two tooltip tests fail
  even on older commits (environmental: window focus while the PC is in use).
- Never create two files whose names differ only by case (Windows and macOS file systems are
  case-insensitive).
- The owner speaks **French**; docs, code and commits stay in English (`CLAUDE.md`).
- Electron 45 downloads its binary on first run, not in `postinstall`. After `npm ci`, run
  `node node_modules/electron/install.js` if `npm run dev` complains.
- Claude never pushes (`CLAUDE.md`); never commit or rewrite history unless the owner asks in that
  session.
