import Link from 'next/link'
import { BookOpenText, Shirt } from 'lucide-react'
import type { TFunction } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { ghs } from '@/lib/give/money'
import type { ResourceCard as Card } from '@/server/resources/resources'

export function ResourceTile({ r, t }: { r: Card; t: TFunction }) {
  const Icon = r.kind === 'uniform' ? Shirt : BookOpenText
  return (
    <Link href={`/resources/${r.id}`} className="group block min-w-0" data-resource={r.kind}>
      <div className="relative aspect-square overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 to-brand-red/10">
        {r.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.image} alt="" className="size-full object-cover transition group-hover:scale-[1.02]" />
          : <Icon className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-primary" />}
        <span className={cn('absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold', r.pricePesewas ? 'bg-black/75 text-white' : 'bg-green-600 text-white')}>{r.pricePesewas ? ghs(r.pricePesewas) : t('res.free')}</span>
        {!r.inStock && <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-xs font-bold text-white">{t('res.outOfStock')}</span>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-bold">{r.title}</p>
    </Link>
  )
}
