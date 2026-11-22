'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Label } from '@/components/ui/label'
import { Field, FormAlert, SubmitButton } from '@/components/forms/fields'
import { AssemblyPicker } from '@/components/church/assembly-picker'
import { useAdminError } from './use-admin-error'
import { saveMemberAction, type AdminResult } from '@/server/actions/admin'

export type MemberFormValues = { churchId: string; fullName: string; phone: string; dateOfBirth: string; assembly: { id: string; name: string; town: string | null; districtName: string } | null }

export function MemberForm({ existing, values, readOnly }: { existing?: string; values?: MemberFormValues; readOnly?: boolean }) {
  const { t } = useI18n(); const err = useAdminError()
  const [s, action] = useActionState<AdminResult, FormData>(saveMemberAction, {})
  useEffect(() => { if (s.ok) toast.success(t('admin.saved')) }, [s, t])
  return (
    <form action={action} className="space-y-4">
      <FormAlert message={err(s.error)} />
      {existing && <input type="hidden" name="existing" value={existing} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.members.churchId')} name="churchId" defaultValue={values?.churchId} disabled={!!existing || readOnly} required={!existing} autoCapitalize="characters" error={err(s.fields?.churchId)} />
        <Field label={t('admin.members.phone')} name="phone" type="tel" defaultValue={values?.phone} disabled={readOnly} required error={err(s.fields?.phone)} />
      </div>
      <Field label={t('admin.members.fullName')} name="fullName" defaultValue={values?.fullName} disabled={readOnly} required error={err(s.fields?.fullName)} />
      <div className="space-y-1.5">
        <Label>{t('admin.members.assembly')}</Label>
        <AssemblyPicker initial={values?.assembly} placeholder={t('admin.structure.search')} invalid={!!s.fields?.assemblyId} />
        {s.fields?.assemblyId && <p className="text-xs font-medium text-destructive">{err(s.fields.assemblyId)}</p>}
      </div>
      <Field label={t('admin.members.dob')} name="dateOfBirth" type="date" defaultValue={values?.dateOfBirth} disabled={readOnly} error={err(s.fields?.dateOfBirth)} className="sm:max-w-60" />
      {!readOnly && <SubmitButton className="sm:w-auto sm:px-8">{t('admin.members.save')}</SubmitButton>}
    </form>
  )
}
