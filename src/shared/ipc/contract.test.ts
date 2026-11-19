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
    expect(input.safeParse({ glass: true }).success).toBe(true)
    expect(input.safeParse({ accent: 'violet' }).success).toBe(false)
    expect(input.safeParse({ grainOpacity: 0.9 }).success).toBe(false)
    expect(input.safeParse({ nodeIntegration: true }).success).toBe(false)
  })
})
