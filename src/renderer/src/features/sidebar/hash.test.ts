import { describe, expect, it } from 'vitest'
import { FOLDER_HUES, folderHue, folderIcon } from './hash'

describe('folderIcon', () => {
  const name = 'Reading'

  it('takes the hue from the name when there is no icon', () => {
    expect(folderIcon({ name, icon: null })).toEqual({ kind: 'hue', hue: folderHue(name) })
  })

  it('takes a chosen hue, but only one of the folder hues', () => {
    expect(folderIcon({ name, icon: 'hue:262' })).toEqual({ kind: 'hue', hue: 262 })
    expect(FOLDER_HUES).toContain(262)
    expect(folderIcon({ name, icon: 'hue:999' })).toEqual({ kind: 'hue', hue: folderHue(name) })
  })

  it('takes anything else as an emoji', () => {
    expect(folderIcon({ name, icon: '📁' })).toEqual({ kind: 'emoji', emoji: '📁' })
  })
})
