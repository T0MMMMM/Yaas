# HANDOFF — read this first (temporary file)

> Temporary context for the next Claude session. **Delete this file** once its "Next steps" are
> done or moved into proper docs. Written 2026-11-20.

## Where the project is

- This repo started as **YAAS** (multi-account Claude Code app). On 2026-11-20 the owner decided
  to turn it into **ACAB — "AI Custom Another Browser"**: a real web browser, customizable by an
  AI on the user's own account, with removable feature modules, a workshop, and AI tabs that keep
  the YAAS scope. See [ADR-0006](docs/adr/0006-pivot-to-acab-browser.md).
- The design is **approved for step 1** (2026-11-20):
  [docs/superpowers/specs/2026-11-20-acab-design.md](docs/superpowers/specs/2026-11-20-acab-design.md).
  Its legend marks what the owner decided vs what Claude proposed.
- A throwaway spike proved Chrome extensions (1Password) work in Electron with two fixes:
  [docs/spikes/2026-11-20-chrome-extensions-electron.md](docs/spikes/2026-11-20-chrome-extensions-electron.md),
  code in `scripts/spikes/chrome-extensions/`.
- Code in `src/` is the YAAS MVP, not just the skeleton: workspace module (`useWorkspace()`),
  persistent settings, account import, SQLite through `node:sqlite` (ADR-0005), session view and
  the visual pass (Satoshi, liquid glass, grain, drawn controls, colour picker). The pivot was
  written on another machine before this work was merged in; it was reconciled on 2026-11-20 and
  the pivot ADR renumbered to 0006. Nothing has been renamed yet.
- Reference browser: **yab** — https://github.com/yetanotherbrowser/yab (Apache-2.0, Swift, macOS).
  Its `docs/` folder describes each feature in detail; its `sync-server/` is TypeScript.

## Decided by the owner

- Name: AI Custom Another Browser. Open source. Mac + Windows **with sync**.
- Approach A: Electron, in this repo (after the spike).
- Modules can change **websites and the browser UI**.
- Workshop installs are at the user's own risk.
- Keep this repo's visual base. Take many features from yab.
- Must-have extensions: 1Password + an ad blocker, and other extensions must work.

## Next steps (in order)

1. ~~Brainstorming and design approval~~ — done 2026-11-20.
2. Write and follow the plan for **step 1 (daily-driver browser)**:
   `docs/superpowers/plans/` (superpowers:writing-plans).
3. Rename YAAS → ACAB in code, package, README and `CLAUDE.md` as part of step 1.

## Gotchas

- The owner speaks **French**; docs, code and commits stay in English (`CLAUDE.md`).
- Electron 45 downloads its binary on first run, not in `postinstall`. After `npm ci`, run
  `node node_modules/electron/install.js` if `npm run dev` complains.
- Claude never pushes (`CLAUDE.md`); never commit or rewrite history unless the owner asks in that
  session.
- Fonts: Satoshi is not in git; run `npm run setup:fonts -- <path>` once (`docs/DESIGN.md` §3.0).
