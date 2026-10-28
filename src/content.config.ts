import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  // One post = src/content/posts/<name>.md(x), or <name>/index.md(x) with images beside it.
  // URL is /posts/<slug>/ when `slug` is set, otherwise derived from the file path.
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug: lowercase letters, digits and dashes').optional(),
      description: z.string().optional(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      accent: z.enum(['blue', 'coral', 'green', 'violet', 'yellow']).optional(),
      cover: image().optional(),
    }),
});

// Single markdown pages edited alongside posts (src/content/about.md, …).
const pages = defineCollection({
  loader: glob({ base: './src/content', pattern: '*.md' }),
  schema: z.object({
    title: z.string(),
    kicker: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const collections = { posts, pages };
