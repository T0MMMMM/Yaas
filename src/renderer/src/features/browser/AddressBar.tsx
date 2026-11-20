import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowClockwise, ArrowLeft, ArrowRight, SlidersHorizontal } from '@phosphor-icons/react'
import { isHex, onAccentColor } from '../../theme/color'
import { useUi } from '../../stores/ui'
import { anchorOf } from '../../ui/anchor'
import { useWorkspace } from '../workspace/useWorkspace'
import styles from './AddressBar.module.css'

const BLANK = 'about:blank'

/** The site's colour, as runtime data: the bar takes it, with legible text on top. */
function tint(themeColor: string | null | undefined): CSSProperties | undefined {
  if (!themeColor) return undefined
  const style: CSSProperties = { backgroundColor: themeColor }
  if (isHex(themeColor)) style.color = onAccentColor(themeColor)
  return style
}

/**
 * yab-style address bar (spec, "Browser chrome"): back, forward, reload, and the URL centred with
 * the host bright and the path dimmed. Clicking the URL (or ⌘L, ⌘T) edits it; the button on the
 * right opens the site menu. Always shown.
 */
export function AddressBar() {
  const tab = useWorkspace()?.activeTab ?? null
  const addressFocus = useUi((s) => s.addressFocus)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement>(null)
  /** Whether the site menu is open in the overlay. */
  const [siteMenuOpen, setSiteMenuOpen] = useState(false)

  useEffect(() => window.acab.on('overlay.closed', () => setSiteMenuOpen(false)), [])

  const startEditing = () => {
    setDraft(tab && tab.url !== BLANK ? tab.url : '')
    setEditing(true)
  }

  // Each request from ⌘T, ⌘L or "New tab" bumps the counter; the first render is not one.
  const handled = useRef(addressFocus)
  useEffect(() => {
    if (addressFocus === handled.current) return
    handled.current = addressFocus
    startEditing()
    // startEditing reads the tab active at the time of the request, on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressFocus])

  useEffect(() => {
    if (!editing) return
    input.current?.focus()
    input.current?.select()
  }, [editing])

  const submit = () => {
    const text = draft.trim()
    setEditing(false)
    if (!text) return
    if (tab) void window.acab.invoke('browser.navigate', { tabId: tab.id, input: text })
    else void window.acab.invoke('browser.openTab', { input: text })
  }

  const run = (command: 'browser.goBack' | 'browser.goForward' | 'browser.reload') => {
    if (tab) void window.acab.invoke(command, { tabId: tab.id })
  }

  return (
    <header
      className={`${styles.bar} drag`}
      style={tint(tab?.themeColor)}
      data-tinted={tab?.themeColor ? true : undefined}
      data-testid="address-bar"
    >
      <div className={`${styles.nav} no-drag`}>
        <button
          className={styles.button}
          aria-label="Back"
          title="Back (⌘[)"
          disabled={!tab?.canGoBack}
          onClick={() => run('browser.goBack')}
        >
          <ArrowLeft size={15} weight="bold" />
        </button>
        <button
          className={styles.button}
          aria-label="Forward"
          title="Forward (⌘])"
          disabled={!tab?.canGoForward}
          onClick={() => run('browser.goForward')}
        >
          <ArrowRight size={15} weight="bold" />
        </button>
        <button
          className={styles.button}
          aria-label="Reload"
          title="Reload (⌘R)"
          disabled={!tab}
          data-loading={tab?.loading}
          onClick={() => run('browser.reload')}
        >
          <ArrowClockwise size={15} weight="bold" />
        </button>
      </div>

      {editing ? (
        <input
          ref={input}
          className={`${styles.input} no-drag`}
          aria-label="Address"
          placeholder="Search or enter address"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            else if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <button
          className={`${styles.url} no-drag`}
          onClick={startEditing}
          title={tab?.url}
          data-testid="url"
        >
          {tab?.host ? (
            <>
              <span className={styles.host} data-testid="url-host">
                {tab.host}
              </span>
              <span className={styles.rest} data-testid="url-rest">
                {tab.rest}
              </span>
            </>
          ) : (
            <span className={styles.placeholder}>Search or enter address</span>
          )}
        </button>
      )}

      {/* Same width as the navigation buttons, so the URL stays centred. */}
      <div className={`${styles.nav} ${styles.actions} no-drag`}>
        <button
          className={styles.button}
          aria-label="Site menu"
          title="Site menu"
          aria-haspopup="dialog"
          aria-expanded={siteMenuOpen}
          disabled={!tab}
          onClick={(e) => {
            setSiteMenuOpen(true)
            // The menu floats over the page in the overlay view, under the button.
            window.acab
              .invoke('overlay.open', { kind: 'site-menu', anchor: anchorOf(e.currentTarget) })
              .catch(() => setSiteMenuOpen(false))
          }}
        >
          <SlidersHorizontal size={15} weight="bold" />
        </button>
      </div>
    </header>
  )
}
