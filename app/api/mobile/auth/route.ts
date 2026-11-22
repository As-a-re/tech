import { login, refreshSupabaseSession } from '@/server/identity/login'
import { destroyMobileSession, getMobileUser, mobileIp, mobileResponseError } from '@/server/identity/mobile-session'

export const dynamic = 'force-dynamic'

type Body = { identifier?: unknown; password?: unknown; refresh_token?: unknown }

/** Sign in for the Expo apps with the same accounts as the website. Responds with a bearer session token. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null
    if (typeof body?.refresh_token === 'string') {
      const session = await refreshSupabaseSession(body.refresh_token)
      if (!session) return Response.json({ error: 'unauthorised' }, { status: 401 })
      return Response.json({ token: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at })
    }
    const identifier = typeof body?.identifier === 'string' ? body.identifier : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!identifier.trim() || !password) return mobileResponseError('bad_request')
    const result = await login(identifier, password, mobileIp(request))
    if (result.ok) return Response.json({ token: result.session.access_token, refreshToken: result.session.refresh_token, expiresAt: result.session.expires_at })
    return Response.json({ error: 'error' in result ? result.error : 'invalid' }, { status: 401 })
  } catch {
    return mobileResponseError('server')
  }
}

/** Sign out: removes the session the request was made with. */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null
    await destroyMobileSession(request, typeof body?.refresh_token === 'string' ? body.refresh_token : undefined)
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
