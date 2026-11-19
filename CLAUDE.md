# YAAS — conventions for Claude sessions

YAAS ("Yeah, An Account Switcher") is an Electron desktop app (macOS + Windows) that runs
Claude Code sessions across several isolated accounts / workspaces (e.g. pro + perso).

> This file is a stub. Architecture, stack and code conventions will be added once the
> design is validated (see `docs/` when it exists). Until then, only the git rules below apply.

## Language

- Code, comments, commit messages, docs, UI strings: **English**.

## Git workflow

- `main` must always build and launch. Never push broken code to `main`.
- Small, self-contained changes (docs, config tweak, one-file fix) may go straight to `main`.
- Anything bigger goes on a short-lived branch named `<type>/<short-kebab-desc>`
  (e.g. `feat/onboarding-screen`, `fix/ipc-timeout`), then merged into `main`.
- Commit after each step the user has validated — don't pile unrelated work into one commit.
- Never commit, push, force-push or rewrite history unless the user asked for it in this session.
- Never commit secrets, tokens, `.env` files, or any Claude config dir (`.claude*/`, account dirs).

## Commit messages — Conventional Commits

```
<type>(<scope>): <summary in imperative mood, lowercase, no trailing period, ≤ 72 chars>

<optional body: what and why, wrapped at 72 chars>

<optional footer: BREAKING CHANGE: …, Refs #12>
```

**Types**

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

**Scopes** (optional, pick the closest): `main`, `preload`, `renderer`, `shared`,
`accounts`, `sessions`, `claude`, `handoff`, `orchestrator`, `theme`, `onboarding`,
`ipc`, `adr`, `deps`.

**Examples**

```
feat(onboarding): add accent color picker step
fix(ipc): reject unknown channels in preload bridge
docs(adr): record account isolation via CLAUDE_CONFIG_DIR
build(deps): bump electron to 39.x
```

- One logical change per commit. If the summary needs "and", split it.
- Breaking changes: add `!` after the type/scope (`feat(ipc)!: …`) and a `BREAKING CHANGE:` footer.
- Commits written by Claude end with a `Co-Authored-By:` trailer.
