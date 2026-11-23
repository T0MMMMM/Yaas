// The "offset ink" icon set (generated once from sandbox/icons/build.py, 2026-11-23); edit here.
import type { ReactNode } from 'react'

export type IconTint = 'sage' | 'coral' | 'sky' | 'butter' | 'lilac' | 'teal'

export const ICONS = {
  general: {
    tint: 'sage',
    shape: (
      <>
        <circle cx="15.5" cy="8.5" r="3.2" />
        <circle cx="10.5" cy="13.5" r="3.2" />
      </>
    ),
    ink: (
      <>
        <path d="M4 7h8M16 7h4M4 12h3M11 12h9M4 17h9M17 17h3" />
        <circle cx="14" cy="7" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="15" cy="17" r="2" />
      </>
    ),
  },
  field: {
    tint: 'butter',
    shape: (
      <>
        <rect x="5" y="10" width="17" height="8" rx="4" />
      </>
    ),
    ink: (
      <>
        <rect x="3" y="8" width="17" height="8" rx="4" />
        <path d="M7.5 10.5v3" />
      </>
    ),
  },
  appearance: {
    tint: 'coral',
    shape: (
      <>
        <path d="M13.5 5.5a8 8 0 0 1 0 16z" />
      </>
    ),
    ink: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4v16" />
      </>
    ),
  },
  websites: {
    tint: 'sky',
    shape: (
      <>
        <circle cx="13.5" cy="13.5" r="8" />
      </>
    ),
    ink: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16" />
        <path d="M12 4c2.4 2.2 3.4 5 3.4 8s-1 5.8-3.4 8c-2.4-2.2-3.4-5-3.4-8s1-5.8 3.4-8z" />
      </>
    ),
  },
  tabs: {
    tint: 'teal',
    shape: (
      <>
        <rect x="6.5" y="8.5" width="13" height="3.2" rx="1.6" />
      </>
    ),
    ink: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3.5" />
        <path d="M8 8.5h8M8 12.2h8M8 15.8h5" />
      </>
    ),
  },
  spaces: {
    tint: 'sage',
    shape: (
      <>
        <rect x="6.5" y="10.5" width="14" height="10" rx="3" />
      </>
    ),
    ink: (
      <>
        <rect x="5" y="9" width="14" height="10" rx="3" />
        <path d="M7 6.2h10M9.5 3.6h5" />
      </>
    ),
  },
  shortcuts: {
    tint: 'butter',
    shape: (
      <>
        <rect x="5.5" y="6.5" width="16" height="14" rx="3.5" />
      </>
    ),
    ink: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="3.5" />
        <path d="M8 15h8" />
        <path d="M8.5 9.5h.01M12 9.5h.01M15.5 9.5h.01" strokeWidth="2.2" />
      </>
    ),
  },
  privacy: {
    tint: 'sky',
    shape: (
      <>
        <path d="M13.5 5l7 2.8V13c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V7.8z" />
      </>
    ),
    ink: (
      <>
        <path d="M12 3.5l7 2.8v5.2c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6.3z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  extensions: {
    tint: 'lilac',
    shape: (
      <>
        <circle cx="12" cy="8.2" r="3" />
        <circle cx="18.2" cy="15.2" r="3" />
      </>
    ),
    ink: (
      <>
        <path d="M5 8h3.5a2 2 0 1 1 4 0H16v3.5a2 2 0 1 1 0 4V19H5z" />
      </>
    ),
  },
  developers: {
    tint: 'coral',
    shape: (
      <>
        <rect x="8.5" y="10" width="9.5" height="7.5" rx="3.75" />
      </>
    ),
    ink: (
      <>
        <path d="M9 8l-4 4 4 4M15 8l4 4-4 4M13.2 6l-2.4 12" />
      </>
    ),
  },
  ai: {
    tint: 'lilac',
    shape: (
      <>
        <path d="M13.5 5.5c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6z" />
      </>
    ),
    ink: (
      <>
        <path d="M12 4c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6z" />
        <path d="M18.5 16v4M16.5 18h4" />
      </>
    ),
  },
  boosts: {
    tint: 'butter',
    shape: (
      <>
        <circle cx="17" cy="8.5" r="3.6" />
      </>
    ),
    ink: (
      <>
        <path d="M5 19L14.5 9.5M15.5 4.5v2.2M19.5 8.5h-2.2M18.4 5.6l-1.5 1.5" />
        <path d="M13 11l-1.5-1.5" />
      </>
    ),
  },
  snippets: {
    tint: 'butter',
    shape: (
      <>
        <rect x="5.5" y="6.5" width="16" height="14" rx="3" />
      </>
    ),
    ink: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <path d="M8 10h5M8 14h8" />
        <path d="M16.5 9.2v.01" strokeWidth="2.2" />
      </>
    ),
  },
  sync: {
    tint: 'sky',
    shape: (
      <>
        <circle cx="13.5" cy="13.5" r="6" />
      </>
    ),
    ink: (
      <>
        <path d="M18.5 9A7 7 0 0 0 6 8M5.5 15a7 7 0 0 0 12.5 1" />
        <path d="M18.5 4.5V9H14M5.5 19.5V15H10" />
      </>
    ),
  },
  downloads: {
    tint: 'sage',
    shape: (
      <>
        <rect x="6.5" y="16.5" width="14" height="4.5" rx="2.25" />
      </>
    ),
    ink: (
      <>
        <path d="M12 4v10M8 10l4 4 4-4M5 19h14" />
      </>
    ),
  },
  passwords: {
    tint: 'butter',
    shape: (
      <>
        <circle cx="10" cy="13.5" r="3.6" />
      </>
    ),
    ink: (
      <>
        <circle cx="8.5" cy="12" r="3.5" />
        <path d="M12 12h8M17 12v3M20 12v2" />
      </>
    ),
  },
  folder: {
    tint: 'teal',
    shape: (
      <>
        <path d="M5.5 9A1.5 1.5 0 0 1 7 7.5h4.5l2 2H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 20.5H7A1.5 1.5 0 0 1 5.5 19z" />
      </>
    ),
    ink: (
      <>
        <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
      </>
    ),
  },
  'live-folder': {
    tint: 'coral',
    shape: (
      <>
        <path d="M5.5 9A1.5 1.5 0 0 1 7 7.5h4.5l2 2H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 20.5H7A1.5 1.5 0 0 1 5.5 19z" />
      </>
    ),
    ink: (
      <>
        <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
        <path d="M7 14h2.3l1.5-2.5 2 4 1.4-1.5H17" />
      </>
    ),
  },
  experimental: {
    tint: 'sage',
    shape: (
      <>
        <path d="M8.6 14.5h7.8l2.6 4.6a1 1 0 0 1-.9 1.4H7a1 1 0 0 1-.9-1.4z" />
      </>
    ),
    ink: (
      <>
        <path d="M9.5 4h5M10.5 4v5.5L6 17.5a1.5 1.5 0 0 0 1.3 2.2h9.4a1.5 1.5 0 0 0 1.3-2.2L13.5 9.5V4" />
      </>
    ),
  },
  'split-view': {
    tint: 'sky',
    shape: (
      <>
        <rect x="12.5" y="6.5" width="9" height="14" rx="3" />
      </>
    ),
    ink: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <path d="M12 5v14" />
      </>
    ),
  },
  'new-tab': {
    tint: 'teal',
    shape: (
      <>
        <rect x="5.5" y="5.5" width="16" height="16" rx="4" />
      </>
    ),
    ink: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="M12 8.5v7M8.5 12h7" />
      </>
    ),
  },
  search: {
    tint: 'butter',
    shape: (
      <>
        <circle cx="12.5" cy="12.5" r="6" />
      </>
    ),
    ink: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="M15.5 15.5L20 20" />
      </>
    ),
  },
  share: {
    tint: 'sky',
    shape: (
      <>
        <rect x="6.5" y="12.5" width="14" height="9" rx="1.8" />
      </>
    ),
    ink: (
      <>
        <path d="M12 4v10M8.5 7.5L12 4l3.5 3.5" />
        <path d="M7.5 11h-1A1.5 1.5 0 0 0 5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 17.5 11h-1" />
      </>
    ),
  },
  capture: {
    tint: 'coral',
    shape: (
      <>
        <circle cx="13.5" cy="14.5" r="3.2" />
      </>
    ),
    ink: (
      <>
        <rect x="4" y="7" width="16" height="12" rx="3" />
        <path d="M9 7l1.2-2h3.6L15 7" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
  },
  reading: {
    tint: 'lilac',
    shape: (
      <>
        <path d="M13.5 8.5c2-1.5 4.5-2 8-2v12c-3.5 0-6 .5-8 2z" />
      </>
    ),
    ink: (
      <>
        <path d="M12 7c-2-1.5-4.5-2-8-2v12c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V5c-3.5 0-6 .5-8 2zM12 7v12" />
      </>
    ),
  },
  'hide-element': {
    tint: 'coral',
    shape: (
      <>
        <circle cx="13.6" cy="13.6" r="3" />
      </>
    ),
    ink: (
      <>
        <path d="M3.5 12S6.5 6 12 6s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6z" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M5 19L19 5" />
      </>
    ),
  },
  pip: {
    tint: 'sky',
    shape: (
      <>
        <rect x="12.5" y="12" width="7" height="5.5" rx="1.5" />
      </>
    ),
    ink: (
      <>
        <rect x="3.5" y="5" width="17" height="14" rx="3" />
        <rect x="11" y="10.5" width="7" height="5.5" rx="1.5" />
      </>
    ),
  },
  feedback: {
    tint: 'butter',
    shape: (
      <>
        <path d="M8 6.5h11a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-5.5L9 21v-3.5H8A2.5 2.5 0 0 1 5.5 15V9A2.5 2.5 0 0 1 8 6.5z" />
      </>
    ),
    ink: (
      <>
        <path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v6a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 3.5V16h-1A2.5 2.5 0 0 1 4 13.5v-6A2.5 2.5 0 0 1 6.5 5z" />
      </>
    ),
  },
  community: {
    tint: 'coral',
    shape: (
      <>
        <circle cx="10.5" cy="10.5" r="3" />
      </>
    ),
    ink: (
      <>
        <circle cx="9" cy="9" r="3" />
        <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
        <circle cx="16.5" cy="8.5" r="2.5" />
        <path d="M16.5 13.5c2.4 0 4 1.8 4 4.5" />
      </>
    ),
  },
  about: {
    tint: 'teal',
    shape: (
      <>
        <circle cx="13.5" cy="13.5" r="8" />
      </>
    ),
    ink: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" strokeWidth="2.2" />
      </>
    ),
  },
} as const satisfies Record<string, { tint: IconTint; shape: ReactNode; ink: ReactNode }>

export type IconName = keyof typeof ICONS
