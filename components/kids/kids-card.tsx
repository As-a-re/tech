import Link from 'next/link'
import { BookHeart, Brush, GraduationCap, Music, Puzzle, Video } from 'lucide-react'
import type { MessageKey, TFunction } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import type { KidsCard as Card, KidsKind } from '@/server/library/kids'

export const KIDS_ICON: Record<KidsKind, typeof BookHeart> = { story: BookHeart, quiz: Puzzle, song: Music, video: Video, colouring: Brush, memory_verse: BookHeart, lesson: GraduationCap }
const TONE: Record<KidsKind, string> = {
  story: 'from-sky-400 to-blue-600', quiz: 'from-amber-400 to-orange-500', song: 'from-pink-400 to-rose-500', video: 'from-violet-400 to-purple-600',
  colouring: 'from-lime-400 to-green-600', memory_verse: 'from-cyan-400 to-teal-600', lesson: 'from-slate-400 to-slate-600',
}

/** A big, friendly tile for one story, quiz, song or colouring page. */
export function KidsTile({ item, t }: { item: Card; t: TFunction }) {
  const Icon = KIDS_ICON[item.kind]
  return (
    <Link href={`/children/${item.id}`} className="group block min-w-0" data-kids-item={item.kind}>
      <div className={cn('relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br shadow-md transition group-hover:-translate-y-0.5 group-hover:shadow-lg', TONE[item.kind])}>
        {item.coverUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.coverUrl} alt="" className="size-full object-cover" />
          : <Icon className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-white/90" />}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-black"><Icon className="size-3.5" />{t(`kids.kinds.${item.kind}` as MessageKey)}</span>
        {item.stars !== null && item.stars !== undefined && <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{'⭐'.repeat(item.stars) || '☆'}</span>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[15px] font-extrabold leading-snug">{item.title}</p>
      {item.bibleRef && <p className="text-xs text-muted-foreground">{item.bibleRef}</p>}
    </Link>
  )
}

export function KidsRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-3">
      <h2 className="px-4 pb-2 text-lg font-black">{title}</h2>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 [&>*]:w-40 [&>*]:shrink-0 sm:[&>*]:w-48">{children}</div>
    </section>
  )
}
