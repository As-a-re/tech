import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

const origin = (value?: string) => value ? (value.startsWith('http') ? value : `https://${value}`) : undefined
const baseURL = origin(process.env.BETTER_AUTH_URL) || origin(process.env.VERCEL_PROJECT_PRODUCTION_URL) || origin(process.env.VERCEL_URL) || process.env.V0_RUNTIME_URL || 'http://localhost:3000'
const trustedOrigins = [baseURL, 'http://localhost:3000', process.env.V0_RUNTIME_URL, process.env.V0_DEV_APP_URL, process.env.V0_BUILD_URL, process.env.V0_SANDBOX_URL].filter(Boolean) as string[]

const secret = process.env.BETTER_AUTH_SECRET ?? (process.env.NEXT_PHASE === 'phase-production-build' ? 'build-only-auth-secret-not-used-at-runtime' : undefined)
if (!secret) throw new Error('BETTER_AUTH_SECRET is required to start authentication')

export const auth = betterAuth({
  secret,
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  baseURL,
  trustedOrigins,
  emailAndPassword: { enabled: true },
  ...(process.env.NODE_ENV === 'development' ? { advanced: { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } } } : {}),
})
