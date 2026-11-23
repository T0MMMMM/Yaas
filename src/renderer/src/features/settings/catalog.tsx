import type { ReactNode } from 'react'
import type { IconComponent } from '../../ui/icons/InkIcon'
import { inkIcon } from '../../ui/icons/adapter'
import { About, Advanced, Appearance, General, Privacy, Shortcuts } from './panels'

export interface SettingsSection {
  id: string
  label: string
  icon: IconComponent
  render: () => ReactNode
}

/**
 * Settings sections shown for the browser (rebuilt in plan 5). The Claude panels (accounts,
 * sessions, profiles, permissions, handoff, crew, notifications) stay in `panels.tsx`, unlisted
 * until AI tabs.
 */
export const SECTIONS: SettingsSection[] = [
  { id: 'general', label: 'General', icon: inkIcon('general'), render: () => <General /> },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: inkIcon('appearance'),
    render: () => <Appearance />,
  },
  { id: 'shortcuts', label: 'Shortcuts', icon: inkIcon('shortcuts'), render: () => <Shortcuts /> },
  { id: 'privacy', label: 'Privacy & data', icon: inkIcon('privacy'), render: () => <Privacy /> },
  { id: 'advanced', label: 'Advanced', icon: inkIcon('developers'), render: () => <Advanced /> },
  { id: 'about', label: 'About', icon: inkIcon('about'), render: () => <About /> },
]
