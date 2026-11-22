import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { getKidsItem } from '@/server/library/kids'
import { kidsMode } from '@/lib/library/kids-server'
import { KIDS_ICON } from '@/components/kids/kids-card'
import { ReadAloud } from '@/components/kids/read-aloud'
import { KidsQuiz } from '@/components/kids/quiz'
import { KidsItemActions } from '@/components/kids/kids-item-actions'
import { PrintButton } from '@/components/kids/print-button'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const it = await getKidsItem((await params).id, await getCurrentUser())
  return { title: it?.title ?? 'Kids' }
}

const paras = (s: string) => s.split(/\n{2,}/).filter(Boolean)

export default async function KidsItemPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me, mode] = await Promise.all([params, getT(), getCurrentUser(), kidsMode()])
  const it = await getKidsItem(id, me)
  if (!it || (mode && it.kind === 'lesson')) notFound()
  const Icon = KIDS_ICON[it.kind]
  const isPdf = it.fileUrl?.endsWith('.pdf')
  return (
    <article className="space-y-5 px-4 py-4" data-kids-view={it.kind}>
      <div className="flex items-center gap-2">
        <Link href="/children" aria-label={t('soon.back')} className="rounded-full bg-background/80 p-2 shadow-sm hover:bg-muted"><ArrowLeft className="size-5" /></Link>
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary"><Icon className="size-4" />{t(`kids.kinds.${it.kind}` as MessageKey)}</span>
        <span className="text-sm text-muted-foreground">{t(`kids.agesLong.${it.ageGroup}`)}</span>
        {it.canEdit && !mode && <span className="ml-auto"><KidsItemActions id={it.id} /></span>}
      </div>
      {it.coverUrl && it.kind !== 'colouring' && /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.coverUrl} alt="" className="aspect-video w-full rounded-3xl object-cover shadow-md" />}
      <header>
        <h1 className="text-3xl font-black leading-tight">{it.title}</h1>
        {it.bibleRef && <p className="mt-1 font-bold text-primary">{it.bibleRef}</p>}
        {it.summary && <p className="mt-2 text-lg text-muted-foreground">{it.summary}</p>}
      </header>

      {it.kind === 'story' && <>
        <ReadAloud audioUrl={it.audioUrl} text={`${it.title}. ${it.body}`} />
        <div className="space-y-4 text-xl leading-relaxed">{paras(it.body).map((p, i) => <p key={i}>{p}</p>)}</div>
      </>}

      {it.kind === 'memory_verse' && (
        <div className="rounded-3xl bg-gradient-to-br from-cyan-400 to-teal-600 p-6 text-center text-white shadow-md">
          <p className="font-serif text-3xl italic leading-snug">“{it.body}”</p>
          {it.bibleRef && <p className="mt-3 text-xl font-black">{it.bibleRef}</p>}
          <div className="mt-4 flex justify-center"><ReadAloud audioUrl={it.audioUrl} text={`${it.body}. ${it.bibleRef ?? ''}`} /></div>
        </div>
      )}

      {it.kind === 'quiz' && <div className="rounded-3xl bg-background p-5 shadow-md"><KidsQuiz id={it.id} questions={it.questions} best={it.best} /></div>}

      {(it.kind === 'song' || it.kind === 'video') && <>
        {it.youtube ? (
          <div className="aspect-video overflow-hidden rounded-3xl bg-black shadow-md">
            <iframe src={`https://www.youtube-nocookie.com/embed/${it.youtube}?rel=0&modestbranding=1`} title={it.title} className="size-full" loading="lazy"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        ) : it.videoUrl ? <video src={it.videoUrl} controls playsInline preload="metadata" className="w-full rounded-3xl bg-black shadow-md" />
          : it.audioUrl ? <audio src={it.audioUrl} controls className="w-full" /> : null}
        {it.body && <div className="space-y-4 whitespace-pre-line text-xl leading-relaxed">{paras(it.body).map((p, i) => <p key={i}>{p}</p>)}</div>}
      </>}

      {it.kind === 'colouring' && it.fileUrl && <>
        {isPdf ? <iframe src={it.fileUrl} title={it.title} className="h-[70vh] w-full rounded-2xl border bg-white" />
          : /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.fileUrl} alt={it.title} className="w-full rounded-2xl border bg-white" data-colouring />}
        <div className="flex gap-2">
          <PrintButton url={it.fileUrl} label={t('kids.print')} />
          <a href={it.fileUrl} download className="flex items-center gap-2 rounded-full border-2 px-5 py-3 font-black hover:bg-muted"><Download className="size-5" />{t('kids.download')}</a>
        </div>
      </>}

      {it.kind === 'lesson' && <>
        <div className="space-y-4 whitespace-pre-line text-[17px] leading-relaxed">{paras(it.body).map((p, i) => <p key={i}>{p}</p>)}</div>
        {it.fileUrl && <a href={it.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border px-4 py-2 font-semibold hover:bg-muted"><Printer className="size-4" />{t('kids.open')}</a>}
      </>}
    </article>
  )
}
