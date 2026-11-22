import 'server-only'
import { env } from '@/lib/env'

/** Sends one SMS. Provider chosen by SMS_PROVIDER: "console" (development: prints to the terminal) or "arkesel". */
export async function sendSms(to: string, message: string): Promise<void> {
  if (env.smsProvider === 'console') {
    console.log(`\n\x1b[1;35m[SMS → +${to}]\x1b[0m ${message}\n`)
    return
  }
  // Arkesel SMS API v2 (Ghana). https://developers.arkesel.com
  const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: { 'api-key': env.arkeselApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: env.smsSender, message, recipients: [to] }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`SMS provider error ${res.status}`)
}
