import { useEffect, useState } from 'react'

const SAMPLE_SIZE = 16
const HUE_BUCKETS = 24
const MAX_CACHE = 200

const cache = new Map<string, string | null>()

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h *= 60
  if (h < 0) h += 360
  return [h, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r: number
  let g: number
  let b: number
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const hex = (v: number): string =>
    Math.round(Math.min(1, Math.max(0, v + m)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * Dominant chromatic colour of a sampled RGBA buffer, clamped into a legible ring lightness and
 * saturation range so active favourite tile rings stay crisp in both light and dark modes.
 * Returns null for monochrome or transparent icons (callers fall back to `--space-accent`).
 */
export function dominantColor(rgba: Uint8ClampedArray): string | null {
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({ r: 0, g: 0, b: 0, w: 0 }))
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i] ?? 0
    const g = rgba[i + 1] ?? 0
    const b = rgba[i + 2] ?? 0
    const a = rgba[i + 3] ?? 0
    if (a < 128) continue
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min
    if (delta < 32 || max < 28 || min > 235) continue
    const [h] = rgbToHsl(r, g, b)
    const bucket = buckets[Math.floor(h / (360 / HUE_BUCKETS)) % HUE_BUCKETS]
    if (!bucket) continue
    const w = (delta / 255) * (a / 255)
    bucket.r += r * w
    bucket.g += g * w
    bucket.b += b * w
    bucket.w += w
  }
  let best = buckets[0]
  for (const bucket of buckets) {
    if (best && bucket.w > best.w) best = bucket
  }
  if (!best || best.w < 0.5) return null
  const [h, s, l] = rgbToHsl(best.r / best.w, best.g / best.w, best.b / best.w)
  return hslToHex(h, Math.min(0.85, Math.max(0.45, s)), Math.min(0.58, Math.max(0.42, l)))
}

function remember(url: string, color: string | null): void {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(url, color)
}

/**
 * Samples an inline (`data:`) favicon's dominant colour for the active favourite tile's 3 px ring.
 * Never loads remote URLs; returns null for missing or monochrome icons so CSS falls back to
 * `--space-accent`.
 */
export function useFaviconColor(faviconUrl: string | null): string | null {
  const inlineUrl = faviconUrl?.startsWith('data:') ? faviconUrl : null
  const [resolved, setResolved] = useState<{ url: string; color: string | null } | null>(null)

  useEffect(() => {
    if (!inlineUrl || cache.has(inlineUrl)) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      let picked: string | null = null
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SAMPLE_SIZE
        canvas.height = SAMPLE_SIZE
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
          picked = dominantColor(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data)
        }
      } catch {
        picked = null
      }
      remember(inlineUrl, picked)
      if (!cancelled) setResolved({ url: inlineUrl, color: picked })
    }
    img.onerror = () => {
      remember(inlineUrl, null)
      if (!cancelled) setResolved({ url: inlineUrl, color: null })
    }
    img.src = inlineUrl
    return () => {
      cancelled = true
    }
  }, [inlineUrl])

  if (!inlineUrl) return null
  if (cache.has(inlineUrl)) return cache.get(inlineUrl) ?? null
  return resolved?.url === inlineUrl ? resolved.color : null
}
