import { getT } from '@/lib/i18n/server'
import { requireShop } from '@/server/market/require-shop'
import { shopToInput } from '@/server/market/seller'
import { ShopForm } from '@/components/market/shop-form'
import { ShopStatusControls } from '@/components/market/shop-status'

export const metadata = { title: 'Shop settings' }

export default async function ShopSettings() {
  const [{ shop }, t] = await Promise.all([requireShop('/market/sell/settings'), getT()])
  return (
    <>
      <h1 className="px-4 pt-5 text-xl font-bold">{t('market.sell.form.editTitle')}</h1>
      <ShopForm key={shop.id} mode="edit" initial={shopToInput(shop)} />
      <div className="px-4 pb-8"><ShopStatusControls status={shop.status} /></div>
    </>
  )
}
