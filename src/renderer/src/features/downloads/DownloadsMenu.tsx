import { CheckCircle, FileArrowDown, WarningCircle } from '@phosphor-icons/react'
import type { Download } from '@shared/model'
import { useDownloads } from '../../stores/downloads'
import { useSettings } from '../../stores/settings'
import { formatBytes, fraction } from './format'
import styles from './DownloadsMenu.module.css'

function show(id: string): void {
  void window.bigBrowser
    .invoke('downloads.show', { id })
    .catch((error: unknown) => console.warn('Show download failed:', error))
}

function clear(): void {
  void window.bigBrowser.invoke('downloads.clear')
}

function Row({ download, showLabel }: { download: Download; showLabel: string }) {
  const { state, receivedBytes, totalBytes } = download
  const share = fraction(receivedBytes, totalBytes)
  return (
    <li className={styles.row} data-testid="download" data-state={state}>
      <span className={styles.icon} aria-hidden="true">
        {state === 'completed' ? (
          <CheckCircle size={15} weight="fill" className={styles.ok} />
        ) : state === 'interrupted' ? (
          <WarningCircle size={15} weight="fill" className={styles.warn} />
        ) : (
          <FileArrowDown size={15} weight="regular" />
        )}
      </span>
      <div className={styles.body}>
        <span className={styles.name} title={download.path}>
          {download.filename}
        </span>
        {state === 'progressing' && (
          <>
            <span
              className={styles.bar}
              role="progressbar"
              aria-label={`Downloading ${download.filename}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={share === null ? undefined : Math.round(share * 100)}
              data-indeterminate={share === null || undefined}
            >
              <span className={styles.fill} style={{ width: `${(share ?? 0) * 100}%` }} />
            </span>
            <span className={styles.detail}>
              {share === null
                ? formatBytes(receivedBytes)
                : `${formatBytes(receivedBytes)} of ${formatBytes(totalBytes)}`}
            </span>
          </>
        )}
        {state === 'completed' && (
          <span className={styles.detail}>
            <span>{formatBytes(totalBytes || receivedBytes)}</span>
            <button type="button" className={styles.link} onClick={() => show(download.id)}>
              {showLabel}
            </button>
          </span>
        )}
        {state === 'interrupted' && <span className={styles.detail}>Interrupted</span>}
      </div>
    </li>
  )
}

/** The content of the downloads card: every space's downloads, newest first, with Clear. */
export function DownloadsMenu() {
  const list = useDownloads((s) => s.list)
  const platform = useSettings((s) => s.info?.platform)
  const showLabel = platform === 'mac' ? 'Show in Finder' : 'Show in Explorer'
  const finished = list.some((d) => d.state !== 'progressing')
  return (
    <div className={styles.menu}>
      <div className={styles.header}>
        <h2 className={styles.title}>Downloads</h2>
        <button type="button" className={styles.clear} disabled={!finished} onClick={clear}>
          Clear
        </button>
      </div>
      {list.length === 0 ? (
        <p className={styles.empty}>No downloads yet</p>
      ) : (
        <ul className={styles.list} aria-label="Downloads">
          {list.map((d) => (
            <Row key={d.id} download={d} showLabel={showLabel} />
          ))}
        </ul>
      )}
    </div>
  )
}
