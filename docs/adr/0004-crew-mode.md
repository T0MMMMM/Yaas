# ADR-0004 — Crew mode: in-process MCP tool + manual runs

- **Status:** Accepted (2026-11-19) — "Crew" is a working name
- **Evidence:** [spike S#7](../spikes/2026-11-19-risk-validation.md)

## Context

For big prompts, a lead session (account A) should be able to hand sub-tasks to Claude instances
running on other accounts (B, C…). The user can trigger it, or Claude can **propose** it — never
run it without approval. It must not add tokens when unused.

## Decision

Two complementary mechanisms, both in v1:

1. **`delegate_to_account` tool** exposed to the lead through an **in-process SDK MCP server**
   (`createSdkMcpServer`, top-level `mcpServers`). Every call goes through `canUseTool`, i.e. the
   normal approval sheet — that is the "proposed, not without consent" behaviour. To avoid blocking
   the lead for a long child run, the tool set is `delegate` (returns a ticket) +
   `await_delegations` (collects results).
2. **Manual Crew:** the user writes the big prompt, the lead proposes a split (one confirmed model
   call), the user assigns sub-tasks to accounts, YAAS runs them in parallel, then posts the
   results back to the lead.

Common rules:
- The tools are registered **only when Crew is enabled** on the session.
- Each child is a normal YAAS session (`origin=crew`) on the target account, with its own context
  profile, in its **own git worktree/branch** under `<repo>/.yaas-worktrees/`.
- The lead receives a short result (summary + branch name), never the child's full transcript.

## Alternatives considered

| Option | + | − |
|---|---|---|
| A. In-process MCP tool | Lead can propose; approval for free; no port/auth | Only for YAAS-launched sessions; needs async ticket pattern |
| B. Local MCP over HTTP | Usable from any Claude Code (terminal, Desktop) | Port, auth token, attack surface; only useful if YAAS becomes a companion |
| C. Manual orchestration | Deterministic, user in control, no tool tokens | Lead doesn't drive; final aggregation turn needed |
| D. Native subagents (Task tool) | Built in | ❌ Always the parent's account |

Chosen: **A + C**. B may come later; D is not viable.

## Consequences

- Worktrees require the project to be a git repo; non-git folders get Crew in read-only mode
  (children can't write) or a warning.
- Parallel children multiply quota usage — the assignment UI shows each account's gauge.
- MCP tool timeouts must be raised for `await_delegations`, or it polls with short calls.
