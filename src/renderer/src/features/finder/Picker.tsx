import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useDismiss } from '../../ui/useDismiss'
import styles from './Picker.module.css'

export interface PickerRow {
  key: string
  icon: ReactNode
  label: string
  /** Dimmed, after the label (a host, a space, "In <folder>"). */
  hint?: string
  /** What Enter does with it ("Switch to Tab"), shown in the footer pill while it is selected. */
  enterLabel?: string
  /** Draws a "−" button that removes it, named `removeLabel`. */
  onRemove?(): void
  removeLabel?: string
}

/** Rows under a title (or none: the rows on top). */
export interface PickerSection {
  title: string | null
  rows: PickerRow[]
}

interface PickerProps {
  /** The field's accessible name. */
  label: string
  /** Placeholder text shown when the field is empty (defaults to `${label}…`). */
  placeholder?: string
  query: string
  onQuery(query: string): void
  /** One untitled list, or `sections`. */
  rows?: PickerRow[]
  sections?: PickerSection[]
  /** Action pills placed on the left side of the bottom bar. */
  footerActions?: ReactNode
  /** Left edge of the web page area (the sidebar width), so the card centres on the web window. */
  contentLeft?: number
  /** Runs a row (Enter or a click); the picker closes after. */
  onRun(row: PickerRow): void
  /** Plays the exit animation (the overlay hides it once done). */
  closing?: boolean
  onClose(): void
  testId: string
}

/**
 * The card of the tab finder and the command field: a field over a list (in titled sections, for
 * the command field), centred over the web window in the overlay. ↑/↓ move the selection across
 * sections, Enter runs it, Escape or a click outside closes. A floating pill footer holds quick
 * actions on the left and the Enter action on the right.
 */
export function Picker({
  label,
  placeholder,
  query,
  onQuery,
  rows: plainRows = [],
  sections: givenSections,
  footerActions,
  contentLeft = 0,
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
  const showFooter = Boolean(footerActions || enterLabel)

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
      style={{ '--content-left': `${contentLeft}px` } as CSSProperties}
      data-state={closing ? 'closing' : 'open'}
      // While it animates out it takes no focus, keys or clicks.
      inert={closing}
      data-testid={testId}
    >
      <div className={styles.fieldRow}>
        <span className={styles.searchIcon} aria-hidden="true">
          <MagnifyingGlass size={16} weight="regular" />
        </span>
        <input
          className={styles.field}
          role="combobox"
          aria-label={label}
          aria-expanded={rows.length > 0}
          aria-controls={`${testId}-list`}
          aria-activedescendant={index >= 0 ? optionId(index) : undefined}
          placeholder={placeholder ?? `${label}…`}
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
      </div>
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
      {showFooter && (
        <div className={styles.footer}>
          <div className={styles.footerActions}>{footerActions}</div>
          {enterLabel && (
            <button
              type="button"
              className={styles.enterPill}
              data-testid={`${testId}-footer`}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(rows[index])}
            >
              <span>{enterLabel}</span>
              <kbd className={styles.key}>↵</kbd>
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}
