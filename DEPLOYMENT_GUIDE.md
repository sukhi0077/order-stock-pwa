# Deployment Guide — Cloudflare Pages + Supabase

This app is a plain static site (Vite → `dist/`) with Supabase as the backend.
Hosting is **Cloudflare Pages**: free, allows commercial use, unlimited bandwidth,
and hard-capped (no surprise bills). No credit card required on either service.

---

## 1. Supabase (backend)

1. Create a project at https://supabase.com.
2. **SQL Editor** → paste all of [`supabase/schema.sql`](./supabase/schema.sql) →
   **Run**. This creates the tables, RLS policies, the `is_admin()` helper, and
   the trigger that gives every new user a `staff` profile.
3. **Authentication → Users** → add your staff and admin accounts. For a private
   internal tool you may disable email confirmation (Authentication → Providers →
   Email) or confirm users manually.
4. Promote your admin account:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@shop.com';
   ```
5. **Project Settings → API Keys** → on the **Publishable and secret API keys**
   tab, note the **Project URL** and the **publishable** key (`sb_publishable_...`,
   the successor to the legacy anon key; if you only see legacy keys, click
   **Create new API keys** once). Never expose any **secret** key
   (`sb_secret_...` / `service_role`).

## 2. GitHub

Create a repo and push this project. `.env` is git-ignored — secrets live in
Cloudflare, not in the repo.

```bash
git init && git add . && git commit -m "Order & Stock PWA (Supabase)"
git branch -M main
git remote add origin https://github.com/<you>/order-stock-pwa.git
git push -u origin main
```

## 3. Cloudflare Pages (hosting, push-to-deploy)

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to
   Git** → pick the repo.
2. Build settings:
   - **Framework preset:** None (or Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 (set env var `NODE_VERSION=20` if needed)
   - If the install step hits a peer-dep error, set the install command to
     `npm install --legacy-peer-deps`.
3. **Settings → Environment variables** (Production **and** Preview):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key (`sb_publishable_...`)
4. **Save and Deploy.** Every push to `main` auto-builds and deploys; pull
   requests get their own preview URL.

> The `public/_redirects` file (`/* /index.html 200`) makes Cloudflare serve the
> SPA shell for any path — safe even though this app has no client-side router.

## 4. Keep the free DB awake (optional)

Supabase pauses a free project after 7 days of inactivity. Daily use keeps it up.
For quiet periods, the included workflow `.github/workflows/keepalive.yml` pings
it every 3 days. Add two repo secrets (**Settings → Secrets and variables →
Actions**): `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Free tier has **no
backups**, so don't leave a project paused for long.

## 5. Install as an app

Because it's a PWA, staff can open the Cloudflare URL on their phone and choose
**Add to Home Screen** — it installs and launches full-screen, works offline for
the app shell, and needs no App Store / Play Store submission.

---

## Why this stack

- **Vite React over Next.js:** a private, login-only internal tool has no SEO/SSR
  needs, Supabase is the backend, and Next.js needs an adapter (OpenNext) to run
  on Cloudflare. Vite builds a plain static site Cloudflare hosts with zero
  friction.
- **Cloudflare Pages over Vercel:** free, commercial use allowed, unlimited
  bandwidth. Vercel's free Hobby tier prohibits commercial use.
- **Billing safety:** no credit card on either service ⇒ no overage billing —
  both enforce hard caps instead.
