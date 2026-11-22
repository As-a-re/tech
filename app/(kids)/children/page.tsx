import Link from 'next/link'
import { Baby, Plus, Settings2 } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { listKids, memoryVerse, type AgeGroup, type KidsKind } from '@/server/library/kids'
import { hasMinistryRole } from '@/server/library/permissions'
import { kidsMode } from '@/lib/library/kids-server'
import { isKidsAge, KIDS_AGES } from '@/lib/library/kids-mode'
import { SectionTabs } from '@/components/shell/section-tabs'
import { LinkChips } from '@/components/community/tabs'
import { KidsRow, KidsTile } from '@/components/kids/kids-card'

export const metadata = { title: 'Kids' }

const ROWS: { key: string; kinds: KidsKind[] }[] = [{ key: 'story', kinds: ['story'] }, { key: 'quiz', kinds: ['quiz'] }, { key: 'song', kinds: ['song', 'video'] }, { key: 'colouring', kinds: ['colouring'] }]

/** Kids home: memory verse of the week, then stories, quizzes, songs and colouring (lessons for teachers outside Kids mode). */
export default async function Kids({ searchParams }: { searchParams: Promise<{ age?: string }> }) {
  const [t, me, sp, mode] = await Promise.all([getT(), getCurrentUser(), searchParams, kidsMode()])
  const age: AgeGroup = mode ?? (isKidsAge(sp.age) ? sp.age : 'all')
  const [verse, all, editor] = await Promise.all([memoryVerse(age), listKids({ age, kidsMode: !!mode, userId: me?.id, limit: 200 }), hasMinistryRole(me, 'childrens_ministry')])
  const rows = [...ROWS, ...(mode ? [] : [{ key: 'lesson', kinds: ['lesson'] as KidsKind[] }])].map((r) => ({ ...r, items: all.filter((i) => r.kinds.includes(i.kind)) }))
  return (
    <>
      {!mode && <SectionTabs active="kids" signedIn={!!me} />}
      <div className="space-y-3 px-4 py-4">
        {!mode && (
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="flex flex-1 items-center gap-2 text-2xl font-black"><Baby className="size-7 text-brand-red" />{t('kids.title')}</h1>
            {me && <Link href="/children/kids-mode" className="rounded-full bg-amber-300 px-4 py-1.5 text-sm font-bold text-black hover:bg-amber-200" data-kids-mode-link>{t('kids.mode.button')}</Link>}
            {editor && <Link href="/children/manage" aria-label={t('kids.manage')} className="rounded-full border p-2 hover:bg-muted"><Settings2 className="size-4" /></Link>}
            {editor && <Link href="/children/new" className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />{t('kids.add')}</Link>}
          </div>
        )}
        {!mode && <p className="text-sm text-muted-foreground">{t('kids.lead')}</p>}
        {!mode && <LinkChips active={age} items={KIDS_AGES.map((a) => ({ key: a, label: t(`kids.ages.${a}`), href: a === 'all' ? '/children' : `/children?age=${a}` }))} />}
      </div>
      {verse && (
        <Link href={`/children/${verse.id}`} className="mx-4 block rounded-3xl bg-gradient-to-br from-cyan-400 to-teal-600 p-5 text-white shadow-md" data-memory-verse>
          <p className="text-xs font-black uppercase tracking-widest text-white/80">{t('kids.memoryVerse')}</p>
          <p className="mt-2 font-serif text-xl italic leading-snug">“{verse.body}”</p>
          {verse.bibleRef && <p className="mt-2 font-bold">{verse.bibleRef}</p>}
        </Link>
      )}
      {rows.every((r) => !r.items.length) && <p className="px-8 py-16 text-center text-muted-foreground">{t('kids.none')}</p>}
      {rows.filter((r) => r.items.length).map((r) => (
        <KidsRow key={r.key} title={t(`kids.sections.${r.key}` as MessageKey)}>{r.items.map((i) => <KidsTile key={i.id} item={i} t={t} />)}</KidsRow>
      ))}
    </>
  )
}
