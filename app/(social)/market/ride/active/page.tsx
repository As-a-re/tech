import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { myJobs } from '@/server/market/riders'
import { JobCard } from '@/components/market/job-card'

export const metadata = { title: 'My deliveries' }

export default async function Active() {
  const [me, t] = await Promise.all([requireUser('/market/ride/active'), getT()])
  const [now, done] = await Promise.all([myJobs(me), myJobs(me, true, 30)])
  return (
    <div className="space-y-5 px-4 py-4">
      <section className="space-y-2"><h1 className="text-xl font-bold">{t('market.ride.active')}</h1>
        {now.length ? now.map((j) => <JobCard key={j.id} j={j} t={t} />) : <p className="py-6 text-center text-muted-foreground">{t('market.ride.none')}</p>}</section>
      <section className="space-y-2"><h2 className="text-lg font-bold">{t('market.ride.history')}</h2>
        {done.length ? done.map((j) => <JobCard key={j.id} j={j} t={t} />) : <p className="py-6 text-center text-muted-foreground">{t('market.ride.noHistory')}</p>}</section>
    </div>
  )
}
