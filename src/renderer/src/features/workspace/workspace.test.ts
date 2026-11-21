import { describe, expect, it } from 'vitest'
import type { BrowserState } from '@shared/ipc/contract'
import type { BrowserFolder, BrowserTab } from '@shared/model'
import type { DemoSpace } from './demoData'
import {
  browserView,
  CONTEXT_LIMIT,
  openSession,
  recentFirst,
  sidebarSections,
  sidebarTree,
  todayCloseOrder,
  todaySubtree,
  usageView,
  MAX_FOLDER_INDENT,
  type SidebarNode,
} from './workspace'

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
  ({
    id,
    spaceId,
    url,
    title: id,
    faviconUrl: null,
    position,
    section: 'today',
    folderId: null,
    parentId: null,
    lastActiveAt: null,
    splitOf: null,
    splitRatio: null,
  }) satisfies BrowserTab

const browser: BrowserState = {
  spaces: [
    {
      id: 's1',
      name: 'Personal',
      color: '#7C5CFF',
      position: 0,
      icon: null,
      sectionCollapsed: false,
    },
    { id: 's2', name: 'Work', color: '#2BB673', position: 1, icon: null, sectionCollapsed: false },
  ],
  activeSpaceId: 's1',
  // By space then position, as main sends them.
  tabs: [
    tab('a', 's1', 0),
    tab('b', 's1', 1, 'https://www.example.com/docs?q=1'),
    tab('c', 's1', 2),
    tab('x', 's2', 0),
  ],
  folders: [],
  activeTabIds: { s1: 'b', s2: 'x' },
  runtime: {
    b: {
      loading: true,
      canGoBack: true,
      canGoForward: false,
      themeColor: '#123456',
      webContentsId: 7,
      loaded: true,
    },
    c: {
      loading: false,
      canGoBack: false,
      canGoForward: false,
      themeColor: null,
      webContentsId: null,
      loaded: false,
    },
  },
}

describe('browserView', () => {
  it("browserView lists the active space's tabs in order", () => {
    const view = browserView(browser)
    expect(view.space).toEqual({
      id: 's1',
      label: 'Personal',
      color: '#7C5CFF',
      icon: null,
      sectionCollapsed: false,
    })
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
      siteHost: 'www.example.com',
      connection: 'secure',
      loading: true,
      canGoBack: true,
      canGoForward: false,
      themeColor: '#123456',
      webContentsId: 7,
      loaded: true,
      folderId: null,
      lastActiveAt: null,
    })
  })

  it('browserView marks tabs without a view as not loaded', () => {
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

  it('browserView gives web pages a site host and a connection, other pages neither', () => {
    const pages: BrowserState = {
      ...browser,
      tabs: [tab('a', 's1', 0, 'http://127.0.0.1:8080/a'), tab('b', 's1', 1, 'about:blank')],
    }
    expect(browserView(pages).tabs.map((t) => [t.siteHost, t.connection])).toEqual([
      ['127.0.0.1', 'not-secure'],
      [null, null],
    ])
  })

  it('browserView lists every space’s tabs, space by space in drawn order, with their space', () => {
    const view = browserView(browser)
    expect(view.allTabs.map((t) => [t.id, t.space.label])).toEqual([
      ['a', 'Personal'],
      ['b', 'Personal'],
      ['c', 'Personal'],
      ['x', 'Work'],
    ])
    expect(view.allTabs.find((t) => t.id === 'b')).toMatchObject({ loading: true, title: 'b' })
  })

  it('browserView knows every open tab of every space, so a moved row is told from a closed one', () => {
    const view = browserView(browser)
    expect([...view.openTabIds].sort()).toEqual(['a', 'b', 'c', 'x'])
  })

  it('browserView has no active tab in an empty space', () => {
    const empty = browserView({ ...browser, tabs: [], activeTabIds: { s1: null, s2: null } })
    expect(empty.tabs).toEqual([])
    expect(empty.activeTab).toBeNull()
  })
})

// ---------- sidebar sections ----------

const at = (
  id: string,
  position: number,
  extra: Partial<BrowserTab> = {},
  url = `https://${id}.test/`,
): BrowserTab => ({ ...tab(id, 's1', position, url), ...extra })

const folder = (
  id: string,
  position: number,
  collapsed = false,
  parentId: string | null = null,
): BrowserFolder => ({
  id,
  spaceId: 's1',
  name: id,
  position,
  collapsed,
  parentId,
  icon: null,
})

const stateOf = (tabs: BrowserTab[], folders: BrowserFolder[] = []): BrowserState => ({
  ...browser,
  tabs: [...tabs, tab('x', 's2', 0)],
  folders,
  runtime: {},
})

/** A node as a short readable shape: tab id with its depth, or a folder with its children. */
type Shape = string | { [name: string]: Shape[] }
const shape = (node: SidebarNode): Shape => {
  if (node.kind === 'tab') return `${node.tab.id}@${node.depth}`
  if (node.kind === 'split') return `${node.first.id}+${node.second.id}@${node.depth}`
  const name = node.kind === 'folder' ? node.folder.id : `auto:${node.host}`
  return { [name]: node.children.map(shape) }
}

describe('sidebarSections', () => {
  const on = { autoFolders: true }

  it('lists the favourites by position, then pinned and today', () => {
    const sections = sidebarSections(
      stateOf([
        at('t1', 0),
        at('f2', 1, { section: 'favorites' }),
        at('f1', 0, { section: 'favorites' }),
        at('p1', 0, { section: 'pinned' }),
      ]),
      's1',
      on,
    )
    expect(sections.favorites.map((t) => t.id)).toEqual(['f1', 'f2'])
    expect(sections.pinned.map(shape)).toEqual(['p1@0'])
    expect(sections.today.map(shape)).toEqual(['t1@0'])
  })

  it("orders folders and pinned tabs by their shared position, each folder's tabs in order", () => {
    const sections = sidebarSections(
      stateOf(
        [
          at('p1', 0, { section: 'pinned' }),
          at('in2', 1, { section: 'pinned', folderId: 'fo' }),
          at('in1', 0, { section: 'pinned', folderId: 'fo' }),
          at('p2', 2, { section: 'pinned' }),
        ],
        [folder('fo', 1)],
      ),
      's1',
      on,
    )
    expect(sections.pinned.map(shape)).toEqual(['p1@0', { fo: ['in1@0', 'in2@0'] }, 'p2@0'])
  })

  it('nests a folder in a folder, with its depth', () => {
    const sections = sidebarSections(
      stateOf(
        [
          at('in1', 0, { section: 'pinned', folderId: 'outer' }),
          at('deep', 0, { section: 'pinned', folderId: 'inner' }),
          at('p1', 1, { section: 'pinned' }),
        ],
        [folder('outer', 0), folder('inner', 1, false, 'outer')],
      ),
      's1',
      on,
    )
    expect(sections.pinned.map(shape)).toEqual([
      { outer: ['in1@0', { inner: ['deep@0'] }] },
      'p1@0',
    ])
    const outer = sections.pinned[0]
    const inner = outer?.kind === 'folder' ? outer.children[1] : undefined
    expect(outer).toMatchObject({ kind: 'folder', depth: 0 })
    expect(inner).toMatchObject({ kind: 'folder', depth: 1 })
  })

  it(`indents nested folders at most ${MAX_FOLDER_INDENT} levels`, () => {
    const chain = Array.from({ length: 7 }, (_, i) =>
      folder(`f${i}`, 0, false, i === 0 ? null : `f${i - 1}`),
    )
    const sections = sidebarSections(stateOf([], chain), 's1', on)
    const depths: number[] = []
    for (let node = sections.pinned[0]; node?.kind === 'folder'; node = node.children[0]) {
      depths.push(node.depth)
    }
    expect(depths).toEqual([0, 1, 2, 3, 4, 4, 4])
  })

  it('draws today depth-first under parents, indent capped at 3', () => {
    const sections = sidebarSections(
      stateOf([
        at('a', 0),
        at('b', 1, { parentId: 'a' }),
        at('c', 2, { parentId: 'b' }),
        at('d', 3, { parentId: 'c' }),
        at('e', 4, { parentId: 'd' }),
        at('f', 5),
        at('g', 6, { parentId: 'missing' }),
      ]),
      's1',
      on,
    )
    expect(sections.today.map(shape)).toEqual(['a@0', 'b@1', 'c@2', 'd@3', 'e@3', 'f@0', 'g@0'])
  })

  it('agrees with the drawn order of browserView', () => {
    const state = stateOf(
      [
        at('t2', 1, { parentId: 't1' }),
        at('t1', 0),
        at('p1', 0, { section: 'pinned', folderId: 'fo' }),
        at('f1', 0, { section: 'favorites' }),
      ],
      [folder('fo', 0)],
    )
    expect(browserView(state).tabs.map((t) => t.id)).toEqual(['f1', 'p1', 't1', 't2'])
  })

  it('groups 3 top-level today tabs of one host into an automatic folder, 2 stay apart', () => {
    const three = sidebarSections(
      stateOf([
        at('a1', 0, {}, 'https://a.com/1'),
        at('a2', 1, {}, 'https://a.com/2'),
        at('a3', 2, {}, 'https://a.com/3'),
      ]),
      's1',
      on,
    )
    expect(three.today.map(shape)).toEqual([{ 'auto:a.com': ['a1@0', 'a2@0', 'a3@0'] }])

    const two = sidebarSections(
      stateOf([at('a1', 0, {}, 'https://a.com/1'), at('a2', 1, {}, 'https://a.com/2')]),
      's1',
      on,
    )
    expect(two.today.map(shape)).toEqual(['a1@0', 'a2@0'])
  })

  it('groups www.a.com with a.com', () => {
    const sections = sidebarSections(
      stateOf([
        at('a1', 0, {}, 'https://www.a.com/1'),
        at('a2', 1, {}, 'https://a.com/2'),
        at('a3', 2, {}, 'https://WWW.A.com/3'),
      ]),
      's1',
      on,
    )
    expect(sections.today.map(shape)).toEqual([{ 'auto:a.com': ['a1@0', 'a2@0', 'a3@0'] }])
  })

  it('puts the automatic folder where its first tab was, children keep their nesting', () => {
    const sections = sidebarSections(
      stateOf([
        at('x1', 0, {}, 'https://x.com/'),
        at('a1', 1, {}, 'https://a.com/1'),
        at('kid', 2, { parentId: 'a1' }, 'https://b.com/'),
        at('y1', 3, {}, 'https://y.com/'),
        at('a2', 4, {}, 'https://a.com/2'),
        at('a3', 5, {}, 'https://a.com/3'),
      ]),
      's1',
      on,
    )
    expect(sections.today.map(shape)).toEqual([
      'x1@0',
      { 'auto:a.com': ['a1@0', 'kid@1', 'a2@0', 'a3@0'] },
      'y1@0',
    ])
  })

  it('makes no automatic folder when the setting is off, nor for pages without a host', () => {
    const tabs = [
      at('a1', 0, {}, 'https://a.com/1'),
      at('a2', 1, {}, 'https://a.com/2'),
      at('a3', 2, {}, 'https://a.com/3'),
    ]
    expect(sidebarSections(stateOf(tabs), 's1', { autoFolders: false }).today.map(shape)).toEqual([
      'a1@0',
      'a2@0',
      'a3@0',
    ])

    const blank = [0, 1, 2].map((i) => at(`b${i}`, i, {}, 'about:blank'))
    expect(sidebarSections(stateOf(blank), 's1', on).today.map(shape)).toEqual([
      'b0@0',
      'b1@0',
      'b2@0',
    ])
  })

  it('only looks at the given space', () => {
    const sections = sidebarSections(stateOf([at('t1', 0)]), 's2', on)
    expect(sections.today.map(shape)).toEqual(['x@0'])
  })
})

describe('recentFirst', () => {
  it('orders tabs most recently active first, never-active last in their order', () => {
    const at = (id: string, lastActiveAt: string | null) => ({ id, lastActiveAt })
    const tabs = [
      at('never1', null),
      at('old', '2026-11-20T08:00:00.000Z'),
      at('never2', null),
      at('new', '2026-11-20T10:00:00.000Z'),
    ]
    expect(recentFirst(tabs).map((t) => t.id)).toEqual(['new', 'old', 'never1', 'never2'])
    // The input is left as it was.
    expect(tabs[0]?.id).toBe('never1')
  })
})

describe('todayCloseOrder', () => {
  const today = sidebarSections(
    stateOf([
      at('a', 0),
      at('b', 1, { parentId: 'a' }),
      at('c', 2),
      at('a1', 3, {}, 'https://a.com/1'),
      at('a2', 4, {}, 'https://a.com/2'),
      at('a3', 5, {}, 'https://a.com/3'),
    ]),
    's1',
    { autoFolders: true },
  ).today

  it('closes bottom-up, children before parents, automatic folders included', () => {
    expect(todayCloseOrder(today, null)).toEqual(['a3', 'a2', 'a1', 'c', 'b', 'a'])
  })

  it('closes the active tab last, so closing the others never activates (loads) a tab', () => {
    expect(todayCloseOrder(today, 'b')).toEqual(['a3', 'a2', 'a1', 'c', 'a', 'b'])
    expect(todayCloseOrder(today, 'elsewhere')).toEqual(['a3', 'a2', 'a1', 'c', 'b', 'a'])
  })
})

describe('todayOrder', () => {
  it("lists today in the store's order with parents, whatever automatic folders regroup", () => {
    const sections = sidebarSections(
      stateOf([
        at('a1', 0, {}, 'https://a.com/1'),
        at('kid', 1, { parentId: 'a1' }, 'https://b.com/'),
        at('y1', 2, {}, 'https://y.com/'),
        at('a2', 3, {}, 'https://a.com/2'),
        at('a3', 4, {}, 'https://a.com/3'),
        at('p1', 0, { section: 'pinned' }),
      ]),
      's1',
      { autoFolders: true },
    )
    expect(sections.today.map(shape)).toEqual([
      { 'auto:a.com': ['a1@0', 'kid@1', 'a2@0', 'a3@0'] },
      'y1@0',
    ])
    expect(sections.todayOrder).toEqual([
      { id: 'a1', parentId: null },
      { id: 'kid', parentId: 'a1' },
      { id: 'y1', parentId: null },
      { id: 'a2', parentId: null },
      { id: 'a3', parentId: null },
    ])
  })

  it('gives a today tab with its descendants, nothing for a tab outside today', () => {
    const order = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
      { id: 'd', parentId: null },
    ]
    expect([...todaySubtree(order, 'a')]).toEqual(['a', 'b', 'c'])
    expect([...todaySubtree(order, 'b')]).toEqual(['b', 'c'])
    expect([...todaySubtree(order, 'pinned')]).toEqual([])
  })
})

describe('splits', () => {
  const pair = [
    at('a', 0),
    at('b', 1, { splitRatio: 0.6 }),
    at('c', -1, { splitOf: 'b' }),
    at('d', 2),
  ]

  it('a split is one node with both halves, the second out of the list', () => {
    const sections = sidebarSections(stateOf(pair), 's1', { autoFolders: false })
    expect(sections.today.map((n) => n.kind)).toEqual(['tab', 'split', 'tab'])
    const split = sections.today[1]
    expect(split?.kind === 'split' && [split.first.id, split.second.id, split.ratio]).toEqual([
      'b',
      'c',
      0.6,
    ])
    expect(sections.todayOrder.map((t) => t.id)).toEqual(['a', 'b', 'd'])
  })

  it('activeSplit follows the active half', () => {
    const state = { ...stateOf(pair), activeTabIds: { s1: 'c', s2: 'x' } }
    const view = browserView(state)
    expect(view.activeTab?.id).toBe('c')
    expect(view.tabs.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(view.activeSplit).toMatchObject({ ratio: 0.6, activeHalf: 'second' })
    expect(view.activeSplit?.first.id).toBe('b')
    const onFirst = browserView({ ...state, activeTabIds: { s1: 'b', s2: 'x' } })
    expect(onFirst.activeSplit?.activeHalf).toBe('first')
    expect(browserView({ ...state, activeTabIds: { s1: 'a', s2: 'x' } }).activeSplit).toBeNull()
  })

  it('a favourite split is one tile, its second half kept beside it', () => {
    const favourites = [
      at('f', 0, { section: 'favorites' }),
      at('g', -1, { section: 'favorites', splitOf: 'f' }),
      at('h', 1, { section: 'favorites' }),
    ]
    const sections = sidebarSections(stateOf(favourites), 's1', { autoFolders: false })
    expect(sections.favorites.map((t) => t.id)).toEqual(['f', 'h'])
    expect([...sections.favoriteSeconds].map(([id, t]) => [id, t.id])).toEqual([['f', 'g']])
    expect(browserView(stateOf(favourites)).tabs.map((t) => t.id)).toEqual(['f', 'g', 'h'])
  })

  it('a second whose first is gone is a normal tab', () => {
    const sections = sidebarSections(stateOf([at('a', 0), at('c', 1, { splitOf: 'gone' })]), 's1', {
      autoFolders: false,
    })
    expect(sections.today.map((n) => n.kind)).toEqual(['tab', 'tab'])
  })
})
