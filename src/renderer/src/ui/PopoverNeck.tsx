import type { Ref } from 'react'
import popover from './Popover.module.css'

/*
 * Smooth, gentle bell-curve bump leaving the card's border tangentially and cresting cleanly
 * before the button (never pointy, never touching the button). Drawn for a card above its button;
 * the `top` side flips it vertically in CSS.
 */
const W = 28
const H = 8
const CURVE = `M0 0 C8 0 10.5 ${H - 1} ${W / 2} ${H - 1} C${W - 10.5} ${H - 1} ${W - 8} 0 ${W} 0`
const FILL = `${CURVE} Z`
const EDGE = CURVE

/**
 * The smooth bump joining a popover card to the button it opens from (`side`: where it leaves the
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
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path className={popover.neckFill} d={FILL} />
        <path className={popover.neckEdge} d={EDGE} vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  )
}
