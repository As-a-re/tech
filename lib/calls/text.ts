import type { TFunction } from '@/lib/i18n/config'

export type CallLog = { callId: string; media: 'voice' | 'video'; result: 'completed' | 'missed' | 'declined' | 'busy' | 'cancelled' | 'failed' | null; duration: number; joined: number }

export function parseCallLog(body: string): CallLog | null {
  try { const v = JSON.parse(body); return v && v.callId ? v as CallLog : null } catch { return null }
}

/** "3:12" or "1:02:45". */
export function callDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

/** The call line in a chat, as the reader sees it: mine = I made the call. */
export function callLine(log: CallLog, t: TFunction, mine: boolean, group: boolean): { title: string; sub: string; missed: boolean } {
  const v = log.media === 'video'
  const kind = v ? t('calls.video') : t('calls.voice')
  if (log.result === 'completed') {
    const title = group ? t('calls.groupCall', { kind }) : mine ? t('calls.outgoing', { kind }) : t('calls.incoming', { kind })
    const sub = group && log.joined > 1 ? `${callDuration(log.duration)} · ${t('calls.joined', { n: log.joined })}` : callDuration(log.duration)
    return { title, sub, missed: false }
  }
  if (mine) {
    const why = log.result === 'busy' ? t('calls.busy') : log.result === 'declined' ? t('calls.declined') : log.result === 'cancelled' ? t('calls.cancelled')
      : log.result === 'failed' ? t('calls.failed') : t('calls.noAnswer')
    return { title: group ? t('calls.groupCall', { kind }) : t('calls.outgoing', { kind }), sub: why, missed: false }
  }
  if (log.result === 'declined' && !group) return { title: t('calls.incoming', { kind }), sub: t('calls.declined'), missed: false }
  return { title: v ? t('calls.missedVideo') : t('calls.missedVoice'), sub: '', missed: true }
}
