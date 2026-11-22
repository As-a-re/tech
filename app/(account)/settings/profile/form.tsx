'use client'

import { useActionState, useEffect, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Field, FormAlert, SubmitButton } from '@/components/forms/fields'
import { UserAvatar } from '@/components/common/user-avatar'
import { useSettingsError } from '@/components/settings/use-err'
import { saveProfile, type FormResult } from '@/server/actions/account'

export function ProfileForm({ name, username, avatarUrl, coverUrl, bio, website, anniversary }: { name: string; username: string; avatarUrl: string | null; coverUrl: string | null; bio: string; website: string; anniversary: string }) {
  const { t } = useI18n(); const err = useSettingsError()
  const [s, action] = useActionState<FormResult, FormData>(saveProfile, {})
  const [avatar, setAvatar] = useState(avatarUrl)
  const [cover, setCover] = useState(coverUrl)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [removeCover, setRemoveCover] = useState(false)
  const [len, setLen] = useState(bio.length)
  useEffect(() => { if (s.ok) toast.success(t('settings.saved')) }, [s, t])
  const pick = (set: (v: string) => void, clearRemove: () => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) { set(URL.createObjectURL(f)); clearRemove() }
  }
  return (
    <form action={action} className="space-y-5">
      <FormAlert message={err(s.fields?.photo)} />
      <input type="hidden" name="removeAvatar" value={removeAvatar ? '1' : ''} />
      <input type="hidden" name="removeCover" value={removeCover ? '1' : ''} />
      <div className="relative">
        <div className="relative aspect-[3/1] overflow-hidden rounded-xl bg-gradient-to-br from-brand-blue via-brand-blue/85 to-brand-red/75">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover} alt="" className="size-full object-cover" />}
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/20">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white" aria-label={t('settings.profile.cover')}>
              <Camera className="size-4" />{t('settings.profile.change')}
              <input type="file" name="cover" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={pick(setCover, () => setRemoveCover(false))} />
            </label>
            {cover && <button type="button" onClick={() => { setCover(null); setRemoveCover(true) }} className="flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white"><X className="size-4" />{t('settings.profile.remove')}</button>}
          </div>
        </div>
        <div className="absolute -bottom-10 left-4">
          <label className="relative block cursor-pointer rounded-full border-4 border-background" aria-label={t('settings.profile.photo')}>
            <UserAvatar name={name} src={avatar} className="size-24 text-3xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35 text-white"><Camera className="size-6" /></span>
            <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={pick(setAvatar, () => setRemoveAvatar(false))} />
          </label>
          {avatar && <button type="button" onClick={() => { setAvatar(null); setRemoveAvatar(true) }} className="mt-1 w-full text-center text-xs font-medium text-muted-foreground hover:text-destructive">{t('settings.profile.remove')}</button>}
        </div>
      </div>
      <div className="space-y-1.5 pt-12">
        <div className="flex justify-between"><Label htmlFor="bio">{t('settings.profile.bio')}</Label><span className="text-xs text-muted-foreground">{len}/280</span></div>
        <Textarea id="bio" name="bio" defaultValue={bio} maxLength={280} rows={3} onChange={(e) => setLen(e.target.value.length)} aria-invalid={!!s.fields?.bio} />
        {s.fields?.bio && <p className="text-xs font-medium text-destructive">{err(s.fields.bio)}</p>}
      </div>
      <Field label={t('settings.profile.website')} name="website" defaultValue={website} placeholder={t('settings.profile.websitePh')} inputMode="url" error={err(s.fields?.website)} />
      <Field label={t('settings.profile.anniversary')} name="anniversary" type="date" defaultValue={anniversary} error={err(s.fields?.anniversary)} className="sm:max-w-60" />
      <p className="-mt-2 text-xs text-muted-foreground">{t('settings.profile.anniversaryHelp')}</p>
      <p className="text-xs text-muted-foreground">@{username}</p>
      <SubmitButton className="sm:w-auto sm:px-8">{t('settings.profile.save')}</SubmitButton>
    </form>
  )
}
