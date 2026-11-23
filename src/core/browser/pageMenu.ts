// The right-click menu of a web page: which entries (and icons) to show for what was clicked.
// Main turns the ids into the menu the overlay draws; this module knows nothing of Electron.

/** What Electron's `context-menu` event tells about the click, plus the tab's state. */
export interface PageMenuContext {
  linkURL: string
  srcURL: string
  mediaType: string
  /** Whether a clicked video/audio element is currently looping. */
  mediaLoop: boolean
  /** Whether a clicked video/audio element is currently showing its controls. */
  mediaControls: boolean
  /** The current page's URL, for Copy Page URL, Save Page As… and View Page Source. */
  pageURL: string
  /** Whether this tab can be paired into a split (false when it is already split). */
  canSplit: boolean
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

/** Longest selection preview shown inside "Go to" / "Search Google for" labels. */
const MAX_SELECTION_PREVIEW = 32

export type PageMenuId =
  /** Replaces the misspelled word with `suggestions[n]`. */
  | `suggestion:${number}`
  | 'noSuggestions'
  | 'addToDictionary'
  | 'openLinkInNewTab'
  | 'openLinkInSplitView'
  | 'openLinkHere'
  | 'downloadLink'
  | 'copyLink'
  | 'shareLink'
  | 'copyEmailAddress'
  | 'openImageInNewTab'
  | 'downloadImage'
  | 'copyImage'
  | 'copyImageAddress'
  | 'openMediaInNewTab'
  | 'downloadMedia'
  | 'copyMediaAddress'
  | 'toggleMediaLoop'
  | 'toggleMediaControls'
  | 'pictureInPicture'
  | 'goToSelection'
  | 'searchSelection'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'pasteAndMatchStyle'
  | 'selectAll'
  | 'back'
  | 'forward'
  | 'reload'
  | 'copyPageUrl'
  | 'savePageAs'
  | 'print'
  | 'viewPageSource'
  | 'inspect'

export type PageMenuEntry =
  { id: PageMenuId; enabled: boolean; icon: string; checked?: boolean } | 'separator'

const isWebUrl = (url: string): boolean => /^https?:\/\//i.test(url)

const BARE_URL_HOST =
  /^(localhost|\d{1,3}(?:\.\d{1,3}){3}|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(:\d+)?([/?#].*)?$/i
const LOCAL_URL_HOST = /^(localhost|\d{1,3}(?:\.\d{1,3}){3})(?::|\/|\?|#|$)/i

/** The email address in a `mailto:` URL, or '' when it is not one or has no address. */
export function emailFromMailto(url: string): string {
  if (!/^mailto:/i.test(url)) return ''
  const raw = (url.slice('mailto:'.length).split('?')[0] ?? '').trim()
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Navigable http(s) URL if `text` looks like an address (no whitespace), else null. */
export function selectionUrl(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  if (isWebUrl(trimmed)) {
    try {
      return new URL(trimmed).href
    } catch {
      return null
    }
  }
  if (BARE_URL_HOST.test(trimmed)) {
    const scheme = LOCAL_URL_HOST.test(trimmed) ? 'http://' : 'https://'
    try {
      return new URL(scheme + trimmed).href
    } catch {
      return null
    }
  }
  return null
}

/** Single-line preview of a selection for menu labels (short enough to stay readable). */
export function clipSelection(text: string, max = MAX_SELECTION_PREVIEW): string {
  const flat = text.trim().replace(/\s+/g, ' ')
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

const ICONS: Record<Exclude<PageMenuId, `suggestion:${number}`>, string> = {
  noSuggestions: 'Prohibit',
  addToDictionary: 'BookBookmark',
  openLinkInNewTab: 'ArrowSquareOut',
  openLinkInSplitView: 'SquareSplitHorizontal',
  openLinkHere: 'ArrowBendUpRight',
  downloadLink: 'DownloadSimple',
  copyLink: 'LinkSimple',
  shareLink: 'ShareNetwork',
  copyEmailAddress: 'Envelope',
  openImageInNewTab: 'Image',
  downloadImage: 'DownloadSimple',
  copyImage: 'Copy',
  copyImageAddress: 'LinkSimple',
  openMediaInNewTab: 'ArrowSquareOut',
  downloadMedia: 'DownloadSimple',
  copyMediaAddress: 'LinkSimple',
  toggleMediaLoop: 'Repeat',
  toggleMediaControls: 'SlidersHorizontal',
  pictureInPicture: 'PictureInPicture',
  goToSelection: 'Globe',
  searchSelection: 'MagnifyingGlass',
  cut: 'Scissors',
  copy: 'Copy',
  paste: 'Clipboard',
  pasteAndMatchStyle: 'TextAa',
  selectAll: 'SelectionAll',
  back: 'ArrowLeft',
  forward: 'ArrowRight',
  reload: 'ArrowClockwise',
  copyPageUrl: 'LinkSimple',
  savePageAs: 'FloppyDisk',
  print: 'Printer',
  viewPageSource: 'Code',
  inspect: 'Wrench',
}

export function pageMenu(context: PageMenuContext): PageMenuEntry[] {
  const groups: PageMenuEntry[][] = []
  const on = (
    id: Exclude<PageMenuId, `suggestion:${number}`>,
    enabled = true,
    checked?: boolean,
  ): PageMenuEntry => ({
    id,
    enabled,
    icon: ICONS[id],
    ...(checked !== undefined ? { checked } : {}),
  })

  if (context.misspelledWord) {
    const suggestions = context.suggestions.slice(0, MAX_SUGGESTIONS)
    const spelling: PageMenuEntry[] =
      suggestions.length > 0
        ? suggestions.map((_, index) => ({
            id: `suggestion:${index}` as const,
            enabled: true,
            icon: 'Check',
          }))
        : [on('noSuggestions', false)]
    spelling.push(on('addToDictionary'))
    groups.push(spelling)
  }

  const hasLink = Boolean(context.linkURL)
  if (hasLink) {
    const web = isWebUrl(context.linkURL)
    const email = emailFromMailto(context.linkURL)
    groups.push([
      ...(web
        ? [
            on('openLinkInNewTab'),
            on('openLinkInSplitView', context.canSplit),
            on('openLinkHere'),
            on('downloadLink'),
          ]
        : []),
      on('copyLink'),
      on('shareLink'),
      ...(email ? [on('copyEmailAddress')] : []),
    ])
  }

  const hasImage = context.mediaType === 'image' && Boolean(context.srcURL)
  if (hasImage) {
    const web = isWebUrl(context.srcURL)
    groups.push([
      ...(web ? [on('openImageInNewTab'), on('downloadImage')] : []),
      on('copyImage'),
      on('copyImageAddress'),
    ])
  }

  const hasMedia = context.mediaType === 'video' || context.mediaType === 'audio'
  if (hasMedia) {
    const web = isWebUrl(context.srcURL)
    groups.push([
      ...(web ? [on('openMediaInNewTab'), on('downloadMedia')] : []),
      ...(context.srcURL ? [on('copyMediaAddress')] : []),
      on('toggleMediaLoop', true, context.mediaLoop),
      on('toggleMediaControls'),
      ...(context.mediaType === 'video' ? [on('pictureInPicture')] : []),
    ])
  }

  const selected = context.selectionText.trim() !== ''
  if (context.isEditable) {
    groups.push([
      on('cut', context.canCut),
      on('copy', context.canCopy),
      on('paste', context.canPaste),
      on('pasteAndMatchStyle', context.canPaste),
      on('selectAll'),
    ])
  } else if (selected) {
    groups.push([
      ...(selectionUrl(context.selectionText) ? [on('goToSelection')] : []),
      on('searchSelection'),
      on('copy'),
    ])
  }

  // Page actions only on a blank spot (nothing more specific was clicked), like other browsers.
  if (!hasLink && !hasImage && !hasMedia && !context.isEditable && !selected) {
    const webPage = isWebUrl(context.pageURL)
    groups.push([
      on('back', context.canGoBack),
      on('forward', context.canGoForward),
      on('reload'),
      on('copyPageUrl', Boolean(context.pageURL)),
      on('savePageAs', webPage),
      on('print'),
      on('viewPageSource', webPage),
    ])
  }

  groups.push([on('inspect')])

  return groups.flatMap((group, index) => (index === 0 ? group : ['separator', ...group]))
}
