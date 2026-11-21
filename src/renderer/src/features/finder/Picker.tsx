import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss } from '../../ui/useDismiss'
import styles from './Picker.module.css'

export interface PickerRow {
  key: string
  icon: ReactNode
  label: string
  /** Dimmed, after the label (a host, a space, "In <folder>"). */
  hint?: string
  /** What Enter does with it ("Switch to Tab"), shown in the footer while it is selected. */
  enterLabel?: string
  /** Draws a "−" button that removes it (a history page), named `removeLabel`. */
  onRemove?(): void
  removeLabel?: string
}

/** Rows under a title (or none: the rows on top). */
export interface PickerSection {
  title: string | null
  rows: PickerRow[]
}

interface PickerProps {
  /** The field's accessible name, and its placeholder. */
  label: string
  query: string
  onQuery(query: string): void
  /** One untitled list, or `sections`. */
  rows?: PickerRow[]
  sections?: PickerSection[]
  /** Runs a row (Enter or a click); the picker closes after. */
  onRun(row: PickerRow): void
  /** Plays the exit animation (the overlay hides it once done). */
  closing?: boolean
  onClose(): void
  testId: string
}

/**
 * The card of the tab finder and the command field: a field over a list (in titled sections, for
 * the command field), centred near the top of the window, in the overlay. ↑/↓ move the selection
 * across sections, Enter runs it, Escape or a click outside closes. A footer names what Enter does
 * when the selected row says.
 */
export function Picker({
  label,
  query,
  onQuery,
  rows: plainRows = [],
  sections: givenSections,
  onRun,
  closing = false,
  onClose,
  testId,
}: PickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(0)
  useDismiss(ref, onClose)

  const optionId = (i: number) => `${testId}-option-${i}`
  const sections = givenSections ?? [{ title: null, rows: plainRows }]
  const rows = sections.flatMap((s) => s.rows)
  const index = Math.min(selected, rows.length - 1)
  const enterLabel = rows[index]?.enterLabel

  const run = (row: PickerRow | undefined) => {
    // A closing card runs nothing more (a quick second Enter would run the row twice).
    if (!row || closing) return
    // The action first: the exit animation only delays hiding the card.
    onRun(row)
    onClose()
  }

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
            const next = (index + step + rows.length) % rows.length
            setSelected(next)
            // Keep it in sight when the list scrolls.
            document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' })
          } else if (e.key === 'Enter') {
            e.preventDefault()
            run(rows[index])
          }
        }}
      />
      {rows.length > 0 && (
        <div className={styles.list} role="listbox" id={`${testId}-list`} aria-label="Results">
          {sections.map((section, si) => {
            if (section.rows.length === 0) return null
            // Rows are numbered across sections: ↑/↓ and the option ids count them all.
            const first = sections.slice(0, si).reduce((n, s) => n + s.rows.length, 0)
            const titleId = `${testId}-section-${si}`
            return (
              <div
                key={section.title ?? `untitled-${si}`}
                className={styles.section}
                role={section.title ? 'group' : 'presentation'}
                aria-labelledby={section.title ? titleId : undefined}
              >
                {section.title && (
                  <div id={titleId} className={styles.title}>
                    {section.title}
                  </div>
                )}
                {section.rows.map((row, ri) => {
                  const i = first + ri
                  return (
                    <div
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
                      {row.onRemove && (
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={row.removeLabel ?? 'Remove'}
                          // The field keeps the keyboard.
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation()
                            row.onRemove?.()
                          }}
                        >
                          −
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
      {enterLabel && (
        <div className={styles.footer} data-testid={`${testId}-footer`}>
          {enterLabel} <kbd className={styles.key}>↵</kbd>
        </div>
      )}
    </div>,
    document.body,
  )
}
