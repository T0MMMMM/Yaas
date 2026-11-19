# ADR-0005 — SQLite through Node's built-in `node:sqlite`

- **Status:** Accepted (2026-11-19) — supersedes the `better-sqlite3` choice in ADR-0001

## Context

ADR-0001 chose SQLite via `better-sqlite3`. That is a native module: it must be rebuilt for
Electron's ABI, unpacked from the asar, and the Electron build cannot be loaded by Vitest running
on the system Node — so core tests that touch the database would need a second build or mocks.

## Decision

Use **`node:sqlite`** (`DatabaseSync`), built into Node. Verified in the spike for this ADR:
Electron 45 (Node 24.22) and the dev/test Node 22.20 both open databases, and FTS5 is available.

- `src/core/store/database.ts` opens the file and applies ordered migrations tracked by
  `PRAGMA user_version`. Shipped migrations are never edited; new ones are appended.
- WAL journal mode, foreign keys on.
- Tests use `:memory:` databases — real SQL, no mocks.

## Alternatives considered

- **better-sqlite3** — mature and fast, but the native rebuild/ABI split above.
- **JSON files** — no migrations, no FTS, no transactions.

## Consequences

- No native module to rebuild for the database; `asarUnpack` no longer needs SQLite.
- `node:sqlite` is still flagged experimental by Node and prints an `ExperimentalWarning` in
  tests. Its API is synchronous and stable enough for our use; if it changes, only
  `core/store/database.ts` is affected.
