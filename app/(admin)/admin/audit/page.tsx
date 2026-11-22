import { getT } from '@/lib/i18n/server'
import { actionNames, listAudit } from '@/server/admin/audit-log'
import { AdminHeading, Pager, fmtDate } from '@/components/admin/ui'

export const metadata = { title: 'Audit log' }

export default async function Audit({ searchParams }: { searchParams: Promise<{ action?: string; actor?: string; from?: string; to?: string; page?: string }> }) {
  const [t, sp] = await Promise.all([getT(), searchParams])
  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined)
  const [r, actions] = await Promise.all([listAudit({ action: sp.action, actor: sp.actor, from: valid(sp.from), to: valid(sp.to), page: Number(sp.page) || 1 }), actionNames()])
  const qs = (o: Record<string, string | number | undefined>) => '?' + new URLSearchParams(Object.entries({ action: sp.action, actor: sp.actor, from: sp.from, to: sp.to, ...o }).filter(([, v]) => v).map(([k, v]) => [k, String(v)])).toString()
  const input = 'h-10 rounded-md border bg-background px-3 text-sm'
  return (
    <>
      <AdminHeading title={t('admin.tabs.audit')} />
      <form className="flex flex-wrap items-end gap-2 px-4 py-3 sm:px-6">
        <select name="action" defaultValue={sp.action ?? ''} aria-label={t('admin.audit.action')} className={input}>
          <option value="">{t('admin.audit.allActions')}</option>{actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input name="actor" defaultValue={sp.actor} placeholder={t('admin.audit.actor')} aria-label={t('admin.audit.who')} className={`${input} w-36`} />
        <label className="text-xs text-muted-foreground">{t('admin.audit.from')}<input type="date" name="from" defaultValue={sp.from} className={`${input} ml-1`} /></label>
        <label className="text-xs text-muted-foreground">{t('admin.audit.to')}<input type="date" name="to" defaultValue={sp.to} className={`${input} ml-1`} /></label>
        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{t('admin.audit.filter')}</button>
      </form>
      {r.rows.length === 0 ? <p className="px-6 py-12 text-center text-muted-foreground">{t('admin.audit.none')}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-y bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 sm:px-6">{t('admin.audit.when')}</th><th className="px-2 py-2">{t('admin.audit.action')}</th><th className="px-2 py-2">{t('admin.audit.who')}</th>
              <th className="px-2 py-2">{t('admin.audit.target')}</th><th className="px-4 py-2 sm:px-6">{t('admin.audit.ip')}</th>
            </tr></thead>
            <tbody className="divide-y">
              {r.rows.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground sm:px-6">{fmtDate(e.createdAt, true)}</td>
                  <td className="px-2 py-2"><span className="font-mono text-xs">{e.action}</span>{e.meta ? <span className="block max-w-xs truncate text-xs text-muted-foreground">{JSON.stringify(e.meta)}</span> : null}</td>
                  <td className="px-2 py-2">{e.username ? `@${e.username}` : '—'}</td>
                  <td className="max-w-[12rem] truncate px-2 py-2 font-mono text-xs">{e.target ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground sm:px-6">{e.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={r.page} pages={r.pages} href={(p) => `/admin/audit${qs({ page: p })}`}
        labels={{ prev: t('admin.pager.prev'), next: t('admin.pager.next'), page: t('admin.pager.page', { page: r.page, pages: r.pages }) }} />
    </>
  )
}
