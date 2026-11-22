'use client'

import { useActionState } from 'react'
import { CheckCircle2, Upload } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { Label } from '@/components/ui/label'
import { FormAlert, SubmitButton } from '@/components/forms/fields'
import { useAdminError } from '@/components/admin/use-admin-error'
import { importCsvAction, type AdminResult } from '@/server/actions/admin'

export function ImportForm() {
  const { t } = useI18n(); const err = useAdminError()
  const [s, action] = useActionState<AdminResult, FormData>(importCsvAction, {})
  const d = s.data as { added: number; updated: number; skipped: number; problems: string[]; detail?: string } | undefined
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3 rounded-2xl border p-4">
        <FormAlert message={s.error ? `${err(s.error)}${d?.detail ? ` (${d.detail})` : ''}` : undefined} />
        <Label htmlFor="file">{t('admin.members.chooseFile')}</Label>
        <input id="file" type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:font-medium" />
        {s.fields?.file && <p className="text-xs font-medium text-destructive">{err(s.fields.file)}</p>}
        <SubmitButton className="sm:w-auto sm:px-6"><Upload className="size-4" />{t('admin.members.upload')}</SubmitButton>
      </form>
      {s.ok && d && (
        <div className="rounded-2xl border p-4">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5 text-green-600" />{t('admin.members.results', { added: d.added, updated: d.updated, skipped: d.skipped })}</p>
          {d.problems.length > 0 && (
            <>
              <p className="mt-3 text-sm font-medium">{t('admin.members.problems')}</p>
              <ul className="mt-1 max-h-72 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-destructive">{d.problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
