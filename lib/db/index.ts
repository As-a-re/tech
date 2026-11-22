import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const connectionString = process.env.SUPABASE_DB_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('A Supabase PostgreSQL connection URL is required')
export const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })
