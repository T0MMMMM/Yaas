import type { Ref } from 'react'
import popover from './Popover.module.css'

/*
 * The neck's shape, drawn for a card above its button (the `top` side is the same, flipped): an
 * hourglass. The viewBox is the nominal size — `--connector-w` 14 plus `--connector-flare` 8 on
 * each side, by the gap (POPOVER_GAP 10) plus the card's border — and stretches to the size set at
 * runtime. Each edge leaves the card's border tangent to it, narrows into the stem, then widens
 * again into the button (whose corners on this side go square while open), so card, neck and
 * button read as one poured shape. Only the half by the card is outlined, like the card; the half
 * by the button melts into it.
 */
const W = 30
const H = 11
const F = 8
const MID = H / 2
const DOWN_LEFT = `M0 0 C${F * 0.6} 0 ${F} ${MID * 0.4} ${F} ${MID}`
const DOWN_RIGHT = `M${W} 0 C${W - F * 0.6} 0 ${W - F} ${MID * 0.4} ${W - F} ${MID}`
const FILL = [
  DOWN_LEFT,
  `C${F} ${H - MID * 0.4} ${F * 0.6} ${H} 0 ${H}`,
  `L${W} ${H}`,
  `C${W - F * 0.6} ${H} ${W - F} ${H - MID * 0.4} ${W - F} ${MID}`,
  `C${W - F} ${MID * 0.4} ${W - F * 0.6} 0 ${W} 0 Z`,
].join(' ')

/**
 * The neck joining a popover card to the button it opens from (`side`: where it leaves the card).
 * `ref` comes from useConnector, which places and sizes it.
 */
export function PopoverNeck({ side, ref }: { side: 'top' | 'bottom'; ref: Ref<HTMLSpanElement> }) {
  return (
    <span
      ref={ref}
      className={popover.connector}
      data-side={side}
      aria-hidden
      data-testid="connector"
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path className={popover.neckFill} d={FILL} />
        <path
          className={popover.neckEdge}
          d={`${DOWN_LEFT} ${DOWN_RIGHT}`}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  )
}
