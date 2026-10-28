# kirisawa-subaru.github.io

https://kirisawa-subaru.github.io — Astro 博客，push 到 `main` 自动部署。

## 写文章

在 `src/content/posts/` 新建 `<slug>.md`：

```md
---
title: 标题
description: 一句话摘要
date: 2026-10-29
tags: [notes]
draft: true   # 写完删掉这行再 push 就会发布
---

正文……
```

带图片的文章用文件夹：`src/content/posts/<slug>/index.md`，图片放同目录，正文里写 `![](./figure.png)`。
想插交互组件就用 `.mdx`，示例见 `src/content/posts/style-guide/index.mdx`。

本地预览：`npm run dev`，草稿只在这里可见。

站点名、简介、链接在 `src/site.config.ts`；About 页是 `src/pages/about.md`。

维护约定给 agent 看的版本在 `AGENTS.md`。
