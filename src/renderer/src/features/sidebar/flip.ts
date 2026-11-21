// What the other rows do while a sidebar row is dragged (useTabDrag): instead of a drop line, they
// move aside so a gap opens where the dragged row will land. Pure maths; the drag applies it as
// CSS `translate` on the rows (dragLift.ts).

/** A row of a vertical list, as drawn (client Y, no translate). */
export interface FlipRow {
  id: string
  top: number
  height: number
}

/**
 * The `translateY` each row (the dragged one left out) takes so a gap of the dragged row's height
 * opens at drawn index `target` (its index once it has landed): the rows between the slot it left
 * and the gap shift up when it goes down, down when it goes up. A row dragged in from another list
 * is given last, so the rows from `target` on shift down. Rows in drawn order.
 */
export function gapOffsets(
  rows: FlipRow[],
  dragged: string,
  target: number,
): Record<string, number> {
  const from = rows.findIndex((r) => r.id === dragged)
  const size = rows[from]?.height ?? 0
  const offsets: Record<string, number> = {}
  rows.forEach((row, i) => {
    if (i === from) return
    if (from >= 0 && i > from && i <= target) offsets[row.id] = -size
    else if (from >= 0 && i >= target && i < from) offsets[row.id] = size
    else offsets[row.id] = 0
  })
  return offsets
}

/** A favourite tile's slot in the grid (client coordinates, no translate). */
export interface Slot {
  id: string
  left: number
  top: number
}

/**
 * Tiles wrap, so a tile does not shift by a fixed amount: each one (the dragged one left out)
 * moves into the slot of the place it takes once the dragged tile lands at `target`.
 */
export function slotShifts(
  slots: Slot[],
  dragged: string,
  target: number,
): Record<string, { x: number; y: number }> {
  const order = slots.map((s) => s.id).filter((id) => id !== dragged)
  order.splice(target, 0, dragged)
  const shifts: Record<string, { x: number; y: number }> = {}
  for (const slot of slots) {
    if (slot.id === dragged) continue
    const to = slots[order.indexOf(slot.id)] ?? slot
    shifts[slot.id] = { x: to.left - slot.left, y: to.top - slot.top }
  }
  return shifts
}
