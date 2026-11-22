import { Bike, CheckCircle2, Clock, MapPin, Wallet, XCircle } from 'lucide-react'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { formatPhone } from '@/lib/identity/normalise'
import { ghs } from '@/lib/give/money'
import { requireUser } from '@/server/identity/session'
import { myJobs, openJobs, riderStats } from '@/server/market/riders'
import { PageHeader } from '@/components/common/page-header'
import { RiderForm } from '@/components/market/rider-form'
import { JobCard } from '@/components/market/job-card'
import { AvailableSwitch } from '@/components/market/job-actions'

export const metadata = { title: 'Deliver for PAPA' }

export default async function RideHome() {
  const [me, t] = await Promise.all([requireUser('/market/ride'), getT()])
  const s = await riderStats(me)
  const { data: u, error } = await createSupabaseAdminClient().from('users').select('phone').eq('id', me.id).maybeSingle()
  if (error) throw new Error(`Unable to load rider profile: ${error.message}`)
  const phone = u?.phone ? formatPhone(u.phone) : ''
  const r = s?.rider
  if (!r || r.status === 'pending' || r.status === 'rejected') {
    const pts = [[MapPin, 'p1'], [Bike, 'p2'], [Wallet, 'p3']] as const
    return (
      <>
        <PageHeader title={t('market.ride.become.title')} back="/market" />
        {r?.status === 'pending' ? (
          <div className="space-y-3 px-6 py-12 text-center" data-rider-status="pending"><Clock className="mx-auto size-12 text-amber-500" />
            <h1 className="text-xl font-bold">{t('market.ride.status.pending')}</h1><p className="text-muted-foreground">{t('market.ride.pendingLead')}</p></div>
        ) : (
          <>
            <section className="space-y-3 bg-primary/5 px-4 py-6" data-become-rider>
              <h1 className="text-2xl font-black">{t('market.ride.become.title')}</h1>
              <p className="text-muted-foreground">{t('market.ride.become.lead')}</p>
              {r?.status === 'rejected' && <p className="flex gap-2 rounded-xl border border-destructive/40 bg-background p-3 text-sm"><XCircle className="size-5 shrink-0 text-destructive" />{t('market.ride.rejectedLead')}{r.note && ` “${r.note}”`}</p>}
              <ul className="grid gap-3 sm:grid-cols-3">{pts.map(([Icon, k]) => <li key={k} className="flex gap-3 rounded-2xl border bg-background p-3 text-sm"><Icon className="size-5 shrink-0 text-primary" />{t(`market.ride.become.${k}`)}</li>)}</ul>
            </section>
            <RiderForm mode="apply" initial={r ? { phone: r.phone, vehicle: r.vehicle, plate: r.plate, areas: r.areas, about: r.about, payoutProvider: r.payoutProvider ?? 'mtn', payoutNumber: r.payoutNumber ?? '', payoutName: r.payoutName ?? '' }
              : { phone, vehicle: 'motorbike', areas: [], payoutProvider: 'mtn', payoutNumber: phone, payoutName: me.fullName }} />
          </>
        )}
      </>
    )
  }
  const [jobs, active] = await Promise.all([r.status === 'active' && r.available ? openJobs(me) : [], myJobs(me)])
  return (
    <div className="space-y-4 px-4 py-4" data-rider-home={r.status}>
      <h1 className="text-xl font-black">{t('market.ride.title')}</h1>
      {r.status !== 'active' ? <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm">{t(`market.ride.status.${r.status}`)} · {t('market.ride.pausedLead')}</p>
        : <AvailableSwitch initial={r.available} />}
      <div className="grid grid-cols-3 gap-2">
        {([[s.done30, 'done30'], [ghs(s.held), 'held'], [ghs(s.paid), 'paid']] as const).map(([v, k]) => (
          <div key={k} className="rounded-2xl border p-3"><p className="text-lg font-black text-primary">{v}</p><p className="text-xs text-muted-foreground">{t(`market.ride.stats.${k}`)}</p></div>
        ))}
      </div>
      {active.length > 0 && <section className="space-y-2"><h2 className="font-bold">{t('market.ride.active')}</h2>{active.map((j) => <JobCard key={j.id} j={j} t={t} />)}</section>}
      {r.status === 'active' && r.available && (
        <section className="space-y-2"><h2 className="font-bold">{t('market.ride.jobs')}</h2>
          {jobs.length === 0 ? <p className="flex items-center gap-2 rounded-2xl border p-4 text-sm text-muted-foreground"><CheckCircle2 className="size-5" />{t('market.ride.noJobs')}</p>
            : <div className="space-y-2" data-open-jobs={jobs.length}>{jobs.map((j) => <JobCard key={j.id} j={j} t={t} />)}</div>}
        </section>
      )}
    </div>
  )
}
