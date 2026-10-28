import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

// Drafts render in `astro dev` (and with SHOW_DRAFTS=1, used by the CI math
// check) and are dropped from production builds.
const showDrafts = import.meta.env.DEV || process.env.SHOW_DRAFTS === '1';

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => showDrafts || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

// Drafts get an unlisted, noindex preview page so the real rendering can be
// checked before publishing. The source is in a public repo anyway.
export async function getDrafts(): Promise<Post[]> {
  return getCollection('posts', ({ data }) => data.draft);
}

export function previewUrl(post: Post) {
  return `/preview/${post.id}/`;
}

export function postUrl(post: Post) {
  return `/posts/${post.id}/`;
}

export function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// CJK characters read at ~400/min, latin words at ~220/min.
export function readingMinutes(body = '') {
  const cjk = (body.match(/[぀-ヿ㐀-鿿]/g) ?? []).length;
  const words = (body.replace(/[぀-ヿ㐀-鿿]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

export function tagSlug(tag: string) {
  return encodeURIComponent(tag.toLowerCase().replace(/\s+/g, '-'));
}

export async function getTags(posts: Post[]) {
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
