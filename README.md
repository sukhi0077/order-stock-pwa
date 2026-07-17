# Order & Stock — Restaurant Stock Management PWA

A mobile-first, installable PWA for a restaurant to run three jobs:

- **Stock** — end-of-month closing stock count (`used = opening + received − closing` is reconciled downstream).
- **Orders** — staff build a running purchase order over several days, then submit it for the admin.
- **Receiving** — log received-stock batches with expiry dates; the admin sees what expires when.

Two roles: **employee** (staff) and **admin**. Role separation is enforced in the database with Supabase Row-Level Security — not by hiding buttons.

## Stack

- **Frontend:** Vite + React 19 + Tailwind, `vite-plugin-pwa` for the installable/offline PWA
- **Backend:** Supabase — Postgres + Auth (email/password) + Row-Level Security
- **Data fetching:** TanStack React Query
- **Hosting:** Cloudflare Pages (free, commercial-use OK, push-to-deploy from GitHub)

## Quick start

```bash
npm install --legacy-peer-deps    # peer-dep cushion (vite-plugin-pwa vs Vite 8)
cp .env.example .env              # then paste your Supabase URL + anon key
npm run dev                       # web dev server
npm test                          # model unit tests (Vitest)
npm run build                     # production build -> dist/
```

## First-time setup (three steps)

1. **Supabase** — create a project, then run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL Editor (creates tables + RLS). Add users under Authentication, then promote your admin:
   `update public.profiles set role='admin' where email='you@shop.com';`
2. **Env** — put the project URL + **publishable** key (`sb_publishable_...`) in `.env` (dev) and in Cloudflare Pages env vars (prod), both `VITE_`-prefixed.
3. **Seed** — sign in as the admin and click **Load items** once to seed the ~270-item master list from `src/data/seedItems.js`.

Full detail: **[HANDOVER.md](./HANDOVER.md)** (architecture, data model, RLS) and **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** (Cloudflare Pages).

## Security in one line

The public **publishable** key (`sb_publishable_...`, the successor to the legacy anon key) is safe in the frontend **because RLS is configured**. Any **secret** key (`sb_secret_...` / legacy `service_role`) must never touch the frontend or git. See HANDOVER for the policy summary.
