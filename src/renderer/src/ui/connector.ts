import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { PageBounds } from '@shared/ipc/contract'
import { POPOVER_GAP } from './anchor'

/**
 * Left edge of a popover's connector (the neck joining the card to its button), relative to the
 * card's padding box: centred on the button, but kept clear of the card's rounded corners.
 */
export function connectorLeft(
  anchor: PageBounds,
  cardLeft: number,
  cardWidth: number,
  radius: number,
  width: number,
): number {
  const centred = anchor.x + anchor.width / 2 - cardLeft - width / 2
  return Math.min(Math.max(centred, radius), cardWidth - radius - width)
}

/** Breathing room kept between the smooth connector crest and the opener button. */
const NECK_CLEARANCE = 4

/**
 * A ref for a popover card's connector (a child of the card), placed in line with `anchor` after
 * every render (the card's width follows its content), stopping `NECK_CLEARANCE` px short of the
 * button so the smooth bump never touches it. Layout values, not the bounding box, so the card's
 * open animation (a scale) does not skew it.
 */
export function useConnector(anchor: PageBounds): RefObject<HTMLSpanElement | null> {
  const connector = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const neck = connector.current
    const card = neck?.parentElement
    if (!neck || !card) return
    const radius = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0
    const left = connectorLeft(
      anchor,
      card.offsetLeft + card.clientLeft,
      card.clientWidth,
      radius,
      neck.offsetWidth,
    )
    neck.style.left = `${left}px`
    neck.style.height = `${Math.max(4, POPOVER_GAP - NECK_CLEARANCE) + card.clientTop}px`
  })
  return connector
}
