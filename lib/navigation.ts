import { Baby, BellRing, BookOpen, Bookmark, Compass, ListChecks, CalendarDays, Church, FolderOpen, HandCoins, HandHeart, Home, MessageCircle, Radio, Settings, ShieldCheck, ShoppingBag, User, UserPlus, Users, type LucideIcon, Megaphone, Feather, Sparkles, Store, BookOpenText, Cake } from 'lucide-react'
import type { MessageKey } from '@/lib/i18n/config'

export type NavItem = {
  href: string
  label: MessageKey
  icon: LucideIcon
  /** Build batch that delivers this section (docs/DESIGN.md). */
  batch: number
  /** Needs a signed-in member. */
  auth?: boolean
  /** Only for this role. */
  role?: 'tech_admin'
  accent?: 'red'
}

/** Menu order follows the church's concept slides. */
export const NAV: NavItem[] = [
  { href: '/profile', label: 'nav.profile', icon: User, batch: 3, auth: true },
  { href: '/', label: 'nav.home', icon: Home, batch: 1 },
  { href: '/explore', label: 'nav.explore', icon: Compass, batch: 6 },
  { href: '/notifications', label: 'nav.notifications', icon: BellRing, batch: 6, auth: true },
  { href: '/announcements', label: 'nav.announcements', icon: Megaphone, batch: 7 },
  { href: '/events', label: 'nav.events', icon: CalendarDays, batch: 7 },
  { href: '/prayer', label: 'nav.prayer', icon: HandHeart, batch: 8 },
  { href: '/testimonies', label: 'nav.testimonies', icon: Sparkles, batch: 8 },
  { href: '/verse', label: 'nav.verse', icon: BookOpenText, batch: 8 },
  { href: '/birthdays', label: 'nav.birthdays', icon: Cake, batch: 8, auth: true },
  { href: '/groups/new', label: 'nav.createGroup', icon: UserPlus, batch: 10, auth: true },
  { href: '/groups', label: 'nav.groups', icon: Users, batch: 10, auth: true },
  { href: '/messages', label: 'nav.messages', icon: MessageCircle, batch: 9, auth: true },
  { href: '/publications', label: 'nav.publications', icon: BookOpen, batch: 12 },
  { href: '/resources', label: 'nav.resources', icon: FolderOpen, batch: 15 },
  { href: '/children', label: 'nav.children', icon: Baby, batch: 12 },
  { href: '/live', label: 'nav.live', icon: Radio, batch: 13, accent: 'red' },
  { href: '/give', label: 'nav.give', icon: HandCoins, batch: 14 },
  { href: '/saved', label: 'nav.saved', icon: Bookmark, batch: 5, auth: true },
  { href: '/lists', label: 'nav.lists', icon: ListChecks, batch: 6, auth: true },
  { href: '/market', label: 'nav.market', icon: ShoppingBag, batch: 16 },
  { href: '/assemblies', label: 'nav.directory', icon: Church, batch: 7 },
  { href: '/settings', label: 'nav.settings', icon: Settings, batch: 3, auth: true },
  { href: '/admin', label: 'nav.admin', icon: ShieldCheck, batch: 4, auth: true, role: 'tech_admin' },
]

/** Batches delivered so far. Raised by one with each batch, so menus only show finished sections. */
export const BUILT_THROUGH_BATCH = 19

export function visibleNav(signedIn: boolean, { role }: { role?: string } = {}) {
  return NAV.filter((i) => i.batch <= BUILT_THROUGH_BATCH && (signedIn || !i.auth) && (!i.role || i.role === role))
}

/**
 * Sections row under the top bar (Home, Events, Kids pages).
 * Favorites live on the member's profile; Announcements have their own icon in the top bar.
 */
export type SectionKey = 'for_you' | 'following' | 'events' | 'kids'
export const SECTIONS: { key: SectionKey; href: string; label: MessageKey; auth?: boolean }[] = [
  { key: 'for_you', href: '/', label: 'feed.forYou' },
  { key: 'following', href: '/?tab=following', label: 'feed.following', auth: true },
  { key: 'events', href: '/events', label: 'nav.events' },
  { key: 'kids', href: '/children', label: 'nav.kids' },
]

/**
 * Everything a member can add to PAPA. "Add" opens this list; each choice goes straight to its form.
 * Items from later batches are shown as "Coming soon" until they're built.
 */
export type CreateItem = { key: string; label: MessageKey; hint: MessageKey; icon: LucideIcon; batch: number; href?: string; compose?: true; accent?: 'red' }
export const CREATE: CreateItem[] = [
  { key: 'post', label: 'create.post', hint: 'create.postHint', icon: Feather, batch: 5, compose: true },
  { key: 'announcement', label: 'create.announcement', hint: 'create.announcementHint', icon: Megaphone, batch: 7, href: '/announcements/new' },
  { key: 'event', label: 'create.event', hint: 'create.eventHint', icon: CalendarDays, batch: 7, href: '/events/new' },
  { key: 'prayer', label: 'create.prayer', hint: 'create.prayerHint', icon: HandHeart, batch: 8, href: '/prayer/new' },
  { key: 'testimony', label: 'create.testimony', hint: 'create.testimonyHint', icon: Sparkles, batch: 8, href: '/testimonies/new' },
  { key: 'group', label: 'create.group', hint: 'create.groupHint', icon: Users, batch: 10, href: '/groups/new' },
  { key: 'publication', label: 'create.publication', hint: 'create.publicationHint', icon: BookOpen, batch: 12, href: '/publications/new' },
  { key: 'kids', label: 'create.kids', hint: 'create.kidsHint', icon: Baby, batch: 12, href: '/children/new' },
  { key: 'live', label: 'create.live', hint: 'create.liveHint', icon: Radio, batch: 13, href: '/live/new', accent: 'red' },
  { key: 'product', label: 'create.product', hint: 'create.productHint', icon: Store, batch: 17, href: '/market/sell/products/new' },
]
export const isBuilt = (batch: number) => batch <= BUILT_THROUGH_BATCH

export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
