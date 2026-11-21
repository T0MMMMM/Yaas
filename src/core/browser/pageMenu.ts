// The right-click menu of a web page: which entries to show for what was clicked. Main turns the
// ids into the menu the overlay draws; this module knows nothing of Electron.

/** What Electron's `context-menu` event tells about the click, plus the tab's history. */
export interface PageMenuContext {
  linkURL: string
  srcURL: string
  mediaType: string
  selectionText: string
  isEditable: boolean
  canCut: boolean
  canCopy: boolean
  canPaste: boolean
  canGoBack: boolean
  canGoForward: boolean
  /** The misspelled word under the pointer, or '' (spellcheck off, or spelled right). */
  misspelledWord: string
  /** The spellchecker's replacements for `misspelledWord`. */
  suggestions: string[]
}

/** Most spelling suggestions offered, like Chrome. */
export const MAX_SUGGESTIONS = 5

export type PageMenuId =
  /** Replaces the misspelled word with `suggestions[n]`. */
  | `suggestion:${number}`
  | 'noSuggestions'
  | 'openLinkInNewTab'
  | 'copyLink'
  | 'openImageInNewTab'
  | 'copyImage'
  | 'copyImageAddress'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll'
  | 'searchSelection'
  | 'back'
  | 'forward'
  | 'reload'
  | 'inspect'

export type PageMenuEntry = { id: PageMenuId; enabled: boolean } | 'separator'

const isWebUrl = (url: string): boolean => /^https?:\/\//i.test(url)

export function pageMenu(context: PageMenuContext): PageMenuEntry[] {
  const groups: PageMenuEntry[][] = []
  const on = (id: PageMenuId, enabled = true): PageMenuEntry => ({ id, enabled })

  if (context.misspelledWord) {
    const suggestions = context.suggestions.slice(0, MAX_SUGGESTIONS)
    groups.push(
      suggestions.length > 0
        ? suggestions.map((_, index) => on(`suggestion:${index}`))
        : [on('noSuggestions', false)],
    )
  }

  if (context.linkURL) {
    groups.push([...(isWebUrl(context.linkURL) ? [on('openLinkInNewTab')] : []), on('copyLink')])
  }
  if (context.mediaType === 'image' && context.srcURL) {
    groups.push([
      ...(isWebUrl(context.srcURL) ? [on('openImageInNewTab')] : []),
      on('copyImage'),
      on('copyImageAddress'),
    ])
  }

  const selected = context.selectionText.trim() !== ''
  if (context.isEditable) {
    groups.push([
      on('cut', context.canCut),
      on('copy', context.canCopy),
      on('paste', context.canPaste),
      on('selectAll'),
    ])
  } else if (selected) {
    groups.push([on('copy'), on('searchSelection')])
  }

  // Navigation only when nothing more specific was clicked, like other browsers.
  if (!context.isEditable && !selected) {
    groups.push([on('back', context.canGoBack), on('forward', context.canGoForward), on('reload')])
  }
  groups.push([on('inspect')])

  return groups.flatMap((group, index) => (index === 0 ? group : ['separator', ...group]))
}
