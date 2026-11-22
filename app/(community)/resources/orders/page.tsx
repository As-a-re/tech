import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { longDate } from '@/lib/community/dates'
import { cn } from '@/lib/utils'
import { requireUser } from '@/server/identity/session'
import { myOrders } from '@/server/resources/resources'
import { PageHeader } from '@/components/common/page-header'

export const metadata = { title: 'My orders' }

export default async function MyResourceOrders() {
  const [me, t] = await Promise.all([requireUser('/resources/orders'), getT()])
  const orders = await myOrders(me.id)
  return (
    <>
      <PageHeader title={t('res.orders.title')} back="/resources" />
      {orders.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{t('res.orders.none')}</p> : (
        <ul className="divide-y">{orders.map((o) => (
          <li key={o.id} className="space-y-2 px-4 py-4" data-order={o.status}>
            <Link href={`/resources/${o.resourceId}`} className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {o.image ? <img src={o.image} alt="" className="size-16 rounded-lg object-cover" /> : <span className="size-16 rounded-lg bg-muted" />}
              <span className="min-w-0 flex-1"><b className="block">{o.title}</b>
                <span className="text-sm text-muted-foreground">{o.size ? `${t('res.size')} ${o.size} · ` : ''}× {o.qty} · {ghs(o.totalPesewas)} · {longDate(o.createdAt)}</span>
                <span className={cn('mt-1 block text-sm font-semibold', o.status === 'ready' ? 'text-green-600' : o.status === 'cancelled' ? 'text-muted-foreground' : 'text-primary')}>{t(`res.orders.status.${o.status}` as MessageKey)}</span></span>
            </Link>
            {o.kind === 'uniform' && o.collectionCode && (o.status === 'paid' || o.status === 'ready') && (
              <div className="rounded-xl border-2 border-dashed border-primary p-3 text-center">
                <p className="text-xs text-muted-foreground">{t('res.orders.code')}</p>
                <p className="font-mono text-3xl font-black tracking-[0.3em]" data-code>{o.collectionCode}</p>
                <p className="text-xs text-muted-foreground">{t('res.orders.codeHint')}{o.pickupInfo ? ` · ${o.pickupInfo}` : ''}</p>
              </div>
            )}
          </li>
        ))}</ul>
      )}
    </>
  )
}
