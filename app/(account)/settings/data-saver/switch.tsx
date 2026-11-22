'use client'

import { useI18n } from '@/lib/i18n/client'
import { SwitchRow } from '@/components/settings/switch-row'
import { saveDisplay } from '@/server/actions/account'

export function DataSaverSwitch({ on }: { on: boolean }) {
  const { t } = useI18n()
  return <SwitchRow title={t('settings.dataSaver.title')} text={t('settings.dataSaver.text')} checked={on} onSave={(v) => saveDisplay({ dataSaver: v })} />
}
