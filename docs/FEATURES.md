# YAAS — features & roadmap

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
| Existing sessions | Imported: `~/.claude` becomes the "Default" account |
| Handoff | **Proposed**, never automatic — the user confirms |
| Combined mode | User-triggered, or proposed by Claude — never run without approval |
| Tool permissions | Approval window inside YAAS (SDK `canUseTool`) |
| Data | Local only |
| UI language | English only for now (i18n later) |
| Distribution | Not now (no signing / auto-update in MVP) |

## Pillar 1 — Sessions per account

| Stage | Feature |
|---|---|
| **MVP** | Account = space (accent color + emoji), session = tab in its space; each session bound to a project folder |
| **MVP** | Chat view: streamed messages, collapsible tool calls, per-session model picker, Stop |
| **MVP** | Permission approval sheet (allow once / always for this project / deny) |
| **MVP** | Tab status badge: running · needs approval · done · error · account limited |
| **MVP** | Import existing sessions from the default `~/.claude` (S#4) |
| **MVP** | Per-account context control: "clean" vs "inherit `~/.claude`" settings/MCP/skills (S#6) |
| v1 | Rich tool rendering: diffs, command output, images/attachments, slash commands |
| v1 | Folder routing rules (`~/work/*` → Work, `~/perso/*` → Personal) |
| v1 | Approvals inbox across all accounts + OS notifications |
| later | Split view, multiple windows |

## Pillar 2 — Session administration

| Stage | Feature |
|---|---|
| **MVP** | Create, rename, archive, delete, pin; search by title/folder |
| **MVP** | Command palette (Cmd/Ctrl+K), Cmd/Ctrl+T, Cmd/Ctrl+1..9 |
| **MVP** | Account gauges (5 h / 7 d utilization + reset time) from `rate_limit_event` (S#2) — *moved up from v1 after the spike* |
| v1 | Full-text search across transcripts (SQLite FTS5) |
| v1 | Token/cost per session and per account (`result.usage`, `total_cost_usd`) |
| v1 | Active quota polling for idle accounts (internal endpoint, feature-flagged) (S#2) |
| v1 | Shared vs isolated settings per account (skills, MCP, global CLAUDE.md); export transcript to Markdown |
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
