'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Home, LogIn, LogOut, Menu, ShoppingBag } from 'lucide-react'
import { isActive } from '@/lib/navigation'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { UserAvatar } from '@/components/common/user-avatar'
import { signOut } from '@/server/actions/auth'
import { Sidebar } from './sidebar'
import { AddTab } from './create-menu'
import { PreferencesMenu } from './preferences-menu'
import type { MenuUser } from './user-menu'
import { CartTab } from '@/components/market/cart-link'

/** Phone bottom bar: Home · Add · Market · Menu · Cart. */
export function MobileNav({ user, cart = 0 }: { user: MenuUser | null; cart?: number }) {
  const pathname = usePathname()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  // Inside a chat the composer sits at the bottom, like WhatsApp
  if (/^\/messages\/[^/]+/.test(pathname)) return null
  const tab = (href: string, label: string, Icon: typeof Home) => {
    const active = isActive(pathname, href)
    return (
      <li className="flex-1">
        <Link href={href} aria-current={active ? 'page' : undefined}
          className={cn('flex h-full flex-col items-center justify-center gap-0.5 text-[11px]', active ? 'font-semibold text-primary' : 'text-muted-foreground')}>
          <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} />{label}
        </Link>
      </li>
    )
  }
  return (
    <nav aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="flex h-14 items-stretch justify-around">
        {tab('/', t('nav.home'), Home)}
        <li className="flex-1"><AddTab signedIn={!!user} className="flex h-full w-full items-center justify-center" /></li>
        {tab('/market', t('nav.market'), ShoppingBag)}
        <li className="flex-1">
          <button type="button" onClick={() => setOpen(true)} className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground">
            <Menu className="size-[22px]" strokeWidth={1.8} />{t('nav.menu')}
          </button>
        </li>
        <li className="flex-1"><CartTab initial={cart} /></li>
      </ul>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[19rem] overflow-y-auto p-3">
          <SheetHeader className="px-1"><SheetTitle>{t('nav.menu')}</SheetTitle></SheetHeader>
          <div className="flex items-center gap-3 rounded-xl border p-3">
            {user ? (
              <Link href={`/u/${user.username}`} onClick={() => setOpen(false)} className="flex min-w-0 flex-1 items-center gap-3">
                <UserAvatar name={user.fullName} src={user.avatarUrl} />
                <span className="min-w-0"><b className="block truncate">{user.fullName}</b><span className="block truncate text-xs text-muted-foreground">@{user.username} · {user.assemblyName}</span></span>
              </Link>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} className="flex flex-1 items-center gap-2 font-semibold text-primary"><LogIn className="size-5" />{t('auth.signIn')}</Link>
            )}
            <PreferencesMenu />
          </div>
          <Sidebar signedIn={!!user} role={user?.role} onNavigate={() => setOpen(false)} />
          {user && (
            <button type="button" onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-destructive hover:bg-muted">
              <LogOut className="size-5" />{t('auth.signOut')}
            </button>
          )}
          <nav className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t px-3 pt-3 text-xs text-muted-foreground">
            {(['about', 'help'] as const).map((k) => <Link key={k} href={`/${k}`} onClick={() => setOpen(false)} className="hover:underline">{t(`nav.${k}`)}</Link>)}
            <Link href="/terms" onClick={() => setOpen(false)} className="hover:underline">{t('info.terms')}</Link>
            <Link href="/privacy" onClick={() => setOpen(false)} className="hover:underline">{t('info.privacy')}</Link>
          </nav>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
