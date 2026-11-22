import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import type { MessageKey, TFunction } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import type { PublicationCard as Card } from '@/server/library/publications'

export const ghs = (pesewas: number) => (pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: pesewas % 100 ? 2 : 0, maximumFractionDigits: 2 })

/** A cover tile: picture, type, title, edition and price. */
export function PublicationTile({ p, t, percent, className }: { p: Card; t: TFunction; percent?: number; className?: string }) {
  return (
    <Link href={`/publications/${p.id}`} className={cn('group block min-w-0', className)} data-publication>
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border bg-gradient-to-br from-primary/15 to-brand-red/10 shadow-sm transition group-hover:shadow-md">
        {p.coverUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.coverUrl} alt="" className="size-full object-cover" />
          : <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center"><BookOpen className="size-8 text-primary" /><span className="line-clamp-3 text-sm font-bold">{p.title}</span></div>}
        <span className={cn('absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold', p.pricePesewas ? 'bg-black/75 text-white' : 'bg-green-600 text-white')}>
          {p.pricePesewas ? t('pubs.price', { amount: ghs(p.pricePesewas) }) : t('pubs.free')}
        </span>
        {p.status !== 'published' && <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-black">{t(p.status === 'draft' ? 'pubs.draft' : 'pubs.form.schedule')}</span>}
        {percent !== undefined && <span className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30"><span className="block h-full bg-primary" style={{ width: `${percent}%` }} /></span>}
      </div>
      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">{t(`pubs.kinds.${p.kind}` as MessageKey)}</p>
      <p className="line-clamp-2 text-sm font-bold leading-snug">{p.title}</p>
      {(p.edition || p.seriesName) && <p className="truncate text-xs text-muted-foreground">{p.edition ?? p.seriesName}</p>}
    </Link>
  )
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-5 p-4 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
}

export function TileRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3 overflow-x-auto px-4 pb-2 [&>*]:w-28 [&>*]:shrink-0 sm:[&>*]:w-32">{children}</div>
}
