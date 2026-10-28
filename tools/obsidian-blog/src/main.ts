import {
  FileSystemAdapter,
  ItemView,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  WorkspaceLeaf,
  debounce,
  normalizePath,
  setIcon,
} from 'obsidian';
import { watchDeploy, type DeployState } from './deploy';
import { Git, GitError } from './git';
import { IssuesModal, NewPostModal, type NewPostInput } from './modals';
import { decodeSafe, preflight, type Issue } from './preflight';

const VIEW_TYPE = 'kirisawa-blog';
const POSTS = 'posts';
const LOCAL = 'posts/local/';
const SITE = 'https://kirisawa-subaru.github.io';
const REPO = 'kirisawa-subaru/kirisawa-subaru.github.io';

type Mode = 'publish' | 'preview' | 'unpublish';

export default class KirisawaBlog extends Plugin {
  git!: Git;
  changed = new Set<string>();
  ahead = 0;
  deploy: DeployState | null = null;
  busy: string | null = null;
  private statusEl!: HTMLElement;
  private deployWatch = { cancelled: false };

  async onload() {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      new Notice('Kirisawa Blog 只支持桌面版 Obsidian。');
      return;
    }
    this.git = new Git(adapter.getBasePath());

    this.registerView(VIEW_TYPE, (leaf) => new BlogView(leaf, this));
    this.addRibbonIcon('send', '博客', () => this.revealView());
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass('kblog-status');
    this.statusEl.addEventListener('click', () => this.onStatusClick());

    this.addCommand({
      id: 'new-post',
      name: '新建文章',
      hotkeys: [{ modifiers: ['Mod', 'Alt'], key: 'n' }],
      callback: () => this.newPost(),
    });
    this.addPostCommand('check', '预检当前文章', { modifiers: ['Mod', 'Alt'], key: 'k' }, (f) => this.check(f));
    this.addPostCommand('publish', '发布 / 更新当前文章', { modifiers: ['Mod', 'Alt'], key: 'p' }, (f) =>
      this.ship(f, 'publish'),
    );
    this.addPostCommand('preview', '预览当前草稿（推送并打开预览页）', { modifiers: ['Mod', 'Alt'], key: 'v' }, (f) =>
      this.ship(f, this.isDraft(f) ? 'preview' : 'publish'),
    );
    this.addPostCommand('unpublish', '撤回为草稿', null, (f) => this.ship(f, 'unpublish'));
    this.addPostCommand('open-site', '在网站上打开当前文章', { modifiers: ['Mod', 'Alt'], key: 'o' }, (f) =>
      window.open(SITE + this.urlOf(f)),
    );
    this.addCommand({
      id: 'sync',
      name: '同步（拉取网站仓库的最新内容）',
      hotkeys: [{ modifiers: ['Mod', 'Alt'], key: 's' }],
      callback: () => this.pull(false),
    });
    this.addCommand({ id: 'push-all', name: '推送全部改动', callback: () => this.pushAll() });
    this.addCommand({ id: 'open-panel', name: '打开博客面板', callback: () => this.revealView() });

    const refresh = debounce(() => this.refreshStatus(), 1200, true);
    this.registerEvent(this.app.vault.on('modify', refresh));
    this.registerEvent(this.app.vault.on('create', refresh));
    this.registerEvent(this.app.vault.on('delete', refresh));
    this.registerEvent(this.app.vault.on('rename', refresh));
    this.registerEvent(this.app.metadataCache.on('changed', () => this.redraw()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.redraw()));

    this.app.workspace.onLayoutReady(async () => {
      await this.pull(true);
      if (!this.app.workspace.getLeavesOfType(VIEW_TYPE).length) await this.revealView(false);
    });
  }

  onunload() {
    this.deployWatch.cancelled = true;
  }

  private addPostCommand(
    id: string,
    name: string,
    hotkey: { modifiers: ('Mod' | 'Alt' | 'Shift' | 'Ctrl')[]; key: string } | null,
    run: (f: TFile) => void,
  ) {
    this.addCommand({
      id,
      name,
      hotkeys: hotkey ? [hotkey] : undefined,
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.isPost(file)) return false;
        if (!checking) run(file);
        return true;
      },
    });
  }

  // ---------- model ----------

  isPost(file: TFile) {
    return file.extension === 'md' && file.path.startsWith(POSTS + '/');
  }

  isLocal(file: TFile) {
    return file.path.startsWith(LOCAL);
  }

  fm(file: TFile): Record<string, unknown> | undefined {
    return this.app.metadataCache.getFileCache(file)?.frontmatter;
  }

  isDraft(file: TFile) {
    return this.fm(file)?.draft === true;
  }

  titleOf(file: TFile) {
    const t = this.fm(file)?.title;
    return typeof t === 'string' && t.trim() ? t : file.basename;
  }

  /** Same id Astro's glob loader derives: frontmatter slug, else the slugified path. */
  idOf(file: TFile) {
    const slug = this.fm(file)?.slug;
    if (typeof slug === 'string' && slug) return slug;
    const rel = file.path.slice(POSTS.length + 1).replace(/\.mdx?$/, '').replace(/\/index$/, '');
    return rel
      .split('/')
      .map((seg) =>
        seg
          .toLowerCase()
          .trim()
          .replace(/[^\p{L}\p{N}\s_-]/gu, '')
          .replace(/\s/g, '-'),
      )
      .join('/');
  }

  urlOf(file: TFile) {
    return this.isDraft(file) ? `/preview/${this.idOf(file)}/` : `/posts/${this.idOf(file)}/`;
  }

  posts(): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => this.isPost(f))
      .sort((a, b) => dateOf(this.fm(b)) - dateOf(this.fm(a)) || b.stat.mtime - a.stat.mtime);
  }

  hasChanges(file: TFile) {
    return this.changed.has(file.path);
  }

  // ---------- actions ----------

  newPost() {
    new NewPostModal(this.app, (input) => this.createPost(input)).open();
  }

  private async createPost({ title, slug, tags }: NewPostInput) {
    const safe = title.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim() || slug;
    let path = normalizePath(`${POSTS}/${safe}.md`);
    for (let n = 2; this.app.vault.getAbstractFileByPath(path); n++) path = normalizePath(`${POSTS}/${safe} ${n}.md`);
    const today = new Date().toISOString().slice(0, 10);
    const yaml = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `slug: ${slug}`,
      'description: ""',
      `date: ${today}`,
      `tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`,
      'draft: true',
      '---',
      '',
      '',
    ].join('\n');
    if (!this.app.vault.getAbstractFileByPath(POSTS)) await this.app.vault.createFolder(POSTS);
    const file = await this.app.vault.create(path, yaml);
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    const view = leaf.view;
    if (view instanceof MarkdownView) {
      const editor = view.editor;
      editor.focus();
      editor.setCursor({ line: editor.lastLine(), ch: 0 });
    }
  }

  private runPreflight(file: TFile, source: string): Issue[] {
    const otherSlugs = new Map<string, string>();
    for (const p of this.posts()) if (p.path !== file.path && !this.isLocal(p)) otherSlugs.set(this.idOf(p), p.path);
    const dir = file.parent?.path ?? '';
    return preflight({
      source,
      frontmatter: this.fm(file),
      basename: file.basename,
      otherSlugs,
      exists: (target) => {
        const clean = decodeSafe(target.split('#')[0].split('?')[0]);
        const resolved = clean.startsWith('/') ? clean.slice(1) : normalizePath(`${dir}/${clean}`);
        return this.app.vault.getAbstractFileByPath(resolveDots(resolved)) instanceof TFile;
      },
    });
  }

  async check(file: TFile) {
    await this.saveActive();
    const issues = this.runPreflight(file, await this.app.vault.read(file));
    if (!issues.length) {
      new Notice('✓ 预检通过：公式、frontmatter、图片都没问题。');
      return;
    }
    new IssuesModal(this.app, summary(issues), issues, (line) => this.jumpTo(file, line)).open();
  }

  async ship(file: TFile, mode: Mode, skipWarnings = false) {
    if (this.busy) {
      new Notice(`正在${this.busy}，稍等。`);
      return;
    }
    if (this.isLocal(file)) {
      new Notice('posts/local/ 里的文章只留在本机，不会上传。挪到 posts/ 下再发布。');
      return;
    }
    await this.saveActive();

    if (mode !== 'unpublish') {
      const issues = this.runPreflight(file, await this.app.vault.read(file));
      const errors = issues.filter((i) => i.severity === 'error');
      if (errors.length || (issues.length && !skipWarnings)) {
        new IssuesModal(
          this.app,
          summary(issues),
          issues,
          (line) => this.jumpTo(file, line),
          errors.length ? undefined : { label: '忽略提醒，继续', run: () => this.ship(file, mode, true) },
        ).open();
        return;
      }
    }

    const wasDraft = this.isDraft(file);
    const title = this.titleOf(file);
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (mode === 'publish') delete fm.draft;
      if (mode === 'preview' || mode === 'unpublish') fm.draft = true;
      if (!fm.date) fm.date = new Date().toISOString().slice(0, 10);
    });

    const verb = { publish: wasDraft ? '发布' : '更新', preview: '预览', unpublish: '撤回' }[mode];
    const paths = [file.path, ...this.localAssets(file)];
    const sha = await this.gitShip(`${verb}：${title}`, paths, verb);
    if (!sha) return;

    const url = SITE + this.urlOf(file);
    this.followDeploy(sha, (state) => {
      if (state.kind !== 'success') return;
      if (mode === 'preview') window.open(url);
      else if (mode === 'publish') notifyLink(`已上线：${title}`, url);
      else new Notice(`已撤回：${title}`);
    });
  }

  async pushAll() {
    const sha = await this.gitShip('更新博客内容', null, '推送');
    if (sha) this.followDeploy(sha, (s) => s.kind === 'success' && notifyLink('网站已更新', SITE));
  }

  /** Commit the given paths (or everything), rebase on remote, push. Returns pushed HEAD or null. */
  private async gitShip(message: string, paths: string[] | null, verb: string): Promise<string | null> {
    this.busy = verb;
    this.redraw();
    try {
      if (paths) {
        await this.git.run('add', '-A', '--', ...paths);
        const staged = (await this.git.run('diff', '--cached', '--name-only')).trim();
        if (staged) await this.git.run('commit', '-m', message);
      } else {
        await this.git.commitAll(message);
      }
      await this.git.pull();
      const { ahead } = await this.git.status();
      if (!ahead) {
        new Notice('没有需要上传的改动。');
        return null;
      }
      await this.git.push();
      return await this.git.head();
    } catch (e) {
      this.gitFailure(e, verb);
      return null;
    } finally {
      this.busy = null;
      await this.refreshStatus();
    }
  }

  async pull(quiet: boolean) {
    if (this.busy) return;
    this.busy = '同步';
    this.redraw();
    try {
      const before = await this.git.head();
      await this.git.pull();
      const after = await this.git.head();
      if (!quiet) new Notice(before === after ? '已经是最新。' : '已同步网站仓库的最新内容。');
    } catch (e) {
      this.gitFailure(e, '同步');
    } finally {
      this.busy = null;
      await this.refreshStatus();
    }
  }

  private gitFailure(e: unknown, verb: string) {
    const detail = e instanceof GitError ? e.stderr : String(e);
    console.error('[kirisawa-blog]', verb, detail);
    let hint = '';
    if (/CONFLICT|could not apply|unmerged/i.test(detail))
      hint = '网站仓库里有人改了同一处。把这条提示发给 agent 处理最省事。';
    else if (/Permission denied|publickey|Could not read from remote/i.test(detail))
      hint = '推送凭据不可用（deploy key）。';
    else if (/Could not resolve host|timed out|Network/i.test(detail)) hint = '网络连不上 GitHub，稍后重试。';
    const frag = createFragment((f) => {
      f.createEl('b', { text: `${verb}失败。` });
      if (hint) f.createDiv({ text: hint });
      f.createEl('pre', { cls: 'kblog-notice-pre', text: detail.trim().split('\n').slice(-6).join('\n') });
    });
    new Notice(frag, 0);
  }

  private followDeploy(sha: string, onDone: (s: DeployState) => void) {
    this.deployWatch.cancelled = true;
    const signal = { cancelled: false };
    this.deployWatch = signal;
    watchDeploy(REPO, sha, (s) => {
      if (signal.cancelled) return;
      this.deploy = s;
      this.redraw();
    }, signal).then((s) => {
      if (signal.cancelled) return;
      if (s.kind === 'failure') {
        notifyLink('网站构建失败，文章没有更新。点开看原因，或交给 agent。', s.url, 0);
      } else if (s.kind !== 'success') {
        new Notice('部署还没完成，稍后看看网站。');
      }
      onDone(s);
      if (s.kind === 'success') window.setTimeout(() => {
        if (this.deploy === s) {
          this.deploy = null;
          this.redraw();
        }
      }, 4000);
    });
  }

  private onStatusClick() {
    const d = this.deploy;
    if (d && d.kind !== 'waiting') window.open(d.url);
    else this.revealView();
  }

  /** Images referenced with relative markdown links, as vault paths. */
  private localAssets(file: TFile): string[] {
    const cache = this.app.metadataCache.getFileCache(file);
    const out = new Set<string>();
    const dir = file.parent?.path ?? '';
    for (const embed of cache?.embeds ?? []) {
      const target = decodeSafe(embed.link.split('#')[0]);
      const resolved = this.app.metadataCache.getFirstLinkpathDest(target, file.path);
      if (resolved) out.add(resolved.path);
      else out.add(resolveDots(normalizePath(`${dir}/${target}`)));
    }
    return [...out].filter((p) => this.app.vault.getAbstractFileByPath(p));
  }

  async refreshStatus() {
    try {
      const { changed, ahead } = await this.git.status();
      this.changed = changed;
      this.ahead = ahead;
    } catch {
      // not a repo or git missing; the view shows nothing special
    }
    this.redraw();
  }

  private async saveActive() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) await view.save();
  }

  private async jumpTo(file: TFile, line: number) {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    const view = leaf.view;
    if (view instanceof MarkdownView) {
      const editor = view.editor;
      const pos = { line: Math.max(0, line - 1), ch: 0 };
      editor.setCursor(pos);
      editor.scrollIntoView({ from: pos, to: pos }, true);
      editor.focus();
    }
  }

  async revealView(focus = true) {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: VIEW_TYPE, active: focus });
    }
    if (focus) this.app.workspace.revealLeaf(leaf);
  }

  redraw() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) (leaf.view as BlogView).render();
    this.renderStatus();
  }

  // Dark cockpit: the status bar is empty unless something needs attention.
  private renderStatus() {
    const el = this.statusEl;
    if (!el) return;
    el.empty();
    el.removeClass('is-running', 'is-failure', 'is-success');
    const d = this.deploy;
    if (this.busy) {
      el.setText(`博客：${this.busy}中…`);
      el.addClass('is-running');
    } else if (d?.kind === 'waiting' || d?.kind === 'running') {
      el.setText('博客：部署中…');
      el.addClass('is-running');
    } else if (d?.kind === 'failure') {
      el.setText('博客：部署失败');
      el.addClass('is-failure');
    } else if (d?.kind === 'success') {
      el.setText('博客：已上线');
      el.addClass('is-success');
    }
  }
}

class BlogView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: KirisawaBlog,
  ) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return '博客';
  }

  getIcon() {
    return 'send';
  }

  async onOpen() {
    this.render();
  }

  render() {
    const p = this.plugin;
    const root = this.contentEl;
    root.empty();
    root.addClass('kblog-view');

    const head = root.createDiv({ cls: 'kblog-head' });
    head.createDiv({ cls: 'kblog-title', text: '博客' });
    const tools = head.createDiv({ cls: 'kblog-tools' });
    iconButton(tools, 'plus', '新建文章', () => p.newPost());
    iconButton(tools, 'refresh-cw', '同步', () => p.pull(false));
    iconButton(tools, 'globe', '打开网站', () => window.open(SITE));

    const pending = p.posts().filter((f) => p.hasChanges(f) && !p.isLocal(f)).length;
    const otherChanges = [...p.changed].filter((path) => !path.startsWith(POSTS + '/')).length;
    if (p.busy || p.deploy || pending + otherChanges > 0 || p.ahead > 0) {
      const bar = root.createDiv({ cls: 'kblog-bar' });
      if (p.busy) bar.createSpan({ text: `${p.busy}中…` });
      else if (p.deploy?.kind === 'failure') {
        const a = bar.createEl('a', { text: '上次部署失败，点开看原因', href: p.deploy.url });
        a.addClass('is-failure');
      } else if (p.deploy && p.deploy.kind !== 'success') bar.createSpan({ text: '部署中…' });
      else if (p.deploy?.kind === 'success') bar.createSpan({ cls: 'is-success', text: '已上线' });
      if (!p.busy && pending + otherChanges + p.ahead > 0) {
        const n = pending + otherChanges;
        const btn = bar.createEl('button', { cls: 'kblog-link', text: n ? `${n} 处改动未上传 · 全部上传` : '有提交未推送 · 推送' });
        btn.addEventListener('click', () => p.pushAll());
      }
    }

    const active = p.app.workspace.getActiveFile();
    if (active && p.isPost(active)) this.renderActive(root, active);

    const posts = p.posts();
    const groups: [string, TFile[]][] = [
      ['草稿', posts.filter((f) => !p.isLocal(f) && p.isDraft(f))],
      ['已发布', posts.filter((f) => !p.isLocal(f) && !p.isDraft(f))],
      ['仅本机', posts.filter((f) => p.isLocal(f))],
    ];
    for (const [label, files] of groups) {
      if (!files.length) continue;
      const section = root.createDiv({ cls: 'kblog-group' });
      section.createDiv({ cls: 'kblog-group-label', text: `${label} · ${files.length}` });
      for (const f of files) {
        const row = section.createDiv({ cls: 'kblog-row' });
        if (f.path === active?.path) row.addClass('is-active');
        row.createDiv({ cls: 'kblog-row-title', text: p.titleOf(f) });
        const meta = row.createDiv({ cls: 'kblog-row-meta' });
        const d = p.fm(f)?.date;
        if (d) meta.createSpan({ text: String(d).slice(0, 10) });
        if (p.hasChanges(f) && !p.isLocal(f)) meta.createSpan({ cls: 'kblog-dot', attr: { title: '有改动未上传' } });
        row.addEventListener('click', () => p.app.workspace.getLeaf(false).openFile(f));
      }
    }
  }

  private renderActive(root: HTMLElement, file: TFile) {
    const p = this.plugin;
    const draft = p.isDraft(file);
    const local = p.isLocal(file);
    const card = root.createDiv({ cls: 'kblog-card' });
    const top = card.createDiv({ cls: 'kblog-card-top' });
    top.createSpan({
      cls: `kblog-pill ${local ? 'is-local' : draft ? 'is-draft' : 'is-live'}`,
      text: local ? 'Local' : draft ? 'Draft' : 'Live',
    });
    if (p.hasChanges(file) && !local) top.createSpan({ cls: 'kblog-card-note', text: '有改动未上传' });
    card.createDiv({ cls: 'kblog-card-title', text: p.titleOf(file) });
    const url = card.createEl('a', { cls: 'kblog-card-url', text: p.urlOf(file), href: SITE + p.urlOf(file) });
    url.setAttr('title', draft ? '草稿预览页（未公开列出）' : '文章网址');

    if (local) {
      card.createDiv({ cls: 'kblog-card-hint', text: '这篇在 posts/local/，只留在本机，不会上传。' });
      return;
    }
    const actions = card.createDiv({ cls: 'kblog-actions' });
    const busy = !!p.busy;
    button(actions, '预检', '检查公式、frontmatter、图片', () => p.check(file), false, busy);
    if (draft) {
      button(actions, '预览', '推送草稿并打开预览页', () => p.ship(file, 'preview'), false, busy);
      button(actions, '发布', '公开发布到网站', () => p.ship(file, 'publish'), true, busy);
    } else {
      button(actions, '更新', '把改动更新到网站', () => p.ship(file, 'publish'), true, busy);
      button(actions, '撤回', '从网站撤下，改回草稿', () => p.ship(file, 'unpublish'), false, busy);
    }
  }
}

function iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void) {
  const b = parent.createEl('button', { cls: 'clickable-icon kblog-icon', attr: { 'aria-label': label } });
  setIcon(b, icon);
  b.addEventListener('click', onClick);
}

function button(parent: HTMLElement, text: string, title: string, onClick: () => void, cta: boolean, disabled: boolean) {
  const b = parent.createEl('button', { text, attr: { title } });
  if (cta) b.addClass('mod-cta');
  if (disabled) b.setAttr('disabled', 'true');
  b.addEventListener('click', onClick);
}

function notifyLink(text: string, url: string, timeout = 8000) {
  const frag = createFragment((f) => {
    f.createSpan({ text: `${text}  ` });
    const a = f.createEl('a', { text: '打开', href: url });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(url);
    });
  });
  new Notice(frag, timeout);
}

function summary(issues: Issue[]) {
  const e = issues.filter((i) => i.severity === 'error').length;
  const w = issues.length - e;
  if (e) return `有 ${e} 个问题需要修改${w ? `，另有 ${w} 条提醒` : ''}`;
  return `${w} 条提醒`;
}

function dateOf(fm: Record<string, unknown> | undefined) {
  const t = fm?.date ? new Date(String(fm.date)).valueOf() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function resolveDots(path: string) {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '..') out.pop();
    else if (seg && seg !== '.') out.push(seg);
  }
  return out.join('/');
}
