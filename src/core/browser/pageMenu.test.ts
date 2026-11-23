import { describe, expect, it } from 'vitest'
import {
  clipSelection,
  emailFromMailto,
  pageMenu,
  selectionUrl,
  type PageMenuContext,
  type PageMenuEntry,
} from './pageMenu'

const base: PageMenuContext = {
  linkURL: '',
  srcURL: '',
  mediaType: 'none',
  mediaLoop: false,
  mediaControls: false,
  pageURL: 'https://page.test/',
  canSplit: true,
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

const itemsOf = (entries: PageMenuEntry[]) =>
  entries.filter((e): e is Exclude<PageMenuEntry, 'separator'> => e !== 'separator')

describe('pageMenu', () => {
  it('offers navigation, page actions and inspect on a blank spot', () => {
    const entries = pageMenu({ ...base, canGoBack: true })
    expect(ids({ canGoBack: true })).toEqual([
      'back',
      'forward',
      'reload',
      'copyPageUrl',
      'savePageAs',
      'print',
      'viewPageSource',
      '—',
      'inspect',
    ])
    expect(entries[0]).toMatchObject({ id: 'back', enabled: true })
    expect(entries[1]).toMatchObject({ id: 'forward', enabled: false })
    expect(entries.at(-1)).toMatchObject({ id: 'inspect', enabled: true })
  })

  it('disables web-only page actions on non-web pages', () => {
    const entries = itemsOf(pageMenu({ ...base, pageURL: 'about:blank' }))
    expect(entries.find((e) => e.id === 'savePageAs')?.enabled).toBe(false)
    expect(entries.find((e) => e.id === 'viewPageSource')?.enabled).toBe(false)
    expect(entries.find((e) => e.id === 'copyPageUrl')?.enabled).toBe(true)
    expect(
      itemsOf(pageMenu({ ...base, pageURL: '' })).find((e) => e.id === 'copyPageUrl')?.enabled,
    ).toBe(false)
  })

  it('offers link actions for a web link, and hides Open/Download for non-web links', () => {
    expect(ids({ linkURL: 'https://a.test/' })).toEqual([
      'openLinkInNewTab',
      'openLinkInSplitView',
      'openLinkHere',
      'downloadLink',
      'copyLink',
      'shareLink',
      '—',
      'inspect',
    ])
    // Already in a split: Open Link in Split View stays visible but disabled.
    const alreadySplit = itemsOf(pageMenu({ ...base, linkURL: 'https://a.test/', canSplit: false }))
    expect(alreadySplit.find((e) => e.id === 'openLinkInSplitView')?.enabled).toBe(false)

    // mailto adds Copy Email Address and hides Open/Download.
    expect(ids({ linkURL: 'mailto:a@b.test?subject=hi' })).toEqual([
      'copyLink',
      'shareLink',
      'copyEmailAddress',
      '—',
      'inspect',
    ])
    // Other non-web links hide Open/Download and do not add Copy Email Address.
    expect(ids({ linkURL: 'tel:+123456' })).toEqual(['copyLink', 'shareLink', '—', 'inspect'])
  })

  it('offers the four image actions on an image', () => {
    expect(ids({ mediaType: 'image', srcURL: 'https://a.test/i.png' })).toEqual([
      'openImageInNewTab',
      'downloadImage',
      'copyImage',
      'copyImageAddress',
      '—',
      'inspect',
    ])
    // Non-web image hides Open/Download.
    expect(ids({ mediaType: 'image', srcURL: 'data:image/png;base64,AA==' })).toEqual([
      'copyImage',
      'copyImageAddress',
      '—',
      'inspect',
    ])
  })

  it('offers six actions on video and five on audio (no Picture in Picture)', () => {
    const video = pageMenu({
      ...base,
      mediaType: 'video',
      srcURL: 'https://a.test/v.mp4',
      mediaLoop: true,
      mediaControls: true,
    })
    expect(video.map((e) => (e === 'separator' ? '—' : e.id))).toEqual([
      'openMediaInNewTab',
      'downloadMedia',
      'copyMediaAddress',
      'toggleMediaLoop',
      'toggleMediaControls',
      'pictureInPicture',
      '—',
      'inspect',
    ])
    expect(itemsOf(video).find((e) => e.id === 'toggleMediaLoop')?.checked).toBe(true)

    expect(ids({ mediaType: 'audio', srcURL: 'https://a.test/a.mp3' })).toEqual([
      'openMediaInNewTab',
      'downloadMedia',
      'copyMediaAddress',
      'toggleMediaLoop',
      'toggleMediaControls',
      '—',
      'inspect',
    ])
  })

  it('offers Go to first when the selection is a URL, else Search and Copy', () => {
    expect(ids({ selectionText: 'example.com/docs', canCopy: true })).toEqual([
      'goToSelection',
      'searchSelection',
      'copy',
      '—',
      'inspect',
    ])
    expect(ids({ selectionText: 'hello world', canCopy: true })).toEqual([
      'searchSelection',
      'copy',
      '—',
      'inspect',
    ])
  })

  it('offers edit actions including Paste and Match Style in an editable field', () => {
    const entries = pageMenu({ ...base, isEditable: true, canPaste: true })
    expect(ids({ isEditable: true, canPaste: true })).toEqual([
      'cut',
      'copy',
      'paste',
      'pasteAndMatchStyle',
      'selectAll',
      '—',
      'inspect',
    ])
    expect(entries[0]).toMatchObject({ id: 'cut', enabled: false })
    expect(entries[2]).toMatchObject({ id: 'paste', enabled: true })
    expect(entries[3]).toMatchObject({ id: 'pasteAndMatchStyle', enabled: true })
  })

  it('offers spelling suggestions and Add to Dictionary first for a misspelled word', () => {
    const entries = pageMenu({
      ...base,
      isEditable: true,
      misspelledWord: 'helo',
      suggestions: ['hello', 'help'],
    })
    expect(entries.slice(0, 4).map((e) => (e === 'separator' ? '—' : [e.id, e.enabled]))).toEqual([
      ['suggestion:0', true],
      ['suggestion:1', true],
      ['addToDictionary', true],
      '—',
    ])
    expect(entries[4]).toMatchObject({ id: 'cut', enabled: false })
  })

  it('offers at most five suggestions before Add to Dictionary', () => {
    const suggestions = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const entries = pageMenu({ ...base, isEditable: true, misspelledWord: 'x', suggestions })
    expect(entries.indexOf('separator')).toBe(6)
    expect(entries[5]).toMatchObject({ id: 'addToDictionary', enabled: true })
  })

  it('says there are no suggestions, disabled, alongside Add to Dictionary when there are none', () => {
    const entries = pageMenu({ ...base, isEditable: true, misspelledWord: 'qwzx', suggestions: [] })
    expect(entries.slice(0, 3).map((e) => (e === 'separator' ? '—' : [e.id, e.enabled]))).toEqual([
      ['noSuggestions', false],
      ['addToDictionary', true],
      '—',
    ])
  })

  it('gives every single entry a Phosphor icon name', () => {
    const scenarios: Partial<PageMenuContext>[] = [
      {},
      { linkURL: 'https://a.test/' },
      { linkURL: 'mailto:a@b.test' },
      { mediaType: 'image', srcURL: 'https://a.test/i.png' },
      { mediaType: 'video', srcURL: 'https://a.test/v.mp4' },
      { mediaType: 'audio', srcURL: 'https://a.test/a.mp3' },
      { selectionText: 'https://a.test/' },
      { selectionText: 'hello' },
      { isEditable: true, misspelledWord: 'helo', suggestions: ['hello'] },
      { isEditable: true, misspelledWord: 'qwzx', suggestions: [] },
    ]
    for (const ctx of scenarios) {
      for (const entry of itemsOf(pageMenu({ ...base, ...ctx }))) {
        expect(entry.icon).toMatch(/^[A-Z][A-Za-z0-9]*$/)
      }
    }
  })
})

describe('pageMenu helpers', () => {
  it('extracts the email address from a mailto URL', () => {
    expect(emailFromMailto('mailto:alice@example.com')).toBe('alice@example.com')
    expect(emailFromMailto('MAILTO:alice%2B1@example.com?subject=Hi')).toBe('alice+1@example.com')
    expect(emailFromMailto('mailto:')).toBe('')
    expect(emailFromMailto('https://example.com')).toBe('')
  })

  it('recognises URL selections and rejects plain text or numbers', () => {
    expect(selectionUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(selectionUrl('  example.com/docs  ')).toBe('https://example.com/docs')
    expect(selectionUrl('localhost:3000/a')).toBe('http://localhost:3000/a')
    expect(selectionUrl('127.0.0.1:8080')).toBe('http://127.0.0.1:8080/')
    expect(selectionUrl('hello world')).toBeNull()
    expect(selectionUrl('3.14')).toBeNull()
    expect(selectionUrl('v1.2')).toBeNull()
  })

  it('clips long selection text with an ellipsis', () => {
    expect(clipSelection('  hello   world  ')).toBe('hello world')
    expect(clipSelection('a'.repeat(50))).toBe(`${'a'.repeat(32)}…`)
  })
})
