#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env.local ]; then cp .env.example .env.local; echo "Created .env.local. Add your Supabase database password and API settings before continuing."; fi
if grep -q '^AUTH_SECRET=$' .env.local; then
  secret="$(openssl rand -hex 32)"
  sed -i "s/^AUTH_SECRET=$/AUTH_SECRET=$secret/" .env.local
fi
if ! grep -q '^SUPABASE_DB_URL=postgresql://' .env.local || grep -q '\[YOUR-DATABASE-PASSWORD\]' .env.local; then
  echo "Configure SUPABASE_DB_URL in .env.local using Supabase → Project Settings → Database → Connection string."
  exit 1
fi
npm install --no-audit --no-fund
npx drizzle-kit migrate
npm test
exec npm run dev
