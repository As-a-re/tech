# PAPA: technical handover

For the engineers who will host, run and extend PAPA, the app of Christ Anointed Church Ghana.
Read this first, then:

| Document | For |
|---|---|
| [`DEPLOY-AWS.md`](DEPLOY-AWS.md) | Hosting on AWS: database, files, containers, domain, payments, SMS, calls, backups |
| [`MOBILE-APPS.md`](MOBILE-APPS.md) | Building and publishing the Android and iPhone apps |
| [`CHURCH_DB_API.md`](CHURCH_DB_API.md) | The API PAPA needs from the church's member database |
| [`SECURITY.md`](SECURITY.md) | How PAPA protects accounts, data and money; launch checklist |
| [`ADMIN-GUIDE.md`](ADMIN-GUIDE.md) | For Tech Admins running PAPA day to day |
| [`DESIGN.md`](DESIGN.md) | Product decisions, feature by feature |

## 1. What PAPA is
One web app that serves members in the browser (installable as a PWA) and inside the Android and iPhone apps (a native shell that opens the live site). Areas: Home feed and posts, Explore and Search, Notifications, Messages and groups, voice and video Calls, Announcements, Events, Assembly directory, Prayer, Testimonies, Verse of the day, Birthdays, Publications (PDF and written), PAPA Kids, Live broadcasts, Give (tithes, offerings, projects), Resources (uniforms, study guides), Market (shops, escrow, riders, payouts), Account and privacy, Admin.

Languages: English complete; Twi, Ga and Ewe drafts in `locales/`.

## 2. Stack
| Part | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components, Server Actions), TypeScript strict |
| Database | PostgreSQL 15+ (17 tested) through Drizzle ORM; SQL migrations in `db/migrations` |
| Styling | Tailwind CSS 4, light and pure-black dark themes |
| Realtime | Server-Sent Events (`/api/realtime`) fed by Postgres `LISTEN/NOTIFY`, so it works across many servers |
| Files | Local disk or S3 (`integrations/storage`), always served through `/media/*` with permission checks |
| Payments | Paystack (MoMo and card), Paystack Transfers for payouts; a built-in sandbox when no key is set |
| SMS | Arkesel (or printed to the console in development) |
| Calls and Live | LiveKit (Cloud or self-hosted) |
| Push | Web Push (VAPID) for browsers; Firebase Cloud Messaging (HTTP v1) for the phone apps |
| Phone apps | Capacitor 8 (`android/`, `ios/`) |
| Tests | Vitest against a real Postgres (`npm test`) |
| Runtime | Node.js 22 |

## 3. Code map
| Folder | Holds |
|---|---|
| `app/` | Routes. Groups: `(public)` sign-in and registration, `(social)` feed, profiles, market, `(community)` announcements, events, give, `(chat)` messages, `(reader)` publications, `(kids)`, `(watch)` live, `(account)`, `(admin)`; `api/` route handlers; `media/` file serving |
| `components/` | UI by feature; `shell/` (header, menus, bottom bar), `ui/` (base kit), `providers/` (theme, realtime, native bridge) |
| `server/` | All business logic, one folder per feature. `server/actions/*` are the Server Actions the screens call; each checks the signed-in member and permissions before calling the feature code |
| `integrations/` | Outside services: `church-db` (local register or API), `storage`, `push`, `sms`, `paystack`, `livekit` |
| `db/schema` | Drizzle table definitions (about 100 tables) by area; `db/migrations` the SQL that creates them |
| `lib/` | Shared helpers: env, crypto, money (pesewas), i18n, navigation, identity rules |
| `locales/` | Translation files |
| `scripts/` | `setup.sh` (developer setup), `migrate.mjs` (production migrations), `backup.sh`, `demo.ts`, `church-import.ts`, `grant-admin.ts`, `livekit-dev.sh` |
| `tests/` | Vitest suites, one per area |
| `mobile/` | Phone app offline page (`www/`) and icon/splash sources (`assets/`) |

## 4. Rules that run through the code
- **Money is whole pesewas** (`integer`), never floats. GH₵ 12.50 is `1250`.
- **Every server action authenticates and authorises** (signed-in member, Tech Admin, owner, or a level role). Screens hide things, but the server decides.
- **Identity comes from the church register.** Accounts link to a Church ID; name, phone, assembly and active status come from the register (local table or church API) and refresh at every sign-in and every 15 minutes (API mode).
- **Background jobs claim rows** (`update … where … returning`, or a lock row), so any number of servers can run them without doing anything twice.
- **Soft deletes** (`deleted_at`) for member content; account deletion removes personal data and is blocked while Market business is open.
- **Audit log** (`audit_log`) for every admin action and sensitive change.
- **Text for screens comes from `locales/en.json`** through `t('key')`; never hard-code English in components.

## 5. Data model (main tables)
| Area | Tables |
|---|---|
| Identity | `users`, `sessions`, `verification_codes`, `backup_codes`, `user_preferences`, `church_members` (cached register), `districts`, `assemblies`, `level_roles`, `rate_limits`, `audit_log` |
| Social | `posts`, `post_media`, `post_edits`, `post_hashtags`, `post_mentions`, `polls`, `poll_options`, `poll_votes`, `bookmarks`, `bookmark_folders`, `favorites`, `pinned_posts`, `follows`, `follow_requests`, `blocks`, `mutes`, `lists`, `list_members`, `reports` |
| Notifications | `notifications`, `notification_settings`, `push_subscriptions` (web push endpoints and `fcm:<token>` for the phone apps) |
| Messages and calls | `conversations`, `conversation_members`, `messages`, `message_attachments`, `message_reactions`, `message_hidden`, `group_join_requests`, `calls`, `call_participants` |
| Community | `announcements`, `announcement_media`, `level_subscriptions`, `events`, `event_rsvps`, `assembly_profiles`, `prayer_requests`, `prayer_prayed`, `testimonies`, `testimony_media`, `testimony_praises`, `daily_verses`, `devotion_comments` |
| Library and Live | `publications`, `publication_series`, `publication_chapters`, `publication_saves`, `series_follows`, `reading_progress`, `kids_items`, `kids_quiz_questions`, `kids_quiz_results`, `lives`, `live_comments`, `live_viewers`, `live_reactions`, `live_reminders` |
| Payments | `payments` (every Paystack charge, any purpose), `funds` (giving projects) |
| Resources | `resources`, `resource_orders` |
| Market | `shops`, `shop_follows`, `products`, `product_variants`, `product_questions`, `product_reviews`, `product_alerts`, `wishlist_items`, `recently_viewed`, `cart_items`, `coupons`, `market_checkouts`, `market_orders`, `market_order_items`, `market_order_events`, `market_requests` (cancel, return, refund, dispute), `riders`, `deliveries`, `payouts` |
| Platform | `platform_settings` (key/value JSON: support contacts, blocked words, market fee, church sync state), `job_runs` |

The schema files in `db/schema` are the source of truth. After changing them run `npm run db:generate` and commit the new migration.

## 6. Background jobs
Started in `instrumentation.ts` on every server unless `JOBS=0`. They run each minute (`server/jobs/index.ts`):

| Job | Does |
|---|---|
| `releaseScheduledPosts`, `releaseScheduledPublications` | Publish items whose time has come |
| `sendEventReminders` | A day and an hour before events |
| `sendBirthdayNotifications` | Once a day from 6 AM |
| `expireLives` | End broadcasts that stopped sending |
| `settleStalePayments` | Re-check payments Paystack didn't confirm |
| `cancelUnacceptedOrders` | Cancel and refund Market orders a seller ignored |
| `settleMarket` | Release escrow after delivery and the return period, create and send payouts |
| `syncChurchChanges` | Every 15 minutes in API mode: apply member changes from the church database |
| `expireCalls` (every 10 s) | Unanswered rings and dropped callers |

## 7. Money flows
1. **Giving, publications, resources, Market checkout**: PAPA creates a `payments` row and a Paystack transaction; the member pays in Paystack's page; Paystack calls `/api/payments/paystack` (signature checked) and PAPA marks it paid. A return-page check and `settleStalePayments` cover lost webhooks.
2. **Market escrow**: the buyer's money is held. After delivery (rider code or buyer confirmation) and the return period, `settleMarket` releases it, keeps the service fee (Admin → Platform settings) and creates payouts for seller and rider.
3. **Payouts**: sent by Paystack Transfers to MoMo or bank; `transfer.success/failed/reversed` webhooks finish them. Failed ones retry; Tech Admins can mark manual bank payouts paid.
4. With no `PAYSTACK_SECRET_KEY`, all of this runs in a sandbox (pretend checkout and transfers) for testing.

## 8. Running it locally
```bash
bash scripts/setup.sh "first run"   # creates .env.local and the database, installs, migrates, tests, starts
npm run dev
npm test                             # type check + all tests (needs Postgres from setup)
```

## 9. Production build
```bash
docker build -t papa .                       # or: npm ci && npm run build
docker run -p 3000:3000 --env-file .env.production papa
```
The container applies migrations (`scripts/migrate.mjs`), then starts. Health check: `GET /api/health`.

## 10. Extending PAPA
- New feature: tables in `db/schema/<area>.ts` → `npm run db:generate` → logic in `server/<area>/` → actions in `server/actions/<area>.ts` (auth first) → screens in `app/` → strings in `locales/en.json` → tests in `tests/<area>.test.ts`.
- New notification type: add it to the notification type enum, the `TEXT` map in `server/notifications/notify.ts`, its icon, and the settings screen.
- New background job: add it to `JOBS` and make it claim its rows.
- Keep `npm test` green; tests run against a real database and clean up rows tagged `ZZTEST`.

## 11. Known limits and next steps
- **Search** uses Postgres `ILIKE` matching; fine for the church's size. Add `pg_trgm` indexes or OpenSearch if it grows a lot.
- **Video** is stored and served as uploaded (no transcoding). For heavy video use, add MediaConvert or a video service.
- **Translations** for Twi, Ga and Ewe need review by fluent members.
- **Phone apps** need Firebase set up before app notifications work (see MOBILE-APPS.md).
- **Church database**: switch `CHURCH_DB_MODE=api` once the church's API meets [`CHURCH_DB_API.md`](CHURCH_DB_API.md).
