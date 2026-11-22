import { Ban, BellRing, Database, Gauge, KeyRound, Languages, MonitorSmartphone, Palette, Shield, User, UserCheck, UserCog } from 'lucide-react'

export const SETTINGS = [
  { key: 'profile', icon: User },
  { key: 'account', icon: UserCog },
  { key: 'security', icon: KeyRound },
  { key: 'devices', icon: MonitorSmartphone },
  { key: 'privacy', icon: Shield },
  { key: 'notifications', icon: BellRing },
  { key: 'requests', icon: UserCheck, href: '/settings/follow-requests' },
  { key: 'blocked', icon: Ban },
  { key: 'display', icon: Palette },
  { key: 'language', icon: Languages },
  { key: 'dataSaver', icon: Gauge, href: '/settings/data-saver' },
  { key: 'yourData', icon: Database, href: '/settings/your-data' },
] as const
export const settingsHref = (s: (typeof SETTINGS)[number]) => ('href' in s ? s.href : `/settings/${s.key}`)
