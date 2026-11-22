# Supabase database setup

Supabase is the canonical database and migration system for PAPA.

## Apply migrations

For a fresh Supabase project, run `supabase/all-migrations.sql` in the SQL Editor. For an existing project, apply only migrations that are not already present. The individual files under `supabase/migrations/` are the source-controlled history; the consolidated bundle is checked with:

```bash
pnpm supabase:verify
```

Keep database and service-role credentials server-only. Configure `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL` or `DATABASE_URL` through the deployment environment.

## Validation

```bash
pnpm typecheck
pnpm build
pnpm supabase:verify
```

The optional RPC smoke test requires a disposable Supabase project and `SUPABASE_INTEGRATION_TESTS=1`. Never run it against production with a production service-role key.

## Runtime note

The application uses Supabase JS/RPC access for migrated domains and retains the PostgreSQL compatibility adapter for legacy runtime modules that are still being converted. Do not delete `drizzle-orm`, `pg`, or the active `db/` schema adapter until those remaining imports have been migrated and validated. The old base SQL files under `db/migrations/` have been removed; Supabase migrations are now the only migration source.
