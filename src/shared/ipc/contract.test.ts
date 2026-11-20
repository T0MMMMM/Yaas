import { describe, expect, it } from 'vitest'
import { COMMAND_CHANNELS, EVENT_CHANNELS } from './channels'
import { commands, events } from './contract'

describe('IPC contract', () => {
  it('declares exactly the channels listed for the preload', () => {
    expect(Object.keys(commands).sort()).toEqual([...COMMAND_CHANNELS].sort())
    expect(Object.keys(events).sort()).toEqual([...EVENT_CHANNELS].sort())
  })

  it('rejects unknown keys and invalid values in settings.update', () => {
    const input = commands['settings.update'].input
    expect(input.safeParse({ transparency: 1 }).success).toBe(true)
    expect(input.safeParse({ accent: 'violet' }).success).toBe(false)
    expect(input.safeParse({ grain: 1.5 }).success).toBe(false)
    expect(input.safeParse({ spaceSwitcherStyle: 'dots' }).success).toBe(true)
    expect(input.safeParse({ spaceSwitcherStyle: 'bars' }).success).toBe(false)
    expect(input.safeParse({ autoArchive: { enabled: true, afterDays: 7 } }).success).toBe(true)
    expect(input.safeParse({ autoArchive: { enabled: true, afterDays: 0 } }).success).toBe(false)
    expect(input.safeParse({ sidebarWidth: 120 }).success).toBe(false)
    expect(input.safeParse({ askewCards: false }).success).toBe(true)
    expect(input.safeParse({ contextBarStyle: 'attached' }).success).toBe(true)
    expect(input.safeParse({ contextBarStyle: 'floating' }).success).toBe(false)
    expect(input.safeParse({ nodeIntegration: true }).success).toBe(false)
  })

  it('accepts the ad blocker settings only with their allowed hosts', () => {
    const input = commands['settings.update'].input
    expect(input.safeParse({ adBlock: { enabled: false, allowedHosts: ['a.com'] } }).success).toBe(
      true,
    )
    expect(input.safeParse({ adBlock: { enabled: true } }).success).toBe(false)
  })

  it('accepts only lower-cased hostnames as allowed hosts', () => {
    const input = commands['settings.update'].input
    const allowed = (host: string) =>
      input.safeParse({ adBlock: { enabled: true, allowedHosts: [host] } }).success
    expect(allowed('example.com')).toBe(true)
    expect(allowed('127.0.0.1')).toBe(true)
    for (const bad of ['', 'Example.com', 'a.com$x', 'a.com,b.com', 'a b.com', 'a.com|b.com'])
      expect(allowed(bad)).toBe(false)
  })

  it('rejects a negative page bound', () => {
    const input = commands['browser.setPageBounds'].input
    expect(input.safeParse({ x: 0, y: 0, width: 800, height: 600 }).success).toBe(true)
    expect(input.safeParse({ x: -1, y: 0, width: 800, height: 600 }).success).toBe(false)
  })

  it('rejects an unknown field on browser.openTab', () => {
    const input = commands['browser.openTab'].input
    expect(input.safeParse({ input: 'example.com' }).success).toBe(true)
    expect(input.safeParse({ input: 'example.com', partition: 'x' }).success).toBe(false)
  })

  it('accepts only a known overlay kind with an anchor on overlay.open', () => {
    const input = commands['overlay.open'].input
    const anchor = { x: 0, y: 0, width: 10, height: 10 }
    expect(input.safeParse({ kind: 'site-menu', anchor }).success).toBe(true)
    expect(input.safeParse({ kind: 'new-menu', anchor }).success).toBe(true)
    expect(input.safeParse({ kind: 'popup', anchor }).success).toBe(false)
    expect(input.safeParse({ kind: 'site-menu', anchor, url: 'x' }).success).toBe(false)
  })

  it.each(['browser.share', 'browser.toggleDevTools'] as const)(
    'accepts only a tab id on %s',
    (channel) => {
      const input = commands[channel].input
      expect(input.safeParse({ tabId: 'x' }).success).toBe(true)
      expect(input.safeParse({ tabId: 'x', url: 'https://a.com' }).success).toBe(false)
      expect(input.safeParse({}).success).toBe(false)
    },
  )

  it('takes no input on browser.openWebStore', () => {
    const input = commands['browser.openWebStore'].input
    expect(input.safeParse(undefined).success).toBe(true)
    expect(input.safeParse({ url: 'https://a.com' }).success).toBe(false)
  })

  it('rejects a bad space color', () => {
    const input = commands['browser.createSpace'].input
    expect(input.safeParse({ name: 'Work', color: '#2BB673' }).success).toBe(true)
    expect(input.safeParse({ name: 'Work', color: 'green' }).success).toBe(false)
  })
})
