'use client'

import Link from 'next/link'
import { FileClock, LogOut, Settings, ShieldCheck, User } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/common/user-avatar'
import { useI18n } from '@/lib/i18n/client'
import { signOut } from '@/server/actions/auth'

export type MenuUser = { fullName: string; username: string; avatarUrl: string | null; assemblyName: string; districtName: string; role: string }

export function UserMenu({ user }: { user: MenuUser }) {
  const { t } = useI18n()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t('account.menu')}>
        <UserAvatar name={user.fullName} src={user.avatarUrl} className="size-9" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-semibold">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{t('account.assembly', { assembly: user.assemblyName, district: user.districtName })}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href={`/u/${user.username}`}><User /> {t('account.profile')}</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/drafts"><FileClock /> {t('compose.drafts')}</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/settings"><Settings /> {t('account.settings')}</Link></DropdownMenuItem>
        {user.role === 'tech_admin' && <DropdownMenuItem asChild><Link href="/admin"><ShieldCheck /> {t('account.admin')}</Link></DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()} className="text-destructive focus:text-destructive"><LogOut /> {t('auth.signOut')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
