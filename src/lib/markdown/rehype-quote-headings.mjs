/**
 * Headings inside a blockquote belong to the quoted text, not to this post's
 * outline: turn them into styled paragraphs so they get no id, no "#" anchor
 * and stay out of the table of contents. Must run before rehypeHeadingIds.
 */

import { visit } from 'unist-util-visit';

const HEADING = /^h[1-6]$/;

export default function rehypeQuoteHeadings() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'blockquote') return;
      visit(node, 'element', (child) => {
        if (!HEADING.test(child.tagName)) return;
        child.properties = { ...child.properties, className: ['quote-heading', `quote-${child.tagName}`] };
        child.tagName = 'p';
      });
    });
  };
}
