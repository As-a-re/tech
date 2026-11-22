'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Flag, Link2, LogOut, MoreVertical, Pencil, RefreshCw, Share2, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { longDate } from '@/lib/community/dates'
import type { GroupInfo, GroupMember } from '@/server/messages/groups'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { ReportDialog } from '@/components/moderation/report-dialog'
import { startChatAction } from '@/server/actions/messages'
import {
  addMembersAction, answerRequestAction, closeGroupAction, groupSettingsAction, leaveGroupAction, removeMemberAction, resetInviteAction, setAdminAction, updateGroupAction,
} from '@/server/actions/groups'
import { GroupPhoto } from './group-photo'
import { MemberPicker, type Picked } from './member-picker'

type Confirm = { title: string; body?: string; danger?: boolean; run: () => Promise<void> } | null

/** WhatsApp-style group info: photo and name, description, members and their roles, invite link, requests, settings, leave. */
export function GroupInfoView({ g, meId, isTechAdmin, appUrl }: { g: GroupInfo; meId: string; isTechAdmin: boolean; appUrl: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(g.title)
  const [description, setDescription] = useState(g.description ?? '')
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<Picked[]>([])
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [reporting, setReporting] = useState(false)
  const link = g.inviteCode ? `${appUrl}/groups/join/${g.inviteCode}` : null
  const err = (code: string) => toast.error(t(`groups.err.${code}` as MessageKey))
  const run = (fn: () => Promise<{ ok: boolean; error?: string } | { ok: true }>, okMsg?: MessageKey) => start(async () => {
    const r = await fn() as { ok: boolean; error?: string }
    if (!r.ok) { err(r.error ?? 'not_found'); return }
    if (okMsg) toast.success(t(okMsg))
    router.refresh()
  })
  const save = () => run(async () => { const r = await updateGroupAction(g.id, { title, description }); if (r.ok) setEditing(false); return r }, 'groups.saved')
  const setting = (k: 'onlyAdminsSend' | 'onlyAdminsEdit' | 'membersCanAdd' | 'approveJoins', v: boolean) => run(() => groupSettingsAction(g.id, { [k]: v }))
  const copy = async () => { if (!link) return; try { await navigator.clipboard.writeText(link); toast.success(t('groups.copied')) } catch { toast.error(link) } }
  const share = async () => { if (!link) return; if (navigator.share) await navigator.share({ title: g.title, text: t('groups.inviteTitle'), url: link }).catch(() => {}); else await copy() }
  const memberMenu = (m: GroupMember) => {
    const first = m.fullName.split(' ')[0]
    return (
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('messages.options')} className="rounded-full p-2 hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => start(async () => { const r = await startChatAction(m.id); if (r.ok) router.push(`/messages/${r.id}`); else toast.error(t(`messages.err.${r.error}` as MessageKey)) })}>{t('groups.message', { name: first })}</DropdownMenuItem>
          <DropdownMenuItem asChild><Link href={`/u/${m.username}`}>{t('messages.viewProfile')}</Link></DropdownMenuItem>
          {g.me.isAdmin && <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => run(() => setAdminAction(g.id, m.id, m.role !== 'admin'))}><ShieldCheck />{m.role === 'admin' ? t('groups.dismissAdmin') : t('groups.makeAdmin')}</DropdownMenuItem>
            {!m.isCreator && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm({ title: t('groups.removeConfirm', { name: m.fullName }), danger: true, run: async () => run(() => removeMemberAction(g.id, m.id)) })}><Trash2 />{t('groups.remove')}</DropdownMenuItem>}
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
  return (
    <div className="h-full overflow-y-auto" data-group-info>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-2 py-2 backdrop-blur">
        <Link href={`/messages/${g.id}`} aria-label={t('messages.back')} className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="size-5" /></Link>
        <h1 className="flex-1 truncate font-bold">{t('messages.info')}</h1>
      </div>

      <section className="space-y-3 border-b px-4 py-6 text-center">
        <GroupPhoto url={g.avatarUrl} editable={g.me.canEdit} onError={err} onChange={(url) => run(() => updateGroupAction(g.id, { avatarUrl: url }))} />
        {editing ? (
          <div className="mx-auto max-w-md space-y-2 text-left">
            <input aria-label={t('groups.name')} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} className="h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary" />
            <textarea aria-label={t('groups.about')} value={description} maxLength={500} rows={3} onChange={(e) => setDescription(e.target.value)} placeholder={t('groups.aboutPh')} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" />
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(false)}>{t('profile.cancel')}</Button><Button disabled={pending || !title.trim()} onClick={save}>{t('groups.save')}</Button></div>
          </div>
        ) : (
          <>
            <h2 className="flex items-center justify-center gap-2 text-2xl font-extrabold">{g.title}
              {g.me.canEdit && <button type="button" aria-label={t('groups.edit')} onClick={() => setEditing(true)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="size-4" /></button>}</h2>
            <p className="text-sm text-muted-foreground">{t(`groups.${g.visibility}`)} · {t('groups.members', { n: g.memberCount })}</p>
            {g.description && <p className="mx-auto max-w-md whitespace-pre-line text-[15px]">{g.description}</p>}
            <p className="text-xs text-muted-foreground">{t('groups.createdOn', { date: longDate(g.createdAt) })}</p>
          </>
        )}
      </section>

      {link && (
        <section className="space-y-2 border-b px-4 py-4">
          <h3 className="flex items-center gap-2 font-bold"><Link2 className="size-4" />{t('groups.invite')}</h3>
          <p className="break-all rounded-lg bg-muted px-3 py-2 text-sm" data-invite>{link}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={copy}><Copy />{t('groups.copyLink')}</Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={share}><Share2 />{t('groups.shareLink')}</Button>
            {g.me.isAdmin && <Button variant="outline" size="sm" className="rounded-full" onClick={() => setConfirm({ title: t('groups.resetLink'), body: t('groups.resetConfirm'), run: async () => run(() => resetInviteAction(g.id), 'groups.linkReset') })}><RefreshCw />{t('groups.resetLink')}</Button>}
          </div>
        </section>
      )}

      {g.me.isAdmin && g.requests.length > 0 && (
        <section className="border-b py-3">
          <h3 className="px-4 pb-1 font-bold">{t('groups.requests')} <span className="text-primary">{g.requests.length}</span></h3>
          <ul>{g.requests.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2">
              <UserAvatar name={r.fullName} src={r.avatarUrl} />
              <span className="min-w-0 flex-1"><b className="block truncate">{r.fullName}</b><span className="block truncate text-sm text-muted-foreground">@{r.username} · {r.assemblyName}</span></span>
              <Button size="sm" className="rounded-full" disabled={pending} onClick={() => run(() => answerRequestAction(g.id, r.id, true))}>{t('groups.accept')}</Button>
              <Button size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => run(() => answerRequestAction(g.id, r.id, false))}>{t('groups.decline')}</Button>
            </li>
          ))}</ul>
        </section>
      )}

      {g.me.isAdmin && (
        <section className="space-y-1 border-b px-4 py-3">
          <h3 className="pb-1 font-bold">{t('groups.settings')}</h3>
          {([['onlyAdminsSend', 'groups.onlyAdminsSendHint'], ['onlyAdminsEdit', null], ['membersCanAdd', null], ['approveJoins', 'groups.approveJoinsHint']] as const).map(([k, hint]) => (
            <label key={k} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1"><span className="block font-medium">{t(`groups.${k}`)}</span>{hint && <span className="block text-sm text-muted-foreground">{t(hint)}</span>}</span>
              <Switch checked={g[k]} disabled={pending} onCheckedChange={(v) => setting(k, v)} aria-label={t(`groups.${k}`)} />
            </label>
          ))}
          <label className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1"><span className="block font-medium">{t('groups.public')}</span><span className="block text-sm text-muted-foreground">{t('groups.publicHint')}</span></span>
            <Switch checked={g.visibility === 'public'} disabled={pending} onCheckedChange={(v) => run(() => groupSettingsAction(g.id, { visibility: v ? 'public' : 'private' }))} aria-label={t('groups.public')} />
          </label>
        </section>
      )}

      <section className="border-b py-3">
        <h3 className="px-4 pb-1 font-bold">{t('groups.members', { n: g.memberCount })}</h3>
        {g.me.canAdd && (
          <button type="button" onClick={() => { setPicked([]); setAdding(true) }} className="flex w-full items-center gap-3 px-4 py-2 font-semibold text-primary hover:bg-muted/50">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><UserPlus className="size-5" /></span>{t('groups.addPeople')}
          </button>
        )}
        <ul>{g.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-2" data-member={m.username}>
            <UserAvatar name={m.fullName} src={m.avatarUrl} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1"><b className="truncate">{m.id === meId ? t('messages.you') : m.fullName}</b>{m.verified && <VerifiedBadge />}</span>
              <span className="block truncate text-sm text-muted-foreground">{m.assemblyName}</span>
            </span>
            {m.role === 'admin' && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{t('groups.admin')}</span>}
            {m.id !== meId && memberMenu(m)}
          </li>
        ))}</ul>
      </section>

      <section className="px-2 py-3">
        <button type="button" onClick={() => setConfirm({ title: t('groups.leave'), body: t('groups.leaveConfirm'), danger: true, run: async () => {
          const r = await leaveGroupAction(g.id)
          if (!r.ok) { err(r.error); return }
          toast.success(t('groups.left')); router.push('/messages')
        } })} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 font-semibold text-destructive hover:bg-destructive/5"><LogOut className="size-5" />{t('groups.leave')}</button>
        <button type="button" onClick={() => setReporting(true)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 font-semibold text-destructive hover:bg-destructive/5"><Flag className="size-5" />{t('groups.report')}</button>
        {isTechAdmin && <button type="button" onClick={() => setConfirm({ title: t('groups.close'), body: t('groups.closeConfirm'), danger: true, run: async () => {
          const r = await closeGroupAction(g.id)
          if (!r.ok) { err(r.error); return }
          toast.success(t('groups.closed')); router.push('/messages')
        } })} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 font-semibold text-destructive hover:bg-destructive/5"><Trash2 className="size-5" />{t('groups.close')}</button>}
      </section>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('groups.addPeople')}</DialogTitle></DialogHeader>
          <MemberPicker value={picked} onChange={setPicked} exclude={g.members.map((m) => m.id)} />
          <Button disabled={pending || !picked.length} className="rounded-full" onClick={() => start(async () => {
            const r = await addMembersAction(g.id, picked.map((p) => p.id))
            if (!r.ok) { err(r.error); return }
            if (r.added) toast.success(t('groups.added', { n: r.added }))
            if (r.skipped) toast.message(t('groups.skipped', { n: r.skipped }))
            setAdding(false); router.refresh()
          })}>{t('groups.addMembers')}</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            {confirm?.body && <AlertDialogDescription>{confirm.body}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
            <AlertDialogAction className={confirm?.danger ? 'bg-destructive text-white hover:bg-destructive/90' : undefined} onClick={() => { const c = confirm; setConfirm(null); void c?.run() }}>{t('profile.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReportDialog target={{ conversationId: g.id }} title={t('groups.report')} open={reporting} onOpenChange={setReporting} />
    </div>
  )
}
