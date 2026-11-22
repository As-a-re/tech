import { getT } from '@/lib/i18n/server'
import { requireShop } from '@/server/market/require-shop'
import { ProductForm } from '@/components/market/product-form'

export const metadata = { title: 'Add product' }

export default async function NewProduct() {
  const [, t] = await Promise.all([requireShop('/market/sell/products/new'), getT()])
  return <><h1 className="px-4 pt-5 text-xl font-bold">{t('market.sell.pform.newTitle')}</h1><ProductForm /></>
}
