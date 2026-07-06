-- jahuntsmith.com — database schema (Neon Postgres 17)
-- Applied to project spring-recipe-99608149 / branch main / database neondb.
-- This file is the source of truth; re-running it is safe (idempotent).
--
-- Security model:
--   * Public site reads at BUILD TIME via the neondb_owner connection (bypasses RLS).
--   * Admin app writes at RUNTIME via the Neon Data API as role `authenticated`,
--     restricted by RLS to users listed in `admins`.

-- ── Admin allowlist ───────────────────────────────────────────
-- Access model: a user may edit content only if their Neon Auth (Google)
-- account email is in `admin_emails`. On first login an allowlisted user
-- self-provisions their `admins` row; everyone else is refused.
create table if not exists admin_emails (
  email    text primary key,             -- normalized lowercase
  added_at timestamptz not null default now()
);

create table if not exists admins (
  user_id    text primary key,          -- Neon Auth user id (JWT `sub`)
  email      text,
  created_at timestamptz not null default now()
);

-- ── Resume ────────────────────────────────────────────────────
create table if not exists profile (
  id             smallint primary key default 1,
  full_name      text not null default '',
  headline       text not null default '',
  summary        text not null default '',
  email          text,
  phone          text,
  location       text,
  links          jsonb not null default '[]'::jsonb,   -- [{label,url}]
  resume_pdf_url text,                                  -- /assets/<id>.pdf
  avatar_url     text,                                  -- /assets/<id>.<ext> (headshot)
  updated_at     timestamptz not null default now(),
  constraint profile_singleton check (id = 1)
);

-- NOTE: experiences/education/skills/projects are SUPERSEDED by the page
-- composer (pages/sections/section_items) below. Kept for reference; not
-- rendered or edited anymore. `profile` (the hero) is still used.
create table if not exists experiences (
  id          uuid primary key default gen_random_uuid(),
  company     text not null,
  role        text not null,
  location    text,
  start_date  date,
  end_date    date,                                     -- null = present
  description text,                                      -- markdown
  highlights  jsonb not null default '[]'::jsonb,        -- ["bullet", ...]
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists education (
  id          uuid primary key default gen_random_uuid(),
  institution text not null,
  credential  text,
  field       text,
  start_date  date,
  end_date    date,
  description text,
  sort_order  int not null default 0
);

create table if not exists skills (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text,
  level      int,                                        -- optional 1..5
  sort_order int not null default 0
);

create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  url         text,
  tags        text[] not null default '{}',
  sort_order  int not null default 0
);

-- ── Blog ──────────────────────────────────────────────────────
create table if not exists posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  title           text not null,
  excerpt         text,
  body            text not null default '',              -- markdown
  cover_image_url text,
  tags            text[] not null default '{}',
  status          text not null default 'draft' check (status in ('draft','published')),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists posts_status_pub_idx on posts(status, published_at desc);

-- ── Uploaded files (resume PDF, blog images) ──────────────────
-- Stored as base64; the build step materializes them to /assets/<id>.<ext>.
create table if not exists assets (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'file',             -- 'resume' | 'image'
  filename     text not null,
  content_type text not null,
  data         text not null,                            -- base64
  byte_size    int,
  created_at   timestamptz not null default now()
);

-- ── Page composer (multi-page, user-defined sections) ────────
-- A page has ordered sections; each section has a layout `kind` and either a
-- `body` (richtext/tags) or ordered `section_items` (timeline/cards/list).
create table if not exists pages (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,          -- 'home' is the apex '/'
  nav_label  text not null,
  subtitle   text,
  sort_order int not null default 0,
  visible    boolean not null default true,
  is_home    boolean not null default false
);

create table if not exists sections (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references pages(id) on delete cascade,
  title      text not null default '',       -- the custom header
  kind       text not null default 'timeline'
             check (kind in ('timeline','cards','list','tags','richtext')),
  body       text not null default '',        -- richtext markdown / tags list
  options    jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  visible    boolean not null default true
);
create index if not exists sections_page_idx on sections(page_id, sort_order);

create table if not exists section_items (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  title      text not null default '',
  subtitle   text,
  meta       text,
  date_start date,
  date_end   date,
  body       text,
  url        text,
  tags       text[] not null default '{}',
  bullets    jsonb not null default '[]'::jsonb,
  sort_order int not null default 0
);
create index if not exists section_items_section_idx on section_items(section_id, sort_order);

-- NOTE: after adding tables the Neon Data API schema cache must be refreshed
-- (re-run provision_neon_data_api, or the "Refresh schema cache" console button);
-- `NOTIFY pgrst, 'reload schema'` alone was not reliable here.

-- ── RLS helpers ───────────────────────────────────────────────
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public, auth as $fn$
  select exists (select 1 from public.admins a where a.user_id = auth.user_id())
$fn$;

-- Is the CURRENT authenticated user's email on the allowlist? Reads the email
-- from Neon Auth's synced user table (never trusts client-supplied values).
create or replace function public.email_allowed() returns boolean
  language sql stable security definer set search_path = public, auth, neon_auth as $fn$
  select exists (
    select 1 from neon_auth."user" u
    where u.id = auth.uid()
      and lower(u.email) in (select lower(email) from public.admin_emails)
  )
$fn$;

-- ── Row-Level Security ────────────────────────────────────────
alter table admin_emails enable row level security;   -- no policies → not readable via Data API
alter table admins      enable row level security;
alter table profile     enable row level security;
alter table experiences enable row level security;
alter table education    enable row level security;
alter table skills      enable row level security;
alter table projects    enable row level security;
alter table posts       enable row level security;
alter table assets      enable row level security;

-- Admins can read their own row; an allowlisted user self-provisions on login.
drop policy if exists admins_select_self on admins;
create policy admins_select_self on admins for select to authenticated
  using (user_id = auth.user_id());
drop policy if exists admins_self_provision on admins;
create policy admins_self_provision on admins for insert to authenticated
  with check (user_id = auth.user_id() and public.email_allowed());
-- To add an admin: insert their Google email into admin_emails, e.g.
--   insert into admin_emails (email) values ('james@example.com');

-- All content: full access to admins only.
drop policy if exists profile_admin_all on profile;
create policy profile_admin_all on profile for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists experiences_admin_all on experiences;
create policy experiences_admin_all on experiences for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists education_admin_all on education;
create policy education_admin_all on education for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists skills_admin_all on skills;
create policy skills_admin_all on skills for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists projects_admin_all on projects;
create policy projects_admin_all on projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists posts_admin_all on posts;
create policy posts_admin_all on posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists assets_admin_all on assets;
create policy assets_admin_all on assets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Page composer tables: admin-only, same pattern.
alter table pages         enable row level security;
alter table sections      enable row level security;
alter table section_items enable row level security;
drop policy if exists pages_admin_all on pages;
create policy pages_admin_all on pages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists sections_admin_all on sections;
create policy sections_admin_all on sections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists section_items_admin_all on section_items;
create policy section_items_admin_all on section_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Grants for the Data API `authenticated` role ──────────────
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
