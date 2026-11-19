# ADR-0002 — Account isolation with one `CLAUDE_CONFIG_DIR` per account

- **Status:** Accepted (2026-11-19)
- **Evidence:** [spike S#1, S#5, S#6](../spikes/2026-11-19-risk-validation.md)

## Context

Several Claude accounts (e.g. work + personal) must run **at the same time**, each with its own
auth, history and settings, without ever leaking credentials or config into each other.

## Decision

- Every account created by YAAS gets its own Claude Code config dir at a **stable path**
  `<userData>/accounts/<accountId>/`, passed to the CLI as `CLAUDE_CONFIG_DIR`. It is never moved
  or renamed.
- The pre-existing `~/.claude` is imported as the **Default** account and launched **without**
  `CLAUDE_CONFIG_DIR`, so it keeps its original keychain entry and files in place.
- Credentials stay owned by the Claude CLI (OS keychain on macOS). YAAS never reads or stores them.
- Sign-in uses `claude auth login` with the account's config dir; the profile (email, org, plan)
  comes from `claude auth status` (JSON).
- What a session loads (setting sources, MCP servers, skills, plugins, CLAUDE.md) is decided by
  YAAS through **context profiles**, never inherited implicitly.

## Alternatives considered

- **Switch accounts with `/login` on a single config dir** — one account at a time, slow, fragile.
- **YAAS stores OAuth tokens itself** (`setup-token` → `safeStorage` → `CLAUDE_CODE_OAUTH_TOKEN`) —
  more secret handling on our side. Kept as the **Windows fallback** if credentials turn out to be
  stored in plaintext there (S#8).
- **Separate OS users / containers** — heavy and hostile to a desktop workflow.

## Consequences

- Verified on macOS: the keychain service name includes `sha256(CLAUDE_CONFIG_DIR)[0..8]`, so dirs
  are isolated — **and moving a dir orphans its credentials**.
- Headless sessions would otherwise inherit the whole global config (a trivial prompt overflowed
  200k tokens in the spike); context profiles are therefore a core feature, not an option.
- Windows behaviour still to be verified.
