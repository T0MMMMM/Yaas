import type { Ref } from 'react'
import popover from './Popover.module.css'

/*
 * The funnel's shape, drawn for a card above its button (the `top` side is the same, flipped): a
 * triangle pointing at the button, every corner rounded. The viewBox is the nominal size —
 * `--connector-w` 28 wide, the gap (POPOVER_GAP 10) plus the card's border tall — and stretches to
 * the size set at runtime. Its wide side leaves the card's border tangent to it (two concave
 * corners), its sides run straight down and meet in a broad round tip resting on the button.
 */
const W = 28
const PATH_LEFT = 'M0 0 C3.6 0 5.8 1.1 7.4 3.1 L11.2 8.2'
const TIP = `C12.4 12.3 ${W - 12.4} 12.3 ${W - 11.2} 8.2`
const PATH_RIGHT = `L${W - 7.4} 3.1 C${W - 5.8} 1.1 ${W - 3.6} 0 ${W} 0`
const FILL = `${PATH_LEFT} ${TIP} ${PATH_RIGHT} Z`
const EDGE = `${PATH_LEFT} ${TIP} ${PATH_RIGHT}`

/**
 * The funnel joining a popover card to the button it opens from (`side`: where it leaves the
 * card). `ref` comes from useConnector, which places and sizes it.
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
      <svg viewBox={`0 0 ${W} 11`} preserveAspectRatio="none">
        <path className={popover.neckFill} d={FILL} />
        <path className={popover.neckEdge} d={EDGE} vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  )
}
