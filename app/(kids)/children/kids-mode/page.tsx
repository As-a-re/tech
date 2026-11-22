import { redirect } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { hasKidsPin } from '@/server/library/kids'
import { kidsMode } from '@/lib/library/kids-server'
import { PageHeader } from '@/components/common/page-header'
import { EnterKidsMode } from '@/components/kids/kids-mode-forms'

export const metadata = { title: 'Kids mode' }

export default async function KidsModePage() {
  const [me, t] = await Promise.all([requireUser('/children/kids-mode'), getT()])
  if (await kidsMode()) redirect('/children')
  return <><PageHeader title={t('kids.mode.title')} back="/children" /><EnterKidsMode hasPin={await hasKidsPin(me.id)} /></>
}
