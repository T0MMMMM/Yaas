import { join } from 'node:path'

/**
 * Where a download is saved in `dir`: `filename` while it is free, else `name (1).ext`,
 * `name (2).ext`… `exists` says whether a path is taken. A name never leaves the folder (only its
 * last segment counts), and a name without an extension (or a dotfile) gets the number at its end.
 */
export function uniqueDownloadPath(
  dir: string,
  filename: string,
  exists: (path: string) => boolean,
): string {
  const name = filename.split(/[\\/]/).pop() || 'download'
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  let candidate = join(dir, name)
  for (let n = 1; exists(candidate); n++) candidate = join(dir, `${stem} (${n})${extension}`)
  return candidate
}
