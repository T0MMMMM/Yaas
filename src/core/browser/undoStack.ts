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
}
