# ADR-0001 — Stack: Electron + electron-vite + React + SQLite

- **Status:** Accepted (2026-11-19)

## Context

YAAS is a macOS + Windows desktop app that drives Claude Code sessions through the Claude Agent SDK
(a Node library that spawns the CLI). It needs native window materials (vibrancy, Mica), a fast
custom UI, local storage with full-text search, and a provider-agnostic core so other agents
(Codex, …) can be added later.

## Decision

- **Electron** shell, **TypeScript strict** everywhere.
- **electron-vite** to build main, preload and renderer with Vite.
- **React** + **Zustand** in the renderer; **CSS Modules + CSS custom properties** for design tokens.
- **SQLite** via `better-sqlite3` with FTS5; hand-written SQL migrations.
- **zod** validation of every IPC payload entering main.
- **electron-builder** for `dmg` / `nsis`.
- **Vitest** + **Playwright** (`_electron`) for tests.
- Source split: `main/` (Electron shell), `core/` (domain, **no `electron` import**), `preload/`,
  `renderer/`, `shared/` (IPC contract + types).

## Alternatives considered

- **Tauri** — smaller binaries, but the Agent SDK is Node-only: we would ship a Node sidecar anyway,
  i.e. two runtimes and a Rust↔Node bridge. Rejected.
- **Plain Vite + hand-rolled main build / electron-forge** — more config for the same result.
- **Tailwind** — the look relies on tokens, glass and grain; utility classes add little. Can be
  revisited without changing the tokens.
- **Redux / TanStack Query** — state is mostly pushed by IPC events; Zustand slices are enough.
- **Store messages in SQLite** — rejected: the CLI transcripts are the source of truth (see
  ARCHITECTURE §5); SQLite keeps metadata and a search index only.

## Consequences

- `better-sqlite3` and `node-pty` are native modules: they must be rebuilt for Electron
  (`electron-builder install-app-deps`) and `asarUnpack`ed, like the SDK's native CLI binary.
- Keeping `core/` Electron-free makes it testable with a fake provider (0 tokens) and movable to a
  `utilityProcess` if the main process ever gets janky.
