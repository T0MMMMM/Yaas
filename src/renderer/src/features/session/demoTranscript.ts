// Placeholder transcript so the session view can be designed before sessions are wired.
export type DemoBlock =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | {
      kind: 'tool'
      tool: 'read' | 'edit' | 'bash' | 'search'
      title: string
      detail?: string
      diff?: Array<{ sign: '+' | '-' | ' '; text: string }>
    }

export const DEMO_TRANSCRIPT: DemoBlock[] = [
  {
    kind: 'user',
    text: 'The login page loops back to /login after the OAuth callback. Can you find why and fix it?',
  },
  {
    kind: 'assistant',
    text: "I'll trace the callback first, then check where the session cookie is written.",
  },
  {
    kind: 'tool',
    tool: 'search',
    title: 'Searched for "redirect_uri"',
    detail: '4 matches in 3 files',
  },
  { kind: 'tool', tool: 'read', title: 'Read src/auth/callback.ts', detail: '128 lines' },
  {
    kind: 'assistant',
    text: 'Found it: the cookie is set with `sameSite: "strict"`, so the browser drops it on the cross-site redirect coming back from the provider. The next request has no session and bounces to /login.',
  },
  {
    kind: 'tool',
    tool: 'edit',
    title: 'Edited src/auth/callback.ts',
    detail: '+2 −1',
    diff: [
      { sign: ' ', text: 'res.cookie("session", token, {' },
      { sign: ' ', text: '  httpOnly: true,' },
      { sign: '-', text: '  sameSite: "strict",' },
      { sign: '+', text: '  sameSite: "lax",' },
      { sign: '+', text: '  secure: true,' },
      { sign: ' ', text: '})' },
    ],
  },
]

export const DEMO_APPROVAL = { tool: 'Bash', command: 'npm test -- auth' }
