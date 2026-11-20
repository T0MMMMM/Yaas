# YAAS — features & roadmap

> **Note (2026-11-20):** the product is pivoting to **Big Browser**, an AI-customizable browser
> ([ADR-0006](adr/0006-pivot-to-big-browser.md)). This page now describes the **AI tabs** pillar
> of Big Browser; the guiding principles below still apply to the whole product.

YAAS runs **Claude Code** sessions across several isolated accounts ("spaces"), e.g. work and
personal side by side, in one Arc-style window. Personal project for now; open source or
freemium later.

Technical feasibility of the risky items is tracked in
[`spikes/2026-11-19-risk-validation.md`](spikes/2026-11-19-risk-validation.md) (referenced as **S#n**).

## Product decisions so far

| Topic | Decision |
|---|---|
| Session | A Claude Code session (agent working in a project folder) |
| Rendering | Custom chat UI fed by `stream-json` / Agent SDK — no embedded terminal for MVP |
| Look | Unique, tactile UI (DESIGN.md §3.0); **light/system by default**; context bar is the header of the session card |
| Existing sessions | Imported: `~/.claude` becomes the "Default" account |
| Handoff | **Proposed**, never automatic — the user confirms |
| Combined mode | User-triggered, or proposed by Claude — never run without approval |
| Tool permissions | Approval window inside YAAS (SDK `canUseTool`) |
| Data | Local only |
| UI language | English only for now (i18n later) |
| Distribution | Not now (no signing / auto-update in MVP) |
| Scope | **Full interface**: everything is managed inside YAAS. The "companion to Claude Desktop" approach was considered and set aside for now (may be revisited) |
| Providers | Claude Code only for now; the core is provider-agnostic so Codex & co. can be added later |
| Token overhead | YAAS must cost (almost) no extra tokens compared to using Claude Code directly — see principles below |

## Guiding principles

**1. Near-zero token overhead.** If YAAS makes Claude more expensive to use, it has no reason to exist.
- No hidden model calls: no background summaries, auto-titles, classification or "smart" features
  that spend tokens without an explicit user action. Titles come from the first prompt (local).
- No system prompt injected by YAAS by default. When YAAS must add something (e.g. the
  `delegate_to_account` tool in Crew mode), it is short and only present when that feature is on.
- Every token-spending action that YAAS initiates (handoff summary, Crew split, retries) is shown
  with an estimate *before* it runs and requires a click.
- Context profiles (below) should make sessions **cheaper** than a default Claude Code launch.
- Measured, not assumed: a dev/CI check compares the token count of a YAAS session vs a plain
  `claude -p` run on the same prompt; any regression is a bug.

**2. Provider-agnostic core.** Accounts, sessions, handoff and Crew talk to a `Provider` interface;
`ClaudeCodeProvider` is the only implementation for now. Nothing Claude-specific leaks into the
renderer or the data model beyond a `provider` field.

## Pillar 1 — Sessions per account

| Stage | Feature |
|---|---|
| **MVP** | Account = space (accent color + icon), session = tab in its space; each session bound to a project folder (its **environment**) |
| **MVP** | Sidebar grouped by environment folders (open/close); pin environments and/or individual sessions above the separator (per space) |
| **MVP** | Context bar above the content card, only in a session: title, context and account usage (or in the sidebar — setting) |
| **MVP** | Settings dialog with left navigation (General, Appearance, Accounts, Sessions, Context profiles, Permissions, Handoff, Crew, Notifications, Shortcuts, Privacy, Advanced, About) — catalog in DESIGN.md §7 |
| **MVP** | Account switcher at the bottom left: emoji, first letter or dots (setting); Settings button at the bottom right |
| v1 | Custom icon/emoji on an environment or a session |
| **MVP** | Chat view: streamed messages, collapsible tool calls, per-session model picker, Stop |
| **MVP** | Permission approval sheet (allow once / always for this project / deny) |
| **MVP** | Tab status badge: running · needs approval · done · error · account limited |
| **MVP** | Import existing sessions from the default `~/.claude` (S#4) |
| **MVP** | **Context profiles**: choose which skills, MCP servers, plugins and CLAUDE.md sources each session loads — a default per account, overridable per session (S#6) |
| **MVP** | Estimated context size of the chosen profile shown before launching a session |
| v1 | Saved, reusable profiles ("Web dev", "Writing", "Minimal") and quick toggles mid-session (applied on next turn/restart) |
| v1 | Rich tool rendering: diffs, command output, images/attachments, slash commands |
| v1 | Folder routing rules (`~/work/*` → Work, `~/perso/*` → Personal) |
| v1 | Approvals inbox across all accounts + OS notifications |
| v1 | Embedded terminal per session (node-pty) as an escape hatch for anything the chat view doesn't cover yet |
| later | Desktop-parity panes: built-in browser, diff/review pane, dev-server preview, PR/CI status |
| later | Split view, multiple windows |
| later | Other providers (Codex CLI, …) via the `Provider` interface, with their own setup/onboarding |

## Pillar 2 — Session administration

| Stage | Feature |
|---|---|
| **MVP** | Create, rename, archive, delete, pin (sessions and environments); search by title/folder |
| **MVP** | Command palette (Cmd/Ctrl+K), Cmd/Ctrl+T, Cmd/Ctrl+1..9 |
| **MVP** | Account usage rings — Session (5 h) and Week (7 d): %, reset time and time left, from `rate_limit_event` (S#2) — *moved up from v1 after the spike* |
| v1 | Full-text search across transcripts (SQLite FTS5) |
| v1 | Auto-archive sessions after X days without activity (setting; pinned sessions excluded, never deletes) |
| v1 | Token/cost per session and per account (`result.usage`, `total_cost_usd`) |
| v1 | Active quota polling for idle accounts (internal endpoint, feature-flagged) (S#2) |
| v1 | Shared vs isolated settings per account (skills, MCP, global CLAUDE.md); export transcript to Markdown |
| later | Custom usage reset schedule per account and per weekday (overrides the reset times shown) |
| later | Menu-bar/tray quota widget, tags, stats |

## Pillar 3 — Handoff (proposed)

Same project folder, same disk: files don't move, only the conversation and task state do.
The exhausted account can't summarise its own session, so any summary is produced by the target account.

| Stage | Feature |
|---|---|
| **MVP** | Detection: `allowed_warning` → soft suggestion; `rejected` → banner "Work is limited until 15:00 — continue on Personal?" |
| **MVP** | **Full transcript** handoff: copy JSONL to target config dir, `resume` + `forkSession`; source left untouched (S#3) |
| **MVP** | Fallback sanitizer: strip thinking blocks and retry if the target rejects signatures (S#3) |
| v1 | **Hybrid** handoff: target-made summary + last N turns + todo list + `git status` (for huge transcripts / cache loss) |
| v1 | Handoff chain in the UI (session → continued as …) |

> ⚠️ Cross-account resume is not yet proven on two real accounts — run
> `scripts/spikes/handoff-cross-account.sh` before building this pillar.

## Pillar 4 — Crew mode (working name for the "big prompt" mode)

The main session is the **lead**; other accounts form the **crew**.
Alternatives considered: Relay, Fan-out, Squad.

| Stage | Feature |
|---|---|
| v1 | `delegate_to_account` tool exposed to the lead via an **in-process** SDK MCP server (S#7); each call goes through the approval sheet |
| v1 | Manual Crew: user writes the big prompt → lead proposes a split → user assigns subtasks to accounts → run in parallel → results back to the lead |
| v1 | One git worktree per subtask to avoid concurrent writes |
| later | Quota-aware auto-assignment, nested delegation |

Claude Code's native subagents (Task tool) can't be used: they always share the parent's account.
Crew is v1 because it builds on sessions, approvals and handoff being solid first.

## Open risks

| Risk | Status |
|---|---|
| Cross-account resume / thinking signatures | ❓ needs a second account |
| Windows credential storage (plaintext fallback?) | ❓ needs a Windows machine |
| `unifiedWindows` quota fields are `@internal` | parse defensively |
| Transcript format changes between CLI versions | tolerant parser + pinned version range |
| ToS for redistributing an app using claude.ai login | review before any public release |
