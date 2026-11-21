import { describe, expect, it } from 'vitest'
import { pageMenu, type PageMenuContext } from './pageMenu'

const base: PageMenuContext = {
  linkURL: '',
  srcURL: '',
  mediaType: 'none',
  selectionText: '',
  isEditable: false,
  canCut: false,
  canCopy: false,
  canPaste: false,
  canGoBack: false,
  canGoForward: false,
  misspelledWord: '',
  suggestions: [],
}

const ids = (context: Partial<PageMenuContext>) =>
  pageMenu({ ...base, ...context }).map((entry) => (entry === 'separator' ? '—' : entry.id))

describe('pageMenu', () => {
  it('offers navigation and inspect on a blank spot', () => {
    expect(ids({ canGoBack: true })).toEqual(['back', 'forward', 'reload', '—', 'inspect'])
    const back = pageMenu({ ...base, canGoBack: true })[0]
    expect(back).toEqual({ id: 'back', enabled: true })
    expect(pageMenu(base)[1]).toEqual({ id: 'forward', enabled: false })
  })

  it('offers link actions for a web link only', () => {
    expect(ids({ linkURL: 'https://a.test/' })).toEqual([
      'openLinkInNewTab',
      'copyLink',
      '—',
      'back',
      'forward',
      'reload',
      '—',
      'inspect',
    ])
    expect(ids({ linkURL: 'mailto:a@b.test' })).toEqual([
      'copyLink',
      '—',
      'back',
      'forward',
      'reload',
      '—',
      'inspect',
    ])
  })

  it('offers image actions on an image', () => {
    expect(ids({ mediaType: 'image', srcURL: 'https://a.test/i.png' })).toEqual([
      'openImageInNewTab',
      'copyImage',
      'copyImageAddress',
      '—',
      'back',
      'forward',
      'reload',
      '—',
      'inspect',
    ])
  })

  it('offers copy and search for a selection, without navigation', () => {
    expect(ids({ selectionText: 'hello', canCopy: true })).toEqual([
      'copy',
      'searchSelection',
      '—',
      'inspect',
    ])
  })

  it('offers edit actions in an editable field', () => {
    expect(ids({ isEditable: true, canPaste: true })).toEqual([
      'cut',
      'copy',
      'paste',
      'selectAll',
      '—',
      'inspect',
    ])
    const entries = pageMenu({ ...base, isEditable: true, canPaste: true })
    expect(entries[0]).toEqual({ id: 'cut', enabled: false })
    expect(entries[2]).toEqual({ id: 'paste', enabled: true })
  })

  it('offers spelling suggestions first for a misspelled word', () => {
    const entries = pageMenu({
      ...base,
      isEditable: true,
      misspelledWord: 'helo',
      suggestions: ['hello', 'help'],
    })
    expect(entries.slice(0, 3)).toEqual([
      { id: 'suggestion:0', enabled: true },
      { id: 'suggestion:1', enabled: true },
      'separator',
    ])
    expect(entries[3]).toEqual({ id: 'cut', enabled: false })
  })

  it('offers at most five suggestions', () => {
    const suggestions = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const first = pageMenu({ ...base, isEditable: true, misspelledWord: 'x', suggestions })
    expect(first.indexOf('separator')).toBe(5)
  })

  it('says there are no suggestions, disabled, when there are none', () => {
    const entries = pageMenu({ ...base, isEditable: true, misspelledWord: 'qwzx', suggestions: [] })
    expect(entries.slice(0, 2)).toEqual([{ id: 'noSuggestions', enabled: false }, 'separator'])
  })
})
