import { execFile } from 'child_process';

export class GitError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
  ) {
    super(message);
  }
}

// Obsidian launched from the Dock gets a minimal PATH; prefer absolute git.
const GIT_CANDIDATES = ['/usr/bin/git', '/opt/homebrew/bin/git', '/usr/local/bin/git', 'git'];

export class Git {
  private gitBin: string | null = null;

  constructor(readonly cwd: string) {}

  private async bin(): Promise<string> {
    if (this.gitBin) return this.gitBin;
    for (const candidate of GIT_CANDIDATES) {
      try {
        await this.exec(candidate, ['--version']);
        return (this.gitBin = candidate);
      } catch {
        // try next
      }
    }
    throw new GitError('找不到 git', '');
  }

  private exec(bin: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        bin,
        args,
        {
          cwd: this.cwd,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LANG: 'en_US.UTF-8' },
          timeout: 60_000,
          maxBuffer: 8 * 1024 * 1024,
        },
        (err, stdout, stderr) => {
          if (err) reject(new GitError(`git ${args[0]} 失败`, String(stderr || err.message)));
          else resolve(String(stdout));
        },
      );
    });
  }

  async run(...args: string[]): Promise<string> {
    return this.exec(await this.bin(), args);
  }

  async toplevel(): Promise<string> {
    return (await this.run('rev-parse', '--show-toplevel')).trim();
  }

  /** Paths relative to `cwd` with uncommitted changes, plus ahead/behind counts. */
  async status(): Promise<{ changed: Set<string>; ahead: number; behind: number }> {
    // Porcelain paths are relative to the repo root; strip the vault's prefix.
    const prefix = (await this.run('rev-parse', '--show-prefix')).trim();
    const out = await this.run('status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all', '--', '.');
    const changed = new Set<string>();
    let ahead = 0;
    let behind = 0;
    const records = out.split('\0');
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec) continue;
      if (rec.startsWith('## ')) {
        ahead = Number(/ahead (\d+)/.exec(rec)?.[1] ?? 0);
        behind = Number(/behind (\d+)/.exec(rec)?.[1] ?? 0);
        continue;
      }
      const xy = rec.slice(0, 2);
      const path = rec.slice(3);
      if (xy[0] === 'R' || xy[0] === 'C') i++; // next record is the source path
      changed.add(path.startsWith(prefix) ? path.slice(prefix.length) : path);
    }
    return { changed, ahead, behind };
  }

  async head(): Promise<string> {
    return (await this.run('rev-parse', 'HEAD')).trim();
  }

  /** Stage everything under `cwd`, commit if anything is staged. Returns true if committed. */
  async commitAll(message: string): Promise<boolean> {
    await this.run('add', '-A', '--', '.');
    const staged = await this.run('diff', '--cached', '--name-only');
    if (!staged.trim()) return false;
    await this.run('commit', '-m', message);
    return true;
  }

  async pull(): Promise<void> {
    await this.run('pull', '--rebase', '--autostash');
  }

  async push(): Promise<void> {
    await this.run('push', 'origin', 'HEAD');
  }
}
