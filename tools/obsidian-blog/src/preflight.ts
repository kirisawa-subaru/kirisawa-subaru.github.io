// Pre-publish checks. Mirrors the site's content schema (src/content.config.ts)
// and runs the exact math linter the site's CI runs.
// @ts-ignore -- plain JS module shared with the site
import { lintMath } from '../../../src/lib/markdown/math-lint.mjs';

export type Severity = 'error' | 'warning';

export interface Issue {
  severity: Severity;
  message: string;
  line?: number;
  excerpt?: string;
}

const ACCENTS = ['blue', 'coral', 'green', 'violet', 'yellow'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Obsidian's built-in callout types plus the math ones the site adds (astro.config.mjs).
const CALLOUTS = new Set(
  'note abstract summary tldr info todo tip hint important success check done question help faq warning caution attention failure fail missing danger error bug example quote cite theorem lemma definition proof remark'.split(
    ' ',
  ),
);

export interface PreflightInput {
  source: string;
  frontmatter: Record<string, unknown> | undefined;
  basename: string;
  /** slug → vault path of every other post, to catch duplicate URLs */
  otherSlugs: Map<string, string>;
  /** resolves a relative link target against the note; true if the file exists */
  exists: (target: string) => boolean;
}

export function preflight(input: PreflightInput): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string, line?: number, excerpt?: string) =>
    issues.push({ severity: 'error', message, line, excerpt });
  const warn = (message: string, line?: number, excerpt?: string) =>
    issues.push({ severity: 'warning', message, line, excerpt });

  const fm = input.frontmatter;
  if (!fm) {
    err('缺少 frontmatter（文件开头的 --- 块）。用「新建文章」创建会自动带上。');
  } else {
    if (typeof fm.title !== 'string' || !fm.title.trim()) err('frontmatter 缺少 title。');
    if (fm.date === undefined || fm.date === null || fm.date === '') err('frontmatter 缺少 date（例如 2026-10-29）。');
    else if (Number.isNaN(new Date(String(fm.date)).valueOf())) err(`date 不是有效日期：${String(fm.date)}`);
    if (fm.updated !== undefined && fm.updated !== null && Number.isNaN(new Date(String(fm.updated)).valueOf()))
      err(`updated 不是有效日期：${String(fm.updated)}`);
    if (fm.tags !== undefined && fm.tags !== null) {
      if (!Array.isArray(fm.tags)) err('tags 要写成列表，例如 tags: [rl, notes]。');
      else if (fm.tags.some((t) => typeof t !== 'string')) err('tags 里每一项都要是文字。');
    }
    if (fm.draft !== undefined && fm.draft !== null && typeof fm.draft !== 'boolean')
      err('draft 只能是 true 或 false。');
    if (fm.accent !== undefined && fm.accent !== null && !ACCENTS.includes(String(fm.accent)))
      err(`accent 只能是 ${ACCENTS.join(' / ')}。`);
    if (fm.description !== undefined && fm.description !== null && typeof fm.description !== 'string')
      err('description 要是一段文字。');

    const slug = fm.slug;
    if (slug === undefined || slug === null || slug === '') {
      if (!SLUG.test(input.basename))
        warn(`没有 slug，网址会用文件名「${input.basename}」。建议加一个英文 slug。`);
    } else if (typeof slug !== 'string' || !SLUG.test(slug)) {
      err('slug 只能用小写字母、数字和连字符，例如 eth-ladder。');
    }
    const url = typeof slug === 'string' && slug ? slug : input.basename;
    const clash = input.otherSlugs.get(url);
    if (clash) err(`网址 /posts/${url}/ 和「${clash}」重复。`);
  }

  const lines = input.source.split('\n');
  const inFence = fenceMask(lines);
  lines.forEach((text, i) => {
    if (inFence[i]) return;
    const line = i + 1;
    if (/!?\[\[[^\]]+\]\]/.test(text))
      err('网站不支持 [[wikilink]] / ![[嵌入]]，请用 Markdown 链接（本 vault 已默认关闭 wikilink）。', line, text.trim());
    const callout = /^\s*>\s*\[!([a-z-]+)\]/i.exec(text);
    if (callout && !CALLOUTS.has(callout[1].toLowerCase()))
      warn(`callout 类型 [!${callout[1]}] 网站不认识，会显示成普通引用。`, line, text.trim());
    for (const m of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = m[1];
      if (/^(https?:)?\/\//.test(target) || target.startsWith('data:')) continue;
      if (!input.exists(target)) err(`图片不存在：${decodeSafe(target)}`, line, text.trim());
    }
    for (const m of text.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+\.mdx?)(#[^)]*)?\)/g))
      if (!/^[a-z][a-z0-9+.-]*:/i.test(m[1])) warn(`链接指向 .md 文件（${decodeSafe(m[1])}），网站上会失效；请改成文章网址 /posts/<slug>/。`, line, text.trim());
  });

  for (const i of lintMath(input.source) as Issue[]) issues.push(i);

  return issues.sort(
    (a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) || (a.line ?? 0) - (b.line ?? 0),
  );
}

function fenceMask(lines: string[]): boolean[] {
  const mask: boolean[] = [];
  let fence: string | null = null;
  let inFrontmatter = lines[0]?.trim() === '---';
  lines.forEach((text, i) => {
    if (inFrontmatter) {
      mask.push(true);
      if (i > 0 && text.trim() === '---') inFrontmatter = false;
      return;
    }
    const m = /^\s*(`{3,}|~{3,})/.exec(text);
    if (m) {
      if (!fence) fence = m[1][0];
      else if (m[1][0] === fence) {
        mask.push(true);
        fence = null;
        return;
      }
    }
    mask.push(fence !== null);
  });
  return mask;
}

export function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
