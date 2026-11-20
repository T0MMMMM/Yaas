/** An item still drawn, either present or playing its exit animation. */
export interface Present<T> {
  item: T
  exiting: boolean
}

/**
 * Merges the next list into what is drawn: every item of `next` in its order (not exiting), and
 * each item of `previous` that is gone from `next` and `exits` kept right after the item that
 * preceded it in `previous` (first if none did), exiting. An item already exiting that is still
 * missing stays once, so closing several rows fast never duplicates or reorders the others. A
 * missing item that does not `exit` (it moved to another list, or its space was left) is dropped
 * at once, so it is never drawn twice.
 */
export function withPresence<T>(
  previous: Present<T>[],
  next: T[],
  key: (item: T) => string,
  exits: (item: T) => boolean = () => true,
): Present<T>[] {
  const result: Present<T>[] = next.map((item) => ({ item, exiting: false }))
  const present = new Set(next.map(key))
  previous.forEach((entry, index) => {
    if (present.has(key(entry.item)) || !exits(entry.item)) return
    const before = previous[index - 1]
    // The predecessor is either in `next` or an exiting entry inserted just before.
    const at = before === undefined ? -1 : result.findIndex((r) => key(r.item) === key(before.item))
    result.splice(at + 1, 0, { item: entry.item, exiting: true })
  })
  return result
}
