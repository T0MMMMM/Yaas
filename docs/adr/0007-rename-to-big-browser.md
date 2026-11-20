# ADR-0007 — Rename: ACAB becomes Big Browser

- **Status:** Accepted (2026-11-20)
- **Amends:** [ADR-0006](0006-pivot-to-big-browser.md) (the product name only)

## Context

The browser decided in ADR-0006 was named ACAB ("AI Custom Another Browser"). The owner renamed it
**Big Browser** the same day, before any release.

## Decision

- The product name is **Big Browser** everywhere: UI, window title, menus, docs, packaging
  (`productName: Big Browser`, `appId: dev.bigbrowser.app`, npm name `big-browser`).
- Code identifiers follow: the preload bridge is `window.bigBrowser` (`BigBrowserBridge`),
  environment variables are `BIG_BROWSER_*`, the database file is `big-browser.db`.
- Existing data is kept: on the first launch under the new name, the former data folder
  (`<appData>/ACAB`) is moved into Big Browser's and `acab.db` is renamed
  (`src/core/store/legacyData.ts`). Claude account folders (ADR-0002) live outside it and never move.
- Doc and plan files named after ACAB are renamed; their content keeps historical facts (commits,
  the former name) where they describe the past.

## Alternatives considered

- **Keep the data folder named ACAB** (`app.setPath('userData', …/ACAB)`) — rejected: the old name
  would stay visible on disk forever.
- **Start with fresh data** — rejected: the owner would lose spaces, tabs and sign-ins.

## Consequences

- A changed `appId` makes macOS treat the packaged app as a new app (permissions asked again).
  Acceptable before the first release.
- The one-time move is a no-op on fresh installs and once Big Browser has its own database.
