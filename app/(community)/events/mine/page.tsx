import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { listEvents } from '@/server/community/events'
import { PageHeader } from '@/components/common/page-header'
import { EventRow } from '@/components/community/event-row'

export const metadata = { title: 'My events' }

export default async function MyEvents() {
  const [me, t] = await Promise.all([requireUser('/events/mine'), getT()])
  const [hosting, going] = await Promise.all([listEvents({ filter: 'hosting', viewerId: me.id, limit: 50 }), listEvents({ filter: 'going', viewerId: me.id, limit: 50 })])
  const labels = { national: t('levels.national'), going: t('events.rsvp.goingCount'), cancelled: t('events.cancelled'), online: t('events.joinOnline') }
  const section = (title: string, items: typeof going.items) => (
    <section>
      <h2 className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      {items.length ? items.map((e) => <EventRow key={e.id} e={e} labels={labels} />) : <p className="px-4 py-6 text-sm text-muted-foreground">{t('events.none')}</p>}
    </section>
  )
  return (
    <>
      <PageHeader title={t('events.mine')} back="/events" />
      {section(t('events.going'), going.items.filter((e) => !e.viewer.isAuthor))}
      {section(t('events.hosting'), hosting.items)}
    </>
  )
}
