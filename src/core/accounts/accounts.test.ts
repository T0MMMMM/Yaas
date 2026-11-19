import { describe, expect, it, vi } from 'vitest'
import type { AuthStatus } from '../providers/claude-code/cli'
import { openDatabase } from '../store/database'
import { AccountError, Accounts } from './accounts'

const signedIn: AuthStatus = {
  loggedIn: true,
  authMethod: 'claude.ai',
  email: 'me@example.com',
  orgName: 'Org',
  plan: 'pro',
}

const make = (status: AuthStatus | null) =>
  new Accounts({
    db: openDatabase(':memory:'),
    authStatus: async () => status,
    defaultColor: () => '#7C5CFF',
  })

describe('Accounts.importDefault', () => {
  it('imports ~/.claude as a space without a config dir', async () => {
    const accounts = make(signedIn)
    const account = await accounts.importDefault()
    expect(account).toMatchObject({
      label: 'Default',
      configDir: null,
      email: 'me@example.com',
      plan: 'pro',
      position: 0,
    })
    expect(accounts.list()).toHaveLength(1)
  })

  it('is idempotent and refreshes the profile', async () => {
    const db = openDatabase(':memory:')
    let status = signedIn
    const accounts = new Accounts({
      db,
      authStatus: async () => status,
      defaultColor: () => '#7C5CFF',
    })
    await accounts.importDefault()
    status = { ...signedIn, plan: 'max' }
    await accounts.importDefault()
    expect(accounts.list()).toEqual([expect.objectContaining({ plan: 'max' })])
  })

  it('notifies subscribers', async () => {
    const accounts = make(signedIn)
    const listener = vi.fn()
    accounts.subscribe(listener)
    await accounts.importDefault()
    expect(listener).toHaveBeenCalledWith([expect.objectContaining({ label: 'Default' })])
  })

  it('refuses when the CLI is missing or nobody is signed in', async () => {
    await expect(make(null).importDefault()).rejects.toMatchObject({ code: 'cli_not_found' })
    await expect(make({ ...signedIn, loggedIn: false }).importDefault()).rejects.toBeInstanceOf(
      AccountError,
    )
  })
})
