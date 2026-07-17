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

## 3. Cloudflare hosting (push-to-deploy)

Cloudflare now offers **two** ways to host a Git repo, and they differ in one
place that trips people up:

| | **Pages** flow | **Workers** flow (newer) |
|---|---|---|
| Where | Workers & Pages → Create → **Pages** tab | Workers & Pages → Create → **Workers** / Import repository |
| Build command | `npm run build` | `npm run build` |
| **Deploy command** | *(not asked)* | **`npx wrangler deploy`** |
| SPA routing | `public/_redirects` | `wrangler.jsonc` (`not_found_handling`) |
| Output/served | `dist` directory | `dist` via `wrangler.jsonc` assets |

**If Cloudflare is asking you for a "Deploy command," you're in the Workers
flow.** Both work for this app. Pick one:

### Option A — Pages (simplest, no deploy command)

Follow these steps and you'll never be asked for a deploy command:

1. **Start the project.** Go to https://dash.cloudflare.com → in the left sidebar
   open **Workers & Pages** → click **Create application** → the **Pages** tab →
   **Connect to Git** (in some accounts this button reads **Import an existing Git
   repository**).
2. **Authorize + pick the repo.** Sign in to GitHub (or GitLab), click **Install &
   Authorize**, choose your `order-stock-pwa` repo, then **Begin setup**.
3. **Set up builds and deployments:**
   - **Project name:** becomes your URL (`<name>.pages.dev`) — pick something like
     `order-stock`.
   - **Production branch:** `main`.
   - **Framework preset:** select **Vite** (or leave as **None** — both work).
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** leave as-is (only change it for a monorepo).
4. **Environment variables** (expand **Environment variables (optional)** — in
   newer dashboards this may be labelled **Variables and Secrets**). Add both, for
   **Production** (and add the same two to **Preview** afterwards):
   - `VITE_SUPABASE_URL` = your Project **base** URL, e.g.
     `https://YOUR-PROJECT.supabase.co` (no `/rest/v1/` on the end)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key (`sb_publishable_...`)
   - If the build's install step ever hits a peer-dependency error, also add
     `NPM_FLAGS` = `--legacy-peer-deps`. Set `NODE_VERSION` = `20` if you need to
     pin Node.
5. **Save and Deploy.** Watch the build log; when it finishes you get a
   `https://<project>.pages.dev` URL. Every push to `main` auto-builds and
   deploys, and every pull request gets its own preview URL.

To change build settings or env vars later: **Workers & Pages → your project →
Settings**. (Note: a Git-connected Pages project can't later switch to manual
"Direct Upload" — not something you need here.)

The `public/_redirects` file (`/* /index.html 200`) makes Pages serve the SPA
shell for any path — safe even though this app has no client-side router.

### Option B — Workers (only if you deliberately chose the Workers flow)

Cloudflare is steering new static sites toward **Workers** (an "Import a
repository" flow powered by Workers Builds). That flow asks for a **Deploy
command**, and Wrangler needs a small config file to know what to upload. This
repo is set up Pages-first, so those Workers-only files are **not** included —
add them if (and only if) you go the Workers route:

1. Create `wrangler.jsonc` in the project root:
   ```jsonc
   {
     "name": "order-stock-pwa",
     "compatibility_date": "2026-07-01",
     "assets": {
       "directory": "./dist",
       "not_found_handling": "single-page-application"
     }
   }
   ```
   (`not_found_handling` is the SPA fallback — it replaces `public/_redirects` on
   the Workers path.)
2. **Start the project.** https://dash.cloudflare.com → **Workers & Pages** →
   **Create application** → **Workers** → **Import a repository** → pick your repo.
3. **Set the commands:**
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
4. **Environment variables** — same two build-time variables as Option A
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). They must be **build**
   variables, because Vite bakes them into the static files during `npm run build`.
5. **Save / Deploy.** Wrangler uploads `dist`; pushes to `main` redeploy.

To deploy by hand from your computer instead: `npx wrangler login`, then
`npm run build && npx wrangler deploy`.

**Recommendation: use Option A (Pages).** It's simpler, needs none of the above,
and is what this repo is configured for.

SPA routing on Workers comes from `not_found_handling: "single-page-application"`
in `wrangler.jsonc` (not from `_redirects`). The `name` in that file
(`order-stock-pwa`) becomes the Worker/subdomain name — change it if you like.

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
