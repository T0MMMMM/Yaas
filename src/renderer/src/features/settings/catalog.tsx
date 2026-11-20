import type { ReactNode } from 'react'
import {
  Info,
  Keyboard,
  LockSimple,
  Palette,
  SlidersHorizontal,
  Wrench,
  type Icon,
} from '@phosphor-icons/react'
import { About, Advanced, Appearance, General, Privacy, Shortcuts } from './panels'

export interface SettingsSection {
  id: string
  label: string
  icon: Icon
  render: () => ReactNode
}

/**
 * Settings sections shown for the browser (rebuilt in plan 5). The Claude panels (accounts,
 * sessions, profiles, permissions, handoff, crew, notifications) stay in `panels.tsx`, unlisted
 * until AI tabs.
 */
export const SECTIONS: SettingsSection[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal, render: () => <General /> },
  { id: 'appearance', label: 'Appearance', icon: Palette, render: () => <Appearance /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, render: () => <Shortcuts /> },
  { id: 'privacy', label: 'Privacy & data', icon: LockSimple, render: () => <Privacy /> },
  { id: 'advanced', label: 'Advanced', icon: Wrench, render: () => <Advanced /> },
  { id: 'about', label: 'About', icon: Info, render: () => <About /> },
]
