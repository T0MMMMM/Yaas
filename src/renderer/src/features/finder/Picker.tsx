import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss } from '../../ui/useDismiss'
import styles from './Picker.module.css'

export interface PickerRow {
  key: string
  icon: ReactNode
  label: string
  /** Dimmed, after the label (a host, a space, "Switch to tab"). */
  hint?: string
}

interface PickerProps {
  /** The field's accessible name, and its placeholder. */
  label: string
  query: string
  onQuery(query: string): void
  rows: PickerRow[]
  /** Runs a row (Enter or a click); the picker closes after. */
  onRun(row: PickerRow): void
  /** Plays the exit animation (the overlay hides it once done). */
  closing?: boolean
  onClose(): void
  testId: string
}

/**
 * The card of the tab finder and the command field: a field over a list, centred near the top of
 * the window, in the overlay. ↑/↓ move the selection, Enter runs it, Escape or a click outside
 * closes.
 */
export function Picker({
  label,
  query,
  onQuery,
  rows,
  onRun,
  closing = false,
  onClose,
  testId,
}: PickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(0)
  useDismiss(ref, onClose)

  const index = Math.min(selected, rows.length - 1)

  const run = (row: PickerRow | undefined) => {
    // A closing card runs nothing more (a quick second Enter would run the row twice).
    if (!row || closing) return
    // The action first: the exit animation only delays hiding the card.
    onRun(row)
    onClose()
  }

  const optionId = (i: number) => `${testId}-option-${i}`

  return createPortal(
    <div
      ref={ref}
      className={`${styles.card} no-drag`}
      data-state={closing ? 'closing' : 'open'}
      // While it animates out it takes no focus, keys or clicks.
      inert={closing}
      data-testid={testId}
    >
      <input
        className={styles.field}
        role="combobox"
        aria-label={label}
        aria-expanded={rows.length > 0}
        aria-controls={`${testId}-list`}
        aria-activedescendant={index >= 0 ? optionId(index) : undefined}
        placeholder={`${label}…`}
        value={query}
        autoFocus
        spellCheck={false}
        onChange={(e) => {
          // A new query selects its first row again.
          setSelected(0)
          onQuery(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (rows.length === 0) return
            const step = e.key === 'ArrowDown' ? 1 : -1
            setSelected((index + step + rows.length) % rows.length)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            run(rows[index])
          }
        }}
      />
      {rows.length > 0 && (
        <ul className={styles.list} role="listbox" id={`${testId}-list`} aria-label="Results">
          {rows.map((row, i) => (
            <li
              key={row.key}
              id={optionId(i)}
              role="option"
              aria-selected={i === index}
              className={styles.row}
              onMouseMove={() => setSelected(i)}
              // Before the field loses focus to the click.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(row)}
            >
              <span className={styles.icon}>{row.icon}</span>
              <span className={styles.label}>{row.label}</span>
              {row.hint && <span className={styles.hint}>{row.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  )
}
