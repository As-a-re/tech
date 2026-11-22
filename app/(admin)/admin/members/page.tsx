import Link from 'next/link'
import { Plus, Upload } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { env } from '@/lib/env'
import { formatPhone } from '@/lib/identity/normalise'
import { listMembers, type MemberFilter } from '@/server/admin/register'
import { AdminHeading, Chips, Pager, SearchBox } from '@/components/admin/ui'

export const metadata = { title: 'Member register' }
const STATUSES = ['all', 'active', 'inactive', 'registered', 'not_registered'] as const

export default async function Members({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const [t, sp] = await Promise.all([getT(), searchParams])
  const status = STATUSES.includes(sp.status as never) && sp.status !== 'all' ? (sp.status as MemberFilter['status']) : undefined
  const r = await listMembers({ q: sp.q, status, page: Number(sp.page) || 1 })
  const qs = (o: Record<string, string | number | undefined>) => '?' + new URLSearchParams(Object.entries({ q: sp.q, status: sp.status, ...o }).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()
  const local = env.churchDbMode === 'local'
  const label = { all: t('admin.members.all'), active: t('admin.members.active'), inactive: t('admin.members.inactive'), registered: t('admin.members.registered'), not_registered: t('admin.members.notRegistered') }
  return (
    <>
      <AdminHeading title={t('admin.tabs.members')} action={local && (
        <span className="flex gap-2">
          <Link href="/admin/members/import" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"><Upload className="size-4" />{t('admin.members.import')}</Link>
          <Link href="/admin/members/new" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="size-4" />{t('admin.members.add')}</Link>
        </span>
      )} />
      {!local && <p className="mx-4 mt-3 rounded-lg bg-muted px-3 py-2 text-sm sm:mx-6">{t('admin.apiMode')}</p>}
      <div className="space-y-3 px-4 py-3 sm:px-6">
        <SearchBox value={sp.q} placeholder={t('admin.members.search')} hidden={{ status: sp.status }} />
        <Chips active={sp.status ?? 'all'} items={STATUSES.map((k) => ({ key: k, label: label[k], href: `/admin/members${qs({ status: k === 'all' ? undefined : k, page: undefined })}` }))} />
        <p className="text-sm text-muted-foreground">{t('admin.members.total', { n: r.total.toLocaleString() })}</p>
      </div>
      {r.rows.length === 0 ? <p className="px-6 py-12 text-center text-muted-foreground">{t('admin.members.none')}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-y bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 sm:px-6">{t('admin.members.name')}</th><th className="px-2 py-2">{t('admin.members.churchId')}</th><th className="px-2 py-2">{t('admin.members.phone')}</th>
              <th className="px-2 py-2">{t('admin.members.assembly')}</th><th className="px-2 py-2">{t('admin.members.account')}</th><th className="px-4 py-2 sm:px-6">{t('admin.members.status')}</th>
            </tr></thead>
            <tbody className="divide-y">
              {r.rows.map((m) => (
                <tr key={m.churchId} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5 sm:px-6"><Link href={`/admin/members/${encodeURIComponent(m.churchId)}`} className="font-medium text-primary hover:underline">{m.fullName}</Link></td>
                  <td className="whitespace-nowrap px-2 py-2.5 font-mono text-xs">{m.churchId}</td>
                  <td className="whitespace-nowrap px-2 py-2.5">{formatPhone(m.phone)}</td>
                  <td className="px-2 py-2.5">{m.assemblyName}<span className="block text-xs text-muted-foreground">{m.districtName}</span></td>
                  <td className="px-2 py-2.5">{m.username ? <Link className="hover:underline" href={`/admin/accounts/${m.userId}`}>@{m.username}</Link> : <span className="text-muted-foreground">{t('admin.members.notYet')}</span>}</td>
                  <td className="px-4 py-2.5 sm:px-6"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.active ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>{m.active ? t('admin.members.activeLabel') : t('admin.members.inactiveLabel')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={r.page} pages={r.pages} href={(p) => `/admin/members${qs({ page: p })}`}
        labels={{ prev: t('admin.pager.prev'), next: t('admin.pager.next'), page: t('admin.pager.page', { page: r.page, pages: r.pages }) }} />
    </>
  )
}
