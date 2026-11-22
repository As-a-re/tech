'use client'

import { useEffect, useState, useTransition } from 'react'
import { BellRing, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { removePushSubscription, savePushSubscription, setNotificationPrefAction } from '@/server/actions/discovery'

const b64ToBytes = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)) }

type State = 'loading' | 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on'

export function PushToggle({ publicKey }: { publicKey: string }) {
  const { t } = useI18n()
  const [state, setState] = useState<State>('loading')
  const [pending, start] = useTransition()
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported')
    if (!publicKey) return setState('unavailable')
    if (Notification.permission === 'denied') return setState('denied')
    navigator.serviceWorker.getRegistration('/').then((r) => r?.pushManager.getSubscription()).then((s) => setState(s ? 'on' : 'off'))
  }, [publicKey])
  const enable = () => start(async () => {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off')
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) })
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    if (await savePushSubscription(json, navigator.userAgent)) { setState('on'); toast.success(t('notifSettings.pushOn')) }
  })
  const disable = () => start(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe() }
    setState('off')
  })
  const text = state === 'on' ? t('notifSettings.pushOn') : state === 'denied' ? t('notifSettings.denied') : state === 'unsupported' ? t('notifSettings.unsupported')
    : state === 'unavailable' ? t('notifSettings.unavailable') : t('notifSettings.pushOff')
  return (
    <section className="rounded-2xl border p-5">
      <h2 className="flex items-center gap-2 font-bold"><BellRing className="size-5 text-primary" />{t('notifSettings.pushTitle')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      {(state === 'off' || state === 'on') && (
        <Button className="mt-4" variant={state === 'on' ? 'outline' : 'default'} disabled={pending} onClick={state === 'on' ? disable : enable}>
          {pending && <Loader2 className="animate-spin" />}{state === 'on' ? t('notifSettings.disable') : t('notifSettings.enable')}
        </Button>
      )}
    </section>
  )
}

export function NotificationPrefs({ types, prefs }: { types: string[]; prefs: Record<string, { inApp: boolean; push: boolean }> }) {
  const { t } = useI18n()
  const [state, setState] = useState(prefs)
  const [, start] = useTransition()
  const flip = (type: string, ch: 'inApp' | 'push', on: boolean) => {
    setState((s) => ({ ...s, [type]: { ...s[type], [ch]: on } }))
    start(() => setNotificationPrefAction(type, ch, on))
  }
  return (
    <section className="rounded-2xl border">
      <div className="flex items-center justify-between border-b px-5 py-3"><h2 className="font-bold">{t('notifSettings.typesTitle')}</h2>
        <span className="flex gap-6 text-xs font-medium text-muted-foreground"><span>{t('notifSettings.inApp')}</span><span>{t('notifSettings.push')}</span></span></div>
      <ul className="divide-y">
        {types.map((k) => (
          <li key={k} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-[15px]">{t(`notifSettings.types.${k}` as MessageKey)}</span>
            <span className="flex gap-8">
              <Switch checked={state[k].inApp} onCheckedChange={(v) => flip(k, 'inApp', v)} aria-label={`${t(`notifSettings.types.${k}` as MessageKey)}: ${t('notifSettings.inApp')}`} />
              <Switch checked={state[k].push} onCheckedChange={(v) => flip(k, 'push', v)} aria-label={`${t(`notifSettings.types.${k}` as MessageKey)}: ${t('notifSettings.push')}`} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Chats aren't listed in Notifications; this only controls phone/browser pushes for new messages. */
export function MessagePushRow({ initial, kind = 'message' }: { initial: boolean; kind?: 'message' | 'call' }) {
  const { t } = useI18n()
  const [on, setOn] = useState(initial)
  const [, start] = useTransition()
  const title = kind === 'call' ? t('notifSettings.callsTitle') : t('notifSettings.messagesTitle')
  return (
    <section className="flex items-center justify-between gap-4 rounded-2xl border p-5">
      <div><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{kind === 'call' ? t('notifSettings.callsText') : t('notifSettings.messagesText')}</p></div>
      <Switch checked={on} onCheckedChange={(v) => { setOn(v); start(() => setNotificationPrefAction(kind, 'push', v)) }} aria-label={title} />
    </section>
  )
}
