# ACAB — AI Custom Another Browser

A desktop web browser (macOS + Windows) that you customize with your own AI. It grew out of ACAB,
a multi-account Claude Code app; the ACAB design docs in `docs/` remain the reference for AI tabs
(see ADR-0006).

> **Status: pre-alpha.** Design docs are done; the app skeleton is being set up. Nothing works yet.

## What it does (planned)

- **Spaces per account** — each account is fully isolated (auth, history, settings); its sessions
  live as tabs in a vertical sidebar.
- **Session admin** — create, rename, pin, archive, search; live usage gauges (5 h / 7 d) per account.
- **Context profiles** — choose which skills, MCP servers and plugins each session loads, so you
  don't pay tokens for what you don't use.
- **Handoff** — an account hit its limit? ACAB proposes to continue the same session on another
  account, with the full context.
- **Crew mode** — a lead session can delegate sub-tasks to Claude running on your other accounts,
  always with your approval.
- **Near-zero overhead** — ACAB never calls the model behind your back.

See [`docs/FEATURES.md`](docs/FEATURES.md) for the full roadmap (MVP / v1 / later).

## Requirements

- macOS 13+ or Windows 10/11
- Node.js 22+ and npm
- The Claude Code CLI installed, and at least one Claude account

## Development

```bash
npm install
npm run setup:fonts -- ~/Downloads/Satoshi_Complete   # Satoshi from fontshare.com, not in git
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
