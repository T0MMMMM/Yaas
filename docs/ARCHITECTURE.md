# YAAS — architecture

> Status: **accepted** (2026-11-19). Decisions marked *(ADR)* have their own record in [`adr/`](adr/).
> UI details: [`DESIGN.md`](DESIGN.md).
> Feature scope: [`FEATURES.md`](FEATURES.md). Spike evidence: [`spikes/2026-11-19-risk-validation.md`](spikes/2026-11-19-risk-validation.md) (S#n).

## 1. Stack *(ADR-0001)*

| Concern | Choice | Why |
|---|---|---|
| Shell | **Electron** | The Agent SDK is Node; native vibrancy (macOS) and Mica/Acrylic (Win 11); one codebase. Tauri was rejected: Rust shell + Node sidecar for the SDK = two runtimes for no gain |
| Build | **electron-vite** (Vite for main, preload and renderer) | One config, HMR in the renderer, fast main rebuilds |
| Language | TypeScript `strict` everywhere | — |
| UI | React 19 + **Zustand** (state) + CSS Modules + CSS variables (design tokens) | Small, fast; tokens map 1:1 to the theme settings. No Tailwind: the look relies on tokens, glass and grain, not utility classes |
| Lists | `@tanstack/react-virtual` | Long transcripts and session lists |
| Claude | `@anthropic-ai/claude-agent-sdk` (spawns the Claude Code CLI) | Streaming, `canUseTool`, `resume`/`forkSession`, in-process MCP (S#7) |
| Storage | **SQLite** via built-in `node:sqlite` + FTS5, migrations on `user_version` *(ADR-0005)* | No native module; same engine in Electron and in tests |
| Validation | `zod` on every IPC payload entering main | The renderer is untrusted |
| Terminal (v1) | `node-pty` + `xterm.js` | Escape hatch only |
| Packaging | electron-builder → `dmg` (mac), `nsis` (win) | As required; SDK native binary `asarUnpack`ed (S#7) |
| Tests | Vitest (unit/contract), Playwright `_electron` (e2e) | — |

## 2. Processes

```mermaid
flowchart LR
  subgraph Electron
    R["Renderer (React)<br/>sidebar · tabs · chat · onboarding<br/><i>sandboxed, no Node</i>"]
    P["Preload<br/>contextBridge → window.yaas"]
    M["Main process<br/>windows · IPC router · OS integration<br/>+ core (domain)"]
  end
  DB[("SQLite<br/>userData/yaas.db")]
  KC[["OS keychain<br/>(managed by Claude CLI)"]]
  subgraph Children["Claude Code child processes (1 per live session)"]
    C1["claude · account A<br/>CLAUDE_CONFIG_DIR=…/accounts/A"]
    C2["claude · account B<br/>CLAUDE_CONFIG_DIR=…/accounts/B"]
    C3["claude · Crew delegate (B)<br/>cwd = git worktree"]
  end
  FS[("Config dirs<br/>transcripts *.jsonl")]
  API(("Anthropic API"))

  R <-- "typed IPC<br/>invoke / events" --> P <--> M
  M --- DB
  M -- "Agent SDK<br/>stdin/stdout stream-json" --> C1 & C2 & C3
  C1 & C2 & C3 --- FS
  C1 & C2 & C3 --- KC
  C1 & C2 & C3 --> API
```

- **Renderer**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Talks only to `window.yaas`.
- **Main**: hosts the Electron shell *and* the domain core. The core never imports `electron`
  (rule enforced by ESLint), so it can move to a `utilityProcess` later if streaming ever makes the
  main process janky — without touching domain code.
- **Children**: one Claude Code process per *live* session, started by the Agent SDK in streaming-input
  mode (the process survives across turns). Idle sessions are closed after 10 min and transparently
  resumed (`resume`) on the next message. Credentials never pass through YAAS: each child reads its
  own keychain entry, keyed by its config dir (S#1).

## 3. Source layout

Adapted from the indicative tree: the domain moves out of `main/` into `core/` so it stays
Electron-free and testable with a fake provider.

```
src/
  main/                    # Electron shell only
    index.ts               # app lifecycle, single-instance lock
    windows/               # BrowserWindow creation, vibrancy/mica, traffic lights
    browser/               # TabViews: one WebContentsView per tab; OverlayView (§11)
    ipc/                   # handlers: zod-validate → call core → return; event fan-out
    os/                    # notifications, dock/taskbar badge, menus, shortcuts
    secrets.ts             # safeStorage wrapper (Windows token fallback, S#8)
  core/                    # domain — NO electron imports
    accounts/              # Account CRUD, config dir creation, auth login/status
    profiles/              # Context profiles → provider launch options, context-size estimate
    sessions/              # lifecycle, live-session registry, idle reaper, import
    permissions/           # pending requests, rules (once / always-for-project / deny)
    usage/                 # UsageSnapshot from rate-limit events
    handoff/               # full + hybrid handoff, transcript sanitizer
    crew/                  # delegate tool (in-process MCP), manual runs, worktrees
    providers/
      provider.ts          # Provider interface + normalized events
      claude-code/         # Agent SDK adapter, transcript reader, path encoding
      fake/                # deterministic provider for tests & e2e (0 tokens)
    store/                 # SQLite (node:sqlite), migrations, FTS index
    events.ts              # typed in-process event bus (core → ipc)
  preload/
    index.ts               # exposes window.yaas (invoke/on), nothing else
    browserMirror.ts       # space sessions only: mirrors chrome.* onto browser.* (extensions)
  renderer/
    app/                   # routes: onboarding, main layout
    features/              # sidebar, tabs, chat, approvals, palette, settings, crew
    theme/                 # tokens.css, grain overlay, glass, ThemeProvider
    stores/                # Zustand slices fed by IPC events
  shared/
    ipc.ts                 # THE contract: channels, payload & result types, zod schemas
    model.ts               # domain types shared with the renderer
docs/  scripts/  tests/e2e/
```

## 4. Provider abstraction

Everything provider-specific sits behind one interface; only `ClaudeCodeProvider` exists for now.

```ts
interface Provider {
  readonly id: 'claude-code' // | 'codex' later
  auth: {
    login(account: Account): Promise<void>          // opens the browser flow
    status(account: Account): Promise<AuthStatus>   // email, org, plan
  }
  discoverSessions(account: Account): AsyncIterable<DiscoveredSession> // import
  readTranscript(account: Account, ref: ProviderSessionRef): AsyncIterable<TranscriptEntry>
  open(opts: OpenSessionOptions): LiveSession       // new or resume (+ fork)
  copyTranscript(from: Account, to: Account, ref: ProviderSessionRef,
                 opts: { sanitize: boolean }): Promise<ProviderSessionRef> // handoff
}

interface LiveSession {
  send(input: UserInput): void
  interrupt(): Promise<void>
  close(): Promise<void>
  events: AsyncIterable<ProviderEvent>
}

type ProviderEvent =
  | { kind: 'init'; providerSessionId: string; model: string; tools: string[] }
  | { kind: 'text-delta' | 'thinking-delta'; messageId: string; text: string }
  | { kind: 'message'; entry: TranscriptEntry }            // complete assistant/user message
  | { kind: 'tool-use'; id: string; name: string; input: unknown }
  | { kind: 'tool-result'; toolUseId: string; output: unknown; isError: boolean }
  | { kind: 'permission-request'; requestId: string; tool: string; input: unknown }
  | { kind: 'rate-limit'; status: 'allowed' | 'warning' | 'rejected'; windows: UsageWindow[]; resetsAt?: number }
  | { kind: 'turn-end'; usage: TokenUsage; costUsd: number; stopReason: string }
  | { kind: 'error'; code: 'rate_limited' | 'auth' | 'prompt_too_long' | 'invalid_thinking_signature' | 'other'; message: string }
```

`ClaudeCodeProvider` maps profiles to SDK options: `env.CLAUDE_CONFIG_DIR` (omitted for the
imported default account, so the CLI keeps using its original keychain entry), `settingSources`,
`mcpServers` + `strictMcpConfig`, allowed skills/plugins, `model`, `canUseTool`, `resume`, `forkSession`.

## 5. Data model

**Source of truth for conversations = the provider's transcript files.** SQLite holds metadata,
links between sessions, usage, permissions and a search index — never a second copy of the
conversation. This avoids drift with the CLI and keeps imports free.

```mermaid
erDiagram
  Account ||--o{ Session : owns
  Environment ||--o{ Session : "runs in"
  Account ||--o{ SpaceEnvironment : "pins / orders"
  Environment ||--o{ SpaceEnvironment : "shown in" 
  Account ||--o{ UsageSnapshot : reports
  Account }o--|| ContextProfile : "default profile"
  ContextProfile ||--o{ Session : "launched with"
  Session ||--o{ PermissionRequest : raises
  Session ||--o{ SearchEntry : "indexed as"
  Session ||--o| Handoff : "from"
  Session ||--o| Handoff : "to"
  Session ||--o{ Delegation : "leads"
  Delegation ||--|| Session : "child"
  CrewRun ||--o{ Delegation : groups
  PermissionRule }o--|| Account : "scoped to"

  Account {
    uuid id PK
    string provider "claude-code"
    string label
    string emoji
    string color
    string configDir "null = default ~/.claude"
    string authMethod
    string email
    string orgName
    string plan
    uuid defaultProfileId FK
    int position
    datetime archivedAt
  }
  Environment {
    uuid id PK
    string path "project folder, unique"
    string name "defaults to folder name"
    string icon "optional emoji / icon name"
  }
  SpaceEnvironment {
    uuid accountId FK
    uuid environmentId FK
    bool pinned
    int position
    bool collapsed
  }
  ContextProfile {
    uuid id PK
    uuid accountId "null = global"
    string name
    json settingSources
    json mcpServers "enabled names"
    json skills "allow-list"
    json plugins
    bool loadClaudeMd
    string model
    string permissionMode
  }
  Session {
    uuid id PK "stable YAAS id"
    uuid accountId FK
    string providerSessionId "changes on fork/handoff"
    string title
    string icon "optional"
    string cwd
    uuid environmentId FK
    uuid profileId FK
    string model
    string status "idle|running|needs-approval|done|error|limited"
    string origin "created|imported|handoff|crew"
    uuid parentSessionId
    string worktreePath
    bool pinned
    datetime archivedAt
    datetime lastActivityAt
  }
  SearchEntry {
    uuid sessionId FK
    string entryUuid
    string role
    text text "FTS5"
    datetime ts
  }
  PermissionRequest {
    uuid id PK
    uuid sessionId FK
    string tool
    json input
    string decision "pending|allow|deny"
    string scope "once|project|account"
    datetime createdAt
  }
  PermissionRule {
    uuid id PK
    uuid accountId FK
    string projectPath "null = whole account"
    string toolPattern
    string decision
  }
  UsageSnapshot {
    uuid accountId FK
    string window "five_hour|seven_day|…"
    float utilization
    datetime resetsAt
    string status
    datetime observedAt
  }
  Handoff {
    uuid id PK
    uuid fromSessionId FK
    uuid toSessionId FK
    string mode "full|hybrid"
    string reason "rate_limited|manual"
    bool sanitized
    int estimatedTokens
    string status
    datetime createdAt
  }
  CrewRun {
    uuid id PK
    uuid leadSessionId FK
    text prompt
    string status
  }
  Delegation {
    uuid id PK
    uuid crewRunId FK "null if tool-triggered"
    uuid leadSessionId FK
    uuid childSessionId FK
    uuid targetAccountId FK
    text task
    string trigger "tool|manual"
    string worktreePath
    string branch
    text resultSummary
    string status
  }
```

An **environment** is a project folder. It is global (the same folder can host sessions of
several accounts, e.g. after a handoff); pinning, order and collapsed state are per space
(`SpaceEnvironment`).

App settings (theme tokens, layout options, auto-archive, onboarding done, shortcuts) live in a small
`settings` key/value table.

**On disk**

```
<userData>/
  yaas.db
  accounts/<accountId>/        # CLAUDE_CONFIG_DIR of each YAAS-created account — never moved (S#1)
~/.claude/                     # imported "Default" account, read in place, never moved
<repo>/.yaas-worktrees/<id>/   # Crew worktrees (git-ignored)
```

## 6. IPC contract

One file, `src/shared/ipc.ts`, defines every channel. Two kinds:

- **Commands** (renderer → main, request/response): `accounts.list`, `accounts.add`, `sessions.create`,
  `sessions.send`, `sessions.interrupt`, `permissions.respond`, `handoff.propose`, `handoff.run`,
  `crew.start`, `settings.update`, …
- **Events** (main → renderer, push): `session.event`, `session.status`, `permission.requested`,
  `usage.updated`, `handoff.suggested`, …

```ts
// shared/ipc.ts (shape)
export const commands = {
  'sessions.send': { input: z.object({ sessionId: z.string().uuid(), text: z.string().min(1) }), output: z.void() },
  // …
} satisfies Record<string, { input: ZodType; output: ZodType }>

// renderer
await window.yaas.invoke('sessions.send', { sessionId, text })
const off = window.yaas.on('session.event', (e) => …)
```

The preload exposes only `invoke(channel, payload)` and `on(event, cb)`, with the channel name typed
as `keyof typeof commands`; main rejects unknown channels and invalid payloads. Streaming deltas are
**batched per ~16 ms** before crossing IPC to avoid flooding the renderer.

**The one exception: `window.browserAction` in the overlay.** The site menu lists the tab's
extension actions with `<browser-action-list>` from `electron-chrome-extensions`, which only works
with the library's own bridge. So the preload calls `injectBrowserAction()` (bundled into the
preload) **only when the page is the overlay** (`location.hash === '#overlay'`); the UI window
never gets it. It defines the `<browser-action-list>` / `<browser-action>` elements and exposes
`window.browserAction`: `getState(partition)`, `activate(partition, details)` (click: run the
action or open its popup; right-click: its context menu), `addObserver` / `removeObserver` and
update listeners. It goes through the library's `crx-msg-remote` channel, not through
`window.acab`, and gives no raw `ipcRenderer`. Note the library's `browserAction.getState` /
`activate` handlers accept **any sender** (`allowRemote: true`) for any partition: the exposure is
the library's, registered on `ipcMain` as soon as a space session exists, and the overlay only
uses it to read and activate actions.

## 7. Key flows

### 7.1 Send a message (with a permission request)

```mermaid
sequenceDiagram
  participant UI as Renderer
  participant M as Main / core
  participant C as claude (account A)
  UI->>M: invoke sessions.send
  M->>M: live session? else open (resume) with profile → SDK options
  M->>C: user message (stream-json stdin)
  C-->>M: text deltas, tool_use…
  M-->>UI: session.event (batched)
  C->>M: canUseTool(Bash, {cmd})
  M->>M: matching PermissionRule? → auto answer
  M-->>UI: permission.requested (+ OS notification if unfocused)
  UI->>M: invoke permissions.respond(allow, scope=project)
  M->>C: allow
  C-->>M: tool_result, rate_limit_event, result
  M->>M: UsageSnapshot, SearchEntry, status=done
  M-->>UI: usage.updated, session.status
```

### 7.2 Handoff *(ADR-0003)*

| Option | + | − |
|---|---|---|
| **Full transcript** (copy JSONL → target, `resume` + `forkSession`) | Zero context loss; no extra model call; source untouched | First turn re-reads everything without cache (cost spike); may hit `invalid_thinking_signature` |
| **Compact summary** (new session seeded with a summary) | Cheap ongoing turns | Loses detail; the summary must be produced by the *target* (source is exhausted) |
| **Hybrid** (summary + last N turns + todo + `git status`) | Good balance for long sessions | Most complex; one summarisation call |

Decision: **full transcript in MVP**, hybrid in v1. Flow:
`rate-limit warning|rejected` → `handoff.suggested` banner (target suggested by lowest utilization)
→ user confirms, sees estimated tokens → `copyTranscript` (sanitize on retry) → new Session
(`origin=handoff`, `parentSessionId`) on target → tab replaces the old one, chain visible in UI.

### 7.3 Crew *(ADR-0004)*

| Mechanism | + | − / limits |
|---|---|---|
| **A. In-process MCP tool** `delegate_to_account` (`createSdkMcpServer`) injected into the lead | Lead can propose delegation itself; approval comes for free through `canUseTool`; no port, no auth | Only for sessions launched by YAAS; a long child run blocks the lead's tool call → use `delegate` (returns a ticket) + `await_delegations` |
| **B. Local MCP server over HTTP** (localhost + token) | Usable from any Claude Code (terminal, Desktop) | Port/auth/security handling; only useful if YAAS becomes a companion |
| **C. Manual Crew** (YAAS spawns children directly) | Deterministic, user in control, no extra tool tokens in the lead | Lead doesn't drive; a final aggregation turn is needed |
| **D. Native subagents (Task tool)** | Built-in | ❌ Always the parent's account — not viable |

Decision: **A + C in v1**, B later if ever. The tool is registered only while Crew is enabled on the
session (token principle). Each child runs in its own git worktree/branch, with its own profile;
results come back to the lead as a short summary + branch name, never the full child transcript.

## 8. Token overhead guardrails

- The core has **no code path that calls a model** except: user messages, user-confirmed handoff
  summary (hybrid), user-confirmed Crew split. Enforced by review + a test that runs the full app
  flow on the fake provider and asserts zero unexpected `open/send` calls.
- `scripts/token-overhead.ts` (opt-in, real account): same prompt via YAAS core vs plain `claude -p`,
  compares `turn-end.usage`; must stay within a small tolerance.

## 9. Security

- Renderer sandboxed; strict CSP; no remote content; `will-navigate`/`window.open` blocked;
  links open in the default browser.
- No YAAS-held secrets on macOS (the CLI owns its keychain entries). On Windows, if S#8 confirms a
  plaintext file, use `setup-token` and keep the token in `safeStorage`, injected as
  `CLAUDE_CODE_OAUTH_TOKEN`.
- Permission rules are explicit and visible; "allow for account" requires a second confirmation.

## 10. Testing

| Level | Tool | Notes |
|---|---|---|
| Core unit | Vitest | Against `FakeProvider` — 0 tokens |
| Contract | Vitest | Real transcript fixtures (anonymised) → reader/sanitizer; CLI event fixtures → normalizer |
| IPC | Vitest | Every command schema rejects bad payloads |
| E2E | Playwright `_electron` | App launched with a temp userData (`ACAB_USER_DATA`), no real account |
| Real-account spikes | scripts | Opt-in, never in CI |

## 11. Browser

- **Model in core.** `core/browser/browserStore.ts` owns spaces, tabs and folders (SQLite,
  `spaces` / `tabs` / `folders` tables) and knows nothing of Electron. Main mirrors it; the
  renderer only sees it through `browser.state` and the `browser.changed` event (`BrowserState` =
  the snapshot plus every tab's `runtime`: loading, back/forward, `theme-color`, the view's
  `webContentsId`, `loaded` — live data, never persisted; a tab without a view gets an idle entry
  with `loaded: false`, which the sidebar dims).
- **Sections.** A space's tabs sit in `favorites` (tiles), `pinned` (top-level tabs and folders
  share one ordering; a folder orders its own tabs, one level deep) and `today` (a tree: a tab
  opened from another is its child, `parentId`, drawn under it; closing a parent hands its
  children to its own parent). `visibleOrder` is the drawn order: the next active tab after a
  close and `Ctrl+Tab` follow it. Moving into today takes an index in drawn order; leaving today
  drops the parent.
- **Close, unload, remove.** The user's close (`browser.closeTab`, `Mod+W`, an extension's
  `chrome.tabs.remove`, the tab menu) deletes a today tab but only **unloads** a favourite or
  pinned tab: the entry stays and its view is destroyed. The model often doesn't change then (a
  non-active tab), so `TabViews.sync` can't see it: `BrowserStore.closeTab` returns `'unloaded'`
  and main calls `TabViews.unload` at every call site (`closeTab` in `main/index.ts`).
  `browser.removeTab` deletes a tab whatever its section; deleting a folder deletes its tabs.
- **Undo.** Deleted tabs (a folder's tabs as one entry) go on an in-memory stack of 20
  (`core/browser/undoStack.ts`). `browser.reopenClosed` / `Mod+Shift+T` (menu accelerator, works
  over pages) puts the last one back where it was, or at the end of the active space's today when
  its space or folder is gone, and activates it. `Mod+Z` does the same from a keydown handler of
  the UI (`app/Shell.tsx`), only when no input, text area or editable element has focus; in a page
  or a field it stays the text undo.
- **Sidebar menus.** `browser.showTabMenu` / `browser.showFolderMenu` pop native menus at the
  pointer (`main/browser/sidebarMenus.ts`), so they float over the page view. Tab: Pin / Unpin
  (pinned end / today top), Add to / Remove from Favourites (favourites end / today top), Move to
  Folder ▸ (the space's folders, New Folder…), Copy Link, Duplicate, then Remove (favourite,
  pinned) or Close (today). Folder: Rename, Delete Folder. Rename (and New Folder…) emit
  `browser.shortcut` `{ kind: 'rename-folder', folderId }`: the sidebar edits the name in place.
- **Favicons.** On `page-favicon-updated` main fetches the first candidate through the tab's
  session (`session.fetch`, its cookies, 10 s timeout) and stores it as a `data:` URL
  (`core/browser/favicon.ts` `faviconDataUrl`: `image/*` only, at most 64 KB — reading stops past
  the cap — else no icon). The UI's CSP (`img-src 'self' data: crx:`) stays closed to the web. A
  newer page's icon wins over an older, slower request.
- **One view per tab.** `main/browser/tabViews.ts` gives every tab its own `WebContentsView`,
  added to the window's `contentView` above the UI. Only the active tab of the active space is
  visible. Views are `sandbox` + `contextIsolation`, no `nodeIntegration`, **no app preload; the
  session's `browser.*` mirror only**; the
  user agent is plain Chrome (`core/browser/userAgent.ts` drops the `Electron/` and `ACAB/`
  tokens). Popups, `target=_blank` and "Open Link in New Tab" become tabs in the same space
  (`deny` + `openTab` with `parentId` = the opener), never windows; `will-navigate` to a
  non-http(s) scheme is blocked.
- **Partitions.** Each space browses in its own persistent session,
  `persist:space-<spaceId>`: cookies and storage never leak between spaces.
  `main/browser/spaceSessions.ts` (`SpaceSessions.get`) sets a session up once, when the space's
  first tab view is created: user agent, permission handlers, extensions.
- **Extensions.** Chrome extensions are per space (they follow the space's sign-ins, like Arc):
  every space session gets its own `ElectronChromeExtensions` (`electron-chrome-extensions`) and
  the Chrome Web Store (`electron-chrome-web-store`, "Add to Chrome" works), with extensions
  stored under `<userData>/extensions/<spaceId>`. "Add to Chrome" asks first: a native dialog
  lists what the extension can do (`core/browser/extensionPermissions.ts`, via the store's
  `beforeInstall`), Cancel by default. Web Store update checks are off and installs are allowed
  without the dialog when `ACAB_USER_DATA` is set (tests). `TabViews` registers each tab (`addTab`), reports the shown one
  (`selectTab`) and adds the extensions' `chrome.contextMenus` items to the page menu (own group
  before Inspect). Extensions reach tabs through an `ExtensionHost` in `main/index.ts`:
  `chrome.tabs.create` and `chrome.windows.create` open a tab in the extension's space (bringing
  that space forward), never a window. Two fixes from the spike
  (`docs/spikes/2026-11-20-chrome-extensions-electron.md`): the `browserMirror` preload, registered
  for frames and service workers, copies missing `chrome.*` keys onto Electron's native
  `browser.*` (1Password needs it); and `app.on('web-contents-created')` makes `window.open` from
  any non-tab web contents of a space session (extension popups, background pages) open a tab in
  that space and deny the window (tab views, the UI and the overlay replace it with their own
  handler). The three packages stay external in the main build so they resolve their own preload
  files. E2E loads an unpacked fixture through `ACAB_TEST_EXTENSION` (no network).
- **Ad blocker.** Built in and on by default (spec §8): Ghostery's engine
  (`@ghostery/adblocker-electron`, `main/browser/adBlocker.ts`) blocks ads and trackers in every
  space session. It loads once at startup without holding up the window
  (`fromPrebuiltAdsAndTracking`, serialized to `<userData>/adblock-engine.bin`). The cache is used
  while under 7 days old (`isCacheStale` in `core/browser/adblock.ts`); an older one makes the
  launch download the lists again, falling back to the old cache when offline. A cache that can't
  be written is logged, the fresh engine is kept. Lists refresh only at launch. `SpaceSessions`
  enables it on the sessions set up before it arrives and on every later one; a blocker error is
  logged and never stops a space being set up. If loading fails (offline on first launch) it logs
  and the app browses without it (`loadEngine`). Ghostery registers two global `ipcMain`
  handlers per enabled session (a second registration throws), so `AdBlocker` drops them before
  each enable and restores them on disable while another session still blocks; the two-space e2e
  covers it. Settings: `adBlock: { enabled, allowedHosts }`. The per-site toggle
  adds exception filters to the engine in place (`updateFromDiff`): `@@*$domain=<host>` (every
  request made by the host's pages) and `@@||<host>^$elemhide` (their element hiding) — Ghostery's
  `$document` only matches the page request itself. Ghostery matches the page by the request's
  referrer, so a page sent with `no-referrer` is still filtered. When a host is allowed or no
  longer allowed, main reloads the tabs showing it. Ghostery's cosmetic preload is a second script
  on space sessions; it talks to main over two `ipcMain` handlers and exposes nothing to pages.
  E2E loads a local list through `ACAB_ADBLOCK_FILTERS`; with `ACAB_USER_DATA` set and no list, the
  blocker is skipped (never a download in tests).
- **Permissions.** Every space session denies page permissions except
  `clipboard-sanitized-write`, `fullscreen` and `pointerLock` (`core/browser/permissions.ts`):
  no camera, microphone, location, notifications or `openExternal` until a per-site prompt exists.
- **Memory.** A view lives until its tab closes or is unloaded, even hidden (other space,
  inactive tab): memory grows with visited tabs. Eviction of idle views is for a later plan.
- **Bounds from the renderer.** The UI lays out the page area and sends it with
  `browser.setPageBounds` (DIP); `browser.setPageVisible` hides the page under overlays. The view
  has a `PAGE_RADIUS` corner radius that must equal `--radius-lg`.
- **Window controls.** `window.setControlsVisible({ visible })` shows or hides the macOS traffic
  lights (the main window; a no-op on Windows and Linux): the UI hides them in icon-only mode.
- **Lazy loading.** A view is created the first time its tab is active, so restored and
  unloaded tabs don't load until visited; closing or unloading a tab destroys its view
  (`webContents.close()`).
- **Commands:** `browser.openTab` / `closeTab` / `removeTab` / `moveTab` / `activateTab` /
  `navigate` / `goBack` / `goForward` / `reload` / `createSpace` / `activateSpace` /
  `createFolder` / `renameFolder` / `setFolderCollapsed` / `deleteFolder` / `reopenClosed` /
  `showTabMenu` / `showFolderMenu` / `setPageBounds` / `setPageVisible`.
  Address-bar text goes through `shared/url.ts` `resolveInput` (URL or search).
- **Overlay.** `main/browser/overlayView.ts` is one transparent `WebContentsView` over the whole
  window (content size, kept in sync on resize), always above the tab views (raised again each
  time a tab view is added), so UI popovers can float over the page. It loads the same renderer
  under `#overlay` with the app preload; `App` then renders only `Overlay` on a transparent body.
  It is **hidden** until `overlay.open({ kind, anchor })` (anchor = the button's rect, window DIP;
  none for the centred cards),
  then shown, focused (Escape reaches it) and sent `overlay.opened`; Escape, a click on its empty
  area or a chosen item call `overlay.close`, which hides it, hands the keyboard back to the UI and
  sends `overlay.closed` to the UI (the button resets) and to the overlay (it drops the popover).
  It is a **trusted sender** exactly like the
  UI window (nothing else is) and also receives `settings.changed` and `browser.changed`. Actions
  that belong to the UI go through main: `ui.openSettings` / `ui.focusAddress` /
  `ui.renameFolder` emit `browser.shortcut` (`{ kind: 'settings' }` / `{ kind: 'focus-address' }` /
  `{ kind: 'rename-folder', folderId }`) to the UI; these shortcuts (and ⌘L, ⌘,) close an open
  overlay first, so its card never stays drawn over the field that takes the keyboard. Kinds: `new-menu` (the + menu, opens upward),
  `site-menu` (the address bar's menu, opens downward), and the centred cards `tab-finder` (`Mod+K`,
  the sidebar's Search) and `command` (`Mod+T`). Their menu items emit `browser.shortcut`
  `{ kind: 'tab-finder' }` / `{ kind: 'command' }`, and the UI opens the overlay: a tab is created
  only when the command field is submitted (`browser.openTab { input }`).
- **Overlay modes.** The overlay is either a **popover** (above: the whole window, focused) or a
  **tooltip** strip. `overlay.tooltip({ anchor, title, detail })` (from the sidebar: a tab row's
  or favourite tile's height, across to the sidebar's right edge) shows the view as a strip
  `TOOLTIP_STRIP_W` (320) wide from the anchor's right edge, full height, clamped to the window
  (`tooltipBounds`), **never focused**, and forwards the tooltip to the overlay with the
  `overlay.tooltip` event; the overlay draws one card that slides from row to row.
  `overlay.tooltip(null)` from the UI sends `null` (the card fades) and hides the strip
  `TOOLTIP_FADE_MS` (150) later unless a tooltip or popover came meanwhile; from the overlay itself
  (sent on a `pointermove`: the pointer is on the strip) it hides at once, so the page under it gets
  the next click. A tooltip is ignored while a popover is open, and `overlay.open` replaces any
  tooltip (the overlay drops it on `overlay.opened`): a menu always wins. A window resize drops the
  tooltip.
