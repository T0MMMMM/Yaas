# ADR-0003 — Handoff: full transcript first, hybrid later

- **Status:** Accepted (2026-11-19) — cross-account validation pending
- **Evidence:** [spike S#2, S#3](../spikes/2026-11-19-risk-validation.md)

## Context

When an account hits its usage limit mid-task, the user wants to continue the same session on
another account without losing context. Files don't need to move (same project folder on the same
disk); only the conversation and task state do. Handoff is **proposed, never automatic**, and YAAS
must not add hidden token costs.

## Decision

- **Trigger:** `rate_limit_event` with `allowed_warning` → soft suggestion; `rejected` → banner
  with reset time and the suggested target (lowest utilization). The user confirms.
- **MVP — full transcript:** copy the session JSONL from the source config dir to the target one
  (same encoded-cwd folder), then open it with `resume` + `forkSession`. The source session is left
  untouched. If the target rejects it with `invalid_thinking_signature`, retry once with a
  sanitized copy (thinking / redacted_thinking blocks stripped).
- **v1 — hybrid:** a new session seeded with a summary + last N turns + todo list + `git status`.
  The summary is produced by the **target** account (the source is exhausted), after showing the
  estimated cost.
- A `Handoff` record links both sessions; the UI shows the chain.

## Alternatives considered

| Option | + | − |
|---|---|---|
| Full transcript | No context loss, no extra model call | First turn re-reads everything uncached; possible signature rejection |
| Compact summary only | Cheap afterwards | Loses detail; costs a summarisation call |
| Hybrid | Balance for long sessions | Most complex |

## Consequences

- Copying a transcript and resuming it from another folder is verified on one account; **on two
  different accounts it is not yet** → run `scripts/spikes/handoff-cross-account.sh` (with and
  without `--thinking`) before implementing. If it fails beyond sanitizing, hybrid moves into the MVP.
- The estimated token cost of the first turn on the target is shown before confirming.
