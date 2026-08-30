/**
 * A very small GitHub REST client.
 *
 * Octokit would be a large dependency for the four calls this project makes.
 * `fetch` is built in, the endpoints used here are stable, and keeping the
 * surface tiny makes it obvious exactly what the automation can do.
 */

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  labels: { name: string }[];
  /** Present only on pull requests, which this API returns alongside issues. */
  pull_request?: unknown;
}

export interface GitHubClientOptions {
  token: string;
  /** `owner/repo` — GitHub Actions provides this as `GITHUB_REPOSITORY`. */
  repository: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export class GitHubClient {
  private readonly token: string;
  private readonly repository: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GitHubClientOptions) {
    if (!options.token) throw new Error('a GitHub token is required');
    if (!/^[^/]+\/[^/]+$/.test(options.repository)) {
      throw new Error(`repository must be "owner/repo", received "${options.repository}"`);
    }
    this.token = options.token;
    this.repository = options.repository;
    this.baseUrl = options.baseUrl ?? 'https://api.github.com';
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${this.token}`,
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        ...init?.headers,
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new GitHubError(
        `GitHub ${init?.method ?? 'GET'} ${path} failed: ${response.status} ${response.statusText}`,
        response.status,
        text,
      );
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async createIssue(input: {
    title: string;
    body: string;
    labels?: string[];
  }): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${this.repository}/issues`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getIssue(number: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${this.repository}/issues/${number}`);
  }

  /**
   * Issues carrying a given label, newest first.
   *
   * The collector calls this with the default `state: 'all'` to rebuild its
   * "already collected" set from GitHub itself, so deduplication still works if
   * the committed ledger is lost or a run failed before writing it. The wire
   * board calls it with `state: 'open'` — a closed issue is a decision already
   * made, and the board is only about what is still undecided.
   */
  async listIssuesByLabel(
    label: string,
    options: { perPage?: number; pages?: number; state?: 'open' | 'closed' | 'all' } = {},
  ): Promise<GitHubIssue[]> {
    const { perPage = 100, pages = 3, state = 'all' } = options;
    const all: GitHubIssue[] = [];
    for (let page = 1; page <= pages; page += 1) {
      const batch = await this.request<GitHubIssue[]>(
        `/repos/${this.repository}/issues?labels=${encodeURIComponent(label)}&state=${state}&per_page=${perPage}&page=${page}`,
      );
      // The issues endpoint also returns pull requests; a PR is never inbox.
      all.push(...batch.filter((issue) => issue.pull_request === undefined));
      if (batch.length < perPage) break;
    }
    return all;
  }

  /**
   * Creates a label, ignoring the "already exists" response.
   *
   * Labels are declared in code (`LABEL_DEFINITIONS`) so a fresh clone of this
   * repository gets a working editorial inbox without any manual setup.
   */
  async ensureLabel(input: {
    name: string;
    color: string;
    description?: string;
  }): Promise<void> {
    try {
      await this.request(`/repos/${this.repository}/labels`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    } catch (error) {
      if (error instanceof GitHubError && error.status === 422) return;
      throw error;
    }
  }
}

/** Builds a client from the environment Actions provides. Returns undefined if unconfigured. */
export function clientFromEnv(
  env: Record<string, string | undefined> = process.env,
): GitHubClient | undefined {
  const token = env.GITHUB_TOKEN;
  const repository = env.GITHUB_REPOSITORY;
  if (!token || !repository) return undefined;
  // Actions sets `GITHUB_API_URL`, and it is not always api.github.com —
  // GitHub Enterprise serves a different host. Honouring it also makes the
  // client pointable at a local stub when developing against the inbox.
  const baseUrl = env.GITHUB_API_URL;
  return new GitHubClient({ token, repository, ...(baseUrl ? { baseUrl } : {}) });
}
