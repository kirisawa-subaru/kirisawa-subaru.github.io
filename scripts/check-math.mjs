#!/usr/bin/env node
// Scans built post pages for math that did not render.
//   errors   (exit 1): KaTeX parse errors; `\(` `\)` `\[` `\]` `$$` left in prose.
//   warnings (exit 0): bare TeX commands such as `\le` in prose, usually a
//                      formula written without delimiters.
// Usage: node scripts/check-math.mjs [distDir=dist]

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fromHtml } from 'hast-util-from-html';

const root = process.argv[2] ?? 'dist';
const SKIP_TAGS = new Set(['pre', 'code', 'script', 'style', 'kbd', 'samp']);
const DELIMS = /\\\(|\\\)|\\\[|\\\]|\$\$/;
const COMMAND = /\\[A-Za-z]{2,}/;

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (name.endsWith('.html')) yield path;
  }
}

const classes = (node) => node.properties?.className ?? [];

function scan(node, out, inProse) {
  if (node.type === 'element') {
    const cls = classes(node);
    if (cls.includes('katex-error')) {
      out.errors.push(`KaTeX error: ${node.properties?.title ?? ''} :: ${textOf(node).slice(0, 80)}`);
      return;
    }
    if (cls.includes('katex') || cls.includes('katex-display') || SKIP_TAGS.has(node.tagName)) return;
    inProse ||= cls.includes('prose');
  }
  if (node.type === 'text' && inProse) {
    const t = node.value;
    const d = DELIMS.exec(t);
    if (d) out.errors.push(`unparsed "${d[0]}": …${snippet(t, d.index)}…`);
    const c = COMMAND.exec(t);
    if (c) out.warnings.push(`bare TeX "${c[0]}": …${snippet(t, c.index)}…`);
  }
  for (const child of node.children ?? []) scan(child, out, inProse);
}

const textOf = (n) => (n.type === 'text' ? n.value : (n.children ?? []).map(textOf).join(''));
const snippet = (t, i) => t.slice(Math.max(0, i - 30), i + 40).replace(/\s+/g, ' ');

let errorCount = 0;
for (const file of htmlFiles(root)) {
  if (!file.includes(`${join(root, 'posts')}`) && !file.endsWith(join('about', 'index.html'))) continue;
  const out = { errors: [], warnings: [] };
  scan(fromHtml(readFileSync(file, 'utf8')), out, false);
  const rel = relative(root, file);
  for (const e of out.errors) console.log(`::error file=${rel}::${e}`);
  for (const w of out.warnings) console.log(`::warning file=${rel}::${w}`);
  errorCount += out.errors.length;
}

if (errorCount) {
  console.log(`\ncheck-math: ${errorCount} unrendered formula(s).`);
  process.exit(1);
}
console.log('check-math: all formulas rendered.');
