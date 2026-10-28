import { requestUrl } from 'obsidian';

export type DeployState =
  | { kind: 'waiting' }
  | { kind: 'running'; url: string }
  | { kind: 'success'; url: string }
  | { kind: 'failure'; url: string };

interface Run {
  html_url: string;
  status: string;
  conclusion: string | null;
  name: string;
}

// Public repo: the unauthenticated Actions API is enough (60 requests/hour).
export async function deployRun(repo: string, sha: string): Promise<DeployState> {
  const res = await requestUrl({
    url: `https://api.github.com/repos/${repo}/actions/runs?head_sha=${sha}&per_page=10`,
    headers: { Accept: 'application/vnd.github+json' },
    throw: false,
  });
  if (res.status !== 200) return { kind: 'waiting' };
  const runs = (res.json?.workflow_runs ?? []) as Run[];
  const run = runs.find((r) => r.name === 'Deploy to GitHub Pages');
  if (!run) return { kind: 'waiting' };
  if (run.status !== 'completed') return { kind: 'running', url: run.html_url };
  return run.conclusion === 'success'
    ? { kind: 'success', url: run.html_url }
    : { kind: 'failure', url: run.html_url };
}

/** Polls until the deploy for `sha` finishes or ~6 minutes pass. */
export async function watchDeploy(
  repo: string,
  sha: string,
  onState: (s: DeployState) => void,
  signal: { cancelled: boolean },
): Promise<DeployState> {
  let state: DeployState = { kind: 'waiting' };
  onState(state);
  for (let i = 0; i < 45 && !signal.cancelled; i++) {
    await sleep(i < 3 ? 5000 : 8000);
    try {
      state = await deployRun(repo, sha);
    } catch {
      continue;
    }
    onState(state);
    if (state.kind === 'success' || state.kind === 'failure') return state;
  }
  return state;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
