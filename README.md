# jahuntsmith.com

Personal site — a **resume** and a **blog** — as a static site on GitHub Pages,
managed through a small React **admin** app, with content stored in **Neon Postgres**.

## Architecture

```
Neon Postgres ──(direct SQL, build time)──▶ GitHub Actions ──▶ Astro static site ──▶ GitHub Pages ──▶ jahuntsmith.com
      ▲
      │ (Neon Data API + Neon Auth + RLS, authenticated writes)
      │
   Admin SPA (React + Vite) ──▶ GitHub Pages ──▶ jahuntsmith.com/admin
```

- **Public site reads at build time.** GitHub Actions holds a read-only `DATABASE_URL`,
  queries Neon during the Astro build, and bakes content into static HTML. No database
  or API is exposed to visitors.
- **Admin writes at runtime** via the Neon Data API, authenticated by Neon Auth,
  gated by Row-Level Security so only users in the `admins` table can write.
- **Publishing** = rebuild. The site regenerates on every push, on an hourly schedule,
  and on demand via the **Run workflow** button (see [Publishing](#publishing)).

## Layout

| Path | What |
|---|---|
| `apps/web` | Astro public site (resume + blog). Served at the domain root. |
| `apps/admin` | React + Vite admin SPA. Served at `/admin`. |
| `packages/db/schema.sql` | Database schema + RLS. Source of truth; re-running is idempotent. |
| `.github/workflows/deploy.yml` | Build both apps, assemble, deploy to Pages. |

## Neon project

- Project: **jahuntsmith** (`spring-recipe-99608149`), region `aws-us-west-2`, Postgres 17.
- Auth URL: `https://ep-super-rain-a6o7vmst.neonauth.us-west-2.aws.neon.tech/neondb/auth`
- Data API: `https://ep-super-rain-a6o7vmst.apirest.us-west-2.aws.neon.tech/neondb/rest/v1`

## Local development

> Requires **Node ≥ 22.12** (Astro 7 / Vite 8). Use `fnm use 22` or `nvm`.

```bash
npm install
cp .env.example .env               # fill DATABASE_URL (already done locally)
cp apps/admin/.env.example apps/admin/.env

npm run dev:web      # public site   → http://localhost:4321
npm run dev:admin    # admin app     → http://localhost:5173/admin/
npm run build        # build both apps
```

The build runs `materialize-assets.mjs` first, which pulls uploaded files (resume PDF,
images) out of the `assets` table and writes them to `apps/web/public/assets/`.

## Deploying (one-time setup)

1. **Create the GitHub repo** and push this folder.
2. **Settings → Pages → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → New secret:**
   - `DATABASE_URL` = the `neondb_owner` pooled connection string (in `.env`).
4. **Custom domain (DNS)** — at your registrar for `jahuntsmith.com`:
   - Apex `@` → four `A` records: `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`
   - `www` → `CNAME` → `<your-github-username>.github.io`
   - In **Settings → Pages**, set the custom domain to `jahuntsmith.com` and enable
     **Enforce HTTPS**. The `apps/web/public/CNAME` file is deployed automatically.
5. **CORS / trusted origins (Neon Console)** — so the browser admin can call Auth + Data API:
   - **Data API → Settings → CORS**: allow `https://jahuntsmith.com` and `http://localhost:5173`.
   - **Auth → Configuration → Trusted origins**: same two origins.
6. Push to `main` → the workflow builds and deploys.

## First login / claiming admin

The `admins` table starts empty. The **first** account to sign in at `/admin` self-claims
admin (a bootstrap RLS policy that only fires while the table is empty). **Do this immediately**
after the admin app is live:

1. Go to `https://jahuntsmith.com/admin`, **Create account** (email + password).
2. On success you become the sole admin; the bootstrap policy locks.

To add more admins later, insert into `admins` via SQL (their Neon Auth `user_id`).

## Publishing

Content edits land in Neon instantly, but the **public site only changes when it rebuilds**:

- **Automatic:** hourly (`schedule` cron) and on every push to `main`.
- **On demand:** GitHub → **Actions → Deploy site → Run workflow**.
- **Optional "Publish now" button in the admin** would need a tiny token-holding proxy
  (e.g. a Cloudflare Worker calling `repository_dispatch`). Not built — scheduled + manual
  covers it.

## Admin tabs

Every resume section and the blog are managed from the admin — no SQL needed:
**Profile** (incl. headshot upload), **Experience**, **Education**, **Skills**,
**Projects**, **Blog posts**, and **Résumé PDF**. Education / Skills / Projects use the
generic `CollectionEditor.tsx` (field-config-driven CRUD); to add another collection,
give it a Postgres table + RLS and drop in another `<CollectionEditor>` in `App.tsx`.
