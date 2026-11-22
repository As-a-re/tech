import 'server-only'
import { releaseScheduledPosts } from '@/server/posts/compose'
import { sendEventReminders } from '@/server/community/events'
import { sendBirthdayNotifications } from '@/server/devotion/birthdays'
import { expireCalls } from '@/server/calls/calls'
import { releaseScheduledPublications } from '@/server/library/publications'
import { expireLives } from '@/server/live/live'
import { settleStalePayments } from '@/server/payments/payments'
import { cancelUnacceptedOrders } from '@/server/market/orders'
import { settleMarket } from '@/server/market/payouts'
import { syncChurchChanges } from '@/server/identity/church-sync'

/** Background work that runs every minute on each app server (each job claims its rows, so nothing runs twice). */
export const JOBS = { releaseScheduledPosts, releaseScheduledPublications, expireLives, settleStalePayments, sendEventReminders, sendBirthdayNotifications: () => sendBirthdayNotifications(), cancelUnacceptedOrders, settleMarket, syncChurchChanges: () => syncChurchChanges() }

export async function runJobs() {
  const out: Record<string, number | string> = {}
  for (const [name, job] of Object.entries(JOBS)) {
    try { out[name] = await job() } catch (e) { out[name] = 'failed'; console.error(`[jobs] ${name} failed`, e) }
  }
  return out
}

const g = globalThis as unknown as { __papaJobs?: NodeJS.Timeout; __papaCalls?: NodeJS.Timeout }
export function startJobs(everyMs = 60_000) {
  if (g.__papaJobs) return
  g.__papaJobs = setInterval(() => { void runJobs() }, everyMs)
  g.__papaJobs.unref?.()
  // Unanswered rings and dropped callers are checked more often than the other jobs
  g.__papaCalls = setInterval(() => { void expireCalls().catch((e) => console.error('[jobs] expireCalls failed', e)) }, 10_000)
  g.__papaCalls.unref?.()
  setTimeout(() => { void runJobs() }, 5_000).unref?.()
}
