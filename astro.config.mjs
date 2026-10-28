// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://kirisawa-subaru.github.io',
  integrations: [mdx(), sitemap()],
  markdown: {
    // unified (remark/rehype) rather than the default Sätteri processor, so the
    // remark ecosystem (math now, Obsidian syntax later) plugs in directly.
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    shikiConfig: { theme: 'github-light' },
  },
});
