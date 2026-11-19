import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { hexToHsl, hslToHex, isHex, type Hsl } from '../theme/color'
import { Slider } from './Slider'
import styles from './ColorPicker.module.css'

const PRESETS = [
  '#7C5CFF',
  '#FF5C8A',
  '#FF8A3D',
  '#F2C94C',
  '#2BB673',
  '#14B8C4',
  '#2D9CDB',
  '#111111',
]

const COLS = 18
const ROWS = 11
/** Lightness from the top row to the bottom row. */
const L_TOP = 0.86
const L_BOTTOM = 0.3

/** Field position (0..1) ↔ color: hue across, lightness down. */
const toHsl = (x: number, y: number, s: number): Hsl => ({
  h: x * 360,
  s,
  l: L_TOP + (L_BOTTOM - L_TOP) * y,
})
const toPoint = ({ h, l }: Hsl) => ({
  x: h / 360,
  y: Math.min(1, Math.max(0, (l - L_TOP) / (L_BOTTOM - L_TOP))),
})

/**
 * Accent picker (DESIGN.md §3.1): presets, then a field of colored dots — hue across, lightness
 * down — that swell like under a lens around the chosen color; an "intensity" wave for saturation;
 * a hex field. Every change is emitted live.
 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (hex: string) => void
}) {
  const field = useRef<HTMLDivElement>(null)
  const hsl = isHex(value) ? hexToHsl(value) : { h: 255, s: 0.8, l: 0.68 }
  const saturation = Math.max(0.15, hsl.s)
  const point = toPoint(hsl)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  // The hex field keeps what is being typed, even while it isn't a valid color yet.
  const [draft, setDraft] = useState<string | null>(null)

  const dots = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => {
        const x = (i % COLS) / (COLS - 1)
        const y = Math.floor(i / COLS) / (ROWS - 1)
        return { x, y, color: hslToHex(toHsl(x, y, saturation)) }
      }),
    [saturation],
  )

  const pickAt = (clientX: number, clientY: number) => {
    const box = field.current?.getBoundingClientRect()
    if (!box) return
    const x = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    const y = Math.min(1, Math.max(0, (clientY - box.top) / box.height))
    onChange(hslToHex(toHsl(x, y, saturation)))
  }

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 1 / (COLS - 1)
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -1 / (ROWS - 1)],
      ArrowDown: [0, 1 / (ROWS - 1)],
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    const x = (point.x + move[0] + 1) % 1
    const y = Math.min(1, Math.max(0, point.y + move[1]))
    onChange(hslToHex(toHsl(x, y, saturation)))
  }

  /** Dots swell near the chosen color and near the pointer. */
  const scaleOf = (x: number, y: number) => {
    const near = (p: { x: number; y: number } | null, reach: number) =>
      p ? Math.max(0, 1 - Math.hypot((x - p.x) * 1.6, y - p.y) / reach) : 0
    return 1 + Math.max(near(point, 0.28) * 1.1, near(hover, 0.22) * 0.9)
  }

  return (
    <div className={styles.picker}>
      <div className={styles.presets} role="radiogroup" aria-label="Preset colors">
        {PRESETS.map((color) => (
          <button
            key={color}
            role="radio"
            aria-checked={value.toUpperCase() === color}
            aria-label={color}
            className={styles.preset}
            style={{ background: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>

      <div
        ref={field}
        className={styles.field}
        role="slider"
        tabIndex={0}
        aria-label="Color field: hue across, lightness down"
        aria-valuetext={value}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pickAt(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          const box = field.current?.getBoundingClientRect()
          if (box) {
            setHover({
              x: (e.clientX - box.left) / box.width,
              y: (e.clientY - box.top) / box.height,
            })
          }
          if (e.buttons === 1) pickAt(e.clientX, e.clientY)
        }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
      >
        {dots.map((d, i) => (
          <span
            key={i}
            className={styles.dot}
            style={
              {
                left: `${d.x * 100}%`,
                top: `${d.y * 100}%`,
                background: d.color,
                '--scale': scaleOf(d.x, d.y).toFixed(2),
              } as CSSProperties
            }
          />
        ))}
        <span
          className={styles.knob}
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, background: value }}
        />
      </div>

      <Slider
        label="Intensity"
        variant="wave"
        value={saturation}
        onChange={(s) => onChange(hslToHex({ ...hsl, s: Math.max(0.15, s) }))}
      />

      <div className={styles.footer}>
        <span className={styles.swatch} style={{ background: value }} />
        <input
          className={styles.hex}
          value={draft ?? value}
          spellCheck={false}
          maxLength={7}
          aria-label="Hex color"
          aria-invalid={draft !== null && !isHex(draft)}
          onChange={(e) => {
            const text = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
            setDraft(text)
            if (isHex(text)) onChange(text.toUpperCase())
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
    </div>
  )
}
