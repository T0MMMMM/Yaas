// Placeholder content so the skeleton shows the layout. Replaced by real accounts/sessions later.
import type { SessionStatus } from '@shared/model'

export interface DemoSpace {
  id: string
  label: string
  emoji: string
  sessions: Array<{ id: string; title: string; status: SessionStatus; pinned?: boolean }>
  usage: { fiveHour: number; sevenDay: number }
}

export const DEMO_SPACES: DemoSpace[] = [
  {
    id: 'work',
    label: 'Work',
    emoji: '💼',
    usage: { fiveHour: 0.57, sevenDay: 0.53 },
    sessions: [
      { id: 'w1', title: 'Release notes', status: 'running', pinned: true },
      { id: 'w2', title: 'Infra', status: 'done', pinned: true },
      { id: 'w3', title: 'Fix login redirect', status: 'needs-approval' },
      { id: 'w4', title: 'Refactor billing', status: 'error' },
      { id: 'w5', title: 'Write tests', status: 'idle' },
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    emoji: '🏠',
    usage: { fiveHour: 0.12, sevenDay: 0.31 },
    sessions: [{ id: 'p1', title: 'Blog redesign', status: 'limited' }],
  },
]
