import { NextResponse, type NextRequest } from 'next/server'
import { KIDS_COOKIE, kidsAllowed } from '@/lib/library/kids-mode'
import { updateSupabaseSession } from '@/lib/supabase/proxy'

/**
 * Maintenance mode: MAINTENANCE_MODE=1 shows the maintenance page everywhere except health checks and assets.
 * Kids mode: a device in Kids mode can only open the Kids section (a parent's PIN turns it off).
 */
export async function proxy(req: NextRequest) {
  const sessionResponse = await updateSupabaseSession(req)
  if (process.env.MAINTENANCE_MODE === '1' && !req.nextUrl.pathname.startsWith('/maintenance')) {
    return NextResponse.rewrite(new URL('/maintenance', req.url), { status: 503 })
  }
  if (req.cookies.get(KIDS_COOKIE)?.value && !kidsAllowed(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/children', req.url))
  }
  return sessionResponse
}

export const config = {
  matcher: ['/((?!api/health|_next/static|_next/image|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|svg|ico|webp)$).*)'],
}
