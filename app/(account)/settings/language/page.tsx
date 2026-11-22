import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { SettingsPage } from '@/components/settings/section'
import { LanguageList } from './list'

export const metadata = { title: 'Language' }

export default async function Page() {
  const [, t] = await Promise.all([requireUser('/settings/language'), getT()])
  return <SettingsPage title={t('settings.sections.language')}><LanguageList note={t('settings.language.note')} /></SettingsPage>
}
