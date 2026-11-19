// Placeholder content so the skeleton shows the layout. Replaced by real accounts/sessions later.
import { Briefcase, House, type LucideIcon } from 'lucide-react'
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
  icon: LucideIcon
  environments: DemoEnvironment[]
  usage: { fiveHour: number; sevenDay: number }
}

export const CONTEXT_LIMIT = 200_000

export const DEMO_SPACES: DemoSpace[] = [
  {
    id: 'work',
    label: 'Work',
    icon: Briefcase,
    usage: { fiveHour: 0.57, sevenDay: 0.53 },
    environments: [
      {
        id: 'app',
        name: 'app',
        path: '~/work/app',
        pinned: true,
        sessions: [
          {
            id: 'w1',
            title: 'Release notes',
            status: 'running',
            pinned: true,
            contextTokens: 38_400,
          },
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
          { id: 'w2', title: 'Infra', status: 'done', pinned: true, contextTokens: 12_000 },
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
    icon: House,
    usage: { fiveHour: 0.12, sevenDay: 0.31 },
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
