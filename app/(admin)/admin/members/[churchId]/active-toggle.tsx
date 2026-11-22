'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { setMemberActiveAction } from '@/server/actions/admin'

export function ActiveToggle({ churchId, active }: { churchId: string; active: boolean }) {
  const { t } = useI18n(); const [p, start] = useTransition()
  return (
    <Button variant={active ? 'outline' : 'default'} className={active ? 'text-destructive' : ''} disabled={p}
      onClick={() => start(async () => { await setMemberActiveAction(churchId, !active); toast.success(t('admin.saved')) })}>
      {p && <Loader2 className="animate-spin" />}{active ? t('admin.members.deactivate') : t('admin.members.activate')}
    </Button>
  )
}
