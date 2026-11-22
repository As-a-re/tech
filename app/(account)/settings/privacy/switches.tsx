'use client'

import { useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { SwitchRow } from '@/components/settings/switch-row'
import { savePrivacy } from '@/server/actions/account'

export function PrivacySwitches({ privateProfile, visibleToGuests, showBirthday, messagesFrom, callsFrom, readReceipts, showLastSeen }: { privateProfile: boolean; visibleToGuests: boolean; showBirthday: boolean; messagesFrom: string; callsFrom: string; readReceipts: boolean; showLastSeen: boolean }) {
  const { t } = useI18n()
  return (
    <>
      <SwitchRow title={t('settings.privacy.privateTitle')} text={t('settings.privacy.privateText')} checked={privateProfile} onSave={(v) => savePrivacy({ privateProfile: v })} />
      <SwitchRow title={t('settings.privacy.birthdayTitle')} text={t('settings.privacy.birthdayText')} checked={showBirthday} onSave={(v) => savePrivacy({ showBirthday: v })} />
      <SwitchRow title={t('settings.privacy.messagesTitle')} text={t('settings.privacy.messagesText')} checked={messagesFrom === 'following'} onSave={(v) => savePrivacy({ messagesFrom: v ? 'following' : 'everyone' })} />
      <CallsFrom initial={callsFrom} />
      <SwitchRow title={t('settings.privacy.receiptsTitle')} text={t('settings.privacy.receiptsText')} checked={readReceipts} onSave={(v) => savePrivacy({ readReceipts: v })} />
      <SwitchRow title={t('settings.privacy.lastSeenTitle')} text={t('settings.privacy.lastSeenText')} checked={showLastSeen} onSave={(v) => savePrivacy({ showLastSeen: v })} />
      <SwitchRow title={t('settings.privacy.guestsTitle')} text={t('settings.privacy.guestsText')} checked={visibleToGuests} onSave={(v) => savePrivacy({ visibleToGuests: v })} />
    </>
  )
}

/** Who can call me: Everyone · People I follow · Nobody. */
function CallsFrom({ initial }: { initial: string }) {
  const { t } = useI18n()
  const [value, setValue] = useState(initial)
  const [, start] = useTransition()
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-5" role="radiogroup" aria-label={t('settings.privacy.callsTitle')}>
      <div><p className="font-bold">{t('settings.privacy.callsTitle')}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t('settings.privacy.callsText')}</p></div>
      <div className="flex flex-wrap gap-2">
        {(['everyone', 'following', 'nobody'] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => { setValue(v); start(() => savePrivacy({ callsFrom: v })) }}
            className={cn('rounded-full border px-3 py-1.5 text-sm font-medium', value === v ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
            {t(`settings.privacy.calls.${v}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
