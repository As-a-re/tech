'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { startChatAction } from '@/server/actions/messages'

/** Profile button that opens the chat with this member. */
export function MessageButton({ userId }: { userId: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button type="button" disabled={pending} aria-label={t('messages.message')} title={t('messages.message')}
      onClick={() => start(async () => { const r = await startChatAction(userId); if (r.ok) router.push(`/messages/${r.id}`); else toast.error(t(`messages.err.${r.error}` as MessageKey)) })}
      className="flex size-9 items-center justify-center rounded-full border hover:bg-muted"><Mail className="size-[18px]" /></button>
  )
}
