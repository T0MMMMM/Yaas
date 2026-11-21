import { describe, expect, it } from 'vitest'
import { UndoStack } from './undoStack'

describe('UndoStack', () => {
  it('pops the last pushed entry first', () => {
    const stack = new UndoStack<number>()
    stack.push(1)
    stack.push(2)
    expect(stack.pop()).toBe(2)
    expect(stack.pop()).toBe(1)
    expect(stack.pop()).toBeUndefined()
  })

  it('keeps the last 20 entries', () => {
    const stack = new UndoStack<number>()
    for (let i = 1; i <= 25; i++) stack.push(i)
    const popped: number[] = []
    for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) popped.push(entry)
    expect(popped).toHaveLength(20)
    expect(popped[0]).toBe(25)
    expect(popped.at(-1)).toBe(6)
  })

  it('rewrites its entries in place, dropping those mapped to null', () => {
    const stack = new UndoStack<number>()
    for (const n of [1, 2, 3, 4]) stack.push(n)
    stack.rewrite((n) => (n % 2 === 0 ? null : n * 10))
    expect(stack.pop()).toBe(30)
    expect(stack.pop()).toBe(10)
    expect(stack.pop()).toBeUndefined()
  })
})
