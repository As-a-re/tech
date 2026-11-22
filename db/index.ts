import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL
if (!dbUrl) throw new Error('A Supabase PostgreSQL connection URL is required')
// One pool, reused across hot reloads in development
const g = globalThis as unknown as { __papaPool?: Pool }
/** Supabase connections require TLS by default. Set SUPABASE_DB_SSL=0 only for local development. */
const ssl = process.env.SUPABASE_DB_SSL === '0' ? undefined : { rejectUnauthorized: true }
export const pool = g.__papaPool ?? new Pool({ connectionString: dbUrl, max: Number(process.env.DATABASE_POOL_MAX) || 10, ssl })
if (process.env.NODE_ENV !== 'production') g.__papaPool = pool

export const db = drizzle(pool, { schema })
export { schema }
