/**
 * Article draft scaffolding.
 *
 *   pnpm article:new --title "Headline here" --category UPDATE
 *   pnpm article:from-issue 42
 *   pnpm article:from-post https://x.com/DDR_573/status/…  [--category CHARTS]
 *
 * The output is a draft, never a publication: `status: draft` keeps it off the
 * site until an editor changes it and merges the pull request. The point of
 * this script is to remove the friction between "this issue is worth writing
 * up" and "there is a file open in my editor" — not to write the article.
 */
import { writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { CATEGORIES, type Category } from '../lib/content/categories';
import { SECTION_HEADINGS, SECTION_KEYS } from '../lib/content/schema';
import { slugify, toDateStamp } from '../lib/format';
import { clientFromEnv } from '../lib/github/client';
import { parseCollectorId } from '../lib/news/issue';
import { fetchXPost, X_POST_URL, type XPost } from '../lib/news/oembed';

interface DraftInput {
  title: string;
  category: Category;
  slug?: string;
  summary?: string;
  dek?: string;
  sourceUrl?: string;
  sourcePublisher?: string;
  sourceTitle?: string;
  collectorId?: string;
  issueNumber?: number;
  /** The post the article starts from, when it starts from one. */
  post?: XPost;
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function yamlString(value: string): string {
  // Single-quoted YAML: only the quote character needs escaping.
  return `'${value.replace(/'/g, "''")}'`;
}

function renderDraft(input: DraftInput): { filename: string; contents: string } {
  const now = new Date();
  const publishedAt = now.toISOString();
  const slug = input.slug ?? slugify(input.title);
  const stamp = toDateStamp(publishedAt);

  const sources = input.post
    ? `sources:
  - title: ${yamlString(input.post.text.split('\n')[0] ?? input.title)}
    publisher: ${yamlString(`${input.post.author} (@${input.post.handle})`)}
    url: ${input.post.url}${input.post.date ? `\n    publishedAt: '${input.post.date}'` : ''}
    type: ${input.post.handle.toUpperCase() === 'DDR_573' ? 'official' : 'social'}`
    : input.sourceUrl
    ? `sources:
  - title: ${yamlString(input.sourceTitle ?? input.title)}
    publisher: ${yamlString(input.sourcePublisher ?? 'TODO: publisher')}
    url: ${input.sourceUrl}
    type: official`
    : `sources:
  # A published report MUST cite at least one source, and the NEWS section must
  # reference it with a [^1] marker. "pnpm content:validate" enforces both.
  - title: 'TODO: source headline'
    publisher: 'TODO: publisher'
    url: https://example.com/TODO
    type: official`;

  const body = SECTION_KEYS.map((key) => {
    const heading = `## ${SECTION_HEADINGS[key]}`;
    switch (key) {
      case 'news':
        return input.post
          ? `${heading}

${input.post.author}（@${input.post.handle}）は${input.post.date ? `${Number(input.post.date.slice(5, 7))}月${Number(input.post.date.slice(8, 10))}日` : 'TODO: 日付'}、次のように投稿した。[^1]

${input.post.text
  .split('\n')
  .map((line) => `> ${line}`)
  .join('\n')}

TODO: 投稿の事実を地の文に書き直す。投稿に無いことは書かない。`
          : `${heading}

TODO: what happened, in reported fact. Cite the source with a marker like this.[^1]`;
      case 'context':
        return `${heading}

TODO: why this is notable. This section is STEPWIRE analysis, not reporting.`;
      case 'playerImpact':
        return `${heading}

TODO: what actually changes for someone who plays.`;
    }
  }).join('\n\n');

  const contents = `---
id: ${stamp.replace(/-/g, '')}-${slug.slice(0, 24).replace(/-+$/, '')}
slug: ${slug}
title: ${yamlString(input.title)}
${input.dek ? `dek: ${yamlString(input.dek)}\n` : ''}publishedAt: '${publishedAt}'
category: ${input.category}
tags: []
importance: normal
summary: ${yamlString(input.summary ?? 'TODO: one factual sentence.')}
status: draft
${input.collectorId ? `collectorId: ${input.collectorId}\n` : ''}${input.issueNumber ? `sourceIssue: ${input.issueNumber}\n` : ''}${sources}
${
  input.post
    ? `# The post's picture is not fetched. Save it under public/images/ and
# declare it here with its credit, or delete this block.
# media:
#   - src: images/articles/${stamp}-${slug.slice(0, 24).replace(/-+$/, '')}/post.jpg
#     alt: 'TODO'
#     kind: post
#     credit: '@${input.post.handle} の投稿より'
`
    : ''
}---

${body}
`;

  return { filename: `${stamp}-${slug}.mdx`, contents };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Pulls the fields the collector wrote into an issue body back out again. */
export function parseIssueBody(body: string): Partial<DraftInput> {
  const section = (name: string): string | undefined => {
    const match = new RegExp(`^## ${name}\\s*\\n+([\\s\\S]*?)(?=\\n## |$)`, 'm').exec(body);
    return match?.[1]?.trim();
  };

  const headline = section('Headline');
  const canonical = section('Canonical URL')?.split('\n')[0]?.trim();
  const sourceLine = section('Source');
  const publisher = sourceLine ? /\*\*(.+?)\*\*/.exec(sourceLine)?.[1] : undefined;
  const summary = section('Summary')
    ?.split('\n')
    .map((line) => line.replace(/^>\s?/, ''))
    .join(' ')
    .trim();

  return {
    ...(headline ? { title: headline } : {}),
    ...(canonical?.startsWith('http') ? { sourceUrl: canonical } : {}),
    ...(publisher ? { sourcePublisher: publisher } : {}),
    ...(summary && !summary.startsWith('_') ? { summary } : {}),
    ...(parseCollectorId(body) ? { collectorId: parseCollectorId(body)! } : {}),
  };
}

function categoryFromLabels(labels: { name: string }[]): Category | undefined {
  for (const label of labels) {
    const match = /^category:(.+)$/.exec(label.name);
    const candidate = match?.[1]?.toUpperCase();
    if (candidate && (CATEGORIES as readonly string[]).includes(candidate)) {
      return candidate as Category;
    }
  }
  return undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const fromIssueIndex = argv.indexOf('--from-issue');
  const issueNumber = Number(
    fromIssueIndex !== -1 ? argv[fromIssueIndex + 1] : (flag(argv, 'issue') ?? NaN),
  );

  let input: DraftInput;

  const fromPostIndex = argv.indexOf('--from-post');
  const postUrl = fromPostIndex !== -1 ? argv[fromPostIndex + 1] : undefined;

  if (postUrl) {
    if (!X_POST_URL.test(postUrl)) {
      console.error(`error: not a post URL: ${postUrl}\n`);
      process.exit(1);
    }
    const post = await fetchXPost(postUrl);
    const category = (flag(argv, 'category')?.toUpperCase() ?? 'NEWS') as Category;
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      console.error(`error: unknown category "${category}". One of: ${CATEGORIES.join(', ')}\n`);
      process.exit(1);
    }
    // The first line of the post is a headline more often than not; it is a
    // placeholder either way, and the file name comes from the slug.
    const firstLine = post.text.split('\n')[0]?.replace(/[【】]/g, '').trim();
    input = {
      title: flag(argv, 'title') ?? (firstLine || `${post.author}の投稿`),
      category,
      ...(flag(argv, 'slug') ? { slug: flag(argv, 'slug')! } : { slug: `${post.handle.toLowerCase()}-${post.id}` }),
      summary: post.text.replace(/\s+/g, ' ').slice(0, 300),
      post,
    };
    console.log(`drafting from @${post.handle}: ${post.text.split('\n')[0]}`);
  } else if (!Number.isNaN(issueNumber) && issueNumber > 0) {
    const github = clientFromEnv();
    if (!github) {
      console.error(
        'error: reading an issue requires GITHUB_TOKEN and GITHUB_REPOSITORY.\n' +
          '       export GITHUB_REPOSITORY=owner/repo and a token with repo scope.\n',
      );
      process.exit(1);
    }

    const issue = await github.getIssue(issueNumber);
    const parsed = parseIssueBody(issue.body ?? '');

    input = {
      title: parsed.title ?? issue.title.replace(/^\[inbox\]\s*/, ''),
      category:
        (flag(argv, 'category')?.toUpperCase() as Category | undefined) ??
        categoryFromLabels(issue.labels) ??
        'NEWS',
      ...parsed,
      issueNumber,
    };
    console.log(`drafting from issue #${issueNumber}: ${issue.title}`);
  } else {
    const title = flag(argv, 'title');
    if (!title) {
      console.error(
        'usage:\n' +
          '  pnpm article:new --title "Headline" [--category UPDATE] [--slug custom-slug]\n' +
          '  pnpm article:from-issue <issue-number>\n' +
          '  pnpm article:from-post <x.com/…/status/…> [--category CHARTS] [--title "…"]\n',
      );
      process.exit(1);
    }
    const category = (flag(argv, 'category')?.toUpperCase() ?? 'NEWS') as Category;
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      console.error(`error: unknown category "${category}". One of: ${CATEGORIES.join(', ')}\n`);
      process.exit(1);
    }
    input = {
      title,
      category,
      ...(flag(argv, 'slug') ? { slug: flag(argv, 'slug')! } : {}),
      ...(flag(argv, 'summary') ? { summary: flag(argv, 'summary')! } : {}),
    };
  }

  const { filename, contents } = renderDraft(input);
  const target = path.join(process.cwd(), 'content', 'articles', filename);

  if (await exists(target)) {
    console.error(`error: ${path.relative(process.cwd(), target)} already exists.\n`);
    process.exit(1);
  }

  await writeFile(target, contents, 'utf8');

  console.log(`
  created  content/articles/${filename}

  next:
    1. fill in the TODOs and set every source
    2. pnpm content:validate
    3. change status to "published"
    4. open a pull request${input.issueNumber ? ` (closes #${input.issueNumber})` : ''}
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
