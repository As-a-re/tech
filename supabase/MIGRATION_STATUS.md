# Supabase JavaScript migration status

## Completed in this revision

- Added SQL/RPC migrations `0035`–`0047` for full-text post search, cursor-paged discovery and post feeds, trending/popular/suggested content, atomic external church-directory sync, scoped notifications and push subscription lookup, announcement CRUD/listing/view counts, prayer interactions, testimony mutations, event lifecycle/listing/reminder claims, CLI Tech Admin grants, and atomic resource-order stock/payment settlement.
- Converted `server/discovery/search.ts`, `explore.ts`, `lists.ts`, `saved.ts`, `server/posts/feeds.ts`, and `server/posts/visibility.ts` to Supabase JS/RPC-based access.
- Converted `server/community/levels.ts`, `announcements.ts`, and `events.ts` to Supabase JS/RPC-based access.
- Converted `server/devotion/birthdays.ts`, `prayer.ts`, and `testimonies.ts` to Supabase JS/RPC-based access.
- Converted `server/messages/access.ts`, `server/admin/content.ts`, `server/market/shared.ts` order-event writing, the church-directory integration adapters, and `server/live/live.ts` and `server/resources/resources.ts` to Supabase JS/RPC. Live streaming no longer imports Drizzle or the legacy database module. `server/market/shared.ts` still exposes a SQL visibility fragment consumed by the legacy catalog query path; the catalog query path remains to be converted.
- Converted CLI database setup and register scripts (`scripts/lib/db.ts`, `first-member.ts`, `grant-admin.ts`, `church-import.ts`) to use the Supabase service-role client. `db/register-ops.ts` now uses Supabase JS while retaining the CSV parser used by tests.
- Moved shared church directory and link-preview types out of Drizzle schema modules where practical.
- Updated Supabase RPC integration smoke tests and the consolidated migration bundle.

## Remaining work — runtime adapter cleanup

The project is **not yet fully Supabase-only**. A source scan still finds legacy database imports, including the following runtime modules that remain to be converted:

- `server/calls/calls.ts`
- `server/messages/chat.ts` and `server/messages/groups.ts`
- `server/market/seller.ts`, `riders.ts`, `catalog.ts`, `orders.ts`, `shared.ts`, and `cart.ts`

The remaining 38 files are mainly Drizzle schema definitions, database initialization, and legacy database-backed tests. Those must be migrated or replaced before the dependencies and schema layer can be removed. Keep `SUPABASE_DB_URL`, `drizzle-orm`, and `pg` for now; removing them prematurely would break the remaining runtime modules. `drizzle-kit` is no longer part of the project.

## Validation status

- `node scripts/verify-supabase-migrations.mjs`: passed; 30 individual migrations (`0018`–`0047`) match the consolidated SQL bundle.
- TypeScript syntax transpilation: passed for `server/live/live.ts` and `server/resources/resources.ts` (syntax only; not a typecheck).
- Full TypeScript typecheck and production build: **not verified**. Dependencies are not installed in this environment; the global `tsc` run reports missing framework modules and cannot establish a valid project typecheck.
- Unit and Supabase integration tests: **not run**. Integration probes have been added but require `SUPABASE_INTEGRATION_TESTS=1`, a disposable/test Supabase project, and `SUPABASE_SERVICE_ROLE_KEY`.
- SQL execution against PostgreSQL/Supabase: **not run** for migrations `0035`–`0047`. They must be applied and validated against a disposable Supabase project before production.

## Safe rollout

1. Back up the database and apply new migrations to a disposable Supabase project first.
2. Confirm which earlier migrations are already applied before executing SQL. Do not blindly run the consolidated bundle against a database that already has its base schema.
3. Run `npm run supabase:verify`, `npm test`, `npm run build`, and `npm run supabase:integration` with the test environment configured.
4. Verify RLS, service-role-only RPC grants, scope visibility, notification fan-out, event RSVP count consistency, and authorization behavior.
5. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Rotate credentials that were exposed in terminal history.
