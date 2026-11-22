import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { getPrayer } from '@/server/devotion/prayer'
import { PageHeader } from '@/components/common/page-header'
import { TestimonyForm } from '@/components/devotion/testimony-form'

export const metadata = { title: 'Share a testimony' }

export default async function NewTestimony({ searchParams }: { searchParams: Promise<{ prayer?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/testimonies/new'), getT(), searchParams])
  const p = sp.prayer ? await getPrayer(sp.prayer, { id: me.id, assemblyId: me.assemblyId, isAdmin: false }) : null
  return <><PageHeader title={t('testimonies.new')} back="/testimonies" /><TestimonyForm prayer={p?.viewer.isAuthor ? { id: p.id, body: p.body } : null} /></>
}
