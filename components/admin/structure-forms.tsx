'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Label } from '@/components/ui/label'
import { Field, FormAlert, SubmitButton } from '@/components/forms/fields'
import { useAdminError } from './use-admin-error'
import { saveAssemblyAction, saveDistrictAction, type AdminResult } from '@/server/actions/admin'

function useDone(s: AdminResult, reset: boolean) {
  const { t } = useI18n(); const ref = useRef<HTMLFormElement>(null)
  useEffect(() => { if (s.ok) { toast.success(t('admin.saved')); if (reset) ref.current?.reset() } }, [s, t, reset])
  return ref
}

export function DistrictForm({ id, name }: { id?: string; name?: string }) {
  const { t } = useI18n(); const err = useAdminError()
  const [s, action] = useActionState<AdminResult, FormData>(saveDistrictAction, {})
  const ref = useDone(s, !id)
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <FormAlert message={err(s.error)} />
      {id && <input type="hidden" name="id" value={id} />}
      <Field label={t('admin.structure.districtName')} id={id ? 'district-rename' : 'district-new'} name="name" defaultValue={name} required className="flex-1" error={err(s.fields?.name)} />
      <SubmitButton className="sm:mb-[1px] sm:w-auto sm:px-6">{id ? t('admin.structure.rename') : t('admin.structure.addDistrict')}</SubmitButton>
    </form>
  )
}

export function AssemblyForm({ id, values, districts, fixedDistrictId }: {
  id?: string; values?: { name: string; town: string | null; districtId: string }; districts: { id: string; name: string }[]; fixedDistrictId?: string
}) {
  const { t } = useI18n(); const err = useAdminError()
  const [s, action] = useActionState<AdminResult, FormData>(saveAssemblyAction, {})
  const ref = useDone(s, !id)
  return (
    <form ref={ref} action={action} className="space-y-3">
      <FormAlert message={err(s.error)} />
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('admin.structure.assemblyName')} id={id ? 'assembly-name' : 'assembly-new'} name="name" defaultValue={values?.name} required error={err(s.fields?.name)} />
        <Field label={t('admin.structure.town')} id={id ? 'assembly-town' : 'assembly-town-new'} name="town" defaultValue={values?.town ?? ''} />
      </div>
      {fixedDistrictId ? <input type="hidden" name="districtId" value={fixedDistrictId} /> : (
        <div className="space-y-1.5">
          <Label htmlFor="districtId">{t('admin.structure.district')}</Label>
          <select id="districtId" name="districtId" required defaultValue={values?.districtId ?? ''} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
            <option value="" disabled>{t('admin.structure.chooseDistrict')}</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {s.fields?.districtId && <p className="text-xs font-medium text-destructive">{err(s.fields.districtId)}</p>}
        </div>
      )}
      <SubmitButton className="sm:w-auto sm:px-6">{id ? t('admin.structure.save') : t('admin.structure.addAssembly')}</SubmitButton>
    </form>
  )
}
