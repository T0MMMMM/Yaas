# ACAB — AI Custom Another Browser

A desktop web browser (macOS + Windows) that you customize with your own AI. It grew out of YAAS,
a multi-account Claude Code app; the YAAS design docs in `docs/` remain the reference for AI tabs
(see ADR-0006).

> **Status: pre-alpha.** The browser core is being built. Nothing is usable yet.

## What it is (planned)

- **A real web browser** for macOS and Windows, with browser spaces and an Arc-style sidebar.
- **Chrome extensions** support.
- **Removable feature modules** — browser features are modules your own AI can edit or remove.
- **AI tabs** — Claude Code sessions as tabs, coming later (the former YAAS scope).
- **Near-zero overhead** — ACAB never calls a model behind your back.

Design: [`docs/superpowers/specs/2026-11-20-acab-design.md`](docs/superpowers/specs/2026-11-20-acab-design.md)
and [`docs/adr/0006-pivot-to-acab-browser.md`](docs/adr/0006-pivot-to-acab-browser.md). The AI-tabs
roadmap is in [`docs/FEATURES.md`](docs/FEATURES.md).

## Requirements

- macOS 13+ or Windows 10/11
- Node.js 22+ and npm
- The Claude Code CLI installed, and at least one Claude account

## Development

```bash
npm install
npm run dev        # launch the app with hot reload
npm run lint
npm run typecheck
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end (Playwright, fake provider — no tokens)
npm run dist       # package dmg / nsis
```

(Scripts land with the project skeleton.)

## Documentation

| Doc | Content |
|---|---|
| [`docs/FEATURES.md`](docs/FEATURES.md) | Features, roadmap, guiding principles |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Processes, modules, data model, IPC, flows |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Layout, design tokens, glass/grain, onboarding, shortcuts |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records |
| [`docs/spikes/`](docs/spikes/) | Technical spikes and their findings |
| [`CLAUDE.md`](CLAUDE.md) | Conventions for Claude coding sessions (incl. commit rules) |

## Disclaimer

ACAB is an independent project, not affiliated with or endorsed by Anthropic. It drives the
official Claude Code CLI with your own accounts; you remain responsible for complying with the
terms that apply to them.

## License

To be decided.
