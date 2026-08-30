import type { Metadata } from 'next';
import Link from 'next/link';
import { clientFromEnv } from '@/lib/github/client';
import { LABELS } from '@/lib/news/issue';
import { toInboxItem, type InboxItem } from '@/lib/news/inbox';
import { WireBoard } from '@/components/studio/WireBoard';
import { SectionHeading } from '@/components/SectionHeading';

/**
 * `/studio/wire` — the editorial inbox, visualised.
 *
 * The collector's only output is a GitHub issue, and that stays true: this page
 * reads them and writes nothing. It exists because the step before writing is
 * *looking at what came in*, and a GitHub issue list is a list of titles —
 * fine for triage, useless for noticing that three sources reported the same
 * thing on the same day.
 *
 * Rendered per request rather than at build time: the inbox changes hourly,
 * a deploy does not, and a wire board baked at build time would be a lie.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ワイヤー受信箱',
  description: '収集されたDDR関連ニュースの候補。',
  robots: { index: false, follow: false },
};

type BoardState =
  | { kind: 'unconfigured' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: InboxItem[] };

async function loadInbox(): Promise<BoardState> {
  const github = clientFromEnv();
  if (!github) return { kind: 'unconfigured' };

  try {
    const issues = await github.listIssuesByLabel(LABELS.inbox, { state: 'open', pages: 2 });
    return { kind: 'ready', items: issues.map(toInboxItem) };
  } catch (error) {
    // A failed inbox load is an operational problem, not a 500: the studio is
    // still usable, and the operator needs to see *why* it failed.
    return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

export default async function WirePage() {
  const state = await loadInbox();

  return (
    <div className="mx-auto max-w-[1180px] px-md py-xl">
      <header className="border-b-4 border-ink pb-lg">
        <p className="font-mono text-micro uppercase tracking-wider text-gray700">
          STEPWIRE STUDIO
        </p>
        <h1 className="mt-sm font-display text-h2 font-black leading-headline tracking-headline">
          ワイヤー受信箱
          <span className="mt-xs block font-mono text-micro font-normal tracking-wider text-gray700 sm:ml-md sm:mt-0 sm:inline">
            NEWS INBOX
          </span>
        </h1>
        <p className="mt-md max-w-[62ch] font-body text-base leading-snug text-gray700">
          収集された候補で、まだ判断されていないものです。ここからは何も公開されません。
          記事にするなら <code className="font-mono text-small">pnpm article:from-issue</code>、
          見送るならIssueを閉じてください。
        </p>
        <nav className="mt-lg flex flex-wrap gap-md font-mono text-micro uppercase tracking-wider">
          <Link href="/studio" className="border-2 border-ink px-md py-sm hover:bg-ink hover:text-paper">
            動画スタジオ →
          </Link>
          <Link href="/" className="px-md py-sm text-gray700 hover:text-signal">
            サイトへ戻る
          </Link>
        </nav>
      </header>

      <div className="pt-2xl">
        {state.kind === 'unconfigured' ? <Unconfigured /> : null}
        {state.kind === 'error' ? <LoadError message={state.message} /> : null}
        {state.kind === 'ready' && state.items.length === 0 ? <EmptyInbox /> : null}
        {state.kind === 'ready' && state.items.length > 0 ? (
          <WireBoard items={state.items} />
        ) : null}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-2 border-ink bg-paper p-lg">
      <SectionHeading label={title} as="h2" />
      <div className="mt-md space-y-md font-body text-base leading-snug text-gray700">
        {children}
      </div>
    </section>
  );
}

function Command({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto border border-gray300 bg-off-white px-md py-sm font-mono text-small text-ink">
      {children}
    </pre>
  );
}

function Unconfigured() {
  return (
    <Panel title="GITHUBに接続されていません">
      <p>
        受信箱はGitHub Issuesそのものです。このページがそれを読むには、
        <code className="font-mono text-small"> GITHUB_TOKEN </code>と
        <code className="font-mono text-small"> GITHUB_REPOSITORY </code>
        が必要です。どちらもSecretとして設定し、リポジトリにはコミットしないでください。
      </p>
      <Command>{'GITHUB_REPOSITORY=owner/stepwire\nGITHUB_TOKEN=…'}</Command>
      <p>
        設定がなくても収集そのものは動きます。ネットワークもIssueも使わない試し読みは次のとおりです。
      </p>
      <Command>pnpm news:collect --dry-run</Command>
    </Panel>
  );
}

function EmptyInbox() {
  return (
    <Panel title="受信箱は空です">
      <p>未処理の候補はありません。収集を走らせるか、フィードが新しい記事を出すのを待ってください。</p>
      <Command>{'pnpm news:collect --dry-run        # 何も作らずに確認\npnpm news:collect --create-issues  # 受信箱に入れる'}</Command>
    </Panel>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <Panel title="受信箱を読み込めませんでした">
      <p>GitHubへの問い合わせが失敗しました。トークンの権限と期限を確認してください。</p>
      {/* The message is GitHub's, and it names the endpoint and status — the
          two things needed to tell a bad token from a missing label. */}
      <Command>{message}</Command>
    </Panel>
  );
}
