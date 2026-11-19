// Placeholder content so the skeleton shows the layout. Replaced by real accounts/sessions later.
import type { SessionStatus } from '@shared/model'

export interface DemoSession {
  id: string
  title: string
  status: SessionStatus
  pinned?: boolean
  /** Tokens currently in the context window (demo). */
  contextTokens: number
}

export interface DemoEnvironment {
  id: string
  name: string
  path: string
  pinned: boolean
  sessions: DemoSession[]
}

export interface DemoSpace {
  id: string
  label: string
  emoji: string
  environments: DemoEnvironment[]
  usage: { session: DemoUsage; week: DemoUsage }
}

export interface DemoUsage {
  utilization: number
  minutesLeft: number
}

export const CONTEXT_LIMIT = 200_000

export const DEMO_SPACES: DemoSpace[] = [
  {
    id: 'work',
    label: 'Work',
    emoji: '💼',
    usage: {
      session: { utilization: 0.45, minutesLeft: 3 * 60 + 11 },
      week: { utilization: 0.61, minutesLeft: 23 * 60 + 41 },
    },
    environments: [
      {
        id: 'app',
        name: 'app',
        path: '~/work/app',
        pinned: true,
        sessions: [
          {
            id: 'w3',
            title: 'Fix login redirect',
            status: 'needs-approval',
            contextTokens: 42_100,
          },
          { id: 'w4', title: 'Refactor billing', status: 'error', contextTokens: 171_000 },
        ],
      },
      {
        id: 'website',
        name: 'website',
        path: '~/work/website',
        pinned: false,
        sessions: [
          {
            id: 'w1',
            title: 'Release notes',
            status: 'running',
            pinned: true,
            contextTokens: 38_400,
          },
          { id: 'w2', title: 'Infra', status: 'done', contextTokens: 12_000 },
          { id: 'w6', title: 'Landing copy', status: 'idle', contextTokens: 8_300 },
        ],
      },
      {
        id: 'scripts',
        name: 'infra-scripts',
        path: '~/work/infra-scripts',
        pinned: false,
        sessions: [{ id: 'w5', title: 'Write tests', status: 'done', contextTokens: 64_000 }],
      },
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    emoji: '🏠',
    usage: {
      session: { utilization: 0.12, minutesLeft: 4 * 60 + 2 },
      week: { utilization: 0.88, minutesLeft: 3 * 24 * 60 + 5 * 60 },
    },
    environments: [
      {
        id: 'blog',
        name: 'blog',
        path: '~/perso/blog',
        pinned: true,
        sessions: [{ id: 'p1', title: 'Blog redesign', status: 'limited', contextTokens: 91_000 }],
      },
    ],
  },
]

export function findSession(sessionId: string | null) {
  for (const space of DEMO_SPACES) {
    for (const environment of space.environments) {
      const session = environment.sessions.find((s) => s.id === sessionId)
      if (session) return { space, environment, session }
    }
  }
  return null
}

const appStart = Date.now()

/** Demo usage as absolute reset dates (computed once per app start). */
export function usageView(space: DemoSpace) {
  const at = (u: DemoUsage) => ({
    utilization: u.utilization,
    resetsAt: new Date(appStart + u.minutesLeft * 60_000),
  })
  return { session: at(space.usage.session), week: at(space.usage.week) }
}
