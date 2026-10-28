#!/usr/bin/env node
// Lints every post's math at the source level (same parser + KaTeX as the
// build; see src/lib/markdown/math-lint.mjs), then scans built pages for any
// KaTeX error that slipped through.
// Usage: node scripts/check-math.mjs [distDir]   (dist scan skipped if absent)
// Exit 1 on errors; warnings are printed as GitHub annotations only.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { lintMath } from '../src/lib/markdown/math-lint.mjs';

function* files(dir, test) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name.startsWith('.')) continue;
    if (statSync(path).isDirectory()) yield* files(path, test);
    else if (test(name)) yield path;
  }
}

let errors = 0;
for (const file of files('src/content', (n) => /\.mdx?$/.test(n))) {
  for (const i of lintMath(readFileSync(file, 'utf8'))) {
    const kind = i.severity === 'error' ? 'error' : 'warning';
    console.log(`::${kind} file=${file},line=${i.line},col=${i.column}::${i.message} | ${i.excerpt}`);
    if (kind === 'error') errors++;
  }
}

const dist = process.argv[2];
if (dist && existsSync(dist)) {
  for (const file of files(dist, (n) => n.endsWith('.html'))) {
    const hits = readFileSync(file, 'utf8').match(/class="katex-error"[^>]*title="([^"]*)"/g) ?? [];
    for (const h of hits) console.log(`::error file=${relative(dist, file)}::KaTeX: ${h}`);
    errors += hits.length;
  }
}

if (errors) {
  console.log(`\ncheck-math: ${errors} formula error(s).`);
  process.exit(1);
}
console.log('check-math: all formulas render.');
