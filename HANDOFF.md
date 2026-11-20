# HANDOFF — read this first (temporary file)

> Temporary context for the next Claude session. **Delete this file** once its "Next steps" are
> done or moved into proper docs. Written 2026-11-20.

## Where the project is

- This repo started as **YAAS** (multi-account Claude Code app). On 2026-11-20 the owner decided
  to turn it into **ACAB — "AI Custom Another Browser"**: a real web browser, customizable by an
  AI on the user's own account, with removable feature modules, a workshop, and AI tabs that keep
  the YAAS scope. See [ADR-0005](docs/adr/0005-pivot-to-acab-browser.md).
- The design is a **draft, not approved**:
  [docs/superpowers/specs/2026-11-20-acab-design.md](docs/superpowers/specs/2026-11-20-acab-design.md).
  Its legend marks what the owner decided vs what Claude proposed.
- A throwaway spike proved Chrome extensions (1Password) work in Electron with two fixes:
  [docs/spikes/2026-11-20-chrome-extensions-electron.md](docs/spikes/2026-11-20-chrome-extensions-electron.md),
  code in `scripts/spikes/chrome-extensions/`.
- Code in `src/` is still the YAAS skeleton (Electron + React, design tokens, sidebar). Nothing has
  been renamed yet. `npm run check` passes.
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

1. **Resume the brainstorming** (superpowers:brainstorming) with the open question the owner had
   not answered yet: *which yab features are needed on day one* vs later modules (list in §6 of
   the design). Then the other open questions in §7, one at a time.
2. Update the design doc with the answers, run the builder check, get the owner's **approval**.
3. Only then: superpowers:writing-plans for **step 1 (daily-driver browser)**.
4. Rename YAAS → ACAB in code, package, README and `CLAUDE.md` as part of step 1.

## Gotchas

- The owner speaks **French**; docs, code and commits stay in English (`CLAUDE.md`).
- Electron 45 downloads its binary on first run, not in `postinstall`. After `npm ci`, run
  `node node_modules/electron/install.js` if `npm run dev` complains.
- Never commit, push or rewrite history unless the owner asks in that session.
