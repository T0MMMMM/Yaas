import type { ReactNode } from 'react'
import {
  Bell,
  Info,
  Keyboard,
  Layers,
  Lock,
  Palette,
  Repeat,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import {
  About,
  Accounts,
  Advanced,
  Appearance,
  Crew,
  General,
  Handoff,
  Notifications,
  Permissions,
  Privacy,
  Profiles,
  Sessions,
  Shortcuts,
} from './panels'

export interface SettingsSection {
  id: string
  label: string
  icon: LucideIcon
  render: () => ReactNode
}

/** Catalog of every setting (DESIGN.md §7). Rows marked `soon` are not built yet. */
export const SECTIONS: SettingsSection[] = [
  { id: 'general', label: 'General', icon: Settings2, render: () => <General /> },
  { id: 'appearance', label: 'Appearance', icon: Palette, render: () => <Appearance /> },
  { id: 'accounts', label: 'Accounts', icon: Users, render: () => <Accounts /> },
  { id: 'sessions', label: 'Sessions', icon: SlidersHorizontal, render: () => <Sessions /> },
  { id: 'profiles', label: 'Context profiles', icon: Layers, render: () => <Profiles /> },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck, render: () => <Permissions /> },
  { id: 'handoff', label: 'Handoff', icon: Repeat, render: () => <Handoff /> },
  { id: 'crew', label: 'Crew', icon: UsersRound, render: () => <Crew /> },
  { id: 'notifications', label: 'Notifications', icon: Bell, render: () => <Notifications /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, render: () => <Shortcuts /> },
  { id: 'privacy', label: 'Privacy & data', icon: Lock, render: () => <Privacy /> },
  { id: 'advanced', label: 'Advanced', icon: Wrench, render: () => <Advanced /> },
  { id: 'about', label: 'About', icon: Info, render: () => <About /> },
]
