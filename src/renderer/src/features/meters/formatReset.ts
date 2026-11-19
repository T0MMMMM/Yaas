const pad = (n: number) => String(n).padStart(2, '0')

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/**
 * Reset time of a usage window, as shown in the top bar (DESIGN.md §2):
 * `{ clock: '17:30', left: '3h11' }` today, `{ clock: 'Fri. 14:00', left: '23h41' }` otherwise.
 */
export function formatReset(resetsAt: Date, now: Date): { clock: string; left: string } {
  const time = `${pad(resetsAt.getHours())}:${pad(resetsAt.getMinutes())}`
  const weekday = resetsAt.toLocaleDateString('en-US', { weekday: 'short' })
  const clock = sameDay(resetsAt, now) ? time : `${weekday}. ${time}`

  const minutes = Math.max(0, Math.floor((resetsAt.getTime() - now.getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  let left: string
  if (minutes === 0) left = 'now'
  else if (hours === 0) left = `${minutes}m`
  else if (hours < 48) left = `${hours}h${pad(minutes % 60)}`
  else left = `${Math.floor(hours / 24)}d ${hours % 24}h`

  return { clock, left }
}
