import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { allowedLevels } from '@/server/library/permissions'
import { livekitEnabled } from '@/integrations/livekit'
import { PageHeader } from '@/components/common/page-header'
import { LiveForm } from '@/components/live/live-form'

export const metadata = { title: 'Schedule a live' }

export default async function NewLive() {
  const [me, t] = await Promise.all([requireUser('/live/new'), getT()])
  const levels = await allowedLevels(me, 'media_team')
  return (
    <>
      <PageHeader title={t('live.new')} back="/live" />
      {levels.length ? <LiveForm levels={levels} studioOn={livekitEnabled()} /> : <p className="m-4 rounded-xl border bg-muted/50 p-4 text-sm" data-not-allowed>{t('live.form.notAllowed')}</p>}
    </>
  )
}
