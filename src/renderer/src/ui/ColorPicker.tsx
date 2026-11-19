import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { hexToHsv, hsvToHex, isHex, type Hsv } from '../theme/color'
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

/**
 * Accent picker (DESIGN.md §3.1): presets on top, a hue/saturation wheel, a brightness ramp and a
 * hex field. Every change is emitted live.
 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (hex: string) => void
}) {
  const wheel = useRef<HTMLDivElement>(null)
  const hsv = safeHsv(value)
  // The field keeps what is being typed, even while it isn't a valid color yet.
  const [draft, setDraft] = useState<string | null>(null)

  const emit = (next: Hsv) => onChange(hsvToHex(next))

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const box = wheel.current?.getBoundingClientRect()
    if (!box) return
    const r = box.width / 2
    const dx = e.clientX - box.left - r
    const dy = e.clientY - box.top - r
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360
    const s = Math.min(1, Math.hypot(dx, dy) / r)
    emit({ h, s, v: hsv.v || 1 })
  }

  const onWheelKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { h: (hsv.h - step + 360) % 360 },
      ArrowRight: { h: (hsv.h + step) % 360 },
      ArrowUp: { s: Math.min(1, hsv.s + step / 100) },
      ArrowDown: { s: Math.max(0, hsv.s - step / 100) },
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    emit({ ...hsv, ...move })
  }

  // Knob position: angle = hue (0° at the top), distance = saturation.
  const angle = ((hsv.h - 90) * Math.PI) / 180
  const knob = {
    left: `${50 + Math.cos(angle) * hsv.s * 50}%`,
    top: `${50 + Math.sin(angle) * hsv.s * 50}%`,
  }
  const pure = hsvToHex({ h: hsv.h, s: hsv.s, v: 1 })

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

      <div className={styles.body}>
        <div
          ref={wheel}
          className={styles.wheel}
          role="slider"
          tabIndex={0}
          aria-label="Hue and saturation"
          aria-valuetext={value}
          style={{ filter: `brightness(${0.25 + hsv.v * 0.75})` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            pick(e)
          }}
          onPointerMove={(e) => e.buttons === 1 && pick(e)}
          onKeyDown={onWheelKey}
        >
          <span className={styles.knob} style={{ ...knob, background: value }} />
        </div>

        <div className={styles.side}>
          <span className={styles.swatch} style={{ background: value }} />
          <label className={styles.hex}>
            <span>Hex</span>
            <input
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
          </label>
        </div>
      </div>

      <Slider
        label="Brightness"
        variant="gradient"
        gradient={`linear-gradient(90deg, #000, ${pure})`}
        value={hsv.v}
        onChange={(v) => emit({ ...hsv, v: Math.max(0.04, v) })}
      />
    </div>
  )
}

function safeHsv(hex: string): Hsv {
  return isHex(hex) ? hexToHsv(hex) : { h: 255, s: 0.64, v: 1 }
}
