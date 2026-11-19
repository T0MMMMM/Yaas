import { describe, expect, it } from 'vitest'
import { accountEnv, authStatus, cliVersion, findCli, type Exec } from './cli'

const fakeExec =
  (stdout: string, exitCode = 0): Exec =>
  async () => ({ stdout, exitCode })

describe('findCli', () => {
  it('prefers PATH, then the usual install folders', () => {
    const found = findCli({ PATH: '/nope:/custom/bin' }, (f) => f === '/custom/bin/claude')
    expect(found).toBe('/custom/bin/claude')
  })

  it('returns null when the CLI is nowhere', () => {
    expect(findCli({ PATH: '' }, () => false)).toBeNull()
  })
})

describe('accountEnv', () => {
  it('sets CLAUDE_CONFIG_DIR only for non-default accounts (ADR-0002)', () => {
    expect(accountEnv('/a', { CLAUDE_CONFIG_DIR: '/x' })['CLAUDE_CONFIG_DIR']).toBe('/a')
    expect(accountEnv(null, { CLAUDE_CONFIG_DIR: '/x' })).not.toHaveProperty('CLAUDE_CONFIG_DIR')
  })
})

describe('cliVersion', () => {
  it('extracts the semver', async () => {
    expect(await cliVersion('claude', fakeExec('2.1.247 (Claude Code)\n'))).toBe('2.1.247')
    expect(await cliVersion('claude', fakeExec('', 1))).toBeNull()
  })
})

describe('authStatus', () => {
  it('maps the CLI JSON to an account profile', async () => {
    const json = JSON.stringify({
      loggedIn: true,
      authMethod: 'claude.ai',
      email: 'me@example.com',
      orgName: 'Org',
      subscriptionType: 'pro',
    })
    expect(await authStatus('claude', null, fakeExec(json))).toEqual({
      loggedIn: true,
      authMethod: 'claude.ai',
      email: 'me@example.com',
      orgName: 'Org',
      plan: 'pro',
    })
  })

  it('handles a signed-out config dir', async () => {
    const json = JSON.stringify({ loggedIn: false, authMethod: 'none' })
    expect(await authStatus('claude', '/dir', fakeExec(json))).toMatchObject({
      loggedIn: false,
      email: null,
    })
  })
})
