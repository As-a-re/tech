import { login } from '@/server/identity/login'
import { createMobileSession, destroyMobileSession, getMobileUser, mobileIp, mobileResponseError } from '@/server/identity/mobile-session'

export const dynamic = 'force-dynamic'

type Body = { identifier?: unknown; password?: unknown }

/** Sign in for the Expo apps with the same accounts as the website. Responds with a bearer session token. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null
    const identifier = typeof body?.identifier === 'string' ? body.identifier : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!identifier.trim() || !password) return mobileResponseError('bad_request')
    const result = await login(identifier, password, mobileIp(request))
    if (result.ok) {
      const token = await createMobileSession(result.userId, { ip: mobileIp(request), userAgent: request.headers.get('user-agent') })
      return Response.json({ token })
    }
    return Response.json({ error: result.error }, { status: 401 })
  } catch {
    return mobileResponseError('server')
  }
}

/** Sign out: removes the session the request was made with. */
export async function DELETE(request: Request) {
  try {
    await destroyMobileSession(request)
    return Response.json({ ok: true })
  } catch {
    return mobileResponseError('server')
  }
}

/** Quick check that the stored token still works. */
export async function GET(request: Request) {
  try {
    const me = await getMobileUser(request)
    if (!me) return mobileResponseError('unauthorised')
    return Response.json({ user: me })
  } catch {
    return mobileResponseError('server')
  }
}
