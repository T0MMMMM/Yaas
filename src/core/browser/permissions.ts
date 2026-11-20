// What a web page in a tab may do without asking. Electron grants everything by default; until
// there is a per-site prompt, tabs get only what harms no one and deny the rest (camera,
// microphone, location, notifications, clipboard reading, opening external apps…).
const GRANTED = new Set(['clipboard-sanitized-write', 'fullscreen', 'pointerLock'])

export const isPermissionGranted = (permission: string): boolean => GRANTED.has(permission)
