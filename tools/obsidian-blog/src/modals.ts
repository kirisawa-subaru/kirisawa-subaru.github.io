import { App, Modal, Setting } from 'obsidian';
import type { Issue } from './preflight';

export interface NewPostInput {
  title: string;
  slug: string;
  tags: string[];
}

export function suggestSlug(title: string, date = new Date()): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii.length >= 3) return ascii.slice(0, 60).replace(/-+$/, '');
  const d = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `post-${d}`;
}

export class NewPostModal extends Modal {
  private title = '';
  private slug = '';
  private slugTouched = false;
  private tags = '';

  constructor(
    app: App,
    private readonly onSubmit: (input: NewPostInput) => void,
  ) {
    super(app);
  }

  onOpen() {
    this.setTitle('新建文章');
    this.contentEl.addClass('kblog-modal');
    let slugInput: HTMLInputElement | null = null;

    new Setting(this.contentEl).setName('标题').addText((t) => {
      t.setPlaceholder('文章标题').onChange((v) => {
        this.title = v;
        if (!this.slugTouched && slugInput) {
          this.slug = suggestSlug(v);
          slugInput.value = this.slug;
        }
      });
      window.setTimeout(() => t.inputEl.focus(), 0);
      t.inputEl.addEventListener('keydown', (e) => e.key === 'Enter' && this.submit());
    });

    new Setting(this.contentEl)
      .setName('网址')
      .setDesc('/posts/<slug>/，小写字母、数字和连字符')
      .addText((t) => {
        slugInput = t.inputEl;
        t.setPlaceholder('eth-ladder').onChange((v) => {
          this.slug = v.trim();
          this.slugTouched = true;
        });
        t.inputEl.addEventListener('keydown', (e) => e.key === 'Enter' && this.submit());
      });

    new Setting(this.contentEl)
      .setName('标签')
      .setDesc('逗号分隔，可留空')
      .addText((t) => {
        t.setPlaceholder('rl, math').onChange((v) => (this.tags = v));
        t.inputEl.addEventListener('keydown', (e) => e.key === 'Enter' && this.submit());
      });

    new Setting(this.contentEl).addButton((b) => b.setButtonText('创建草稿').setCta().onClick(() => this.submit()));
  }

  private submit() {
    const title = this.title.trim();
    if (!title) return;
    const slug = this.slug || suggestSlug(title);
    const tags = this.tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    this.close();
    this.onSubmit({ title, slug, tags });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** Lists preflight issues. Click an issue to jump to its line. */
export class IssuesModal extends Modal {
  constructor(
    app: App,
    private readonly heading: string,
    private readonly issues: Issue[],
    private readonly jump: (line: number) => void,
    private readonly proceed?: { label: string; run: () => void },
  ) {
    super(app);
  }

  onOpen() {
    this.setTitle(this.heading);
    const { contentEl } = this;
    contentEl.addClass('kblog-modal');
    const list = contentEl.createEl('ul', { cls: 'kblog-issues' });
    for (const issue of this.issues) {
      const li = list.createEl('li', { cls: `kblog-issue is-${issue.severity}` });
      li.createSpan({ cls: 'kblog-issue-tag', text: issue.severity === 'error' ? 'Error' : 'Warn' });
      const body = li.createDiv({ cls: 'kblog-issue-body' });
      body.createDiv({ text: issue.message });
      if (issue.excerpt) body.createEl('code', { text: issue.excerpt });
      if (issue.line) {
        li.createSpan({ cls: 'kblog-issue-line', text: `L${issue.line}` });
        li.addClass('is-clickable');
        li.addEventListener('click', () => {
          this.close();
          this.jump(issue.line!);
        });
      }
    }
    const buttons = new Setting(contentEl);
    if (this.proceed) {
      const { label, run } = this.proceed;
      buttons.addButton((b) =>
        b
          .setButtonText(label)
          .setWarning()
          .onClick(() => {
            this.close();
            run();
          }),
      );
    }
    buttons.addButton((b) => b.setButtonText('回去修改').setCta().onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }
}
