# PAPA — Christ Anointed Church Ghana

PAPA is the Christ Anointed Church Ghana web and mobile application. It uses Next.js 16, Supabase Auth/Storage/RPCs, PostgreSQL migrations, and Capacitor for mobile packaging.

## Development

```bash
pnpm install
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm build
pnpm supabase:verify
pnpm test
```

## Supabase setup

1. Create or select the project at `https://jsrxojinuknybcciekda.supabase.co`.
2. Copy `.env.example` to `.env.local`.
3. Configure the Supabase URL, anonymous key, service-role key, and server database URL.
4. Apply `supabase/all-migrations.sql` to a fresh project, or apply only migrations not already present.
5. Keep service-role credentials server-only. Never expose them in `NEXT_PUBLIC_*` variables.

The consolidated migration bundle is verified against the individual files with `pnpm supabase:verify`.

## Environment

See `.env.example` for required and optional settings. The application uses the project-provided `DATABASE_URL` as a compatible server database fallback when `SUPABASE_DB_URL` is not present.

## Project structure

- `app/` — routes, pages, and server actions
- `components/` — reusable UI
- `server/` — server-side domain logic
- `lib/supabase/` — Supabase server and browser clients
- `supabase/` — canonical migrations and RPC definitions
- `scripts/` — operational utilities
- `android/`, `ios/`, `mobile/` — Capacitor projects and assets

## Optional integrations

SMS, LiveKit, Paystack, push notifications, S3-compatible storage, and church-register imports are disabled unless their environment variables are configured. Review `docs/SECURITY.md` before deploying.
