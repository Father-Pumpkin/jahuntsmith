import rss from '@astrojs/rss';
import { getPublishedPosts } from '../lib/content.ts';

export async function GET(context) {
  const posts = await getPublishedPosts();
  return rss({
    title: 'jahuntsmith.com',
    description: 'Writing by J. A. Huntsmith.',
    site: context.site,
    items: posts.map((p) => ({
      title: p.title,
      description: p.excerpt ?? '',
      link: `/blog/${p.slug}`,
      pubDate: p.published_at ? new Date(p.published_at) : undefined,
    })),
  });
}
