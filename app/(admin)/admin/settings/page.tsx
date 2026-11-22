import { getT } from '@/lib/i18n/server'
import { getSetting } from '@/server/admin/platform-settings'
import { AdminHeading, Panel } from '@/components/admin/ui'
import { BannedWordsForm, FeeForm, SupportForm } from './forms'

export const metadata = { title: 'Platform settings' }

export default async function PlatformSettings() {
  const [t, support, words, fee] = await Promise.all([getT(), getSetting('support'), getSetting('bannedWords'), getSetting('marketFeePercent')])
  return (
    <>
      <AdminHeading title={t('admin.tabs.settings')} />
      <div className="space-y-5 p-4 sm:p-6">
        <Panel title={t('admin.settings.supportTitle')} note={t('admin.settings.supportNote')}><SupportForm email={support.email} phone={support.phone} /></Panel>
        <Panel title={t('admin.settings.wordsTitle')} note={t('admin.settings.wordsNote')}><BannedWordsForm words={words} /></Panel>
        <Panel title={t('admin.settings.feeTitle')} note={t('admin.settings.feeNote')}><FeeForm fee={fee} /></Panel>
      </div>
    </>
  )
}
