'use client'

import { PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { clockTime } from '@/lib/messages/format'
import { callLine, parseCallLog } from '@/lib/calls/text'
import { useCalls } from './call-provider'

/** A call in the chat ("Outgoing voice call · 3:12", "Missed video call") with Call back. */
export function CallLine({ body, mine, group, conversationId, at }: { body: string; mine: boolean; group: boolean; conversationId: string; at: string }) {
  const { t } = useI18n()
  const { start } = useCalls()
  const log = parseCallLog(body)
  if (!log) return null
  const l = callLine(log, t, mine, group)
  const Icon = log.media === 'video' ? Video : l.missed ? PhoneMissed : mine ? PhoneOutgoing : PhoneIncoming
  return (
    <div className={cn('flex px-3 py-1', mine ? 'justify-end' : 'justify-start')} data-call-line>
      <div className={cn('flex min-w-56 max-w-[82%] items-center gap-3 rounded-2xl px-3 py-2.5 shadow-sm', mine ? 'rounded-br-md bg-bubble-mine text-bubble-mine-fg' : 'rounded-bl-md bg-muted')}>
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', l.missed ? 'bg-[#FF3333]/15 text-[#FF3333]' : mine ? 'bg-white/15' : 'bg-background/70 text-primary')}><Icon className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <b className={cn('block truncate text-[15px]', l.missed && 'text-[#FF3333]')}>{l.title}</b>
          <span className={cn('block text-xs', mine ? 'text-bubble-mine-fg/75' : 'text-muted-foreground')}>{[l.sub, clockTime(at)].filter(Boolean).join(' · ')}</span>
        </span>
        <button type="button" onClick={() => start(conversationId, log.media)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold', mine ? 'bg-white/15 hover:bg-white/25' : 'bg-primary text-primary-foreground hover:bg-primary/90')}>
          {t('calls.callBack')}
        </button>
      </div>
    </div>
  )
}
