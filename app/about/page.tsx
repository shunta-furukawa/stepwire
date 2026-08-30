import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { SectionHeading } from '@/components/SectionHeading';
import { Wordmark } from '@/components/Wordmark';

export const metadata: Metadata = {
  title: 'STEPWIREについて',
  description: site.description,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1180px] px-md py-xl">
      <header className="border-b-4 border-accent pb-lg">
        <Wordmark variant="stacked" className="text-h1 sm:text-display" />
        <p className="mt-lg font-mono text-micro font-bold uppercase tracking-wider text-muted">
          {site.tagline}
        </p>
      </header>

      <div className="grid gap-2xl pt-2xl lg:grid-cols-[1fr_320px]">
        <div className="space-y-2xl">
          <section aria-labelledby="what-heading">
            <SectionHeading id="what-heading" label="STEPWIREとは" />
            <div className="mt-lg max-w-[62ch] space-y-lg font-body text-lead leading-normal">
              <p>
                STEPWIREは、DanceDanceRevolutionを扱う独立系のニュース／カルチャーメディアです。
                運営は{site.operator}。ゲームの更新、新曲と新譜面、イベント、大会、譜面データ、
                そして筐体のまわりにいる人たちを扱います。
              </p>
              <p>
                同時に<strong>アーカイブ</strong>でもあります。シーンは自分の歴史をすぐに失います。
                告知は移転し、掲示板は閉じ、去年みんなが知っていたことが検証できなくなる。
                だからここでは、すべての記事が出典を持ち、URLが永続します。
                <strong>出典そのものが消えても、記録が残るように。</strong>
              </p>
            </div>
          </section>

          <section aria-labelledby="format-heading">
            <SectionHeading id="format-heading" label="記事のかたち" />
            <div className="mt-lg max-w-[62ch] space-y-lg font-body text-lead leading-normal">
              <p>すべての記事は、必ず同じ順序の3つの部分で書かれます。</p>
              <ol className="space-y-lg">
                <li>
                  <span className="block font-display text-h4 font-bold tracking-tight">
                    ニュース
                    <span className="ml-sm font-mono text-micro font-normal tracking-wider text-muted">
                      NEWS
                    </span>
                  </span>
                  何が起きたか。報道された事実であり、必ず出典を引用します。
                </li>
                <li>
                  <span className="block font-display text-h4 font-bold tracking-tight">
                    コンテクスト
                    <span className="ml-sm font-mono text-micro font-normal tracking-wider text-muted">
                      CONTEXT
                    </span>
                  </span>
                  なぜ注目なのか。ここはSTEPWIREの分析であり、そう明記されます。
                </li>
                <li>
                  <span className="block font-display text-h4 font-bold tracking-tight">
                    プレイヤーへの影響
                    <span className="ml-sm font-mono text-micro font-normal tracking-wider text-muted">
                      PLAYER IMPACT
                    </span>
                  </span>
                  実際にプレイする人にとって何が変わるか。これも分析です。
                </li>
              </ol>
              <p>
                この区別は慣習ではなく、コンテンツスキーマが強制しています。
                <strong>ニュースの節が出典を引用していない記事は、ビルドが通りません。</strong>
              </p>
            </div>
          </section>

          <section aria-labelledby="ai-heading">
            <SectionHeading id="ai-heading" label="出典とAIについて" />
            <div className="mt-lg max-w-[62ch] space-y-lg font-body text-lead leading-normal">
              <p>
                候補の収集や下書きに自動化された道具を使うことはあります。しかし
                <strong>それらは出典ではありません</strong>。出典とは、一次発表、報じられた記事、
                コミュニティの記録、データセット —— 読者が自分で確かめにいけるもののことです。
              </p>
            </div>
          </section>
        </div>

        <aside className="space-y-lg">
          <section className="border-2 border-line-strong p-lg" aria-labelledby="masthead-heading">
            <SectionHeading id="masthead-heading" label="MASTHEAD" as="h2" />
            <dl className="mt-md space-y-md font-mono text-micro uppercase tracking-wide">
              <div>
                <dt className="text-muted">運営</dt>
                <dd>{site.operator}</dd>
              </div>
              <div>
                <dt className="text-muted">フィード</dt>
                <dd>
                  <a href="/feed.xml" className="underline underline-offset-4 hover:text-accent">
                    /feed.xml
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <p className="font-body text-small leading-snug text-muted">
            STEPWIREは独立した媒体です。KONAMIとは無関係で、提携も承認も受けていません。
            各商標はそれぞれの権利者に帰属します。
          </p>
        </aside>
      </div>
    </div>
  );
}
