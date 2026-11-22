import { getCurrentUser } from '@/server/identity/session'
import { exportData } from '@/server/account/account'
import { audit } from '@/server/identity/audit'

/** Download of everything PAPA holds about the signed-in member (JSON). */
export async function GET() {
  const me = await getCurrentUser()
  if (!me) return new Response('Sign in required', { status: 401 })
  const data = await exportData(me.id)
  await audit('account.data_exported', { actorId: me.id })
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="papa-${me.username}-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
