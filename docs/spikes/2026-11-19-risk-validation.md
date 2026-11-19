# Spike — technical risk validation

- **Date:** 2026-11-19
- **Environment:** macOS (arm64), Claude Code CLI `2.1.247`, `@anthropic-ai/claude-agent-sdk` `0.3.328`
- **Method:** black-box runs of the CLI in headless mode (`-p --output-format stream-json --verbose`)
  plus string inspection of the CLI binary and the SDK type definitions.
- **Status legend:** ✅ confirmed · ⚠️ confirmed with caveats · ❓ not tested yet

| # | Risk | Status | Verdict |
|---|------|--------|---------|
| 1 | Accounts overwrite each other in the macOS Keychain | ✅ | Isolated per `CLAUDE_CONFIG_DIR` |
| 2 | Remaining quota cannot be read | ⚠️ | Readable from the stream; active polling relies on an internal endpoint |
| 3 | A session cannot be resumed on another account | ⚠️ | Resume of a *copied* transcript works; cross-account untested; thinking signatures are a known failure mode |
| 4 | Transcript format is undocumented | ⚠️ | JSONL, versioned per line, many internal record types |
| 5 | Adding an account needs an interactive login | ✅ | `claude auth login` / `claude setup-token`; JSON `auth status` |
| 6 | Headless sessions inherit the user's whole global config | ✅ (new) | Real problem — must be controlled by YAAS |
| 7 | Agent SDK fits Electron + per-account isolation | ✅ | `env`, `resume`, `forkSession`, `canUseTool`, in-process MCP |
| 8 | Windows credential storage | ❓ | Likely a plaintext `.credentials.json` — to verify on Windows |

---

## 1. Keychain isolation — ✅

**Finding.** The Keychain service name is built as:

```
"Claude Code" + <oauth suffix> + "-credentials" + ("-" + sha256(CLAUDE_CONFIG_DIR).slice(0, 8)  if CLAUDE_CONFIG_DIR is set)
```

The default install uses the plain `Claude Code-credentials` entry; every other config dir gets
its own hashed entry. Running `CLAUDE_CONFIG_DIR=<fresh dir> claude auth status` returns
`"loggedIn": false` while the default dir is still logged in.

**Consequences.**
- One `CLAUDE_CONFIG_DIR` per account is a sound isolation primitive. ADR material.
- The config dir **path is part of the key**: moving/renaming an account dir orphans its
  credentials. YAAS must create account dirs at a stable path (`<userData>/accounts/<accountId>/`)
  and never move them.
- `--bare` mode skips Keychain reads — don't use it for subscription accounts.

## 2. Quota — ⚠️ readable

**Finding A — passive (stream).** Every turn emits a `rate_limit_event` on `stream-json`:

```json
{
  "type": "rate_limit_event",
  "rate_limit_info": {
    "status": "allowed",              // "allowed" | "allowed_warning" | "rejected"
    "rateLimitType": "five_hour",     // five_hour | seven_day | seven_day_opus | seven_day_sonnet | overage …
    "resetsAt": 1795087800,           // unix seconds
    "isUsingOverage": false,
    "unifiedWindows": {               // marked @internal in the SDK types
      "five_hour": { "utilization": 0.57, "resetsAt": 1795087800 },
      "seven_day": { "utilization": 0.53, "resetsAt": 1795179600 }
    }
  }
}
```

**Finding B — active (polling).** The CLI calls `GET /api/oauth/usage` (used by `/usage`) to fetch
per-window utilization without spending a turn. It is internal and undocumented.

**Consequences.**
- MVP: show per-account gauges (5 h / 7 d) from the last `rate_limit_event`, with a "last seen"
  timestamp. Free and reliable while sessions are active.
- `status: "allowed_warning"` → *propose* a handoff before the wall; `"rejected"` → handoff banner
  with `resetsAt`.
- `unifiedWindows` is `@internal`: parse defensively, degrade to `status` + `resetsAt` only.
- v1 (optional): poll the usage endpoint for idle accounts, behind a feature flag, accepting it may break.
- `result.total_cost_usd` and `result.usage` give per-turn token/cost accounting.

## 3. Cross-account resume — ⚠️ partially validated

**Tested.** A transcript copied into a *different project folder* and resumed from that folder with
`--resume <id> --fork-session` kept its context (the model correctly recalled the earlier prompt),
and a new session id was written next to the copied file.

**Storage layout.** `<CLAUDE_CONFIG_DIR>/projects/<encoded cwd>/<sessionId>.jsonl`, where the cwd is
encoded by replacing `/` and `.` with `-`.

**Not tested.** Resume on a *second, different account* — needs a second logged-in account.
Use `scripts/spikes/handoff-cross-account.sh` once one is set up.

**Known failure mode.** The CLI has an explicit `invalid_thinking_signature` error class
(400 "invalid signature in thinking block"). Thinking blocks are signed server-side; replaying
them under another organization may be rejected.

**Consequences.**
- Handoff "full transcript" = copy JSONL into target config dir + `resume` + `forkSession`.
  The original stays untouched in the source account (good for audit/rollback).
- Plan a sanitizer pass: strip `thinking` / `redacted_thinking` blocks from the copy if the
  target rejects it (retry once sanitized).
- The prompt cache is lost on the target account: the first turn re-reads the whole context
  (cost/quota spike). This is what the *hybrid* mode (summary + last N turns) is for.

## 4. Transcript format — ⚠️

Each JSONL line carries `type` and, for message lines, `version` (CLI version), `cwd`, `gitBranch`,
`sessionId`, `uuid`, `parentUuid`, `isSidechain`. Observed record types include `user`, `assistant`,
`attachment`, `queue-operation`, `file-history-snapshot` and others internal to the CLI.

**Consequences.** Tolerant parser (ignore unknown types, never rewrite lines we don't understand),
contract tests on fixture transcripts, and a pinned/tested CLI version range.

## 5. Adding an account — ✅

- `claude auth login [--claudeai | --console] [--email <e>] [--sso]` — browser OAuth.
- `claude setup-token` — long-lived token for a subscription; consumed via `CLAUDE_CODE_OAUTH_TOKEN`.
- `claude auth status` prints JSON: `loggedIn`, `authMethod`, `email`, `orgId`, `orgName`,
  `subscriptionType` → enough to label an account in the UI automatically.

**Consequence.** "Add account" = create config dir → run `claude auth login` with that
`CLAUDE_CONFIG_DIR` (it opens the browser) → poll `auth status` → store profile.
`setup-token` + `safeStorage` stays an option (see #8).

## 6. Global config leaks into headless sessions — ✅ (new risk)

**Finding.** A trivial `claude -p` run from the default config dir **failed**: the request was
~268k tokens against a 200k limit, of which only ~3k were the conversation. The rest came from the
user's globally installed plugins, skills and MCP servers. Re-running with
`--strict-mcp-config --disable-slash-commands --setting-sources project` succeeded.

**Consequences.**
- YAAS must decide explicitly what each session loads (setting sources, MCP servers, skills,
  plugins) instead of inheriting everything.
- Per-account settings page: "inherit from `~/.claude`" vs "clean" — default **clean** for
  accounts created by YAAS, **inherit** for the imported default account (with a context-size warning).

## 7. Agent SDK — ✅ fits

`@anthropic-ai/claude-agent-sdk@0.3.328` options of interest: `env` (→ `CLAUDE_CONFIG_DIR`),
`resume`, `forkSession`, `canUseTool` (→ YAAS approval window), `settingSources`,
`mcpServers` (accepts `createSdkMcpServer()` **in-process** servers → `delegate_to_account` can live
in the Electron main process, no extra server), `pathToClaudeCodeExecutable`.

**Packaging note.** The SDK ships its own native CLI binary per platform via optional dependencies
(`claude-agent-sdk-darwin-arm64`, `-win32-x64`, …). electron-builder must `asarUnpack` it, and its
CLI version is independent from the user's installed `claude` → transcript format compatibility
(#4) must be checked across both.

## 8. Windows credentials — ❓

The binary has a file fallback `<CLAUDE_CONFIG_DIR>/.credentials.json` (chmod-protected) used when
no OS keychain backend is available — very likely the Windows path. To verify on a Windows machine.
If confirmed: YAAS should prefer `setup-token` + `CLAUDE_CODE_OAUTH_TOKEN` stored with `safeStorage`
on Windows, so no token sits in plaintext.

---

## Follow-ups

- [ ] Run `scripts/spikes/handoff-cross-account.sh` with a second account (closes #3).
- [ ] Verify Windows credential storage (closes #8).
- [ ] Check that `rate_limit_event` is also emitted when authenticated via `CLAUDE_CODE_OAUTH_TOKEN`.
