import { getT } from '@/lib/i18n/server'
import { ghs } from '@/lib/give/money'
import { requireUser } from '@/server/identity/session'
import { riderStats } from '@/server/market/riders'
import { myPayouts } from '@/server/market/payouts'
import { PayoutList } from '@/components/market/payout-list'

export const metadata = { title: 'Rider earnings' }

export default async function RideEarnings() {
  const [me, t] = await Promise.all([requireUser('/market/ride/earnings'), getT()])
  const [s, payouts] = await Promise.all([riderStats(me), myPayouts(me.id)])
  if (!s) return null
  const mine = payouts.filter((p) => p.kind === 'rider')
  return (
    <div className="space-y-4 px-4 py-4">
      <h1 className="text-xl font-bold">{t('market.ride.nav.earnings')}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-rider-earnings>
        {([[s.done, 'done'], [ghs(s.earned), 'earned'], [ghs(s.held), 'held'], [ghs(s.paid), 'paid'], [s.active, 'active']] as const).map(([v, k]) => (
          <div key={k} className="rounded-2xl border p-3"><p className="text-xl font-black text-primary">{v}</p><p className="text-sm">{t(`market.ride.stats.${k}`)}</p></div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('market.sell.earnings.payoutsSoon')}</p>
      <h2 className="text-lg font-bold">{t('market.payout.title')}</h2>
      {mine.length ? <PayoutList rows={mine} t={t} /> : <p className="py-6 text-center text-muted-foreground">{t('market.sell.earnings.noPayouts')}</p>}
    </div>
  )
}
