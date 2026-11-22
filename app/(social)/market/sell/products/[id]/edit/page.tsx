import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireShop } from '@/server/market/require-shop'
import { productForEdit } from '@/server/market/seller'
import { ProductForm } from '@/components/market/product-form'

export const metadata = { title: 'Edit product' }

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ me }, t] = await Promise.all([requireShop(`/market/sell/products/${id}/edit`), getT()])
  const p = await productForEdit(me, id)
  if (!p) notFound()
  return <><h1 className="px-4 pt-5 text-xl font-bold">{t('market.sell.pform.editTitle')}</h1><ProductForm id={p.id} initial={p.input} removed={p.status === 'removed'} /></>
}
