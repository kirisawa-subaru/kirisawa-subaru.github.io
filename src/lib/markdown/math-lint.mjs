/**
 * Source-level math linter for a post. Parses with the same micromark
 * extensions and KaTeX version as the site build, so what it reports matches
 * what the page will show. Used by scripts/check-math.mjs (CI) and bundled into
 * the Obsidian companion plugin (tools/obsidian-blog).
 *
 *   error:   a formula KaTeX cannot render; a `\(` `\[` `$$` delimiter that
 *            did not become math (it would show as raw text).
 *   warning: a bare TeX command such as `\le` outside math, usually a formula
 *            written without delimiters.
 */

import katex from 'katex';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { mathFromMarkdown } from 'mdast-util-math';
import { gfm } from 'micromark-extension-gfm';
import { math } from 'micromark-extension-math-extended';
import { visit } from 'unist-util-visit';
import { isDisplayText, texDisplaySyntax } from './remark-tex-display.mjs';

export const KATEX_OPTIONS = {
  throwOnError: true,
  strict: (code) => (code === 'unicodeTextInMathMode' ? 'ignore' : 'warn'),
};

const OPAQUE = new Set(['code', 'inlineCode', 'html', 'math', 'inlineMath']);
const DELIMITER = /\\\(|\\\)|\\\[|\\\]|\$\$/g;
const COMMAND = /\\[A-Za-z]{2,}/g;

/** Blank out YAML frontmatter, keeping offsets and line numbers intact. */
function maskFrontmatter(source) {
  const m = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/.exec(source);
  return m ? source.slice(0, m[0].length).replace(/[^\n]/g, ' ') + source.slice(m[0].length) : source;
}

function lineCol(source, offset) {
  let line = 1;
  let last = -1;
  for (let i = 0; i < offset; i++) if (source.charCodeAt(i) === 10) (line++, (last = i));
  return { line, column: offset - last };
}

const excerpt = (source, start, end = start + 1) =>
  source
    .slice(Math.max(0, start - 24), Math.min(source.length, end + 24))
    .replace(/\s+/g, ' ')
    .trim();

/**
 * @param {string} source full markdown file, frontmatter included
 * @returns {{severity: 'error'|'warning', line: number, column: number, message: string, excerpt: string}[]}
 */
export function lintMath(source) {
  const text = maskFrontmatter(source);
  const tree = fromMarkdown(text, {
    extensions: [gfm(), math(), texDisplaySyntax],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  });

  const issues = [];
  const opaque = [];
  const push = (severity, offset, message, end) =>
    issues.push({ severity, ...lineCol(text, offset), message, excerpt: excerpt(text, offset, end) });

  visit(tree, (node) => {
    if (!OPAQUE.has(node.type) || !node.position) return;
    const start = node.position.start.offset;
    const end = node.position.end.offset;
    opaque.push([start, end]);
    if (node.type !== 'math' && node.type !== 'inlineMath') return;
    const displayMode = node.type === 'math' || isDisplayText(text, node);
    try {
      katex.renderToString(node.value, { ...KATEX_OPTIONS, displayMode });
    } catch (err) {
      const reason = String(err?.message ?? err).replace(/^KaTeX parse error:\s*/, '');
      push('error', start, `公式无法渲染：${reason}`, end);
    }
  });

  opaque.sort((a, b) => a[0] - b[0]);
  const inOpaque = (i) => opaque.some(([s, e]) => i >= s && i < e);

  for (const m of text.matchAll(DELIMITER)) {
    if (inOpaque(m.index)) continue;
    // `\\(` is an escaped backslash followed by a bracket, not a delimiter.
    if (text[m.index - 1] === '\\') continue;
    push('error', m.index, `分隔符 ${m[0]} 没有配对成公式，会原样显示`);
  }

  for (const m of text.matchAll(COMMAND)) {
    if (inOpaque(m.index) || text[m.index - 1] === '\\') continue;
    push('warning', m.index, `公式外出现 TeX 命令 ${m[0]}，是不是漏了 $…$？`);
  }

  return issues.sort((a, b) => a.line - b.line || a.column - b.column);
}
