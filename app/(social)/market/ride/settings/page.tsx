import { redirect } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { formatPhone } from '@/lib/identity/normalise'
import { requireUser } from '@/server/identity/session'
import { myRider } from '@/server/market/riders'
import { RiderForm } from '@/components/market/rider-form'

export const metadata = { title: 'Rider settings' }

export default async function RideSettings() {
  const [me, t] = await Promise.all([requireUser('/market/ride/settings'), getT()])
  const r = await myRider(me.id)
  if (!r) redirect('/market/ride')
  return (
    <>
      <h1 className="px-4 pt-5 text-xl font-bold">{t('market.ride.nav.settings')}</h1>
      <p className="px-4 text-sm text-muted-foreground">{t(`market.ride.status.${r.status}`)}</p>
      <RiderForm mode="edit" initial={{ phone: formatPhone(r.phone), vehicle: r.vehicle, plate: r.plate, areas: r.areas, about: r.about, payoutProvider: r.payoutProvider ?? 'mtn', payoutNumber: r.payoutNumber ? formatPhone(r.payoutNumber) : '', payoutName: r.payoutName ?? '' }} />
    </>
  )
}
