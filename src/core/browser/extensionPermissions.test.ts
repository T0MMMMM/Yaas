import { describe, expect, it } from 'vitest'
import { permissionSummary } from './extensionPermissions'

describe('permissionSummary', () => {
  it('is empty for an extension that asks for nothing', () => {
    expect(permissionSummary({})).toEqual([])
  })

  it('summarises access to every site', () => {
    expect(permissionSummary({ host_permissions: ['<all_urls>'] })).toEqual([
      'Read and change all your data on all websites',
    ])
    expect(permissionSummary({ permissions: ['*://*/*'] })).toEqual([
      'Read and change all your data on all websites',
    ])
  })

  it('names specific hosts, deduplicated', () => {
    expect(
      permissionSummary({
        host_permissions: ['https://*.example.com/*', 'http://*.example.com/*', '*://a.org/x'],
      }),
    ).toEqual(['Read and change your data on *.example.com', 'Read and change your data on a.org'])
  })

  it('explains known APIs and lists unknown ones by name', () => {
    expect(permissionSummary({ permissions: ['tabs', 'cookies', 'frobnicate'] })).toEqual([
      'See the addresses and titles of your open tabs',
      'Read and change your cookies',
      'frobnicate',
    ])
  })

  it('puts host access first and does not repeat a sentence', () => {
    expect(
      permissionSummary({
        permissions: ['history', 'history', '<all_urls>'],
        host_permissions: ['<all_urls>'],
      }),
    ).toEqual([
      'Read and change all your data on all websites',
      'Read and change your browsing history',
    ])
  })
})
