import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { listAccounts, type AccountFilter } from '@/server/admin/accounts'
import { AdminHeading, Chips, Pager, SearchBox, fmtDate } from '@/components/admin/ui'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'

export const metadata = { title: 'Accounts' }
const FILTERS = ['all', 'admins', 'suspended', 'verified'] as const

export default async function Accounts({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; page?: string }> }) {
  const [t, sp] = await Promise.all([getT(), searchParams])
  const f = FILTERS.includes(sp.f as never) ? sp.f! : 'all'
  const filter: AccountFilter = { q: sp.q, page: Number(sp.page) || 1, role: f === 'admins' ? 'tech_admin' : undefined, status: f === 'suspended' ? 'suspended' : undefined, verified: f === 'verified' || undefined }
  const r = await listAccounts(filter)
  const qs = (o: Record<string, string | number | undefined>) => '?' + new URLSearchParams(Object.entries({ q: sp.q, f: sp.f, ...o }).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()
  return (
    <>
      <AdminHeading title={t('admin.tabs.accounts')} />
      <div className="space-y-3 px-4 py-3 sm:px-6">
        <SearchBox value={sp.q} placeholder={t('admin.accounts.search')} hidden={{ f: sp.f }} />
        <Chips active={f} items={FILTERS.map((k) => ({ key: k, label: t(`admin.accounts.${k === 'all' ? 'all' : k}`), href: `/admin/accounts${qs({ f: k === 'all' ? undefined : k, page: undefined })}` }))} />
      </div>
      {r.rows.length === 0 ? <p className="px-6 py-12 text-center text-muted-foreground">{t('admin.accounts.none')}</p> : (
        <ul className="divide-y border-t">
          {r.rows.map((u) => (
            <li key={u.id}><Link href={`/admin/accounts/${u.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 sm:px-6">
              <UserAvatar name={u.fullName} src={u.avatarUrl} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-semibold"><span className="truncate">{u.fullName}</span>{u.verified && <VerifiedBadge />}</span>
                <span className="block truncate text-sm text-muted-foreground">@{u.username} · {u.churchId} · {u.assemblyName}</span>
              </span>
              <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                {u.role === 'tech_admin' && <span className="mb-1 block font-semibold text-primary">Tech Admin</span>}
                {u.status === 'suspended' && <span className="mb-1 block font-semibold text-destructive">{t('admin.accounts.suspended')}</span>}
                {t('admin.accounts.lastSeen')}: {u.lastSeenAt ? fmtDate(u.lastSeenAt) : t('admin.accounts.never')}
              </span>
            </Link></li>
          ))}
        </ul>
      )}
      <Pager page={r.page} pages={r.pages} href={(p) => `/admin/accounts${qs({ page: p })}`}
        labels={{ prev: t('admin.pager.prev'), next: t('admin.pager.next'), page: t('admin.pager.page', { page: r.page, pages: r.pages }) }} />
    </>
  )
}
