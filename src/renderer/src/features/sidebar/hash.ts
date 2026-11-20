/** Stable hash → 0..1, so the same id always gets the same color / tilt. */
export function hashUnit(text: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

const FOLDER_HUES = [210, 262, 330, 22, 42, 150, 188]

/** A folder's hue (degrees), from its name: the same name always gets the same colour. */
export function folderHue(name: string): number {
  return FOLDER_HUES[Math.floor(hashUnit(name) * FOLDER_HUES.length)] ?? 210
}
