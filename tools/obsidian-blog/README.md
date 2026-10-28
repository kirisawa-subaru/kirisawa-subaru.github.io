# Kirisawa Blog — Obsidian companion plugin

Desktop-only plugin for the vault at `src/content/` of a clone of this repo
(on the Mac: `/Users/raymond/Documents/kirisawa-blog/src/content`).

Install / update: `tools/obsidian-blog/install.sh [vault-dir]` (builds, copies
the plugin, merges vault settings: markdown links, `./assets` attachments).

What it does: side panel listing posts (Draft / Live / Local, unpushed dot),
per-post actions 预检 / 预览 / 发布 / 更新 / 撤回, new-post modal, pull on startup,
deploy status in the status bar (quiet unless deploying or failed).
Pre-publish check = the site's schema rules + `src/lib/markdown/math-lint.mjs`.

Default hotkeys (Cmd+Option): N 新建 · K 预检 · P 发布/更新 · V 预览 · O 打开网页 · S 同步.

Git runs as the machine's own identity; pushes go through the
`github-kirisawa-blog` ssh alias (deploy key, write access to this repo only).
