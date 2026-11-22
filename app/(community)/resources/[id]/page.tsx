import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpenText, MapPin, Pencil, Shirt } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { ghs } from '@/lib/give/money'
import { getCurrentUser } from '@/server/identity/session'
import { getResource } from '@/server/resources/resources'
import { PageHeader } from '@/components/common/page-header'
import { MediaGrid } from '@/components/posts/media-grid'
import { OrderForm } from '@/components/resources/order-form'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: (await getResource((await params).id, await getCurrentUser()))?.title ?? 'Resource' }
}

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const r = await getResource(id, me)
  if (!r) notFound()
  const Icon = r.kind === 'uniform' ? Shirt : BookOpenText
  return (
    <>
      <PageHeader title={t(`res.kinds.${r.kind}`)} subtitle={r.levelName} back="/resources" action={r.canManage && <Link href={`/resources/${r.id}/edit`} aria-label={t('res.edit')} className="rounded-full border p-2 hover:bg-muted"><Pencil className="size-4" /></Link>} />
      <article className="space-y-4 px-4 py-4" data-resource-page={r.kind}>
        {r.images.length > 0 ? <MediaGrid media={r.images.map((u) => ({ id: u, kind: 'image' as const, url: u, alt: null, width: 1200, height: 900 }))} />
          : <div className="flex aspect-[2/1] items-center justify-center rounded-2xl bg-primary/10"><Icon className="size-14 text-primary" /></div>}
        <div>
          <h1 className="text-2xl font-extrabold" data-resource-title>{r.title}</h1>
          <p className="text-xl font-bold">{r.pricePesewas ? ghs(r.pricePesewas) : t('res.free')}</p>
          {r.kind === 'study_guide' && r.pageCount ? <p className="text-sm text-muted-foreground">{t('res.pages', { n: r.pageCount })}</p> : null}
        </div>
        {r.description && <p className="whitespace-pre-line text-[15px]">{r.description}</p>}
        {r.kind === 'uniform' && r.pickupInfo && <p className="flex gap-2 rounded-xl bg-muted px-4 py-3 text-sm"><MapPin className="size-4 shrink-0 text-primary" /><span><b>{t('res.pickup')}:</b> {r.pickupInfo}</span></p>}
        {r.kind === 'study_guide' ? (
          <div className="flex flex-wrap gap-2">
            {r.access ? <Link href={`/resources/${r.id}/read`} data-read className="rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground">{t('res.read')}</Link>
              : me ? <OrderForm id={r.id} kind="study_guide" price={r.pricePesewas} sizes={[]} /> : <Link href={`/login?next=/resources/${r.id}`} className="rounded-full border px-5 py-2.5 font-semibold">{t('res.buy', { amount: ghs(r.pricePesewas) })}</Link>}
            {r.access && r.pricePesewas > 0 && !r.canManage && <span className="rounded-full bg-green-600/10 px-4 py-2.5 text-sm font-semibold text-green-700 dark:text-green-400">✓ {t('res.owned')}</span>}
          </div>
        ) : me ? <OrderForm id={r.id} kind="uniform" price={r.pricePesewas} sizes={r.sizes} />
          : <Link href={`/login?next=/resources/${r.id}`} className="block rounded-full bg-primary py-3 text-center font-bold text-primary-foreground">{t('auth.signIn')}</Link>}
      </article>
    </>
  )
}
