import Link from 'next/link'
import { Target } from 'lucide-react'
import type { TFunction } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'

export type FundCardData = { id: string; name: string; description: string; coverUrl: string | null; targetPesewas: number | null; raised: number; givers: number; levelName: string; endsOn: Date | null }

export function Progress({ raised, target }: { raised: number; target: number | null }) {
  if (!target) return null
  const pct = Math.min(100, Math.round((raised / target) * 100))
  return <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-green-600" style={{ width: `${pct}%` }} /></div>
}

export function FundCard({ f, t }: { f: FundCardData; t: TFunction }) {
  return (
    <Link href={`/give/funds/${f.id}`} className="block overflow-hidden rounded-2xl border hover:shadow-md" data-fund>
      {f.coverUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.coverUrl} alt="" className="aspect-[2/1] w-full object-cover" />
        : <div className="flex aspect-[2/1] items-center justify-center bg-gradient-to-br from-green-600 to-brand-blue"><Target className="size-10 text-white" /></div>}
      <div className="space-y-2 p-3">
        <p className="font-bold">{f.name}</p>
        <p className="text-xs text-muted-foreground">{f.levelName}</p>
        <Progress raised={f.raised} target={f.targetPesewas} />
        <p className="text-sm"><b>{t('give.raised', { raised: ghs(f.raised) })}</b>{f.targetPesewas ? <span className="text-muted-foreground"> {t('give.of', { target: ghs(f.targetPesewas) })}</span> : null}</p>
      </div>
    </Link>
  )
}
