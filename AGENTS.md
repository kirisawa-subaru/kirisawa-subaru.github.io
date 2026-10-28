# Agent guide — kirisawa-subaru.github.io

Personal blog of Kirisawa Subaru, built with Astro 7 and deployed to GitHub Pages
by `.github/workflows/deploy.yml` on every push to `main`.

## Ownership boundary

- **Raymond owns post bodies.** Files under `src/content/posts/` and the prose in
  `src/pages/about.md` are his writing. Do not rewrite, reword, "polish" or
  translate them. Allowed edits there: fixing frontmatter that fails the schema,
  fixing broken links/image paths, and changes he explicitly asks for.
- **Agents own everything else**: layouts, components, styles, config, CI,
  dependencies, scripts.

## Content model

One post = `src/content/posts/<slug>.md` (or `.mdx`), or a folder
`src/content/posts/<slug>/index.md(x)` with images beside it. The slug becomes
the URL `/posts/<slug>/`. Schema lives in `src/content.config.ts`:

```yaml
title: string            # required
description: string      # optional, shown in lists and meta
date: 2026-10-29         # required
updated: 2026-11-02      # optional
tags: [rl, notes]        # optional
draft: true              # optional; drafts show in `astro dev`, never in production or RSS
accent: blue             # optional; blue | coral | green | violet | yellow card tint
cover: ./cover.png       # optional; relative image path
```

The repo is public, so drafts are readable on GitHub even though they are not built.
Private local-only posts go in `src/content/posts/local/` (gitignored): they render
in dev/preview on this machine and never reach GitHub.

MDX posts may import interactive widgets from `src/components/widgets/`
(see `src/content/posts/style-guide/index.mdx` for every element in use).
New widgets go there; keep each self-contained (own `<script>` and scoped
`<style>`), use the CSS tokens from `src/styles/global.css`, and respect
`prefers-reduced-motion`. If a widget needs React/Svelte/etc., add the
integration with `npx astro add <name>` and hydrate with `client:visible`.

## Visual language

Warm paper background, ink text, one blue accent, pastel tints
(`--tint-*`) for cards, serif display type with tight negative tracking,
small uppercase blue kickers, pill-shaped labels. Home page = compact intro,
latest post as a featured card, then the archive grouped by year. CV lives at
the end of the About page, never on the home page. Tokens and shared atoms
are in `src/styles/global.css`; site identity strings in `src/site.config.ts`.

## Toolchain notes (non-obvious)

- Node ≥ 22.23.4 (`.nvmrc`). On the MateBook the default `node` is older; use
  `PATH=~/.local/opt/node-v22.23.4-linux-x64/bin:$PATH`.
- Markdown runs through the **unified** processor (`@astrojs/markdown-remark`),
  not Astro 7's default Sätteri, so remark/rehype plugins work. Add plugins in
  `astro.config.mjs` under `markdown.processor: unified({...})`, not the
  deprecated top-level `markdown.remarkPlugins`.
- Zod comes from `astro/zod`; loaders from `astro/loaders`.

## Math (high priority — posts are formula-heavy)

- Delimiters: `$…$`, `$$…$$`, `\(…\)`, `\[…\]` all work. Parsing is
  `remark-math-extended` plus `src/lib/markdown/remark-tex-display.mjs`, which
  lets `\[` open on lazy continuation lines (e.g. after a `8. …` line) and
  renders mid-line `\[…\]` as display math. `rehype-math-nobreak.mjs` keeps
  inline math glued to the punctuation after it.
- KaTeX is pinned to one version via `overrides` in package.json. The CSS
  (`katex/dist/katex.min.css`) must come from the same version rehype-katex
  renders with; a mismatch breaks subscripts, `\boxed` and `\tag` silently.
  Bump `dependencies.katex` and `overrides.katex` together.
- `npm run check:math` builds with drafts and fails on KaTeX errors or
  unparsed delimiters; it warns on bare commands like `\le` outside math.
  `src/content/posts/math-fixture.md` is the regression fixture: when a new
  math bug is fixed, add the failing pattern there.
- Wide display equations break out of the text column to the article width
  (script in `src/layouts/Post.astro`), then scroll with a fade.

## Before pushing

```sh
npm run check        # astro check, must be 0 errors
npm run check:math   # every formula renders
npm run build        # must succeed; CI runs the same three steps
```

Dev server: `npx astro dev --background` (stop with `npx astro dev stop`).
Commit as the agent identity via `~/.claude/bin/agit`, one logical change per commit.
