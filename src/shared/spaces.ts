// Naming shared by main (which creates the sessions) and the renderer (which shows a space's
// extension actions). No Electron or React here.

/** The persistent Electron partition of a space: its cookies, permissions and extensions. */
export const spacePartition = (spaceId: string): string => `persist:space-${spaceId}`
