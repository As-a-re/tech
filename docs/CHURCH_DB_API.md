# Church Database API: what PAPA needs

For the team building the church's standard member database. PAPA only **reads** member identity. Everything members do in PAPA (posts, messages, orders) stays in PAPA's own database.

## Connection
- HTTPS, JSON.
- Authentication: `Authorization: Bearer <API key>` (one key issued to PAPA, which can be rotated).
- Timeouts: PAPA waits up to 8 seconds per request.

In PAPA's `.env.local`:
```
CHURCH_DB_MODE=api
CHURCH_DB_API_URL=https://<church-db-host>/v1
CHURCH_DB_API_KEY=<key>
```

## Endpoint used now

### `GET /members/{church_id}`
Returns one member. `church_id` is upper-case without spaces (PAPA sends it that way).

**200**
```json
{
  "church_id": "CAC-000123",
  "full_name": "Ama Owusu",
  "phone": "+233241234567",
  "status": "active",
  "date_of_birth": "1994-05-17",
  "assembly": { "id": "A-0042", "name": "Bethel Assembly", "town": "Madina" },
  "district": { "id": "D-0007", "name": "Madina District" }
}
```
| Field | Rules |
|---|---|
| `phone` | Any Ghana format; PAPA normalises it (`024…`, `+233…`, `233…`) |
| `status` | `active` or `inactive`. Inactive members cannot register or sign in |
| `date_of_birth` | `YYYY-MM-DD` or `null` (used for birthdays, if the member allows) |
| `assembly.id`, `district.id` | Stable IDs; names may change |

**404**: no such Church ID. **401/403**: bad key. **5xx**: PAPA shows "church register can't be reached, try again shortly".

## When PAPA calls it
| Moment | Why |
|---|---|
| Registration, steps 1 and 3 | Check that Church ID and phone match, and that the member is active |
| Every sign-in | Refresh name, phone, assembly and active status (PAPA falls back to its cached copy if the API is down) |

| Every 15 minutes (background job) | Pick up changes made in the church database (below) |

### `GET /members/changes?since=<ISO time>&cursor=<cursor>`
Members created or changed **after** `since` (any field above, including status). PAPA uses it to show transfers between assemblies, new phone numbers and deactivations within 15 minutes instead of at the member's next sign-in. A deactivated member is signed out of PAPA on every device.

- `since`: ISO 8601 UTC time, e.g. `2026-10-28T09:00:00.000Z`. The first call uses `1970-01-01T00:00:00.000Z` (everyone).
- `cursor`: absent on the first page; then the `next_cursor` from the previous page.
- Page size is up to the API (500 recommended). PAPA reads up to 200 pages per run.

**200**
```json
{
  "members": [ { "church_id": "CAC-000123", "full_name": "Ama Owusu", "phone": "+233241234567", "status": "inactive",
                 "date_of_birth": "1994-05-17", "assembly": { "id": "A-0042", "name": "Bethel Assembly", "town": "Madina" },
                 "district": { "id": "D-0007", "name": "Madina District" } } ],
  "next_cursor": "eyJpZCI6MTIzfQ",
  "until": "2026-10-28T09:15:00.000Z"
}
```
| Field | Rules |
|---|---|
| `members` | Same shape as `GET /members/{church_id}`. Deleted members should come back with `status: "inactive"` |
| `next_cursor` | `null` (or missing) on the last page |
| `until` | The time this answer is complete up to (the server's "now" when the first page was read). PAPA sends it as `since` next time. Return the **same** `until` on every page of one run |

Requirements: order results stably (e.g. by `updated_at, church_id`) so paging never skips or repeats; the API must count a change made at exactly `until` in the next run (use `updated_at > since`). Sending a member twice is harmless.

PAPA keeps the last run, number of changes and any error in Admin → Dashboard → Services → Church database. If the API is down, PAPA keeps working with its saved copy and tries again in 15 minutes.

An OpenAPI description is in [`church-db-openapi.yaml`](church-db-openapi.yaml).

## Optional (useful later)
| Endpoint | For |
|---|---|
| `GET /districts` | Keep districts in step automatically |
| `GET /assemblies?district_id=&q=` | Keep assemblies in step automatically |

Until then, assemblies and districts are created in PAPA from the members' `assembly` and `district` fields, and their public details (service times, map, leaders) are kept by PAPA's Tech Admins.
