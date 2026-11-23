# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner first: a developer who lives in the browser all day on macOS and Windows and wants to
leave Arc (and yab) for a browser of his own. He compares pages side by side, keeps many tabs
organised in spaces, pinned tabs and folders, and uses Claude Code daily. Later: people who want a
browser they can reshape with their own AI.

## Product Purpose

Big Browser is an Electron desktop web browser (macOS + Windows) in an Arc-style layout that you
customize with your own AI. Step 1 makes it a daily driver: spaces, pinned/today tabs, folders,
favourites, a command dock, drawn menus, split screen, downloads, extensions (1Password), ad
blocking, default browser. Later steps add removable feature modules, a workshop, and AI tabs
(Claude Code sessions, the former YAAS scope). Success: the owner uses it instead of Arc every day.

## Positioning

A real browser whose features are modules your own AI (on your own account) can edit or remove,
with near-zero token overhead: nothing ever calls a model without an explicit click.

## Operating Context

Used all day, full screen, next to an editor and terminals; long sessions with dozens of tabs
across several spaces; keyboard shortcuts (⌘T dock, ⌘K finder, ⌘L, ⌃⌘\ split) as much as the mouse.

## Capabilities and Constraints

- Electron 45, React 19 + Zustand, CSS Modules with design tokens only (`tokens.css`), Vitest and
  Playwright; IPC through one zod contract; menus and cards drawn in an overlay view above the
  native page views (no native menus); security defaults stay on.
- Pages are native `WebContentsView`s: the UI cannot draw over a page except through the overlay.
- Everything personal (history, downloads) stays local in SQLite.
- Never a code path that calls a model without an explicit user action.

## Brand Commitments

- Name: Big Browser (renamed from ACAB, ADR-0007). Open source.
- Visual references the owner made binding: **Ardia** (leads) and **yab** — take their whole UI
  look, not their exact UX; rethink every animation. Opaque menus, no glass/blur on menus.
- English UI strings.

## Evidence on Hand

Reference clones of Ardia (GPL-3/Apache) and yab (Apache-2.0) for visual study only; no code is
copied from Ardia. No testimonials, users or metrics exist; do not invent any.

## Product Principles

1. The page is the hero: chrome recedes, the content runs as large as the window allows.
2. Keyboard-first and fast: every action is a shortcut or a click away, never behind a wait.
3. Motion explains, never delays: an action happens first, its animation follows.
4. Local and private by default: nothing leaves the machine without the user asking.
5. Reshapable: every feature is a module the user's AI can change.
