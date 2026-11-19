import { useId, useMemo, type CSSProperties, type ReactNode } from 'react'
import styles from './Slider.module.css'

/**
 * Drawn sliders (DESIGN.md §3.4). The track says what the value does:
 * - `wave`: a ripple up to the thumb that flattens after it (transparency)
 * - `speckle`: grain dots that get denser to the right (grain)
 * - `gradient`: a color ramp given by the caller (brightness)
 * A transparent native range input sits on top for keyboard, pointer and screen readers.
 */
export function Slider({
  value,
  onChange,
  label,
  variant,
  gradient,
  disabled = false,
  start,
  end,
}: {
  /** 0..1 */
  value: number
  onChange: (value: number) => void
  label: string
  variant: 'wave' | 'speckle' | 'gradient'
  /** CSS gradient for the `gradient` variant. */
  gradient?: string
  disabled?: boolean
  start?: ReactNode
  end?: ReactNode
}) {
  const pct = Math.round(value * 1000) / 10
  return (
    <div className={styles.slider} data-disabled={disabled}>
      {start && <span className={styles.cap}>{start}</span>}
      <div className={styles.track} style={{ '--value': `${pct}%` } as CSSProperties}>
        {variant === 'wave' && <Wave value={value} />}
        {variant === 'speckle' && <Speckle value={value} />}
        {variant === 'gradient' && (
          <span className={styles.gradient} style={{ background: gradient }} />
        )}
        <span className={styles.thumb} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      {end && <span className={styles.cap}>{end}</span>}
    </div>
  )
}

const W = 200
const H = 24

function Wave({ value }: { value: number }) {
  const clip = useId()
  // A sine whose amplitude grows to the right: more transparency, more ripple.
  const wave = useMemo(() => {
    let d = `M0 ${H / 2}`
    for (let x = 0; x <= W; x += 2) {
      const amp = 1.2 + (x / W) * 4.5
      d += ` L${x} ${H / 2 + Math.sin(x / 4.2) * amp}`
    }
    return d
  }, [])
  const cut = value * W
  return (
    <svg className={styles.art} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <clipPath id={`${clip}-l`}>
          <rect x="0" y="0" width={cut} height={H} />
        </clipPath>
        <clipPath id={`${clip}-r`}>
          <rect x={cut} y="0" width={W - cut} height={H} />
        </clipPath>
      </defs>
      <path d={wave} className={styles.waveOn} clipPath={`url(#${clip}-l)`} />
      <line
        x1="0"
        x2={W}
        y1={H / 2}
        y2={H / 2}
        className={styles.waveOff}
        clipPath={`url(#${clip}-r)`}
      />
    </svg>
  )
}

/** Deterministic pseudo-random so the dots don't jump between renders. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

// Wider drawing for the dots so they stay round once stretched to the track width.
const SW = 320

const DOTS = (() => {
  const dots: Array<{ x: number; y: number; r: number }> = []
  for (let i = 0; i < 380; i++) {
    const x = Math.sqrt(rand(i)) * SW // denser to the right
    dots.push({ x, y: 3 + rand(i + 1000) * (H - 6), r: 0.5 + rand(i + 2000) * 0.9 })
  }
  return dots
})()

function Speckle({ value }: { value: number }) {
  const cut = value * SW
  return (
    <svg className={styles.art} viewBox={`0 0 ${SW} ${H}`} preserveAspectRatio="none" aria-hidden>
      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          className={d.x <= cut ? styles.speckOn : styles.speckOff}
        />
      ))}
    </svg>
  )
}
