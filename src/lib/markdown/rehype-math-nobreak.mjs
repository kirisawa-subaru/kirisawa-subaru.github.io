/**
 * Keeps inline math glued to the punctuation right after it, so a line never
 * starts with "，" or "." left over from `$x$，`. Runs after rehype-katex.
 */

import { visit, SKIP } from 'unist-util-visit';

const LEADING_PUNCT = /^[，。、；：！？）」』》〉】”’,.;:!?)\]]+/u;

const isInlineKatex = (node) =>
  node?.type === 'element' &&
  node.tagName === 'span' &&
  Array.isArray(node.properties?.className) &&
  node.properties.className.includes('katex');

export default function rehypeMathNoBreak() {
  return (tree) => {
    visit(tree, 'element', (parent) => {
      const classes = parent.properties?.className;
      if (Array.isArray(classes) && (classes.includes('katex') || classes.includes('math-nobreak'))) {
        return SKIP;
      }
      const kids = parent.children;
      for (let i = 0; i < kids.length - 1; i++) {
        const next = kids[i + 1];
        if (!isInlineKatex(kids[i]) || next.type !== 'text') continue;
        const m = LEADING_PUNCT.exec(next.value);
        if (!m) continue;
        next.value = next.value.slice(m[0].length);
        const glued = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['math-nobreak'] },
          children: [kids[i], { type: 'text', value: m[0] }],
        };
        kids.splice(i, 1, glued);
        if (!next.value) kids.splice(i + 1, 1);
      }
    });
  };
}
