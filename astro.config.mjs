// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math-extended';
import rehypeKatex from 'rehype-katex';
import remarkTexDisplay from './src/lib/markdown/remark-tex-display.mjs';
import rehypeMathNoBreak from './src/lib/markdown/rehype-math-nobreak.mjs';

export default defineConfig({
  site: 'https://kirisawa-subaru.github.io',
  integrations: [mdx(), sitemap()],
  markdown: {
    // unified (remark/rehype) rather than the default Sätteri processor, so the
    // remark ecosystem (math now, Obsidian syntax later) plugs in directly.
    processor: unified({
      remarkPlugins: [remarkMath, remarkTexDisplay],
      rehypePlugins: [
        [
          rehypeKatex,
          {
            // CJK inside \mathrm{} / \text{} is intentional; keep other strict warnings.
            strict: (/** @type {string} */ code) => (code === 'unicodeTextInMathMode' ? 'ignore' : 'warn'),
          },
        ],
        rehypeMathNoBreak,
      ],
    }),
    shikiConfig: { theme: 'github-light' },
  },
});
