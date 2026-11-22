import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { allowedLevels } from '@/server/library/permissions'
import { liveForEdit } from '@/server/live/live'
import { livekitEnabled } from '@/integrations/livekit'
import { PageHeader } from '@/components/common/page-header'
import { LiveForm } from '@/components/live/live-form'

export const metadata = { title: 'Edit live' }

export default async function EditLive({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [me, t] = await Promise.all([requireUser(`/live/${id}/edit`), getT()])
  const l = await liveForEdit(me, id)
  if (!l) notFound()
  const levels = await allowedLevels(me, 'media_team')
  const d = l.scheduledAt
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  return (
    <>
      <PageHeader title={t('live.edit')} back={`/live/${id}`} />
      <LiveForm id={id} levels={levels.includes(l.level) ? levels : [l.level, ...levels]} studioOn={livekitEnabled() || l.source === 'studio'} initial={{
        title: l.title, description: l.description, coverUrl: l.coverUrl, level: l.level, source: l.source, youtubeUrl: l.youtubeUrl, scheduledAt: local, replayUrl: l.replayUrl, giving: l.giving,
      }} />
    </>
  )
}
