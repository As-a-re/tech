import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { requireUser } from '@/server/identity/session'
import { PageHeader } from '@/components/common/page-header'
import { UserAvatar } from '@/components/common/user-avatar'
import { SETTINGS, settingsHref } from '@/components/settings/settings-nav'

export const metadata = { title: 'Settings' }

export default async function SettingsHome() {
  const [me, t] = await Promise.all([requireUser('/settings'), getT()])
  return (
    <>
      <PageHeader title={t('settings.title')} />
      <Link href={`/u/${me.username}`} className="flex items-center gap-3 border-b px-4 py-4 hover:bg-muted/50">
        <UserAvatar name={me.fullName} src={me.avatarUrl} className="size-12" />
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{me.fullName}</span><span className="block truncate text-sm text-muted-foreground">@{me.username}</span></span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
      <nav className="divide-y">
        {SETTINGS.map((s) => (
          <Link key={s.key} href={settingsHref(s)} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/50">
            <s.icon className="size-5 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t(`settings.sections.${s.key}` as MessageKey)}</span>
              <span className="block truncate text-sm text-muted-foreground">{t(`settings.descriptions.${s.key}` as MessageKey)}</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        ))}
      </nav>
    </>
  )
}
