'use client'

import { useActionState, useEffect, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { Field, SubmitButton } from '@/components/forms/fields'
import { useAdminError } from '@/components/admin/use-admin-error'
import {
  resetTwoFactorAction, setAccountRoleAction, setAccountStatusAction, setVerifiedAction, signOutEverywhereAction, type AdminResult,
} from '@/server/actions/admin'

export function ActionButton({ kind, id, value, label, danger, disabled }: { kind: 'status' | 'role' | 'reset2fa' | 'signout'; id: string; value?: string; label: string; danger?: boolean; disabled?: boolean }) {
  const { t } = useI18n(); const err = useAdminError(); const [p, start] = useTransition()
  const run = () => start(async () => {
    const r = kind === 'status' ? await setAccountStatusAction(id, value as 'active' | 'suspended')
      : kind === 'role' ? await setAccountRoleAction(id, value as 'member' | 'tech_admin')
        : kind === 'reset2fa' ? await resetTwoFactorAction(id) : await signOutEverywhereAction(id)
    if (r.ok) toast.success(t('admin.accounts.done')); else toast.error(err(r.error))
  })
  return (
    <Button variant={danger ? 'outline' : 'default'} className={danger ? 'border-destructive/40 text-destructive hover:bg-destructive/5' : ''} disabled={p || disabled} onClick={run}>
      {p && <Loader2 className="animate-spin" />}{label}
    </Button>
  )
}

export function VerifiedForm({ id, verified, label }: { id: string; verified: boolean; label: string }) {
  const { t } = useI18n()
  const [s, action] = useActionState<AdminResult, FormData>(setVerifiedAction, {})
  useEffect(() => { if (s.ok) toast.success(t('admin.saved')) }, [s, t])
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label={t('admin.accounts.label')} name="label" defaultValue={label} maxLength={60} placeholder={t('admin.accounts.labelPh')} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton className="sm:w-auto sm:px-6">{t('admin.accounts.giveBadge')}</SubmitButton>
        {verified && <button name="remove" value="1" className="h-11 rounded-md border px-4 text-sm font-medium text-destructive hover:bg-destructive/5">{t('admin.accounts.removeBadge')}</button>}
      </div>
    </form>
  )
}
