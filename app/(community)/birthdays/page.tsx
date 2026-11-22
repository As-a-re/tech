import Link from 'next/link'
import { Cake, Heart } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { requireUser } from '@/server/identity/session'
import { celebrations, type CelebrationRange, type CelebrationScope } from '@/server/devotion/birthdays'
import { PageHeader } from '@/components/common/page-header'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { LinkChips, LinkTabs } from '@/components/community/tabs'
import { WishButton } from '@/components/devotion/wish-button'

export const metadata = { title: 'Birthdays' }
const RANGES: CelebrationRange[] = ['today', 'week', 'month']
const SCOPES: CelebrationScope[] = ['assembly', 'following', 'all']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function Birthdays({ searchParams }: { searchParams: Promise<{ r?: string; s?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/birthdays'), getT(), searchParams])
  const range = (RANGES.includes(sp.r as CelebrationRange) ? sp.r : 'today') as CelebrationRange
  const scope = (SCOPES.includes(sp.s as CelebrationScope) ? sp.s : 'assembly') as CelebrationScope
  const people = (await celebrations({ id: me.id, assemblyId: me.assemblyId }, range, scope))
  const href = (o: { r?: string; s?: string }) => {
    const q = new URLSearchParams(Object.entries({ r: range === 'today' ? undefined : range, s: scope === 'assembly' ? undefined : scope, ...o }).filter(([, v]) => v) as [string, string][]).toString()
    return `/birthdays${q ? `?${q}` : ''}`
  }
  return (
    <>
      <PageHeader title={t('birthdays.title')} />
      <LinkTabs active={range} items={RANGES.map((r) => ({ key: r, label: t(`birthdays.ranges.${r}` as MessageKey), href: href({ r: r === 'today' ? undefined : r }) }))} />
      <div className="space-y-2 border-b px-4 py-3">
        <LinkChips active={scope} items={SCOPES.map((s) => ({ key: s, label: t(`birthdays.scopes.${s}` as MessageKey), href: href({ s: s === 'assembly' ? undefined : s }) }))} />
        <p className="text-xs text-muted-foreground">{t('birthdays.privacyNote')}</p>
      </div>
      {people.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{t('birthdays.none')}</p> : (
        <ul className="divide-y">
          {people.map((p) => {
            const [m, d] = p.monthDay.split('-').map(Number)
            const Icon = p.kind === 'birthday' ? Cake : Heart
            return (
              <li key={`${p.kind}-${p.id}`} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/u/${p.username}`} className="relative shrink-0">
                  <UserAvatar name={p.fullName} src={p.avatarUrl} className="size-11" />
                  <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-background bg-brand-red text-white"><Icon className="size-3" /></span>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${p.username}`} className="flex items-center gap-1 font-semibold hover:underline"><span className="truncate">{p.fullName}</span>{p.verified && <VerifiedBadge />}</Link>
                  <p className="truncate text-sm text-muted-foreground">
                    {t(`birthdays.${p.kind}` as MessageKey)} · {p.isToday ? t('birthdays.today') : `${d} ${MONTHS[m - 1]}`} · {p.assemblyName}
                  </p>
                </div>
                {p.isToday && p.id !== me.id && <WishButton label={t('birthdays.wish')} text={t(p.kind === 'birthday' ? 'birthdays.wishBirthday' : 'birthdays.wishAnniversary', { username: p.username })} />}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
