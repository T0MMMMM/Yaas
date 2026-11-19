import type { ReactNode } from 'react'
import {
  ArrowsLeftRight,
  Bell,
  ChatsCircle,
  Info,
  Keyboard,
  LockSimple,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Stack,
  Users,
  UsersThree,
  Wrench,
  type Icon,
} from '@phosphor-icons/react'
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
  icon: Icon
  render: () => ReactNode
}

/** Catalog of every setting (DESIGN.md §7). Rows marked `soon` are not built yet. */
export const SECTIONS: SettingsSection[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal, render: () => <General /> },
  { id: 'appearance', label: 'Appearance', icon: Palette, render: () => <Appearance /> },
  { id: 'accounts', label: 'Accounts', icon: Users, render: () => <Accounts /> },
  { id: 'sessions', label: 'Sessions', icon: ChatsCircle, render: () => <Sessions /> },
  { id: 'profiles', label: 'Context profiles', icon: Stack, render: () => <Profiles /> },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck, render: () => <Permissions /> },
  { id: 'handoff', label: 'Handoff', icon: ArrowsLeftRight, render: () => <Handoff /> },
  { id: 'crew', label: 'Crew', icon: UsersThree, render: () => <Crew /> },
  { id: 'notifications', label: 'Notifications', icon: Bell, render: () => <Notifications /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, render: () => <Shortcuts /> },
  { id: 'privacy', label: 'Privacy & data', icon: LockSimple, render: () => <Privacy /> },
  { id: 'advanced', label: 'Advanced', icon: Wrench, render: () => <Advanced /> },
  { id: 'about', label: 'About', icon: Info, render: () => <About /> },
]
