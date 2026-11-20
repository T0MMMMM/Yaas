import { describe, expect, it } from 'vitest'
import type { BrowserState } from '@shared/ipc/contract'
import type { BrowserTab } from '@shared/model'
import type { DemoSpace } from './demoData'
import { browserView, CONTEXT_LIMIT, openSession, sidebarTree, usageView } from './workspace'

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

const tab = (id: string, spaceId: string, position: number, url = `https://${id}.test/`) =>
  ({ id, spaceId, url, title: id, faviconUrl: null, position }) satisfies BrowserTab

const browser: BrowserState = {
  spaces: [
    { id: 's1', name: 'Personal', color: '#7C5CFF', position: 0 },
    { id: 's2', name: 'Work', color: '#2BB673', position: 1 },
  ],
  activeSpaceId: 's1',
  // By space then position, as main sends them.
  tabs: [
    tab('a', 's1', 0),
    tab('b', 's1', 1, 'https://www.example.com/docs?q=1'),
    tab('c', 's1', 2),
    tab('x', 's2', 0),
  ],
  activeTabIds: { s1: 'b', s2: 'x' },
  runtime: {
    b: {
      loading: true,
      canGoBack: true,
      canGoForward: false,
      themeColor: '#123456',
      webContentsId: 7,
    },
  },
}

describe('browserView', () => {
  it("browserView lists the active space's tabs in order", () => {
    const view = browserView(browser)
    expect(view.space).toEqual({ id: 's1', label: 'Personal', color: '#7C5CFF' })
    expect(view.spaces.map((s) => s.label)).toEqual(['Personal', 'Work'])
    expect(view.tabs.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('browserView picks the active tab and its runtime', () => {
    expect(browserView(browser).activeTab).toEqual({
      id: 'b',
      title: 'b',
      url: 'https://www.example.com/docs?q=1',
      faviconUrl: null,
      host: 'example.com',
      rest: '/docs?q=1',
      loading: true,
      canGoBack: true,
      canGoForward: false,
      themeColor: '#123456',
      webContentsId: 7,
      loaded: true,
    })
  })

  it('browserView marks tabs without runtime as not loaded', () => {
    const view = browserView(browser)
    expect(view.tabs.map((t) => [t.id, t.loaded])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
    ])
  })

  it('browserView falls back to empty runtime for an unloaded tab', () => {
    const view = browserView({ ...browser, activeSpaceId: 's2' })
    expect(view.activeTab).toMatchObject({
      id: 'x',
      loading: false,
      canGoBack: false,
      canGoForward: false,
      themeColor: null,
      webContentsId: null,
    })
  })

  it('browserView names an untitled tab after its host, else "New tab"', () => {
    const untitled: BrowserState = {
      ...browser,
      tabs: [
        { ...tab('a', 's1', 0), title: '' },
        { ...tab('b', 's1', 1, 'about:blank'), title: '' },
      ],
    }
    expect(browserView(untitled).tabs.map((t) => t.title)).toEqual(['a.test', 'New tab'])
  })

  it('browserView has no active tab in an empty space', () => {
    const empty = browserView({ ...browser, tabs: [], activeTabIds: { s1: null, s2: null } })
    expect(empty.tabs).toEqual([])
    expect(empty.activeTab).toBeNull()
  })
})
