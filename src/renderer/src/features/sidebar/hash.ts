/** Stable hash → 0..1, so the same id always gets the same color / tilt. */
export function hashUnit(text: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

export const FOLDER_HUES = [210, 262, 330, 22, 42, 150, 188]

/** A folder's hue (degrees), from its name: the same name always gets the same colour. */
export function folderHue(name: string): number {
  return FOLDER_HUES[Math.floor(hashUnit(name) * FOLDER_HUES.length)] ?? 210
}

/** How a folder is drawn: its glyph in a hue, or an emoji. */
export type FolderIcon = { kind: 'hue'; hue: number } | { kind: 'emoji'; emoji: string }

/** Prefix of a chosen hue in `folders.icon` (`hue:262`); anything else non-empty is an emoji. */
export const HUE_PREFIX = 'hue:'

export function folderIcon(folder: { name: string; icon: string | null }): FolderIcon {
  const { icon } = folder
  if (icon === null || icon === '') return { kind: 'hue', hue: folderHue(folder.name) }
  if (icon.startsWith(HUE_PREFIX)) {
    const hue = Number(icon.slice(HUE_PREFIX.length))
    return { kind: 'hue', hue: FOLDER_HUES.includes(hue) ? hue : folderHue(folder.name) }
  }
  return { kind: 'emoji', emoji: icon }
}
