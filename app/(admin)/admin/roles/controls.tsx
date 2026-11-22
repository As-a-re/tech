'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { Check, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FormAlert, SubmitButton } from '@/components/forms/fields'
import { AssemblyPicker } from '@/components/church/assembly-picker'
import { UserAvatar } from '@/components/common/user-avatar'
import { useAdminError } from '@/components/admin/use-admin-error'
import { grantRoleAction, revokeRoleAction, searchAccountsAction, type AdminResult } from '@/server/actions/admin'

type Person = Awaited<ReturnType<typeof searchAccountsAction>>[number]

function MemberPicker({ placeholder }: { placeholder: string }) {
  const [q, setQ] = useState(''); const [hits, setHits] = useState<Person[]>([]); const [picked, setPicked] = useState<Person | null>(null); const [, start] = useTransition()
  useEffect(() => {
    if (picked || q.trim().length < 2) { setHits([]); return }
    const t = setTimeout(() => start(async () => setHits(await searchAccountsAction(q))), 200)
    return () => clearTimeout(t)
  }, [q, picked])
  return (
    <div className="relative">
      <input type="hidden" name="userId" value={picked?.id ?? ''} />
      {picked ? (
        <div className="flex h-11 items-center gap-2 rounded-md border bg-secondary/50 px-3 text-sm">
          <Check className="size-4 text-primary" /><span className="flex-1 truncate"><b>{picked.fullName}</b> @{picked.username}</span>
          <button type="button" aria-label="Change" onClick={() => { setPicked(null); setQ('') }}><X className="size-4" /></button>
        </div>
      ) : (
        <>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-11 w-full rounded-md border bg-transparent pl-9 pr-3 text-sm outline-none focus:border-primary" />
          {hits.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
              {hits.map((h) => (
                <li key={h.id}><button type="button" onClick={() => setPicked(h)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted">
                  <UserAvatar name={h.fullName} src={h.avatarUrl} className="size-7 text-xs" /><span><b>{h.fullName}</b> <span className="text-muted-foreground">@{h.username} · {h.assemblyName}</span></span>
                </button></li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export function GrantForm({ districts }: { districts: { id: string; name: string }[] }) {
  const { t } = useI18n(); const err = useAdminError()
  const [s, action] = useActionState<AdminResult, FormData>(grantRoleAction, {})
  const [level, setLevel] = useState<'national' | 'district' | 'local'>('local')
  const [key, setKey] = useState(0)
  useEffect(() => { if (s.ok) { toast.success(t('admin.saved')); setKey((k) => k + 1) } }, [s, t])
  return (
    <form key={key} action={action} className="space-y-3">
      <FormAlert message={err(s.error ?? s.fields?.userId ?? s.fields?.level)} />
      <div className="space-y-1.5"><Label>{t('admin.roles.member')}</Label><MemberPicker placeholder={t('admin.roles.searchMember')} /></div>
      <div className="space-y-1.5">
        <Label htmlFor="role">{t('admin.roles.role')}</Label>
        <select id="role" name="role" defaultValue="publications_editor" className="h-11 w-full rounded-md border bg-background px-3 text-sm">
          {(['media_team', 'publications_editor', 'childrens_ministry', 'resource_manager'] as const).map((k) => <option key={k} value={k}>{t(`admin.roles.kinds.${k}`)}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="level">{t('admin.roles.level')}</Label>
          <select id="level" name="level" value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
            <option value="national">{t('admin.roles.national')}</option><option value="district">{t('admin.roles.district')}</option><option value="local">{t('admin.roles.local')}</option>
          </select>
        </div>
        {level === 'district' && (
          <div className="space-y-1.5">
            <Label htmlFor="districtId">{t('admin.roles.district')}</Label>
            <select id="districtId" name="districtId" defaultValue="" className="h-11 w-full rounded-md border bg-background px-3 text-sm">
              <option value="" disabled>{t('admin.structure.chooseDistrict')}</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        {level === 'local' && <div className="space-y-1.5"><Label>{t('admin.roles.local')}</Label><AssemblyPicker placeholder={t('admin.roles.chooseAssembly')} /></div>}
      </div>
      <SubmitButton className="sm:w-auto sm:px-6">{t('admin.roles.grant')}</SubmitButton>
    </form>
  )
}

export function RevokeButton({ id }: { id: string }) {
  const { t } = useI18n(); const [p, start] = useTransition()
  return <Button size="sm" variant="outline" disabled={p} onClick={() => start(() => revokeRoleAction(id))}>{t('admin.roles.remove')}</Button>
}
