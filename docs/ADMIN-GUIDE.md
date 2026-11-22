# PAPA Admin guide

For Tech Admins. Admin appears in the menu only for Tech Admins; every admin screen and action checks this on the server, and everything you do there is written to the audit log.

## Getting started
- The **first account registered** on a new PAPA becomes a Tech Admin. Make at least one more: Admin → Accounts → find the member → Role → Tech Admin (or on the server: `npm run admin:grant -- username`).
- Turn on 2-step sign-in for your own account (Settings → Security).
- You can't remove your own admin role or suspend yourself, and PAPA always keeps at least one Tech Admin.

## The Admin tabs
| Tab | What you do there |
|---|---|
| **Dashboard** | Members, activity and open work at a glance; **Services** shows whether SMS, push, app notifications, calls, payments, file storage and church database sync are working |
| **Member register** | Add, edit, import (CSV) or deactivate members. When PAPA uses the church's database (`api` mode) this is read-only: changes are made in the church database and reach PAPA within 15 minutes |
| **Districts & assemblies** | Structure, plus each assembly's public page: service times, leaders, address, map pin, contacts |
| **Accounts** | Find any account: suspend or restore, make Tech Admin, reset 2-step sign-in, sign out of all devices, verified badge |
| **Roles** | Give members level roles for a district or assembly: Treasurer (giving reports), Resource manager (uniforms, study guides), Publications editor, Children's ministry (PAPA Kids), Media team |
| **Platform settings** | Support email and phone (Help page), blocked words, Market service fee (0–20%) |
| **Reports** | Posts, members and other items members reported: remove, suspend, or dismiss |
| **Content** | Find and remove posts, announcements, lives and other content |
| **Daily verse** | Choose the verse for any day (otherwise the built-in list is used) |
| **Giving** | Totals by fund and period, every payment, CSV export |
| **Market** | Orders, requests, products, shops, riders, deliveries, payouts and disputes (below) |
| **Audit log** | Who did what and when, searchable |

## Member register (local mode)
CSV columns: `church_id, full_name, phone, assembly, district` and optionally `town, date_of_birth` (YYYY-MM-DD). Import adds new members and updates existing ones by Church ID. A member can only register if their Church ID and phone match the register.

## Market
- **Orders / Requests**: see any order; cancellation, return and refund requests are answered by the seller first.
- **Disputes** (Requests → Disputes): when a buyer escalates a request the seller declined, you decide: approve it (the buyer is refunded) or decline it (the money goes to the seller after the return period). For a part refund, open the order and use **Refund** with the amount.
- **Riders**: approve or reject applications; suspend riders.
- **Payouts**: money released after delivery and the return period is paid automatically by Paystack Transfers. Failed ones show here: fix the cause (e.g. wrong MoMo number on the shop's payout details), then **Retry**, or pay by bank yourself and **Mark paid** with a note.
- **Products / Shops**: take down a product, suspend a shop, mark a shop verified.

## Demo pack

## When something is wrong
| You see | Do |
|---|---|
| Dashboard: SMS off | Registration codes can't be sent. Hosting team: check `ARKESEL_API_KEY` and credit |
| Dashboard: church database "can't reach it" | Members can still sign in (PAPA uses its saved copy). Tell the church database team; the message shows their error |
| Payments stuck "pending" | PAPA re-checks with Paystack automatically; if many, check the webhook in Paystack |
| Many failed payouts | Paystack balance too low or Transfers disabled |
| A member can't register | Check their Church ID and phone in the register; inactive members can't register |
