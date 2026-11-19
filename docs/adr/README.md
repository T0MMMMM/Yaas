# Architecture Decision Records

One file per structural decision: what was decided and **why**. Read these before changing
anything they cover.

**Rules**
- File name: `NNNN-kebab-title.md`, numbered in order.
- An accepted ADR is never rewritten. To change a decision, write a new ADR that supersedes it and
  set the old one's status to `Superseded by ADR-NNNN`.
- Sections: Status · Context · Decision · Alternatives considered · Consequences.
- Only for decisions that shape the codebase — not for details.

| # | Title | Status |
|---|---|---|
| [0001](0001-stack.md) | Stack: Electron + electron-vite + React + SQLite | Accepted (storage → 0005) |
| [0002](0002-account-isolation.md) | Account isolation with one `CLAUDE_CONFIG_DIR` per account | Accepted |
| [0003](0003-handoff.md) | Handoff: full transcript first, hybrid later | Accepted (cross-account validation pending) |
| [0004](0004-crew-mode.md) | Crew mode: in-process MCP tool + manual runs | Accepted |
| [0005](0005-sqlite-builtin.md) | SQLite through Node's built-in `node:sqlite` | Accepted (supersedes part of 0001) |
