// A bounded last-in first-out stack, kept in memory: the oldest entries drop off when full.

export const UNDO_CAPACITY = 20

export class UndoStack<T> {
  private readonly entries: T[] = []

  constructor(private readonly capacity = UNDO_CAPACITY) {}

  push(entry: T): void {
    this.entries.push(entry)
    if (this.entries.length > this.capacity) this.entries.shift()
  }

  pop(): T | undefined {
    return this.entries.pop()
  }

  /** Replaces each entry with `map(entry)`, in place; an entry mapped to null is dropped. */
  rewrite(map: (entry: T) => T | null): void {
    const kept = this.entries.flatMap((entry) => {
      const next = map(entry)
      return next === null ? [] : [next]
    })
    this.entries.splice(0, this.entries.length, ...kept)
  }
}
