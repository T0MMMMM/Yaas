import { describe, expect, it } from 'vitest'
import type { DemoSpace } from './demoData'
import { CONTEXT_LIMIT, openSession, sidebarTree, usageView } from './workspace'

const session = (id: string, pinned = false) => ({
  id,
  title: id,
  status: 'idle' as const,
  pinned,
  contextTokens: 1_000,
})

const space: DemoSpace = {
  id: 'work',
  label: 'Work',
  emoji: '💼',
  usage: {
    session: { utilization: 0.4, minutesLeft: 60 },
    week: { utilization: 0.6, minutesLeft: 120 },
  },
  environments: [
    {
      id: 'app',
      name: 'app',
      path: '~/app',
      pinned: true,
      sessions: [session('a1'), session('a2', true)],
    },
    {
      id: 'web',
      name: 'web',
      path: '~/web',
      pinned: false,
      sessions: [session('w1', true), session('w2')],
    },
  ],
}

describe('sidebarTree', () => {
  const tree = sidebarTree(space)

  it('puts pinned environments above the separator with all their sessions', () => {
    const first = tree.pinned[0]
    expect(first?.kind).toBe('environment')
    if (first?.kind === 'environment') {
      expect(first.environment.sessions.map((s) => s.id)).toEqual(['a1', 'a2'])
    }
  })

  it('moves pinned sessions of unpinned environments out of their folder', () => {
    expect(
      tree.pinned
        .filter((p) => p.kind === 'session')
        .map((p) => p.kind === 'session' && p.session.id),
    ).toEqual(['w1'])
    expect(tree.environments.map((e) => e.id)).toEqual(['web'])
    expect(tree.environments[0]?.sessions.map((s) => s.id)).toEqual(['w2'])
  })
})

describe('openSession', () => {
  it('finds a session of the space with its full environment', () => {
    const open = openSession(space, 'w1')
    expect(open?.environment.sessions.map((s) => s.id)).toEqual(['w1', 'w2'])
    expect(open?.session.contextLimit).toBe(CONTEXT_LIMIT)
  })

  it('returns null for no session or a session of another space', () => {
    expect(openSession(space, null)).toBeNull()
    expect(openSession(space, 'elsewhere')).toBeNull()
  })
})

describe('usageView', () => {
  it('turns minutes left into absolute reset dates', () => {
    const usage = usageView(space, 0)
    expect(usage.session.resetsAt.getTime()).toBe(60 * 60_000)
    expect(usage.week).toEqual({ utilization: 0.6, resetsAt: new Date(120 * 60_000) })
  })
})
