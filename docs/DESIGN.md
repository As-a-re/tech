# PAPA — Christ Anointed Church app: System Design

Version 1.1 · 26 Oct 2026 · App: **PAPA** · Owner: Christ Anointed Church Ghana, Tech Department

## 1. Purpose

A single place where every member of Christ Anointed Church Ghana can follow church news, talk to one another, watch and host live services, give, read and share church publications, and buy and sell among themselves. It is organised around the church's three levels: **National → District → Local assembly**.

Brand: red, blue and white, with the church logo.

## 2. Decisions taken (from Bright's answers, 26 Oct 2026)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Access | Anyone can browse as a **guest**. Only people with a valid **Church ID** can register. |
| 2 | Sign-up | Direct to our own database. No Google, Facebook or other external sign-in. A Church ID is checked against the **member registry**. |
| 3 | Roles | No fixed church-office roles, because they change often. **Every member** can post announcements and go live. Only "production level" work is kept for **Tech Admins**: the registry, moderation and settings. |
| 5 | Scale | About 10 districts, 50+ local assemblies and 5,000+ members. Every district, local or member picker is a **search box**, never a long submenu. |
| 6 | Home | X-style public feed that everyone can see. **Groups** behave like WhatsApp: status updates at the top, group chat below. |
| 7 | Post features | Everything X has: text, images, video, likes, replies, reposts, quote posts, bookmarks, polls, hashtags, mentions and view counts. |
| 8 | Profile | Every member has a profile page (cover, photo, bio, assembly, posts, followers). |
| 9–12 | Groups and messages | Any member can create a group. People join by invite link **or** by request and approval. Statuses last 24 hours. Messages behave like WhatsApp: text, photos, videos, voice notes, files, replies, read receipts, and voice and video calls. |
| 13–14 | Live | Best practice: live chat, reactions and a viewer count. Recordings are saved to Teachings. |
| 15–17 | Giving | Every mobile money network, plus cards and bank, through one payment gateway. Money goes to the **level that is hosting**. Outside a live, a **Give** page lets members choose the level and the type: tithe, offering or other. |
| 18–19 | Publications | Anyone can publish under Books, Articles, Teachings or Music/Hymns. Each item is free or for sale, as the author chooses. |
| 20 | Uniforms | Order and pay online, then pick up. Delivery comes later. |
| 21 | Children | Best practice: content for parents and teachers. No child accounts. |
| 22–25 | Market | Every member can sell. The buyer pays the platform, and the seller is paid **after delivery is confirmed** (escrow). Sellers update order tracking. The platform takes a small fee. |
| 26 | Platforms | Web app first, installable on phones (PWA). Android and iOS apps follow from the same code. |
| 27 | Goal | An MVP ready to present to the church as fast as possible. |
| 30 | Stack | Easy to manage: one Next.js app with one PostgreSQL database. |
| 31 | Standard | Must match leading social and ecommerce platforms. Every viewing point has a creation point. Fundamentals are included even when not requested. |
| 32 | Extras | Events, Prayer requests, Daily verse, Assembly directory, Testimonies, Birthdays. |
| 33 | Uniforms | Sold and managed only by assigned **resource managers** for each level. |
| 35 | Name | App **PAPA** (the founder's popular name). Project folder `christ-anointed-church-app`. Icon: the church logo. |
| 36 | Church database | A team is building the church's standard member database. PAPA reads member identity through its **API** (`integrations/church-db`) and keeps only app data in its own database. A local register stands in until the API is ready. |
| 37 | Quality | No mock-ups in the product. Each batch is production-ready, and paid services switch on when their keys are added. Sample content lives only in the removable demo pack (decision 43). |
| 38 | 2-step verification | Delivered in Batch 3 with the Security settings screen that turns it on (sign-in check included). |
| 39 | SMS | Development prints codes in the terminal. Production uses Arkesel (Ghana). Codes: 6 digits, 10-minute expiry, 5 tries, 3 sends per 15 minutes. |
| 40 | Admin | Tech Admins manage the register (add, edit, import, deactivate), districts and assemblies, accounts (suspend, role, 2-step reset, sign-out, verified badge), resource managers per level, platform settings (support contacts, blocked words, market fee) and the audit log. There is always at least one Tech Admin, and admins cannot act against their own account. In `api` mode the register and structure are read-only. |
| 41 | Home feed | Posts up to 1,000 characters, 4 photos (shrunk in the browser) or 1 video, polls (2–4 choices, 1 hour–7 days), link previews, drafts and scheduling. Edits allowed within 30 minutes (earlier text kept). For you is ranked by engagement, freshness, people you follow, your assembly and district. Likes on profiles are private. Blocked words stop a post. |
| 42 | Discovery & notifications | Explore (trending hashtags, popular posts, who to follow by assembly/district), Search (top, people, posts, media, hashtags, assemblies), Lists (public or private, up to 100, 500 members each), Favorites manager, Saved folders. Notifications for likes, reposts, replies, quotes, mentions, follows and polls; similar ones are grouped; each type can be turned off in-app or for push. Live updates on open screens; phone push when keys are set. Members report posts or members; Tech Admins review in Admin → Reports (remove post, suspend, dismiss), all audited. |
| 45 | Events | Any member hosts at the same three levels: date and time (Ghana time), venue and/or online link, map pin, cover photo. Going / Interested, attendee list, reminders 24 hours and 1 hour before, add to calendar (.ics), list and month calendar views, filters (level, going, hosting, past). Cancelling tells attendees. Reportable. |
| 46 | Assembly directory | Every district and assembly has a public page: service times, leaders (linked to members' profiles), address, map and directions, phone/email, its announcements and events, and a "Notify me" toggle. Tech Admins keep the details up to date (they're kept by PAPA even when the church database API is used). Directory has search and a map view. |
| 47 | Background jobs | Run every minute on each server; scheduled posts now notify and count when they go live. |
| 48 | Navigation (7.1) | Phone top bar: profile · messages · search (Explore icon inside) · announcements · notifications (guests: Join). Under it: For you · Following · Events · Kids. Bottom bar: Home · Add · Market · Menu · Cart. "Add" lists everything members can create and goes straight to its form; later features show "Coming soon". Tablets: icon menu on the left; computers: full left menu, wide search, right column. Favorites moved to the profile. Messages, Market, Cart and Kids show a "coming soon" page until their batch. |
| 49 | Prayer requests | Any member posts a request (up to 1,000 characters) for the whole church or only their assembly, optionally anonymous (Tech Admins can still see who). Members tap "I prayed" and write encouragements; the author is told. The author marks it answered with a note, everyone who prayed is told, and they can turn it into a testimony. Reportable. |
| 50 | Testimonies | Title, story (up to 3,000 characters), 4 photos, optional link to the author's answered prayer. "Praise God" and comments. Reportable. |
| 51 | Verse of the day | Built-in King James list, one a day; Tech Admins can choose a verse for any day. Shown on Home (hide for today), archive of the last 30 days, share as a post or copy. |
| 52 | Birthdays & anniversaries | Birthdays come from the church register; members choose whether to show theirs (day and month only, never the year). Wedding anniversaries are added by members. Today / this week / this month, for my assembly, people I follow or the whole church. Followers are told on the day; "Wish them well" opens a post mentioning the person. |
| 53 | Messages | WhatsApp-style one-to-one chats: text, photos, videos, voice notes and documents; reply, react, forward, edit (15 minutes), delete for me / for everyone (24 hours); ticks (sent, delivered, read), typing and online/last seen; mute, pin, archive, clear; search chats and messages. Chat files are private to the chat. Members choose whether anyone or only people they follow can message them, and can turn off read receipts and last seen (which also hides others'). Posts can be sent into chats. Phone pushes for new messages (not muted chats). Groups (Batch 10) use the same chat engine. |
| 54 | Live updates | One live connection per browser tab, shared by every badge and screen. Background refreshes use plain web requests; server actions are only for things the member does, so taps and page changes are never held up. |
| 34 | Riders | Delivery riders are planned now. If they prove complex, they move to after the investor demo. |

## 3. Users and permissions

| Who | Can do |
|-----|--------|
| **Guest** (not signed in) | Read the Home feed, announcements, publications, the market and profiles. Cannot interact. |
| **Member** (registered with a Church ID) | Everything social: post, react, message, create and join groups, post announcements and go live at **their own district or local, or national**, give, publish, buy and sell. |
| **Tech Admin** | Manage the member registry (import, add, deactivate), districts and locals, remove content, handle reports, set the market fee, and see giving reports. |

Abuse control: because everyone can announce and go live, every item has a **Report** button, Tech Admins can remove content, and announcement and live creators are always shown by name.

## 4. Church structure and "level"

```
National
 └── District (≈10)
      └── Local assembly (≈50+)
           └── Member (5,000+)
```

Every scoped item (announcements, lives, giving, resources) carries a **level**:
`national` | `district` (+ district_id) | `local` (+ local_id).

A member belongs to exactly one local assembly, which implies their district.

## 5. Member registry and Church ID

- `member_registry` holds what the church already knows: Church ID, full name, phone and local assembly.
- **Registration:** enter Church ID + phone number → the system checks they match the registry → choose a username and password → the account is created and linked. Each Church ID can register only once.
- **Login:** Church ID (or username) + password.
- Tech Admins fill the registry by CSV import or by adding members one at a time.

## 6. Screens (navigation follows the PDF)

**Top bar:** logo · search · **Announcements bell** (National / District search / Local search, each with a "notify me" toggle) · notifications · avatar.

**Sidebar (desktop) / bottom bar + "More" (phone):**

1. **Profile**: own profile.
2. **Home**: X-style feed with "For you" and "Following" tabs, and a composer at the top.
3. **Announcements**: tabs for National, My District and My Local, plus search for any district or local.
4. **Create Group**: name, photo, description, public or private.
5. **Groups**: my groups, then discover public groups (searchable). Inside a group: a status row, the chat, and group info.
6. **Messages**: search members, recent chats, one-to-one chat.
7. **Publications**: Books, Articles, Teachings and Music/Hymns, each with a publish button.
8. **Resources**: National, District or Local, containing Uniforms (order) and Study guides.
9. **Children**: academic books and biblical books.
10. **Go Live**: choose a level → stream. Viewers see the stream, chat, reactions and an **Offering** button.
11. **Give**: choose a level → tithe, offering or other → amount → pay.
12. **Saved**: bookmarked posts, publications and products.
13. **Market**: browse and search, product page, cart, checkout, my orders (with tracking), my shop (listings, orders to fulfil, earnings).
14. **Settings**: account, password, notifications, privacy, and an Admin area for Tech Admins.

## 7. Data model (PostgreSQL)

**Church and identity**
- `districts` (id, name, slug)
- `locals` (id, district_id, name, slug, town)
- `member_registry` (church_id PK, full_name, phone, local_id, active, user_id → when registered)
- `users` (id, church_id unique, username unique, full_name, phone, email?, password_hash, local_id, role member|tech_admin, avatar_url, cover_url, bio, created_at)
- `sessions` (id = SHA-256 of token, user_id, expires_at, user_agent, ip)

**Social**
- `follows` (follower_id, followee_id)
- `posts` (id, author_id, body, reply_to_id, repost_of_id, quote_of_id, view_count, created_at, deleted_at)
- `post_media` (post_id, url, kind image|video, position)
- `post_likes`, `polls`, `poll_options`, `poll_votes`, `hashtags`, `post_hashtags`, `mentions`
- `saved_items` (user_id, item_type post|publication|product, item_id)
- `notifications` (user_id, type, actor_id, entity_type, entity_id, read_at)
- `reports` (reporter_id, item_type, item_id, reason, status)

**Announcements**
- `announcements` (id, author_id, level, district_id, local_id, title, body, media_url, created_at)
- `announcement_subscriptions` (user_id, level, district_id, local_id)

**Messaging (groups and direct chats share one engine)**
- `conversations` (id, kind direct|group)
- `conversation_members` (conversation_id, user_id, role admin|member, last_read_at, muted)
- `messages` (id, conversation_id, sender_id, kind text|image|video|audio|file, body, media_url, reply_to_id, created_at, deleted_at)
- `groups` (id, conversation_id, name, description, avatar_url, visibility public|private, invite_code, created_by)
- `group_join_requests` (group_id, user_id, status)
- `statuses` (id, group_id, author_id, kind text|image|video, body, media_url, bg_color, expires_at) and `status_views`

**Live and giving**
- `live_sessions` (id, host_id, title, level, district_id, local_id, room, status scheduled|live|ended, started_at, ended_at, recording_url, peak_viewers)
- `live_comments`, `live_reactions`
- `payments` (id, payer_id, purpose tithe|offering|other|order|resource|publication, level, district_id, local_id, live_session_id, amount_pesewas, provider, provider_ref, channel, status pending|success|failed, created_at)

**Publications, resources and children**
- `publications` (id, author_id, category book|article|teaching|music|children_academic|children_biblical, title, summary, body, cover_url, file_url, media_url, price_pesewas (0 = free), created_at)
- `resources` (id, kind uniform|study_guide, level, district_id, local_id, title, description, price_pesewas, sizes, stock, file_url)
- `resource_orders` (id, resource_id, buyer_id, size, qty, payment_id, status ordered|paid|ready|collected)

**Market**
- `products` (id, seller_id, title, description, category, condition, price_pesewas, stock, status active|sold_out|removed)
- `product_images`, `cart_items`
- `orders` (id, buyer_id, seller_id, status pending_payment|paid|processing|shipped|delivered|completed|cancelled|disputed, subtotal, fee, total, delivery_method pickup|delivery, address, payment_id)
- `order_items`, `order_events` (tracking timeline)
- `payouts` (seller_id, order_id, amount, status, provider_ref)

All money is stored as **integer pesewas** in **GHS**, never as floating-point numbers.

## 8. Architecture

- **App:** Next.js (App Router, server components and server actions), TypeScript in strict mode, Tailwind and shadcn/ui.
- **Database:** PostgreSQL with Drizzle ORM. Schema changes are versioned **migrations** (drizzle-kit).
- **Auth:** our own. Passwords hashed with Argon2id, plus httpOnly session cookies stored as hashes in `sessions`.
- **Realtime** (chat, typing, live comments, notifications): Server-Sent Events fed by Postgres LISTEN/NOTIFY. No extra server is needed.
- **Live video and calls:** LiveKit, an open-source WebRTC media server. `livekit-server --dev` runs it locally, and LiveKit Cloud or a self-hosted server runs it in production. Recordings come from LiveKit Egress.
- **Payments:** Paystack, which covers MTN MoMo, Telecel Cash, AirtelTigo Money, cards and bank in Ghana, through one integration and one webhook. Market escrow pays sellers through Paystack Transfers after delivery is confirmed. The MVP runs in **test mode** until the church's merchant account is approved.
- **Files** (images, video, audio, PDFs): stored behind one storage module. Local disk in development, S3-compatible storage such as Cloudflare R2 in production.
- **Phones:** a PWA (installable, push notifications) now. Capacitor wraps the same app for Android and iOS later.

## 9. Build order (chronological)

| Phase | Delivers | Depends on |
|-------|----------|-----------|
| **1. Foundation** | Project, database and migrations, districts, locals, registry, Church-ID registration and login, guest mode, app shell (sidebar, top bar, mobile nav), profiles, settings, seed data | — |
| **2. Home feed** | Posts with media, likes, replies, reposts, quotes, polls, hashtags, mentions, Saved, follow, search, notifications | 1 |
| **3. Announcements** | Three-level announcements, the bell, subscriptions and notifications | 1, 2 (notifications) |
| **4. Messages and Groups** | Realtime chat engine, direct messages, groups (public and private, invite or request), statuses, voice notes | 1 |
| **5. Publications, Resources, Children** | Publishing and reading, uniform orders, study guides | 1 |
| **6. Live and Giving** | LiveKit streaming by level, live chat, reactions, recordings, Paystack offering, Give page, receipts, admin reports | 1, 4 (realtime) |
| **7. Market** | Listings, cart, checkout, escrow, tracking, seller payouts, fee | 1, 6 (payments) |
| **8. Polish and launch** | PWA install and push, admin dashboard, moderation, performance, deployment | all |

## 10. Things the church must provide before going live

1. **Member registry**: a CSV of Church ID, full name, phone and local assembly.
2. **The list of districts and local assemblies.**
3. **Paystack merchant account**, registered to the church (needs church registration documents).
4. **Hosting**: an app server, a managed PostgreSQL database, file storage, and LiveKit Cloud or a media server.
5. **Church ID format**, so registration can validate it (for example `CAC-0001234`).

## 11. Screen inventory (~160)

**Public and onboarding:** Welcome · Sign in · Register (Church ID → SMS code → username and password) · Onboarding (photo, bio, language, theme, follow suggestions, notifications) · Forgot password · About · Terms · Privacy · Help and support

**Home and social:** Feed (For you / Following / Favorites) · Compose (text, 4 photos or 1 video, poll, schedule) · Drafts and scheduled · Post detail and replies · Media viewer · Liked by / Reposted by · Post insights · Explore and trending · Search (Top, People, Posts, Media, Assemblies, Groups, Products, Publications) · Hashtag · Notifications (All / Mentions) · Profile · Edit profile · Followers and Following · Lists (view, create, members) · Favorites manager · Bookmark folders

**Announcements:** Overview (National / District / Local) · Level page with notify toggle · Detail · Create · My announcements

**Events:** Calendar and list · Event detail (RSVP, reminder, share) · Create event · My events

**Prayer and testimonies:** Prayer wall · Prayer detail ("Praying") · Post a request · Testimonies (feed category with its own tab)

**Daily verse and birthdays:** Verse of the day (on Home) · Verse archive · Birthdays and anniversaries (assembly)

**Assembly directory:** Directory (search, map) · Assembly page (service times, location, leaders, announcements)

**Groups:** My groups · Discover · Preview · Create · Chat · Info · Settings · Join requests · Add members · Status viewer · Status composer · Seen by · Invite link · Message info

**Messages:** Chats · New chat · Chat · Contact info · Forward · Starred · Archived · Voice call · Video call · Call history

**Publications and Children:** Home · Category · Detail · Book reader · Article reader · Teaching player · Music player (lyrics) · Publish · Article editor · My publications · My library · Reviews · Children home

**Resources:** Home · Level resources · Uniform item · Uniform checkout · Study guide viewer · My uniform orders · Manage resources (managers) · Manage uniform orders (managers)

**Live:** Hub (Live now / Upcoming / Recordings) · Schedule · Setup · Host studio · Viewer · Host summary · Replay

**Give:** Give · Payment · Receipt · Giving history

**Saved:** Saved items (posts, publications, products)

**Market, buyer:** Home (recommended, deals, recently viewed) · Category and search with filters · Product (variants, Q&A, reviews) · Shop page (follow) · Wishlist · Cart · Checkout (delivery fee, coupon) · Order confirmed · My orders · Tracking · Cancel / return / refund · Write review · Invoice · Alerts (stock, price drop)

**Market, seller:** Become a seller · Dashboard · Listings · Add/edit product · Coupons and deals · Seller order (accept → pack → ship) · Returns · Earnings and payouts · Shop settings

**Riders:** Become a rider · Available jobs · Active delivery (pickup → drop-off, confirmation code) · Rider earnings · Rider history

**Settings:** Home · Account · Security (2-step verification) · Devices · Privacy · Blocked and muted · Notifications · Display (theme, text size) · Language · Data saver · Payment methods · Your data (download, delete)

**Admin:** Dashboard · Member register · Import results · Districts and assemblies · Accounts · Roles (tech admins, resource managers) · Reports and moderation · Announcement oversight · Live oversight · Giving reports · Market disputes, payouts and fees · Riders · Verified badges · Platform settings · Broadcast notification · Audit log

**System:** Not found · Error · Offline · Maintenance

## 12. Cross-cutting features

Languages (English, Twi, Ga, Ewe, with more to follow) · Light, dark or system theme · Accessibility · Realtime updates · Push notifications · Share links with previews · Mentions, hashtags and link previews · Edit, delete and pin · Report, block and mute everywhere · Spam limits and banned-word filter · Low data use (compressed media, data saver, works offline) · 2-step verification, SMS codes and audit logs · Compliance with Ghana's Data Protection Act, 2012 (Act 843): consent, data download and account deletion.
