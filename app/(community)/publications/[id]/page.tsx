import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, Lock } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { LOCALE_NAMES, isLocale } from '@/lib/i18n/config'
import { longDate } from '@/lib/community/dates'
import { getCurrentUser } from '@/server/identity/session'
import { getPublication, listPublications } from '@/server/library/publications'
import { PageHeader } from '@/components/common/page-header'
import { PublicationActions } from '@/components/library/publication-actions'
import { PublicationTile, TileRow, ghs } from '@/components/library/publication-card'
import { BuyButton } from '@/components/library/buy-button'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await getPublication((await params).id, await getCurrentUser())
  return { title: p?.title ?? 'Publication', description: p?.description.slice(0, 160), openGraph: p?.coverUrl ? { images: [p.coverUrl] } : undefined }
}

export default async function PublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const p = await getPublication(id, me)
  if (!p) notFound()
  const more = p.seriesId ? (await listPublications({ seriesId: p.seriesId })).items.filter((x) => x.id !== p.id).slice(0, 10) : []
  const readLabel = p.progress ? (p.format === 'pdf' ? t('pubs.continueAt', { n: p.progress.position }) : t('pubs.continueCh', { n: p.progress.position }))
    : p.access ? t('pubs.read') : t('pubs.readFree')
  const offline = p.format === 'pdf' ? [p.access ? p.fileUrl : p.previewUrl].filter(Boolean) as string[] : [`/publications/${p.id}/read`]
  return (
    <>
      <PageHeader title={t(`pubs.kinds.${p.kind}` as MessageKey)} back="/publications" />
      <article className="space-y-5 px-4 py-5">
        <div className="flex gap-4">
          <div className="w-32 shrink-0 overflow-hidden rounded-xl border shadow sm:w-40">
            {p.coverUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.coverUrl} alt="" className="aspect-[3/4] w-full object-cover" />
              : <div className="flex aspect-[3/4] items-center justify-center bg-primary/10"><BookOpen className="size-10 text-primary" /></div>}
          </div>
          <div className="min-w-0 space-y-1.5">
            {p.status !== 'published' && <span className="inline-block rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">{p.status === 'draft' ? t('pubs.draft') : t('pubs.scheduled', { when: p.publishAt ? longDate(p.publishAt) : '' })}</span>}
            <h1 className="text-2xl font-extrabold leading-tight" data-pub-title>{p.title}</h1>
            {p.subtitle && <p className="text-muted-foreground">{p.subtitle}</p>}
            {p.author && <p className="text-sm">{t('pubs.by', { name: p.author })}</p>}
            <p className="text-sm text-muted-foreground">
              {[p.edition, p.seriesName && p.seriesSlug ? null : p.seriesName, p.format === 'pdf' && p.pageCount ? t('pubs.pages', { n: p.pageCount }) : p.format === 'article' ? t('pubs.chapters', { n: p.chapters.length }) : null,
                isLocale(p.language) ? LOCALE_NAMES[p.language] : null, p.publishedAt ? longDate(p.publishedAt) : null].filter(Boolean).join(' · ')}
            </p>
            {p.seriesName && p.seriesSlug && <Link href={`/publications/series/${p.seriesSlug}`} className="text-sm font-semibold text-primary hover:underline">{p.seriesName}</Link>}
            <p className="text-sm text-muted-foreground">{t('pubs.levelLabel', { name: p.levelName })}</p>
            <p className="text-lg font-bold">{p.pricePesewas ? t('pubs.price', { amount: ghs(p.pricePesewas) }) : t('pubs.free')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/publications/${p.id}/read${p.format === 'article' && p.progress ? `?ch=${p.progress.position}` : ''}`} data-read
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90"><BookOpen className="size-5" />{readLabel}</Link>
          {!p.access && (me ? <BuyButton id={p.id} label={t('give.buy', { amount: ghs(p.pricePesewas) })} />
            : <Link href={`/login?next=/publications/${p.id}`} className="flex items-center gap-2 rounded-full border px-5 py-2.5 font-semibold"><Lock className="size-4" />{t('give.buy', { amount: ghs(p.pricePesewas) })}</Link>)}
          {p.access && p.pricePesewas > 0 && !p.canEdit && <span className="flex items-center gap-1 rounded-full bg-green-600/10 px-4 py-2.5 text-sm font-semibold text-green-700 dark:text-green-400">✓ {t('give.bought')}</span>}
        </div>
        <PublicationActions id={p.id} title={p.title} saved={p.saved} seriesId={p.seriesId} following={p.following} signedIn={!!me} canEdit={p.canEdit} offlineUrls={offline} />
        {p.description && <p className="whitespace-pre-line text-[15px] leading-relaxed">{p.description}</p>}
        {p.format === 'article' && (
          <section>
            <h2 className="mb-2 font-bold">{t('pubs.reader.contents')}</h2>
            <ol className="divide-y rounded-xl border">
              {p.chapters.map((c) => (
                <li key={c.position}>
                  {c.locked ? <span className="flex items-center gap-3 px-4 py-3 text-muted-foreground"><Lock className="size-4" />{c.position}. {c.title}</span>
                    : <Link href={`/publications/${p.id}/read?ch=${c.position}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"><span className="text-muted-foreground">{c.position}.</span>{c.title}</Link>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>
      {more.length > 0 && (
        <section className="border-t py-4">
          <h2 className="px-4 pb-2 font-bold">{t('pubs.moreInSeries')}</h2>
          <TileRow>{more.map((x) => <PublicationTile key={x.id} p={x} t={t} />)}</TileRow>
        </section>
      )}
    </>
  )
}
