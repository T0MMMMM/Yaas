import { describe, expect, it } from 'vitest'
import { connectorLeft } from './connector'

const RADIUS = 9
const WIDTH = 14

describe('connectorLeft', () => {
  it('centres the neck on a button inside the card', () => {
    const anchor = { x: 100, y: 500, width: 28, height: 28 }
    expect(connectorLeft(anchor, 60, 200, RADIUS, WIDTH)).toBe(100 + 14 - 60 - 7)
  })

  it('keeps the neck clear of the left rounded corner', () => {
    const anchor = { x: 40, y: 500, width: 10, height: 28 }
    expect(connectorLeft(anchor, 60, 200, RADIUS, WIDTH)).toBe(RADIUS)
  })

  it('keeps the neck clear of the right rounded corner', () => {
    const anchor = { x: 250, y: 500, width: 28, height: 28 }
    expect(connectorLeft(anchor, 60, 200, RADIUS, WIDTH)).toBe(200 - RADIUS - WIDTH)
  })
})
