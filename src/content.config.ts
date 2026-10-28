import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  // One post = src/content/posts/<slug>.md(x), or <slug>/index.md(x) with images beside it.
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      accent: z.enum(['blue', 'coral', 'green', 'violet', 'yellow']).optional(),
      cover: image().optional(),
    }),
});

export const collections = { posts };
