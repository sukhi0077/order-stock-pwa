# Order & Stock — Handover

A mobile-first restaurant PWA for **stock counts**, **purchase orders**, and
**receiving stock**. Ported from the original Firebase build to **Supabase +
Cloudflare Pages**. Two roles — **employee (staff)** and **admin** — enforced by
Row-Level Security at the database, not by the UI.

---

## Tech stack

- **React 19 + Vite** (UI), **Tailwind 4** (styling)
- **TanStack React Query** (data fetching / caching)
- **Supabase** — Postgres + Auth (email/password) + Row-Level Security
- **vite-plugin-pwa** — installable, offline-capable PWA
- **Vitest** — unit tests for the pure model layer
- **Cloudflare Pages** — static hosting, push-to-deploy from GitHub

## What the app captures

**Stock (per month):** one closing quantity per item at month-end. Opening /
received / used are reconciled downstream (this app feeds closing counts out via
CSV export). A month moves `draft → submitted → finalized`.

**Orders:** staff build one running **draft** order (each line = a quantity +
optional note), then **submit** it. Admins review, modify, and export to CSV
grouped by supplier.

**Receiving:** each receipt is one batch of an item with its own **expiry date**,
so one item can have several batches. The admin filters by expiry window.

## Project layout

```
src/
  App.jsx                 Auth gate, staff vs admin view, offline banner
  main.jsx                React + React Query provider
  supabase.js             Supabase client (env vars) + timestamp/timeout helpers
  data/seedItems.js       ~270 items (name/category/sub/unit) — seeded once
  models/                 PURE logic (no React/Supabase) — fully unit-tested
    StockCountModel.js    used derivation, validation, payload
    OrderModel.js         order lines, validation, payload
    ReceiptModel.js       expiry windows, validation, payload
  repositories/           Supabase data access (the ONLY DB-coupled layer)
    ItemRepository.js       items read/write + one-time seed + resync
    StockCountRepository.js  monthly counts (+ prev-month carry)
    OrderRepository.js       running draft + submitted orders
    ReceiptRepository.js     received batches
  services/               Thin pass-through between hooks and repositories
  hooks/
    useAuth.js            Supabase session + admin role (from profiles.role)
    useItems.js           item list (+ seed/add/edit)
    useStockCount.js      month "brain": state, math, save, offline queue
    useOrder.js/useOrders.js  order draft + admin list
    useReceipts.js        receiving
    useOfflineSync.js     flushes the offline queue, drives the status banner
  components/             UI (Staff/Order/Receive panels, AdminDashboard, …)
  utils/
    monthUtils.js         month math (business TZ)
    exportCsv.js          CSV build + browser download
    offlineQueue.js       localStorage queue for offline month saves
supabase/schema.sql       Tables + RLS + role helpers + new-user trigger
.github/workflows/keepalive.yml   Cron ping so the free DB never pauses
```

Only `supabase.js`, the 4 repositories, and `useAuth.js` know about Supabase.
Everything above them (models, services, hooks, components) is backend-agnostic —
that is why the Firebase → Supabase port touched so few files.

## Data model (Postgres — see `supabase/schema.sql`)

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | one row per auth user; holds the role | `id` (=auth uid), `email`, `role` (`staff`/`admin`) |
| `suppliers` | admin-managed supplier list | `name`, `active` |
| `items` | master item list | `name`, `category`, `sub_category`, `unit`, `order_unit`, `supplier`, `sort_order`, `active` |
| `stock_counts` | one row per month | `month_id` PK (`YYYY-MM`), `status`, `reporter`, `lines` (jsonb `itemId→number`) |
| `orders` | running/submitted orders | `id`, `status` (`draft`/`submitted`), `reporter`, `lines` (jsonb `itemId→{qty,note}`) |
| `receipts` | received batches w/ expiry | `item_id`, `item_name`, `qty`, `expiry`, `reporter`, `received_at` |
| `app_meta` | one-time seed flag | `key`, `done`, `seeded_at` |

The nested per-item data (`lines`) stays as **JSONB** — it is naturally
document-shaped and the pure models operate on it as a map. Top-level fields are
real columns so RLS and queries can reason about them. The repository layer maps
snake_case columns ↔ the camelCase the models/components expect, and converts
Postgres timestamps to the `{ seconds }` shape the UI already renders.

## Security model (RLS — enforced in the database)

- **Auth:** Supabase email/password. Every request must be signed in.
- **Admin =** `profiles.role = 'admin'`. Checked by `public.is_admin()`
  (SECURITY DEFINER so it doesn't recurse into the profiles policies). A trigger
  auto-creates a `staff` profile on sign-up; promote to admin in SQL.
- **Items:** anyone signed in READS; only admins INSERT/UPDATE; no deletes.
- **Stock counts:** anyone signed in READS. Admins write any month (finalize /
  reopen). Staff write only the **current** month, only while **not finalized**,
  and can never set `finalized`. No deletes, no future months.
- **Orders:** anyone READS/creates. Staff may keep editing an order only while it
  is still a **draft** (and may submit it); once submitted, admin-only. No deletes.
- **Receipts:** any signed-in user may add/edit/remove (operational log).
- **Keys:** the **publishable** key (`sb_publishable_...`, successor to the legacy
  anon key) is public and safe *because* of the above. Any **secret** key
  (`sb_secret_...` or the legacy `service_role`) must never appear in the frontend
  or in git.

### First-time Supabase setup — step by step (no prior experience needed)

**What Supabase is, in plain terms.** Supabase is a hosted database with a
login system attached. You never install or run a server — you click through a
website to create your project, and the app talks to it over the internet.
There are only three things you need from it:

1. a **database** (where items, counts, orders, and receipts are stored),
2. **Auth** (the email + password logins for your staff and admin), and
3. two **keys** — a Project URL and a **publishable** key — that you paste into
   the app so it knows which project to connect to.

That's the whole mental model. Now the clicks.

**Step 1 — Create a free account.**
Go to https://supabase.com and click **Start your project** / **Sign in**. The
easiest option is **Continue with GitHub** (you'll want a GitHub account anyway
for hosting). No credit card is required.

**Step 2 — Create the project.**
Click **New project**. You'll see a short form:

- **Organization:** if it's your first time, it makes one for you — just accept it.
- **Name:** anything, e.g. `order-stock`.
- **Database Password:** click **Generate a password**, then **copy it and save
  it somewhere safe** (a password manager). You rarely need it again, but there's
  no way to see it later — only reset it.
- **Region:** pick the one geographically closest to your restaurant (lower delay).
- **Plan:** **Free**.

Click **Create new project** and wait ~2 minutes while it sets up ("Setting up
project…"). When the dashboard stops spinning, it's ready.

**Step 3 — Create the tables (run the schema).**
In the left sidebar click the **SQL Editor** icon (looks like `>_`). Click
**+ New query**. Open the file `supabase/schema.sql` from this project, copy
**everything** in it, paste it into the big editor box, and click the green
**Run** button (or press Ctrl/Cmd + Enter). You should see **"Success. No rows
returned"** at the bottom — that's the correct result; it means all the tables
and security rules were created. (It's safe to run again if you ever need to.)

You can confirm by clicking the **Table Editor** icon in the sidebar — you should
now see tables named `items`, `orders`, `stock_counts`, `receipts`, `profiles`,
`suppliers`, and `app_meta`.

**Step 4 — Add your login accounts.**
In the sidebar click **Authentication**, then the **Users** tab, then
**Add user → Create new user**. Enter an email and a password for each person who
will use the app (you can start with just two: one for yourself/admin and one
shared staff login). Tick **Auto Confirm User** so they can log in immediately
without a confirmation email. Repeat **Add user** for each account.

> Tip: because this is a private internal tool, you can also turn off email
> confirmation entirely under **Authentication → Sign In / Providers → Email →**
> uncheck **Confirm email**. Then any account you create can log in right away.

**Step 5 — Make yourself the admin.**
Everyone starts as a regular *staff* user automatically. To give your own account
admin powers, go back to the **SQL Editor**, open a **+ New query**, paste the
line below (change the email to the exact one you created in Step 4), and click
**Run**:

```sql
update public.profiles set role = 'admin' where email = 'you@shop.com';
```

You should see **"Success. 1 row(s) affected"**. If it says 0 rows, the email
doesn't match a user — double-check the spelling against the Users list. (To
undo, run the same line with `'staff'` instead of `'admin'`.)

**Step 6 — Copy your two keys.**
Click the **Settings** (gear) icon in the sidebar → **API Keys**. Make sure
you're on the **Publishable and secret API keys** tab (the newer key system —
the older "anon / service_role" keys are being retired by Supabase). If the tab
shows a **Create new API keys** button, click it once — that's safe and just
switches your project onto the new keys. You need exactly two values:

- **Project URL** — from **Settings → API** (or shown at the top); looks like
  `https://abcdefgh.supabase.co`.
- **Publishable key** — starts with `sb_publishable_...`. Click the copy icon.

⚠️ On the same page there is also a **secret** key (`sb_secret_...`). **Never**
copy that one into the app, the `.env` file, or GitHub — it bypasses all security.
You only ever use the **publishable** key in this app.

> If your project is older and still shows only the legacy keys, the **anon
> public** key also works for now — the app accepts either. But prefer the
> publishable key, since the legacy ones are being phased out.

**Step 7 — Give the keys to the app.**
- **On your computer (for testing):** in this project folder, copy `.env.example`
  to a new file named `.env`, and fill in the two values:
  ```
  VITE_SUPABASE_URL=https://abcdefgh.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_paste-the-key-here
  ```
  The `.env` file is git-ignored, so it never gets uploaded.
- **For the live site:** you'll paste these same two values into Cloudflare Pages
  later (see `DEPLOYMENT_GUIDE.md`, "Environment variables"). Keep the `VITE_`
  prefix exactly.

**Step 8 — Load the item list.**
Run the app (`npm run dev`, or open your live site), log in with your **admin**
account, open the **Admin** view, and click **Load items** once. This fills the
database with the ~270 starter items. You only do this a single time.

That's it — staff can now log in and start counting stock, building orders, and
logging received deliveries.

**If something doesn't work:**
- *Login fails / app can't connect* → the two keys in `.env` (or Cloudflare) are
  wrong, missing, or the `VITE_` prefix was dropped. Re-copy them from Step 6.
  After changing `.env` you must stop and restart `npm run dev`.
- *Logged in but no Admin button / "Load items" is missing* → your account isn't
  admin yet. Re-run Step 5 and check it says "1 row affected", then log out and
  back in.
- *SQL Editor shows a red error* → make sure you pasted the **entire**
  `schema.sql` file, not just part of it. Re-running the whole file is safe.
- *The debug badge at the bottom-left says `profile: no profile row`* → the login
  worked but Supabase hasn't matched it to a profile; sign out and back in, and
  confirm the user exists under Authentication → Users.

## Run / build / test

```bash
npm install --legacy-peer-deps   # peer-dep cushion (vite-plugin-pwa vs Vite 8)
npm run dev                      # web dev server
npm run build                    # production build -> dist/
npm test                         # model unit tests (Vitest)
```

## Notes

- **Offline:** a month save made while offline is queued in `localStorage` and
  flushed on reconnect (one entry per month, latest wins). The PWA service worker
  caches the app shell. Unlike Firestore, Supabase reads are not offline-cached,
  but React Query keeps the last fetch in memory for the session.
- **Free-tier pause:** Supabase pauses a project after 7 days of inactivity.
  Daily restaurant use keeps it awake; for quiet periods the included GitHub
  Actions cron (`.github/workflows/keepalive.yml`) pings it every 3 days. Free
  tier has **no backups** — don't let a paused project sit indefinitely.
- **The model layer is pure** (no React/Supabase), so `StockCountModel.test.js`
  and `OrderModel.test.js` fully cover the math, validation, and payloads.
- **Timezone:** "this month" is evaluated in the business timezone in
  `monthUtils.js`; the RLS `is_current_month()` helper allows a ±1-month cushion
  so saves around the month boundary aren't rejected.
