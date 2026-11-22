import { getT } from '@/lib/i18n/server'
import { chosenVerses, verseFor } from '@/server/devotion/verse'
import { longDate } from '@/lib/community/dates'
import { AdminHeading, Panel } from '@/components/admin/ui'
import { RemoveVerse, VerseForm } from '@/components/admin/verse-form'

export const metadata = { title: 'Daily verse' }

export default async function Verses() {
  const [t, list, today] = await Promise.all([getT(), chosenVerses(), verseFor()])
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
  return (
    <>
      <AdminHeading title={t('admin.verses.title')} />
      <div className="space-y-5 p-4 sm:p-6">
        <Panel title={t('admin.verses.today')}>
          <p className="font-serif text-lg italic">“{today.text}”</p>
          <p className="mt-1 text-sm font-semibold">{today.reference} · {today.translation}</p>
        </Panel>
        <Panel title={t('admin.verses.title')} note={t('admin.verses.note')}><VerseForm defaultDay={tomorrow} /></Panel>
        <Panel title={t('admin.verses.chosen')}>
          {list.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.verses.none')}</p> : (
            <ul className="divide-y">
              {list.map((v) => (
                <li key={v.day} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{longDate(`${v.day}T12:00:00Z`)}</p>
                    <p className="text-sm"><b>{v.reference}</b> · {v.text}</p>
                  </div>
                  <RemoveVerse day={v.day} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
