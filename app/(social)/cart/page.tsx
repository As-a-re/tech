import Link from 'next/link'
import { ShieldCheck, ShoppingCart, Store } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { ghs } from '@/lib/give/money'
import { requireUser } from '@/server/identity/session'
import { getCart } from '@/server/market/cart'
import { PageHeader } from '@/components/common/page-header'
import { CartLineControls } from '@/components/market/cart-controls'

export const metadata = { title: 'Cart' }

export default async function CartPage() {
  const [me, t] = await Promise.all([requireUser('/cart'), getT()])
  const cart = await getCart(me.id)
  const line = (l: (typeof cart.shops)[number]['lines'][number] | (typeof cart.saved)[number]) => (
    <li key={l.id} className="flex gap-3 px-4 py-3" data-cart-line={l.available ? 'ok' : 'gone'}>
      <Link href={`/market/p/${l.productId}`} className="size-20 shrink-0 overflow-hidden rounded-xl border bg-muted">{l.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.image} alt="" className="size-full object-cover" />}</Link>
      <div className="min-w-0 flex-1 space-y-1">
        <Link href={`/market/p/${l.productId}`} className="line-clamp-2 text-[15px] font-semibold hover:underline">{l.title}</Link>
        {l.variantName && <p className="text-sm text-muted-foreground">{l.variantName}</p>}
        <p className="font-bold">{ghs(l.unitPesewas)}</p>
        {!l.available ? <p className="text-sm font-semibold text-brand-red">{t('market.cart.unavailable')}</p> : l.stock <= 5 && <p className="text-xs font-semibold text-brand-red">{t('market.cart.onlyLeft', { n: l.stock })}</p>}
        <CartLineControls id={l.id} qty={l.qty} max={Math.min(50, l.stock)} saved={l.savedForLater} available={l.available} />
      </div>
    </li>
  )
  return (
    <>
      <PageHeader title={t('market.cart.title')} subtitle={cart.count ? t('market.cart.items', { n: cart.count }) : undefined} back="/market" />
      {cart.shops.length === 0 ? (
        <div className="space-y-4 px-8 py-14 text-center">
          <ShoppingCart className="mx-auto size-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('market.cart.none')}</p>
          <Link href="/market" className="inline-block rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground">{t('market.cart.browse')}</Link>
        </div>
      ) : (
        <>
          {cart.shops.map((s) => (
            <section key={s.id} className="border-b" data-cart-shop={s.slug}>
              <Link href={`/market/shop/${s.slug}`} className="flex items-center gap-2 px-4 pt-3 text-sm font-bold hover:underline"><Store className="size-4 text-primary" />{t('market.cart.from', { shop: s.name })}</Link>
              <ul className="divide-y">{s.lines.map(line)}</ul>
              <p className="flex justify-between px-4 pb-3 text-sm"><span className="text-muted-foreground">{t('market.cart.subtotal')}</span><b>{ghs(s.subtotalPesewas)}</b></p>
            </section>
          ))}
          <div className="space-y-3 px-4 py-4">
            <p className="flex justify-between text-lg"><span>{t('market.cart.subtotal')}</span><b data-cart-total>{ghs(cart.subtotalPesewas)}</b></p>
            <p className="text-xs text-muted-foreground">{t('market.cart.deliveryNext')}</p>
            {cart.subtotalPesewas > 0 && <Link href="/market/checkout" data-checkout className="block rounded-full bg-amber-400 py-3.5 text-center text-lg font-black text-black hover:bg-amber-300">{t('market.cart.checkoutAll', { amount: ghs(cart.subtotalPesewas) })}</Link>}
            <p className="flex gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary" />{t('market.cart.safe')}</p>
          </div>
        </>
      )}
      {cart.saved.length > 0 && (
        <section className="border-t">
          <h2 className="px-4 pt-4 text-lg font-bold">{t('market.cart.saved')} · {cart.saved.length}</h2>
          <ul className="divide-y">{cart.saved.map(line)}</ul>
        </section>
      )}
    </>
  )
}
