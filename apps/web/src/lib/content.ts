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
