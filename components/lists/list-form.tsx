'use client'

import { useActionState } from 'react'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Field, FormAlert, SubmitButton } from '@/components/forms/fields'
import { saveListAction, type ListFormState } from '@/server/actions/discovery'

export function ListForm({ list }: { list?: { id: string; name: string; description: string | null; isPrivate: boolean } }) {
  const { t } = useI18n()
  const [s, action] = useActionState<ListFormState, FormData>(saveListAction, {})
  return (
    <form action={action} className="space-y-4">
      <FormAlert message={s.error && t(`lists.err.${s.error}` as MessageKey)} />
      {list && <input type="hidden" name="id" value={list.id} />}
      <Field label={t('lists.name')} name="name" defaultValue={list?.name} maxLength={40} required />
      <div className="space-y-1.5"><Label htmlFor="description">{t('lists.description')}</Label><Textarea id="description" name="description" defaultValue={list?.description ?? ''} maxLength={160} rows={2} /></div>
      <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" name="isPrivate" defaultChecked={list?.isPrivate} className="size-4 accent-[var(--primary)]" />{t('lists.private')}</label>
      <SubmitButton className="sm:w-auto sm:px-8">{list ? t('lists.save') : t('lists.create')}</SubmitButton>
    </form>
  )
}
