import { MonitorSmartphone } from 'lucide-react'
import { getLocale, getT } from '@/lib/i18n/server'
import { describeDevice } from '@/lib/user-agent'
import { currentSessionId, requireUser } from '@/server/identity/session'
import { listSessions } from '@/server/account/account'
import { SettingsPage } from '@/components/settings/section'
import { RevokeButton, SignOutOthers } from './buttons'

export const metadata = { title: 'Devices' }

export default async function Page() {
  const [me, t, locale] = await Promise.all([requireUser('/settings/devices'), getT(), getLocale()])
  const [rows, current] = await Promise.all([listSessions(me.id), currentSessionId()])
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  const sorted = [...rows].sort((a, b) => (a.id === current ? -1 : b.id === current ? 1 : 0))
  return (
    <SettingsPage title={t('settings.sections.devices')}>
      <ul className="divide-y rounded-2xl border">
        {sorted.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3.5">
            <MonitorSmartphone className="size-6 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{describeDevice(s.userAgent)}{s.id === current && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{t('settings.devices.thisDevice')}</span>}</p>
              <p className="text-sm text-muted-foreground">{t('settings.devices.lastActive', { when: fmt(s.lastUsedAt) })}{s.ip ? ` · ${s.ip}` : ''}</p>
            </div>
            {s.id !== current && <RevokeButton id={s.id} />}
          </li>
        ))}
      </ul>
      {rows.length > 1 && <SignOutOthers />}
    </SettingsPage>
  )
}
