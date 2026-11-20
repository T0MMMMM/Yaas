# ADR-0005 — Pivot: YAAS becomes ACAB, an AI-customizable browser

- **Status:** Accepted (2026-11-20)
- **Evidence:** [Chrome extensions spike](../spikes/2026-11-20-chrome-extensions-electron.md)
- **Design:** [ACAB design](../superpowers/specs/2026-11-20-acab-design.md)

## Context

YAAS was planned as a desktop app to run Claude Code across several accounts. The owner wants
something bigger and personal: a real web browser that replaces Arc (and yab) as their daily
driver, fully customizable by an AI running on the user's own Claude account, with features that
are easy to add or remove, a workshop to share them, and AI tabs that keep everything YAAS was
meant to do. It will be open source.

The key technical risk was whether an Electron browser can run the Chrome extensions the owner
depends on (1Password first). The spike showed it can, with two small fixes.

## Decision

- The product is renamed **ACAB — "AI Custom Another Browser"**.
- It is a **web browser** first: tabs, spaces, extensions, sync between macOS and Windows.
- **Stay on Electron** (ADR-0001 stands): Chromium via `WebContentsView`, Chrome extensions via
  `electron-chrome-extensions` + `electron-chrome-web-store`, built-in ad blocking via the
  Ghostery engine.
- **Features are modules.** The core is kept small; nearly every feature (including those taken
  from yab) is a module in its own folder that can be added or removed without touching the
  core. The AI edits modules, never the core.
- **The YAAS scope becomes the "AI tabs" pillar.** ADR-0002 (account isolation), ADR-0003
  (handoff) and ADR-0004 (crew) still apply to AI tabs; they are not superseded.
- Build order: (1) daily-driver browser, (2) module system + AI that writes modules,
  (3) AI tabs, (4) workshop.
- Workshop modules are installed at the user's own risk, but the install screen shows what a
  module asks for.
- yab (Apache-2.0) is the main reference: its behaviour and docs are reused, and its
  TypeScript sync server may be reused with attribution. Its Swift code is not ported.

## Alternatives considered

- **Fork Chromium** (Arc, Brave): full extension support, but C++, 100 GB+ sources, multi-hour
  builds and a rebase every four weeks. Not realistic solo, and the AI could not easily edit the UI.
- **Start from Flow Browser** (Electron, GPL-3.0): extension support already done, but we would
  drop the YAAS base and visual direction and take on GPL-3.0.
- **CEF like yab**: better extension coverage, but a C++ helper process and platform-specific
  integration work.

## Consequences

- 1Password works but cannot pair with its desktop app (no native messaging in Electron); users
  sign in inside the extension.
- Extension gaps will appear one by one and need small shims in the browser layer.
- `docs/FEATURES.md` describes the YAAS plan and is now the reference for the AI tabs pillar only.
- The package, app name and docs still say YAAS; the rename is part of step 1.
