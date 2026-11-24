import { useEffect, useRef, useState } from 'react'
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  Check,
  LinkSimple,
  SlidersHorizontal,
} from '@phosphor-icons/react'
import { useUi } from '../../stores/ui'
import { anchorOf } from '../../ui/anchor'
import { useWorkspace } from '../workspace/useWorkspace'
import { addressBarTint } from './addressBarTint'
import styles from './AddressBar.module.css'

const BLANK = 'about:blank'
/** How long Copy link shows its check mark. */
const COPIED_MS = 1200

interface AddressBarProps {
  /** True when the bar sits inside one half of a split view (lets nav groups shrink cleanly). */
  compact?: boolean
}

/**
 * Address bar inside the page card (redesign direction §2): back, forward, reload, and a centred
 * transparent URL field (ink 0.05 on hover/edit, host bright + path faint). Page-action icons on
 * the right (Copy link, Site menu) reveal on hover or focus. Inherits the page's theme-color.
 */
export function AddressBar({ compact = false }: AddressBarProps = {}) {
  const tab = useWorkspace()?.activeTab ?? null
  const addressFocus = useUi((s) => s.addressFocus)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement>(null)
  /** Whether the site menu is open in the overlay. */
  const [siteMenuOpen, setSiteMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => window.bigBrowser.on('overlay.closed', () => setSiteMenuOpen(false)), [])
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

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
    if (tab) void window.bigBrowser.invoke('browser.navigate', { tabId: tab.id, input: text })
    else void window.bigBrowser.invoke('browser.openTab', { input: text })
  }

  const run = (command: 'browser.goBack' | 'browser.goForward' | 'browser.reload') => {
    if (tab) void window.bigBrowser.invoke(command, { tabId: tab.id })
  }

  const barTint = addressBarTint(tab?.themeColor)

  return (
    <header
      className={`${styles.bar} drag`}
      style={barTint}
      data-tinted={barTint ? true : undefined}
      data-compact={compact || undefined}
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
          <ArrowLeft size={15} weight="regular" />
        </button>
        <button
          className={styles.button}
          aria-label="Forward"
          title="Forward (⌘])"
          disabled={!tab?.canGoForward}
          onClick={() => run('browser.goForward')}
        >
          <ArrowRight size={15} weight="regular" />
        </button>
        <button
          className={styles.button}
          aria-label="Reload"
          title="Reload (⌘R)"
          disabled={!tab}
          data-loading={tab?.loading}
          onClick={() => run('browser.reload')}
        >
          <ArrowClockwise size={15} weight="regular" />
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
          aria-label={copied ? 'Link copied' : 'Copy link'}
          title="Copy link"
          disabled={!tab}
          data-copied={copied || undefined}
          onClick={() => {
            if (!tab) return
            void window.bigBrowser.invoke('browser.copyLink', { tabId: tab.id })
            setCopied(true)
          }}
        >
          {copied ? (
            <Check size={15} weight="regular" />
          ) : (
            <LinkSimple size={15} weight="regular" />
          )}
        </button>
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
            window.bigBrowser
              .invoke('overlay.open', { kind: 'site-menu', anchor: anchorOf(e.currentTarget) })
              .catch(() => setSiteMenuOpen(false))
          }}
        >
          <SlidersHorizontal size={15} weight="regular" />
        </button>
      </div>
    </header>
  )
}
