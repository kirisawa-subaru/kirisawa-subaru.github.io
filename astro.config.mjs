// @ts-check
import { defineConfig } from 'astro/config';
import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math-extended';
import remarkBreaks from 'remark-breaks';
import remarkCodeLang from './src/lib/markdown/remark-code-lang.mjs';
import rehypeKatex from 'rehype-katex';
import rehypeCallouts from 'rehype-callouts';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import remarkTexDisplay from './src/lib/markdown/remark-tex-display.mjs';
import rehypeMathNoBreak from './src/lib/markdown/rehype-math-nobreak.mjs';
import rehypeQuoteHeadings from './src/lib/markdown/rehype-quote-headings.mjs';

export default defineConfig({
  site: 'https://kirisawa-subaru.github.io',
  integrations: [mdx(), sitemap({ filter: (page) => !page.includes('/preview/') })],
  markdown: {
    // unified (remark/rehype) rather than the default Sätteri processor, so the
    // remark ecosystem (math now, Obsidian syntax later) plugs in directly.
    processor: unified({
      // remark-breaks: a single newline is a line break, as in Obsidian's
      // default reading view (posts are written there).
      remarkPlugins: [remarkMath, remarkTexDisplay, remarkBreaks, remarkCodeLang],
      rehypePlugins: [
        // Obsidian callouts (> [!note]); styled in global.css, not the package theme.
        [
          rehypeCallouts,
          {
            theme: 'obsidian',
            callouts: {
              theorem: { title: '定理' },
              lemma: { title: '引理' },
              definition: { title: '定义' },
              proof: { title: '证明' },
              remark: { title: '注' },
            },
          },
        ],
        [
          rehypeKatex,
          {
            // CJK inside \mathrm{} / \text{} is intentional; keep other strict warnings.
            strict: (/** @type {string} */ code) => (code === 'unicodeTextInMathMode' ? 'ignore' : 'warn'),
          },
        ],
        rehypeMathNoBreak,
        // Ids first (Astro would add them after user plugins), then a "#"
        // anchor after each heading, visible on hover (styled in global.css).
        rehypeQuoteHeadings,
        rehypeHeadingIds,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: { className: ['heading-anchor'], ariaLabel: '本节链接' },
            content: { type: 'text', value: '#' },
          },
        ],
      ],
    }),
    shikiConfig: { theme: 'github-light' },
  },
});
