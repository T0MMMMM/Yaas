// The Phosphor icons a `MenuSpec` may name (main sends names, not components). Add a name here
// when a menu starts using it; an unknown name draws no icon.
import {
  ArrowLineUp,
  ArrowsSplit,
  CopySimple,
  FolderSimple,
  FolderSimplePlus,
  GearSix,
  LinkSimple,
  Palette,
  PencilSimple,
  Plus,
  PushPin,
  PushPinSlash,
  Smiley,
  SquareSplitHorizontal,
  SquaresFour,
  Star,
  Trash,
  X,
  type Icon,
} from '@phosphor-icons/react'

const ICONS: Readonly<Record<string, Icon>> = {
  ArrowLineUp,
  ArrowsSplit,
  CopySimple,
  FolderSimple,
  FolderSimplePlus,
  GearSix,
  LinkSimple,
  Palette,
  PencilSimple,
  Plus,
  PushPin,
  PushPinSlash,
  Smiley,
  SquareSplitHorizontal,
  SquaresFour,
  Star,
  Trash,
  X,
}

/** The icon component a menu item names, or null for a data URL or an unknown name. */
export function menuIcon(name: string): Icon | null {
  return Object.hasOwn(ICONS, name) ? (ICONS[name] ?? null) : null
}
