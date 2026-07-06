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

## Access control

Login is **Google only**. Authorization is an **email allowlist**: a user can edit content
only if their Google account email is in the `admin_emails` table (enforced by RLS via
`email_allowed()`, which reads the email from Neon Auth's synced `user` table). Non-allowlisted
accounts can authenticate but get a "No access" screen.

Currently allowed: `mitchellornesmith@gmail.com`.

To add an admin (e.g. James), insert their Google email:

```sql
insert into admin_emails (email) values ('james@example.com');
```

They then sign in with Google at `/admin` and are auto-provisioned on first login.

## Publishing

Content edits land in Neon instantly, but the **public site only changes when it rebuilds**:

- **Automatic:** hourly (`schedule` cron) and on every push to `main`.
- **On demand:** GitHub → **Actions → Deploy site → Run workflow**.
- **Optional "Publish now" button in the admin** would need a tiny token-holding proxy
  (e.g. a Cloudflare Worker calling `repository_dispatch`). Not built — scheduled + manual
  covers it.

## Admin tabs

Managed from the admin — no SQL needed:

- **Profile** — name, headline, summary, contact, links, headshot (the home hero).
- **Pages & sections** — the page composer. Create top-level nav **pages** (drag to
  reorder the nav), and within each page add **sections** with a custom header and a
  layout **kind**: `timeline` (dated entries + bullets), `cards` (grid w/ links/tags),
  `list`, `tags` (pill cloud), or `richtext` (markdown). Sections and their items are
  drag-reorderable. Renders via `pages` → `sections` → `section_items` (see schema).
- **Blog posts** — draft/publish editor.
- **Résumé PDF** — upload/replace the downloadable PDF.

Web rendering: `index.astro` (home = hero + home sections), `[page].astro` (custom
pages), and `components/Section.astro` (draws each kind). Admin: `ContentManager` →
`SectionsPanel` → `ItemsEditor`.

> After adding new tables, refresh the Neon Data API schema cache (re-run
> `provision_neon_data_api` or the console button) or the admin will 404 on them.
