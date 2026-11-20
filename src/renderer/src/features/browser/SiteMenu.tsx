import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Code, Export, LockSimple, LockSimpleOpen, Plus, ShieldCheck } from '@phosphor-icons/react'
import type { PageBounds } from '@shared/ipc/contract'
import { spacePartition } from '@shared/spaces'
import { useSettings } from '../../stores/settings'
import { POPOVER_GAP } from '../../ui/anchor'
import { useConnector } from '../../ui/connector'
import popover from '../../ui/Popover.module.css'
import { Switch } from '../../ui/Switch'
import { useDismiss } from '../../ui/useDismiss'
import { useWorkspace } from '../workspace/useWorkspace'
import { blocksAdsOn, withAdsBlockedOn } from './siteAdBlock'
import styles from './SiteMenu.module.css'

interface SiteMenuProps {
  /** Rect of the address bar button it opens from; the card opens below it, right-aligned. */
  anchor: PageBounds
  /** Plays the exit animation (the overlay hides it once done). */
  closing?: boolean
  onClose(): void
}

/**
 * Number of actions `<browser-action-list>` shows: it renders them in its shadow root, after
 * asking main, so they are counted as they appear.
 */
function useActionCount(list: HTMLElement | null): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const root = list?.shadowRoot
    if (!root) return
    const recount = () => setCount(root.querySelectorAll('.action').length)
    recount()
    const observer = new MutationObserver(recount)
    observer.observe(root, { childList: true })
    return () => observer.disconnect()
  }, [list])
  return count
}

/**
 * The address bar's site menu (spec, "Menus and settings"), in the overlay: quick actions, the
 * tab's extension actions, this site's settings and the connection. Pages that are not web pages
 * (about:blank) only get the extensions.
 */
export function SiteMenu({ anchor, closing = false, onClose }: SiteMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [actionList, setActionList] = useState<HTMLElement | null>(null)
  const actionCount = useActionCount(actionList)
  const workspace = useWorkspace()
  const adBlock = useSettings((s) => s.settings?.adBlock)
  const updateSettings = useSettings((s) => s.update)
  useDismiss(ref, onClose)
  const connector = useConnector(anchor)

  const tab = workspace?.activeTab ?? null
  const site = tab?.siteHost ?? null

  /** Runs a command on the tab and closes the menu: it opens something else (a menu, a window). */
  const act = (command: 'browser.share' | 'browser.toggleDevTools') => () => {
    if (tab) void window.acab.invoke(command, { tabId: tab.id })
    onClose()
  }

  const place: CSSProperties = {
    top: anchor.y + anchor.height + POPOVER_GAP,
    right: Math.max(0, window.innerWidth - anchor.x - anchor.width),
  }

  return (
    <div
      ref={ref}
      className={`${styles.card} no-drag`}
      style={place}
      data-state={closing ? 'closing' : 'open'}
      role="dialog"
      aria-label="Site menu"
      data-testid="site-menu"
    >
      <span
        ref={connector}
        className={popover.connector}
        data-side="top"
        aria-hidden
        data-testid="connector"
      />
      {site && (
        <div className={styles.quickActions}>
          <button
            className={styles.quickAction}
            aria-label="Share"
            title="Share"
            onClick={act('browser.share')}
          >
            <Export size={18} />
          </button>
        </div>
      )}

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Extensions</h3>
          <button className={styles.textButton} disabled>
            Manage <span className={styles.soon}>Soon</span>
          </button>
          <button
            className={styles.iconButton}
            aria-label="Add extensions"
            title="Chrome Web Store"
            onClick={() => {
              void window.acab.invoke('browser.openWebStore')
              onClose()
            }}
          >
            <Plus size={14} weight="bold" />
          </button>
        </header>
        <div className={styles.extensions}>
          {workspace && (
            <browser-action-list
              ref={setActionList}
              className={styles.actionList}
              partition={spacePartition(workspace.space.id)}
              tab={tab?.webContentsId ?? undefined}
            />
          )}
          {actionCount === 0 && <p className={styles.empty}>No extensions yet</p>}
        </div>
      </section>

      {site && adBlock && (
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>This site</h3>
          </header>
          <div className={styles.group}>
            <div className={styles.row}>
              <ShieldCheck size={18} className={styles.rowIcon} />
              <div className={styles.rowText}>
                <span className={styles.rowTitle}>Block ads and trackers</span>
                <span className={styles.rowStatus}>
                  {!adBlock.enabled
                    ? 'Off everywhere'
                    : blocksAdsOn(adBlock, site)
                      ? 'On for this site'
                      : 'Off for this site'}
                </span>
              </div>
              <Switch
                label="Block ads and trackers"
                checked={blocksAdsOn(adBlock, site)}
                disabled={!adBlock.enabled}
                onChange={(blocked) =>
                  void updateSettings({ adBlock: withAdsBlockedOn(adBlock, site, blocked) })
                }
              />
            </div>
            <button className={styles.row} onClick={act('browser.toggleDevTools')}>
              <Code size={18} className={styles.rowIcon} />
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>Developer tools</span>
                <span className={styles.rowStatus}>Inspect this page</span>
              </span>
            </button>
          </div>
        </section>
      )}

      {tab?.connection && (
        <footer className={styles.footer}>
          {tab.connection === 'secure' ? <LockSimple size={14} /> : <LockSimpleOpen size={14} />}
          <span>{tab.connection === 'secure' ? 'Secure' : 'Not secure'}</span>
          <span className={styles.host}>{tab.host}</span>
        </footer>
      )}
    </div>
  )
}
