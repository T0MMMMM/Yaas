import { useState, type CSSProperties } from 'react'
import {
  ArrowUp,
  CaretDown,
  FileText,
  MagnifyingGlass,
  PencilSimpleLine,
  Sparkle,
  Stack,
  TerminalWindow,
} from '@phosphor-icons/react'
import { hashUnit } from '../sidebar/hash'
import { DEMO_APPROVAL, DEMO_TRANSCRIPT, type DemoBlock } from './demoTranscript'
import styles from './SessionView.module.css'

const TOOL_ICON = {
  read: FileText,
  edit: PencilSimpleLine,
  bash: TerminalWindow,
  search: MagnifyingGlass,
}

/**
 * The open session (DESIGN.md §2): transcript, tool steps on a timeline, the approval sheet docked
 * above the composer. Demo content — the live stream comes with the provider.
 */
export function SessionView({ path }: { path: string }) {
  const [draft, setDraft] = useState('')

  return (
    <div className={styles.session} data-testid="session-view">
      <div className={styles.transcript}>
        {DEMO_TRANSCRIPT.map((block, i) => (
          <Block key={i} block={block} id={`b${i}`} />
        ))}
        <div className={styles.thinking} aria-label="Claude is working">
          <Sparkle size={15} weight="fill" />
          <span>Waiting for your approval</span>
        </div>
      </div>

      <div className={styles.dock}>
        <section className={styles.approval} aria-label="Permission request">
          <div className={styles.approvalText}>
            <TerminalWindow size={18} />
            <span>
              Claude wants to run <code>{DEMO_APPROVAL.command}</code>
            </span>
          </div>
          <div className={styles.approvalActions}>
            <button className={styles.deny}>
              Deny <kbd>Esc</kbd>
            </button>
            <button className={styles.always}>
              Always for project <kbd>⌘⏎</kbd>
            </button>
            <button className={styles.allow}>
              Allow once <kbd>⏎</kbd>
            </button>
          </div>
        </section>

        <form className={styles.composer} onSubmit={(e) => e.preventDefault()}>
          <textarea
            className={styles.input}
            placeholder="Reply to Claude…"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Message"
          />
          <div className={styles.composerBar}>
            <button type="button" className={styles.chip}>
              <Stack size={14} /> Clean
              <CaretDown size={11} weight="bold" />
            </button>
            <button type="button" className={styles.chip}>
              <Sparkle size={14} /> Sonnet
              <CaretDown size={11} weight="bold" />
            </button>
            <span className={styles.path}>{path}</span>
            <button
              type="submit"
              className={styles.send}
              aria-label="Send"
              disabled={draft.trim() === ''}
            >
              <ArrowUp size={16} weight="bold" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Block({ block, id }: { block: DemoBlock; id: string }) {
  const [open, setOpen] = useState(true)

  if (block.kind === 'user') {
    // A note handed to Claude, pinned a little askew like the sidebar cards.
    const tilt = (hashUnit(id) - 0.5) * 1.6
    return (
      <div className={styles.user} style={{ '--tilt': `${tilt}deg` } as CSSProperties}>
        {block.text}
      </div>
    )
  }

  if (block.kind === 'assistant') {
    return <p className={styles.assistant}>{renderInlineCode(block.text)}</p>
  }

  const Icon = TOOL_ICON[block.tool]
  return (
    <div className={styles.tool} data-tool={block.tool}>
      <span className={styles.node}>
        <Icon size={14} />
      </span>
      <button
        className={styles.toolHead}
        onClick={() => block.diff && setOpen((o) => !o)}
        aria-expanded={block.diff ? open : undefined}
      >
        <span className={styles.toolTitle}>{block.title}</span>
        {block.detail && <span className={styles.toolDetail}>{block.detail}</span>}
        {block.diff && (
          <CaretDown size={12} weight="bold" className={styles.caret} data-open={open} />
        )}
      </button>
      {block.diff && open && (
        <pre className={styles.diff}>
          {block.diff.map((line, i) => (
            <span key={i} className={styles.diffLine} data-sign={line.sign}>
              <span className={styles.sign}>{line.sign}</span>
              {line.text}
            </span>
          ))}
        </pre>
      )}
    </div>
  )
}

/** `code` spans inside assistant text. */
function renderInlineCode(text: string) {
  return text
    .split(/(`[^`]+`)/g)
    .map((part, i) =>
      part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part,
    )
}
