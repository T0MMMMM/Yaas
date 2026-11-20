import { useEffect, useRef, useState } from 'react'
import { withPresence, type Present } from './presence'

const same = <T>(a: Present<T>[], b: Present<T>[]): boolean =>
  a.length === b.length && a.every((e, i) => e.item === b[i]?.item && e.exiting === b[i]?.exiting)

/** Keys are joined with this in the effect's dependency; it appears in no key. */
const SEPARATOR = '\u0000'

/**
 * `items` as they are drawn: a removed item stays for `exitMs` flagged `exiting`, so its row can
 * play an exit animation, then is dropped.
 */
export function usePresence<T>(items: T[], key: (item: T) => string, exitMs: number): Present<T>[] {
  const [kept, setKept] = useState<Present<T>[]>(() => withPresence([], items, key))
  const drawn = withPresence(kept, items, key)
  // Remembers what is drawn, so the next render merges into it (state set during render).
  if (!same(kept, drawn)) setKept(drawn)

  const timers = useRef(new Map<string, number>())
  const exitingKeys = drawn
    .filter((e) => e.exiting)
    .map((e) => key(e.item))
    .join(SEPARATOR)

  useEffect(() => {
    const exiting = new Set(exitingKeys === '' ? [] : exitingKeys.split(SEPARATOR))
    for (const [k, timer] of timers.current) {
      // Came back: its pending removal no longer applies.
      if (!exiting.has(k)) {
        window.clearTimeout(timer)
        timers.current.delete(k)
      }
    }
    for (const k of exiting) {
      if (timers.current.has(k)) continue
      timers.current.set(
        k,
        window.setTimeout(() => {
          timers.current.delete(k)
          setKept((current) => current.filter((e) => !(e.exiting && key(e.item) === k)))
        }, exitMs),
      )
    }
  }, [exitingKeys, exitMs, key])

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer))
      pending.clear()
    }
  }, [])

  return drawn
}
