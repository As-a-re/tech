import { getT } from '@/lib/i18n/server'
import { recentVerses } from '@/server/devotion/verse'
import { longDate } from '@/lib/community/dates'
import { PageHeader } from '@/components/common/page-header'
import { VerseCard } from '@/components/devotion/verse-card'

export const metadata = { title: 'Verse of the day' }

export default async function VersePage() {
  const t = await getT()
  const [today, ...earlier] = await recentVerses(30)
  return (
    <>
      <PageHeader title={t('verse.title')} subtitle={longDate(`${today.day}T12:00:00Z`)} />
      <VerseCard v={today} />
      <h2 className="px-4 pb-2 pt-5 font-bold">{t('verse.archive')}</h2>
      <ul className="divide-y border-t">
        {earlier.map((v) => (
          <li key={v.day} className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{longDate(`${v.day}T12:00:00Z`)}</p>
            <p className="mt-1 font-serif text-[16px] italic leading-relaxed">“{v.text}”</p>
            <p className="mt-0.5 text-sm font-semibold">{v.reference} <span className="font-normal text-muted-foreground">· {v.translation}</span></p>
          </li>
        ))}
      </ul>
    </>
  )
}
