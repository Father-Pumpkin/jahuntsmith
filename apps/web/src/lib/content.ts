import { sql } from './db';

export type Link = { label: string; url: string };

export type Profile = {
  full_name: string;
  headline: string;
  summary: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: Link[];
  resume_pdf_url: string | null;
  avatar_url: string | null;
};

export type Experience = {
  id: string;
  company: string;
  role: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  highlights: string[];
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  tags: string[];
  published_at: string | null;
};

export async function getProfile(): Promise<Profile | null> {
  const rows = (await sql`select * from profile where id = 1`) as Profile[];
  return rows[0] ?? null;
}

export async function getExperiences(): Promise<Experience[]> {
  return (await sql`
    select * from experiences
    order by sort_order asc, end_date desc nulls first, start_date desc nulls last
  `) as Experience[];
}

export async function getEducation() {
  return await sql`select * from education order by sort_order asc, end_date desc nulls last`;
}

export async function getSkills() {
  return await sql`select * from skills order by sort_order asc, name asc`;
}

export async function getProjects() {
  return await sql`select * from projects order by sort_order asc, name asc`;
}

export async function getPublishedPosts(): Promise<Post[]> {
  return (await sql`
    select * from posts
    where status = 'published'
    order by published_at desc nulls last, created_at desc
  `) as Post[];
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const rows = (await sql`
    select * from posts where slug = ${slug} and status = 'published'
  `) as Post[];
  return rows[0] ?? null;
}

// ── Pages / sections (the page composer) ──────────────────────
export type NavPage = { slug: string; nav_label: string; is_home: boolean };
export type SectionItem = {
  id: string;
  title: string;
  subtitle: string | null;
  meta: string | null;
  date_start: string | null;
  date_end: string | null;
  body: string | null;
  url: string | null;
  tags: string[];
  bullets: string[];
};
export type Section = {
  id: string;
  title: string;
  kind: 'timeline' | 'cards' | 'list' | 'tags' | 'richtext';
  body: string;
  items: SectionItem[];
};
export type PageContent = {
  page: { slug: string; nav_label: string; subtitle: string | null; is_home: boolean };
  sections: Section[];
};

export async function getNavPages(): Promise<NavPage[]> {
  return (await sql`
    select slug, nav_label, is_home from pages where visible = true order by sort_order asc, nav_label asc
  `) as NavPage[];
}

export async function getPageContent(slug: string): Promise<PageContent | null> {
  const pages = (await sql`select * from pages where slug = ${slug} and visible = true`) as any[];
  const page = pages[0];
  if (!page) return null;

  const sections = (await sql`
    select * from sections where page_id = ${page.id} and visible = true order by sort_order asc
  `) as any[];

  const ids = sections.map((s) => s.id);
  const items = ids.length
    ? ((await sql`select * from section_items where section_id = any(${ids}) order by sort_order asc`) as any[])
    : [];

  const bySection = new Map<string, SectionItem[]>();
  for (const it of items) {
    if (!bySection.has(it.section_id)) bySection.set(it.section_id, []);
    bySection.get(it.section_id)!.push(it);
  }

  return {
    page,
    sections: sections.map((s) => ({ ...s, items: bySection.get(s.id) ?? [] })),
  };
}

export async function getContentPageSlugs(): Promise<string[]> {
  const rows = (await sql`
    select slug from pages where visible = true and is_home = false
  `) as { slug: string }[];
  return rows.map((r) => r.slug);
}
