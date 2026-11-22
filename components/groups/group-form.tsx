'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createGroupAction } from '@/server/actions/groups'
import { GroupPhoto } from './group-photo'
import { MemberPicker, type Picked } from './member-picker'

/** New group: photo, name, description, private/public, and people to add. */
export function GroupForm() {
  const { t } = useI18n()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [members, setMembers] = useState<Picked[]>([])
  const [pending, start] = useTransition()
  const err = (code: string) => toast.error(t(`groups.err.${code}` as MessageKey))
  const submit = () => start(async () => {
    const r = await createGroupAction({ title, description, avatarUrl, visibility, memberIds: members.map((m) => m.id) })
    if (!r.ok) { err(r.error); return }
    toast.success(t('groups.created'))
    if (r.skipped) toast.message(t('groups.skipped', { n: r.skipped }))
    router.push(`/messages/${r.id}`)
  })
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-5 px-4 py-5">
      <GroupPhoto url={avatarUrl} onChange={setAvatarUrl} onError={err} />
      <label className="block space-y-1">
        <span className="text-sm font-semibold">{t('groups.name')}</span>
        <input name="title" required maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('groups.namePh')}
          className="h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">{t('groups.about')}</span>
        <textarea name="description" maxLength={500} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('groups.aboutPh')}
          className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t('groups.visibility')}</legend>
        {(['private', 'public'] as const).map((v) => (
          <label key={v} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', visibility === v && 'border-primary bg-primary/5')}>
            <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} className="mt-1 accent-[var(--primary)]" />
            {v === 'private' ? <Lock className="mt-0.5 size-5 text-muted-foreground" /> : <Globe className="mt-0.5 size-5 text-muted-foreground" />}
            <span><b className="block">{t(`groups.${v}`)}</b><span className="text-sm text-muted-foreground">{t(`groups.${v}Hint`)}</span></span>
          </label>
        ))}
      </fieldset>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{t('groups.addMembers')}</p>
        <MemberPicker value={members} onChange={setMembers} />
      </div>
      <Button type="submit" disabled={pending || !title.trim()} className="w-full rounded-full" size="lg">{t('groups.create')}</Button>
    </form>
  )
}
