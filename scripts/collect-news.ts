/**
 * News collector CLI.
 *
 *   pnpm news:collect --dry-run          # fixtures only, no network, no issues
 *   pnpm news:collect                    # collect and print candidates
 *   pnpm news:collect --create-issues    # collect and open GitHub issues
 *   pnpm news:collect --source fixture-official --limit 5
 *
 * Nothing is ever published automatically. The collector's only output is a
 * GitHub issue in the editorial inbox for a human to accept or ignore.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadSources } from '../lib/news/sources';
import { collectNews } from '../lib/news/collect';
import {
  buildSeenIndex,
  emptyLedger,
  pruneLedger,
  type Ledger,
  type LedgerEntry,
} from '../lib/news/dedupe';
import {
  LABEL_DEFINITIONS,
  issueBody,
  issueTitle,
  labelsFor,
  parseCollectorId,
} from '../lib/news/issue';
import { clientFromEnv } from '../lib/github/client';
import type { CandidateNews } from '../lib/news/types';

const LEDGER_PATH = path.join(process.cwd(), 'data', 'news-ledger.json');

interface Args {
  dryRun: boolean;
  createIssues: boolean;
  only?: string[];
  limit: number;
  maxAgeDays: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: argv.includes('--dry-run'),
    createIssues: argv.includes('--create-issues'),
    limit: 10,
    maxAgeDays: 14,
  };

  const only = argv.indexOf('--source');
  if (only !== -1 && argv[only + 1]) args.only = argv[only + 1]!.split(',');

  const limit = argv.indexOf('--limit');
  if (limit !== -1 && argv[limit + 1]) args.limit = Number(argv[limit + 1]);

  const maxAge = argv.indexOf('--max-age-days');
  if (maxAge !== -1 && argv[maxAge + 1]) args.maxAgeDays = Number(argv[maxAge + 1]);

  return args;
}

async function readLedger(): Promise<Ledger> {
  try {
    return JSON.parse(await readFile(LEDGER_PATH, 'utf8')) as Ledger;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyLedger();
    throw error;
  }
}

async function writeLedger(ledger: Ledger): Promise<void> {
  await mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await writeFile(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

function describe(candidate: CandidateNews, index: number): string {
  return [
    `  ${String(index + 1).padStart(2, '0')}. ${candidate.title}`,
    `      ${candidate.url}`,
    `      source=${candidate.sourceId} category=${candidate.suggestedCategory} id=${candidate.collectorId}`,
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sources = await loadSources();

  const ledger = pruneLedger(await readLedger());
  const seenEntries: LedgerEntry[] = [...ledger.entries];

  const github = args.dryRun ? undefined : clientFromEnv();

  // Rebuild the seen set from GitHub as well as from the committed ledger, so
  // deduplication survives a lost ledger or a run that failed part-way through.
  if (github) {
    try {
      const issues = await github.listIssuesByLabel('news-inbox');
      for (const issue of issues) {
        const collectorId = parseCollectorId(issue.body ?? '');
        if (!collectorId) continue;
        seenEntries.push({
          collectorId,
          normalizedUrl: '',
          title: issue.title.replace(/^\[inbox\]\s*/, ''),
          sourceId: 'github',
          collectedAt: new Date().toISOString(),
          issueNumber: issue.number,
        });
      }
      console.log(`ledger: ${ledger.entries.length} entries + ${issues.length} existing issue(s)`);
    } catch (error) {
      console.warn(`warning: could not read existing issues — ${(error as Error).message}`);
    }
  }

  const result = await collectNews({
    sources,
    seen: buildSeenIndex(seenEntries),
    ...(args.only ? { only: args.only } : {}),
    limit: args.limit,
    maxAgeDays: args.maxAgeDays,
    onLog: (message) => console.log(`  ${message}`),
  });

  console.log('');
  console.log(`sources:    ${sources.length} registered, ${result.skipped.length} disabled`);
  console.log(`candidates: ${result.candidates.length} new`);
  console.log(`duplicates: ${result.duplicates.length} suppressed`);
  console.log(`errors:     ${result.errors.length}`);
  console.log('');

  for (const error of result.errors) {
    console.warn(`  ! ${error.sourceId}: ${error.message}`);
  }

  if (result.candidates.length === 0) {
    console.log('nothing new on the wire.\n');
    return;
  }

  console.log('new candidates:');
  result.candidates.forEach((candidate, index) => console.log(describe(candidate, index)));
  console.log('');

  if (!args.createIssues) {
    console.log('(no issues created — pass --create-issues to file them)\n');
    return;
  }

  if (!github) {
    console.error(
      'error: --create-issues requires GITHUB_TOKEN and GITHUB_REPOSITORY in the environment.\n',
    );
    process.exit(1);
  }

  for (const definition of LABEL_DEFINITIONS) {
    await github.ensureLabel({ ...definition });
  }

  const created: LedgerEntry[] = [];
  for (const candidate of result.candidates) {
    try {
      const issue = await github.createIssue({
        title: issueTitle(candidate),
        body: issueBody(candidate),
        labels: labelsFor(candidate),
      });
      console.log(`  created #${issue.number} — ${issue.html_url}`);
      created.push({
        collectorId: candidate.collectorId,
        normalizedUrl: candidate.normalizedUrl,
        title: candidate.title,
        sourceId: candidate.sourceId,
        collectedAt: candidate.collectedAt,
        issueNumber: issue.number,
      });
    } catch (error) {
      // A failure here is recoverable: the candidate is simply not recorded in
      // the ledger, so the next run will try it again.
      console.error(`  ! failed to create issue for ${candidate.collectorId}: ${(error as Error).message}`);
    }
  }

  await writeLedger(pruneLedger({ version: 1, entries: [...ledger.entries, ...created] }));
  console.log(`\nledger updated with ${created.length} entry/entries.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
