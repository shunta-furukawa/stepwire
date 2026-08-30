/**
 * Content validation gate.
 *
 * Runs in CI and locally (`pnpm content:validate`). It is the guard that keeps
 * a broken or unsourced article from ever reaching the site.
 */
import { loadAllArticles } from '../lib/content/loader';
import { validateArticles } from '../lib/content/validate';

async function main() {
  let articles;
  try {
    articles = await loadAllArticles();
  } catch (error) {
    console.error(`\n  PARSE ERROR\n  ${(error as Error).message}\n`);
    process.exit(1);
  }

  const issues = validateArticles(articles);
  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');

  for (const issue of issues) {
    const prefix = issue.level === 'error' ? 'ERROR  ' : 'WARN   ';
    console.log(`${prefix} ${issue.filePath}\n         ${issue.message}`);
  }

  const summary = `${articles.length} article(s) checked — ${errors.length} error(s), ${warnings.length} warning(s)`;

  if (errors.length > 0) {
    console.error(`\n${summary}\n`);
    process.exit(1);
  }

  console.log(`\n${summary}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
