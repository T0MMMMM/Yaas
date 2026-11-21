import type { CSSProperties } from 'react'
import { EmojiField } from './EmojiField'
import { FOLDER_HUES, HUE_PREFIX, folderIcon } from './hash'
import styles from './FolderIconPicker.module.css'

/**
 * The folder icon card's content: the folder hues, an emoji field and "Default" (the glyph in
 * the hue of the name). `onPick` gets what `browser.setFolderIcon` takes.
 */
export function FolderIconPicker({
  folder,
  onPick,
}: {
  folder: { name: string; icon: string | null }
  onPick: (icon: string | null) => void
}) {
  const current = folderIcon(folder)
  return (
    <div className={styles.picker}>
      <div className={styles.hues} role="radiogroup" aria-label="Folder colour">
        {FOLDER_HUES.map((hue) => (
          <button
            key={hue}
            className={styles.hue}
            style={{ '--hue': hue } as CSSProperties}
            role="radio"
            aria-label={`Hue ${hue}`}
            aria-checked={current.kind === 'hue' && current.hue === hue}
            onClick={() => onPick(`${HUE_PREFIX}${hue}`)}
          />
        ))}
      </div>
      <EmojiField
        value={current.kind === 'emoji' ? current.emoji : null}
        onPick={(emoji) => onPick(emoji)}
        noneLabel="Default"
        noneActive={folder.icon === null}
      />
    </div>
  )
}
