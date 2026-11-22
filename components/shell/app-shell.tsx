import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { Brand } from './brand'
import { Sidebar } from './sidebar'
import { MobileNav } from './mobile-nav'
import { PreferencesMenu } from './preferences-menu'
import { UserMenu } from './user-menu'
import { ComposeProvider } from '@/components/posts/compose-provider'
import { NotificationBell } from './notification-bell'
import { unreadCount } from '@/server/notifications/notify'
import { MessagesLink } from './messages-link'
import { unreadChats } from '@/server/messages/chat'
import { newMissedCalls } from '@/server/calls/calls'
import { UserAvatar } from '@/components/common/user-avatar'
import { SearchPill } from './search-pill'
import { AddButton } from './create-menu'
import { AnnouncementsBell } from './announcements-bell'
import { unreadAnnouncements } from '@/server/community/announcements'
import { cartCount } from '@/server/market/cart'
import { CartLink } from '@/components/market/cart-link'
import { NativeBridge } from '@/components/providers/native-bridge'
import { nativePushEnabled } from '@/integrations/push'

/** Header + left menu + content (+ optional right rail). Every guest and member screen sits inside this. */
/** `full` = edge-to-edge screens like chats (no bottom padding, no width limit). */
export async function AppShell({ children, rail, wide, full }: { children: React.ReactNode; rail?: React.ReactNode; wide?: boolean; full?: boolean }) {
  const [t, me] = await Promise.all([getT(), getCurrentUser()])
  const signedIn = !!me
  const [unread, unreadAnn, chatsWaiting, missedCalls, inCart] = me ? await Promise.all([unreadCount(me.id), unreadAnnouncements(me.id), unreadChats(me.id), newMissedCalls(me.id), cartCount(me.id)]) : [0, 0, 0, 0, 0]
  const unreadMsgs = chatsWaiting + missedCalls
  const menuUser = me ? { fullName: me.fullName, username: me.username, avatarUrl: me.avatarUrl, assemblyName: me.assemblyName, districtName: me.districtName, role: me.role } : null
  const icon = 'flex size-[38px] shrink-0 items-center justify-center rounded-full border hover:bg-muted'
  return (
    <ComposeProvider me={me ? { id: me.id, fullName: me.fullName, avatarUrl: me.avatarUrl, role: me.role } : null}>
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
          {/* Phone: profile · messages · search · announcements · notifications */}
          <div className="flex items-center gap-2 md:hidden">
            {me ? (
              <Link href={`/u/${me.username}`} aria-label={t('nav.profile')} className="shrink-0 rounded-full"><UserAvatar name={me.fullName} src={me.avatarUrl} className="size-9" /></Link>
            ) : (
              <Link href="/" aria-label="PAPA home" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="" width={36} height={36} className="size-9 rounded-full bg-white" />
              </Link>
            )}
            {me && <MessagesLink initial={unreadMsgs} className={icon} />}
          </div>
          <Brand subtitle={t('app.church')} className="hidden md:flex" />
          <SearchPill placeholder={t('nav.search')} exploreLabel={t('nav.explore')} className="min-w-0 flex-1 md:mx-auto md:max-w-md" />
          <div className="flex shrink-0 items-center gap-2">
            {me && <MessagesLink initial={unreadMsgs} className={`${icon} hidden md:flex`} />}
            <AnnouncementsBell initial={unreadAnn} signedIn={!!me} />
            {me && <NotificationBell initial={unread} />}
            {me && <CartLink initial={inCart} className={`${icon} hidden md:flex`} />}
            <div className="hidden md:block"><PreferencesMenu /></div>
            {me ? <div className="hidden md:block"><UserMenu user={menuUser!} /></div> : (
              <>
                <Link href="/login" className="hidden whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 md:inline-flex">{t('auth.signIn')}</Link>
                <Link href="/register" className="whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">{t('auth.join')}</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1280px] gap-6 md:px-2 lg:px-4">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-20 shrink-0 flex-col items-center overflow-y-auto md:flex lg:w-60 lg:items-stretch lg:pr-2">
          <Sidebar signedIn={signedIn} role={me?.role} rail />
          {me && <div className="flex justify-center px-1 lg:block"><AddButton /></div>}
          <footer className="mt-auto hidden space-y-2 px-3 pb-4 text-xs text-muted-foreground lg:block">
            <nav className="flex flex-wrap gap-x-3 gap-y-1">
              <Link href="/about" className="hover:underline">{t('nav.about')}</Link>
              <Link href="/help" className="hover:underline">{t('nav.help')}</Link>
              <Link href="/terms" className="hover:underline">{t('info.terms')}</Link>
              <Link href="/privacy" className="hover:underline">{t('info.privacy')}</Link>
            </nav>
            <p className="leading-relaxed">© {new Date().getFullYear()} {t('footer.rights')}</p>
          </footer>
        </aside>
        <main id="main" className={full ? 'min-w-0 flex-1 md:border-x' : rail || wide ? 'min-w-0 flex-1 pb-20 md:border-x md:pb-8' : 'min-w-0 max-w-[760px] flex-1 pb-20 md:border-x md:pb-8'}>{children}</main>
        {rail && <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-80 shrink-0 space-y-4 overflow-y-auto py-4 xl:block">{rail}</aside>}
      </div>
      <MobileNav user={menuUser} cart={inCart} />
      <NativeBridge signedIn={!!me} push={nativePushEnabled()} />
    </div>
    </ComposeProvider>
  )
}
