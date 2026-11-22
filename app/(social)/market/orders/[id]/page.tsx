import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Bike, Phone, FileText, KeyRound, MapPin, ShieldCheck, Store, Truck } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { longDate, timeLabel } from '@/lib/community/dates'
import { formatPhone } from '@/lib/identity/normalise'
import { requireUser } from '@/server/identity/session'
import { ACCEPT_WITHIN_HOURS, getOrder, REQUEST_REASONS } from '@/server/market/orders'
import { PageHeader } from '@/components/common/page-header'
import { UserAvatar } from '@/components/common/user-avatar'
import { MessageButton } from '@/components/messages/message-button'
import { ShopLogo } from '@/components/market/product-card'
import { OrderProgress } from '@/components/market/order-progress'
import { AdminOrderActions, AnswerRequest, BuyerActions, EscalateButton, ReviewButton, RiderPanel, SellerActions } from '@/components/market/order-actions'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Order' }

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [me, t] = await Promise.all([requireUser(`/market/orders/${id}`), getT()])
  const o = await getOrder(me, id)
  if (!o) notFound()
  const pickup = o.fulfilment === 'pickup'
  const statusLabel = o.status === 'shipped' && pickup ? t('market.pickupStatus.shipped') : t(`market.status.${o.status}`)
  const when = (iso: string) => `${longDate(iso)} · ${timeLabel(iso)}`
  const other = o.role === 'buyer' ? o.seller : o.buyer
  const open = o.requests.find((r) => r.status === 'open' || r.status === 'escalated')
  const left = o.totalPesewas - o.refundedPesewas
  const noteText = (kind: string, note: string | null) => {
    if (!note || note === 'not_accepted_in_time') return null
    if ((REQUEST_REASONS as readonly string[]).includes(note)) return t(`market.reasons.${note}` as MessageKey)
    if (note === 'confirmed_by_buyer' || note === 'code_checked') return t(`market.events.${note}`)
    if (kind === 'request_withdrawn' && (note === 'cancel' || note === 'return' || note === 'refund')) return t(`market.requestKind.${note}`)
    return note
  }
  const returnUntil = o.deliveredAt && o.returnDays > 0 ? new Date(new Date(o.deliveredAt).getTime() + o.returnDays * 86_400_000).toISOString() : null
  return (
    <>
      <PageHeader title={t('market.order.title', { number: o.number })} subtitle={statusLabel} back={o.role === 'seller' ? '/market/sell/orders' : o.role === 'admin' ? '/admin/market?tab=orders' : '/market/orders'}
        action={o.paidAt && <Link href={`/market/orders/${o.id}/invoice`} className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><FileText className="size-4" />{t('market.order.invoice')}</Link>} />
      <div className="space-y-4 px-4 py-4" data-order={o.number} data-status={o.status} data-role={o.role}>
        <section className="space-y-4 rounded-2xl border p-4">
          <p className={cn('text-xl font-black', o.status === 'cancelled' ? 'text-brand-red' : o.status === 'delivered' || o.status === 'completed' ? 'text-green-700 dark:text-green-400' : '')}>{statusLabel}</p>
          {o.status !== 'cancelled' && o.status !== 'pending_payment' && <OrderProgress status={o.status} pickup={pickup} t={t} />}
          {o.status === 'paid' && o.paidAt && <p className="text-sm text-muted-foreground">{t('market.order.acceptBy', { date: when(new Date(new Date(o.paidAt).getTime() + ACCEPT_WITHIN_HOURS * 3_600_000).toISOString()) })}</p>}
          {o.handoverCode && ['accepted', 'packed', 'shipped'].includes(o.status) && (
            <div className="rounded-xl border-2 border-dashed border-primary/50 p-3 text-center" data-handover-box>
              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground"><KeyRound className="size-3.5" />{t('market.order.code')}</p>
              <p className="font-mono text-3xl font-black tracking-[0.3em]" data-code>{o.handoverCode}</p>
              <p className="text-xs text-muted-foreground">{pickup ? t('market.order.codeHintPickup') : t('market.order.codeHint')}</p>
            </div>
          )}
          {o.role === 'buyer' && returnUntil && o.can.return && <p className="text-sm text-muted-foreground">{t('market.order.returnWindow', { date: longDate(returnUntil) })}</p>}
          {o.delivery && o.status !== 'cancelled' && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5 text-sm" data-delivery={o.delivery.status}>
              <Bike className="size-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1"><b className="block">{t('market.order.rider')}</b>
                {o.delivery.rider ? t('market.order.riderOn', { name: o.delivery.rider.name, vehicle: t(`market.ride.vehicle.${o.delivery.rider.vehicle as 'car'}`) }) : t('market.order.riderWaiting')}
                {o.role !== 'buyer' && ` · ${ghs(o.delivery.feePesewas)}`}</span>
              {o.delivery.rider?.phone && o.delivery.status !== 'delivered' && <a href={`tel:+${o.delivery.rider.phone}`} className="flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 font-semibold" aria-label={t('market.order.riderCall')}><Phone className="size-4" /></a>}
            </div>
          )}
          {o.role === 'buyer' && <BuyerActions orderId={o.id} openRequestId={o.openRequest?.id ?? null} can={o.can} />}
          {o.role === 'buyer' && o.can.escalate && <EscalateButton orderId={o.id} />}
          {o.role === 'seller' && (o.can.accept || o.can.pack || o.can.ship || o.can.handover || o.can.sellerCancel || o.can.requestRider || o.can.cancelRider) && (
            <div className="space-y-3 border-t pt-3"><p className="text-sm font-semibold">{t('market.seller.title')}</p><p className="text-xs text-muted-foreground">{t('market.seller.lead')}</p>
              {(o.can.requestRider || o.can.cancelRider) && <RiderPanel orderId={o.id} canRequest={o.can.requestRider} canCancel={o.can.cancelRider} deliveryFeeGhs={o.deliveryFeePesewas / 100}
                maxGhs={(o.totalPesewas - o.refundedPesewas - o.feePesewas) / 100} />}
              <SellerActions orderId={o.id} pickup={pickup} can={o.can} /></div>
          )}
          {o.role === 'admin' && (o.can.refund || o.can.adminCancel) && <div className="border-t pt-3"><AdminOrderActions orderId={o.id} canRefund={o.can.refund} canCancel={o.can.adminCancel} maxGhs={left / 100} /></div>}
        </section>

        {open && (
          <section className="space-y-2 rounded-2xl border border-amber-500/50 p-4" data-open-request={open.kind}>
            <p className="font-bold">{t('market.order.openRequest', { kind: t(`market.requestKind.${open.kind}`) })}</p>
            <p className="text-sm">{t(`market.reasons.${open.reason}` as MessageKey)}{open.details && ` · “${open.details}”`}</p>
            <p className="text-xs text-muted-foreground">{t(`market.requestStatus.${open.status}`)} · {when(open.createdAt)}</p>
            {open.status === 'escalated' && <p className="rounded-xl bg-muted px-3 py-2 text-sm" data-dispute>{open.response && <span className="block"><b>{t('market.order.shop')}:</b> “{open.response}”</span>}
              {open.escalationNote && <span className="block"><b>{t('market.order.buyer')}:</b> “{open.escalationNote}”</span>}</p>}
            {o.can.answer && <AnswerRequest orderId={o.id} requestId={open.id} kind={open.kind} maxGhs={left / 100} dispute={open.status === 'escalated'}
              suggestGhs={(open.kind === 'refund' ? left : Math.min(left, o.subtotalPesewas - o.discountPesewas - o.refundedPesewas)) / 100} />}
          </section>
        )}

        <section className="rounded-2xl border">
          <h2 className="border-b px-4 py-3 font-bold">{t('market.order.items')}</h2>
          <ul className="divide-y">{o.items.map((i) => (
            <li key={i.id} className="flex gap-3 px-4 py-3">
              {i.productId ? <Link href={`/market/p/${i.productId}`} className="size-16 shrink-0 overflow-hidden rounded-lg border bg-muted">{i.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.image} alt="" className="size-full object-cover" />}</Link>
                : <span className="size-16 shrink-0 rounded-lg border bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium">{i.title}</p>
                <p className="text-sm text-muted-foreground">{[i.variantName, `${i.qty} × ${ghs(i.unitPesewas)}`].filter(Boolean).join(' · ')}</p>
                {o.can.review && i.productId && <ReviewButton orderId={o.id} productId={i.productId} title={i.title} current={i.myRating} />}
              </div>
              <b className="text-sm">{ghs(i.totalPesewas)}</b>
            </li>))}</ul>
          <dl className="space-y-1 border-t px-4 py-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{t('market.order.subtotal')}</dt><dd>{ghs(o.subtotalPesewas)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t('market.order.deliveryFee')}</dt><dd>{o.deliveryFeePesewas ? ghs(o.deliveryFeePesewas) : t('market.checkout.free')}</dd></div>
            {o.discountPesewas > 0 && <div className="flex justify-between text-green-700 dark:text-green-400"><dt>{t('market.order.discount', { code: o.couponCode ?? '' })}</dt><dd>−{ghs(o.discountPesewas)}</dd></div>}
            <div className="flex justify-between text-base font-bold"><dt>{t('market.order.total')}</dt><dd data-order-total>{ghs(o.totalPesewas)}</dd></div>
            {o.refundedPesewas > 0 && <div className="flex justify-between text-brand-red"><dt>{t('market.order.refunded')}</dt><dd data-refunded={o.refundedPesewas}>−{ghs(o.refundedPesewas)}</dd></div>}
            {o.role !== 'buyer' && o.paidAt && <p className="pt-1 text-xs text-muted-foreground">{t('market.seller.net', { amount: ghs(o.sellerNetPesewas), fee: ghs(o.feePesewas) })}</p>}
          </dl>
          {o.escrow && <p className="flex items-center gap-2 border-t px-4 py-3 text-sm" data-escrow={o.escrow}><ShieldCheck className="size-4 text-primary" />{t(`market.order.escrow.${o.escrow}`)}</p>}
          {o.payment && (
            <p className="flex flex-wrap justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
              <span>{t('market.order.reference')}: {o.payment.reference}{o.payment.channel && ` · ${t('market.order.paidWith', { channel: o.payment.channel.replace('_', ' ') })}`}</span>
              {o.role === 'buyer' && o.payment.status !== 'pending' && <Link href={`/give/receipt/${o.payment.reference}`} className="font-semibold text-primary hover:underline">{t('market.order.receipt')}</Link>}
            </p>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 rounded-2xl border p-4 text-sm">
            <p className="flex items-center gap-2 font-bold">{pickup ? <MapPin className="size-4 text-primary" /> : <Truck className="size-4 text-primary" />}{pickup ? t('market.order.pickupAt') : t('market.order.deliverTo')}</p>
            {pickup ? <p>{o.pickupAddress || t('market.checkout.pickupArrange')}</p> : <>
              <p className="font-semibold">{o.recipientName}</p>
              {o.phone && <p>{formatPhone(o.phone)}</p>}
              <p>{[o.address, o.town].filter(Boolean).join(', ')}</p>
              {o.landmark && <p className="text-muted-foreground">{o.landmark}</p>}
            </>}
            {o.note && <p className="pt-1 italic text-muted-foreground">“{o.note}”</p>}
          </div>
          <div className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
            {o.role === 'buyer' ? <ShopLogo name={o.shopName} src={o.shopLogo} /> : other ? <UserAvatar name={other.fullName} src={other.avatarUrl} /> : <Store className="size-10 text-primary" />}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{o.role === 'buyer' ? t('market.order.shop') : t('market.order.buyer')}</p>
              {o.role === 'buyer' ? (o.shopSlug ? <Link href={`/market/shop/${o.shopSlug}`} className="font-bold hover:underline">{o.shopName}</Link> : <b>{o.shopName}</b>) : <p className="font-bold">{other?.fullName}</p>}
              {other && <p className="truncate text-muted-foreground">@{other.username}</p>}
              {o.role === 'admin' && <p className="text-muted-foreground">{o.shopName} · @{o.seller?.username}</p>}
            </div>
            {other && o.role !== 'admin' && <MessageButton userId={other.id} />}
          </div>
        </section>

        <section className="rounded-2xl border p-4">
          <h2 className="mb-3 font-bold">{t('market.order.track')}</h2>
          <ol className="space-y-3 border-l-2 pl-4" data-events={o.events.length}>
            {[...o.events].reverse().map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className="absolute -left-[1.4rem] top-1 size-3 rounded-full border-2 border-background bg-primary" />
                <p className="font-semibold">{t(`market.events.${e.kind}` as MessageKey)}{noteText(e.kind, e.note) && <span className="font-normal text-muted-foreground"> · {noteText(e.kind, e.note)}</span>}</p>
                <p className="text-xs text-muted-foreground">{when(e.at)}{e.actor && ` · ${e.actor}`}</p>
              </li>
            ))}
          </ol>
        </section>

        {o.requests.filter((r) => r.status !== 'open').length > 0 && (
          <section className="rounded-2xl border p-4">
            <h2 className="mb-2 font-bold">{t('market.seller.requests')}</h2>
            <ul className="space-y-2 text-sm">{o.requests.filter((r) => r.status !== 'open').map((r) => (
              <li key={r.id}><b>{t(`market.requestKind.${r.kind}`)}</b> · {t(`market.requestStatus.${r.status}`)}{r.refundPesewas ? ` · ${ghs(r.refundPesewas)}` : ''}{r.response && <span className="block text-muted-foreground">“{r.response}”</span>}</li>
            ))}</ul>
          </section>
        )}
      </div>
    </>
  )
}
