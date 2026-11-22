'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { revokeSessionAction, signOutOtherDevices } from '@/server/actions/account'

export function RevokeButton({ id }: { id: string }) {
  const { t } = useI18n(); const [p, start] = useTransition()
  return <Button size="sm" variant="outline" disabled={p} onClick={() => start(() => revokeSessionAction(id))}>{p && <Loader2 className="animate-spin" />}{t('settings.devices.signOut')}</Button>
}

export function SignOutOthers() {
  const { t } = useI18n(); const [p, start] = useTransition()
  return <Button variant="outline" className="text-destructive" disabled={p} onClick={() => start(() => signOutOtherDevices())}>{p && <Loader2 className="animate-spin" />}{t('settings.devices.signOutOthers')}</Button>
}
