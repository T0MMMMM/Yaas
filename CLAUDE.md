# YAAS — conventions for Claude sessions

YAAS ("Yeah, An Account Switcher") is an Electron desktop app (macOS + Windows) that runs
**Claude Code** sessions across several isolated accounts ("spaces"), in an Arc-style UI.
Personal project, pre-alpha.

## Read first

| When you touch… | Read |
|---|---|
| anything | `docs/FEATURES.md` (scope, roadmap, **guiding principles**) |
| main / core / IPC / data | `docs/ARCHITECTURE.md` |
| UI, CSS, shortcuts | `docs/DESIGN.md` |
| accounts, handoff, crew, stack | the matching ADR in `docs/adr/` — don't contradict an accepted ADR; write a new one that supersedes it |
| Claude CLI behaviour | `docs/spikes/` (what was verified, what wasn't) |

## Commands

```bash
npm run setup:fonts -- <path>  # once: install Satoshi locally (not in git, see DESIGN.md §3.0)
npm run dev         # app with hot reload
npm run check       # typecheck + lint + format:check + unit tests — must pass before every commit
npm run test:e2e    # builds, then Playwright against the real app (no tokens)
npm run format      # Prettier
npm run dist:mac    # package (dist:win on Windows)
```

## Non-negotiable rules

1. **Near-zero token overhead.** Never add a code path that calls a model without an explicit
   user action (no auto-titles, background summaries, "smart" helpers). Anything that spends tokens
   shows an estimate and needs a click. Tests use the fake provider — never a real account.
2. **Layering.**
   - `src/core/` and `src/shared/` never import `electron` or `react` (ESLint enforces it).
   - `src/renderer/` never imports Node, `electron` or `@core/*`; it only talks to `window.yaas`.
   - `src/main/` is the Electron shell: windows, IPC handlers, OS integration. Domain logic goes in `core/`.
3. **IPC goes through the contract.** To add a command or event:
   add the name to `src/shared/ipc/channels.ts` → its zod schema to `src/shared/ipc/contract.ts`
   → the handler in `src/main/index.ts` (validated by `registerCommands`) → use it via
   `window.yaas.invoke/on`. Never expose a raw `ipcRenderer` or a new global.
4. **Security defaults stay on**: `contextIsolation`, `sandbox`, no `nodeIntegration`, CSP in
   `src/renderer/index.html`, navigation and popups blocked.
5. **Account isolation (ADR-0002)**: one `CLAUDE_CONFIG_DIR` per account at a stable path; never
   move it; the default `~/.claude` account runs without `CLAUDE_CONFIG_DIR`. YAAS never reads or
   stores Claude credentials.
6. **Transcripts are the source of truth** for conversations; SQLite stores metadata and the search
   index only.
7. **Workspace data goes through one module**: renderer components get spaces, the sidebar tree
   (pinning rules), the open session and usage from `useWorkspace()`
   (`src/renderer/src/features/workspace/`). Never import the data source or re-derive those rules
   in a component — when real data arrives over IPC, only that module changes.
8. **Provider-agnostic core**: Claude-specific code lives in `src/core/providers/claude-code/`
   behind the `Provider` interface (`src/core/providers/provider.ts`).

## Code style

- TypeScript strict (`noUncheckedIndexedAccess` on). No `any`; use `unknown` + zod at boundaries.
- `import type` for type-only imports (lint-enforced). Path aliases: `@shared/*`, `@core/*`, `@renderer/*`.
- React: function components, named exports, one component per file, state in Zustand stores
  (`src/renderer/src/stores/`) fed by IPC events.
- CSS: CSS Modules per component; **only design tokens** from `theme/tokens.css` — no raw colors,
  sizes or durations in components. New token → add it to `tokens.css` and `docs/DESIGN.md`.
- Tests next to the code (`foo.ts` → `foo.test.ts`); e2e in `tests/e2e/`.
- Language: English for code, comments, docs, UI strings and commits.

## Definition of done

- `npm run check` passes; UI changes also pass `npm run test:e2e`.
- New behaviour has a test (unit with the fake provider, or e2e for UI flows).
- Docs updated if you changed a decision, a token, a shortcut or the IPC contract.

## Git workflow

- `main` must always build and launch.
- Small, self-contained changes (docs, config tweak, one-file fix) may go straight to `main`.
- Anything bigger goes on a short-lived branch named `<type>/<short-kebab-desc>`
  (e.g. `feat/onboarding-screen`, `fix/ipc-timeout`), then merged into `main`.
- Commit after each step the user has validated — don't pile unrelated work into one commit.
- **Claude never pushes** — not `git push`, not `gh` (PRs, releases), not even when asked to
  "publish" or "sync". The user always pushes. Finish with the commits ready and say so.
- Never commit, force-push or rewrite history unless the user asked for it in this session.
- Never commit secrets, tokens, `.env` files, or any Claude config dir (`.claude*/`, account dirs).

## Commit messages — Conventional Commits

```
<type>(<scope>): <summary in imperative mood, lowercase, no trailing period, ≤ 72 chars>

<optional body: what and why, wrapped at 72 chars>

<optional footer: BREAKING CHANGE: …, Refs #12>
```

| type       | use for                                             |
|------------|-----------------------------------------------------|
| `feat`     | a new user-facing capability                        |
| `fix`      | a bug fix                                           |
| `refactor` | code change with no behaviour change                |
| `perf`     | performance improvement                             |
| `test`     | adding or fixing tests only                         |
| `docs`     | documentation only (README, docs/, ADRs, CLAUDE.md) |
| `style`    | formatting only (Prettier, lint autofix)            |
| `build`    | build system, deps, electron-builder, Vite          |
| `ci`       | CI workflows                                        |
| `chore`    | anything else (gitignore, tooling housekeeping)     |

**Scopes** (optional): `main`, `preload`, `renderer`, `shared`, `core`, `accounts`, `sessions`,
`claude`, `handoff`, `crew`, `profiles`, `theme`, `onboarding`, `sidebar`, `ipc`, `adr`, `deps`.

```
feat(onboarding): add accent color picker step
fix(ipc): reject unknown channels in preload bridge
docs(adr): record account isolation via CLAUDE_CONFIG_DIR
build(deps): bump electron to 46.x
```

- One logical change per commit. If the summary needs "and", split it.
- Breaking changes: `!` after the type/scope (`feat(ipc)!: …`) and a `BREAKING CHANGE:` footer.
- Commits written by Claude end with a `Co-Authored-By:` trailer.
