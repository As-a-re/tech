import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { lastAddress, quoteCheckout } from '@/server/market/cart'
import { PageHeader } from '@/components/common/page-header'
import { CheckoutForm } from '@/components/market/checkout-form'

export const metadata = { title: 'Checkout' }

export default async function CheckoutPage() {
  const [me, t] = await Promise.all([requireUser('/market/checkout'), getT()])
  const [q, addr] = await Promise.all([quoteCheckout(me, []), lastAddress(me.id)])
  const shops = q.cart.shops.filter((s) => s.lines.some((l) => l.available)).map((s) => ({
    id: s.id, name: s.name, offersPickup: s.offersPickup, offersDelivery: s.offersDelivery, pickupAddress: s.pickupAddress, deliveryNote: s.deliveryNote,
    lines: s.lines.filter((l) => l.available).map((l) => ({ id: l.id, title: l.title, variantName: l.variantName, image: l.image, qty: l.qty, unitPesewas: l.unitPesewas, stock: l.stock })),
  }))
  return (
    <>
      <PageHeader title={t('market.checkout.title')} back="/cart" />
      {!shops.length ? (
        <div className="space-y-4 px-8 py-14 text-center"><p className="text-muted-foreground">{t('market.checkout.empty')}</p>
          <Link href="/market" className="inline-block rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground">{t('market.cart.browse')}</Link></div>
      ) : <CheckoutForm shops={shops} initial={q.groups} address={addr} />}
    </>
  )
}
