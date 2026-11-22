# PAPA security

How PAPA protects members, their data and their money, and what the hosting team must do.

## Accounts and sign-in
- **Who can join**: only people in the church register (Church ID + matching phone, confirmed by an SMS code). Inactive members can't register or sign in, and are signed out within 15 minutes when the church database marks them inactive (API mode) or at once when a Tech Admin deactivates them.
- **Passwords**: Argon2id (`@node-rs/argon2`); at least 8 characters with a letter and a number (`lib/identity/rules.ts`).
- **2-step sign-in**: authenticator app (TOTP) with one-time backup codes; Tech Admins can reset it (audited).
- **Sessions**: a random 256-bit token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). The database stores only its SHA-256 hash, so a database leak doesn't expose live sessions. 30 days; members see their devices and can sign out any of them; changing the password signs out other devices.
- **Rate limits** (stored in Postgres, shared by all servers): sign-in, SMS codes, registration, password reset, posting, messaging, calls and payments. Client IP comes from `X-Forwarded-For` counted from the right (`TRUSTED_PROXIES`), so callers can't fake it.
- **Roles**: `member` and `tech_admin`, plus level roles (treasurer, resource manager, publications editor, children's ministry, media team) for a district or assembly. The first account on a new install becomes Tech Admin; there must always be at least one; admins can't act against their own account.

## Every request
- Every Server Action and API route checks the signed-in member and their permission **on the server** before doing anything; screens only hide what you can't use. Next.js Server Actions also reject cross-site requests (Origin check).
- All database access goes through Drizzle with bound parameters (no string-built SQL with member input).
- Responses carry `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security` when `APP_URL` is HTTPS.
- React escapes all text; member text is never rendered as HTML.

## Files
- Uploads are limited by type (JPEG, PNG, WebP, GIF, MP4, WebM, MOV, audio, PDF) and size (images 10 MB, audio 30 MB, documents 50 MB, video 200 MB), and stored under random names.
- Files are only served through `/media/*`, which checks access for private files: chat attachments (conversation members only), paid publications and study guides (buyers, editors, admins). The S3 bucket stays private.
- Paths are checked so a request can't climb out of the upload folder or bucket prefix.

## Money
- Card and MoMo details never touch PAPA; members pay on Paystack's page.
- Payments are confirmed only by Paystack's webhook (HMAC-SHA512 signature checked with the secret key) or by PAPA asking Paystack directly; the browser's return page is never trusted.
- Amounts are integers in pesewas and always computed on the server from the database (prices, stock, coupons, fees).
- Market money is held in escrow until delivery and the return period; payouts go only to the payout details on the shop or rider profile (set by the owner while signed in); Tech Admin payout actions (retry, mark paid) are audited.
- Treasurer reports are limited to their level.

## Privacy
- Members control who sees their profile details, birthday, who can message and call them, and can block or mute.
- **Your data**: members download everything PAPA holds about them (JSON) and can delete their account. Deletion removes personal data and content; it waits while they have open Market orders or money due.
- Prayer requests can be anonymous to members (Tech Admins can still see the author, for safety).
- PAPA Kids is behind a parent PIN (Argon2).
- The audit log records admin actions, role changes, removals, payout actions, password changes and church sync runs.

## Moderation
Report button on posts, members, products, shops, announcements, lives; blocked words held back; Tech Admins remove content and suspend accounts (audited).

## Secrets
| Secret | Notes |
|---|---|
| `AUTH_SECRET` | Signs codes and tickets. 48+ random bytes. Rotating it signs everyone out of in-progress flows |
| `SUPABASE_DB_URL` password | Only the app's security group can reach Supabase |
| `PAYSTACK_SECRET_KEY` | Can move money (Transfers). Restrict who can read it; rotate if exposed |
| `FCM_SERVICE_ACCOUNT` | Can send notifications to every phone |
| `VAPID_PRIVATE_KEY`, `LIVEKIT_API_SECRET`, `ARKESEL_API_KEY`, `CHURCH_DB_API_KEY` | Service keys |

Keep them in AWS Secrets Manager; never commit `.env.local` or `.env.production` (both are git-ignored).

## Dependencies
`npm audit --omit=dev` reported **0 vulnerabilities** at handover (Next.js 16.4.3). Run it monthly and before each release; update Next.js promptly when it has a security release.

## Recommended before launch
- [ ] Penetration test or security review by the hosting team
- [ ] AWS WAF on the load balancer (AWS managed common rule set, rate-based rule)
- [ ] A Content-Security-Policy header once the final domains for LiveKit, Paystack and YouTube embeds are known
- [ ] GuardDuty and CloudTrail on the AWS account; MFA for every AWS user
- [ ] Two Tech Admins with 2-step sign-in turned on
- [ ] An incident contact (`SUPPORT_EMAIL`) and a plan for revoking keys
- [ ] Upload scanning (e.g. an S3 malware-scan service) if members will share many documents

## Reporting a problem
Security issues go to the Tech Department (`SUPPORT_EMAIL`), not public posts.
