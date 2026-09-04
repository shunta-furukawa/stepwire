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
                STEPWIREは、{site.operator}のDanceDanceRevolutionセッションブログです。
                新曲の解禁、アップデート、大会といったシーンの動きを書き留め、その日に自分が
                何を踏んで、どうだったかを記録します。書いているのは一人のプレイヤーで、
                報道機関ではありません。
              </p>
              <p>
                ただし<strong>記録の取り方</strong>には決まりがあります。シーンは自分の歴史を
                すぐに失います。告知は移転し、掲示板は閉じ、去年みんなが知っていたことが
                検証できなくなる。だからここでは、外の出来事を書くときは必ず出典を引き、
                URLは永続します。<strong>出典そのものが消えても、記録が残るように。</strong>
              </p>
            </div>
          </section>

          <section aria-labelledby="format-heading">
            <SectionHeading id="format-heading" label="記事のかたち" />
            <div className="mt-lg max-w-[62ch] space-y-lg font-body text-lead leading-normal">
              <p>すべての記事は、同じ順序の3つの部分で書かれます。外の出来事と、私の話を混ぜないためです。</p>
              <ol className="space-y-lg">
                <li>
                  <span className="block font-display text-h4 font-bold tracking-tight">
                    ニュース
                    <span className="ml-sm font-mono text-micro font-normal tracking-wider text-muted">
                      NEWS
                    </span>
                  </span>
                  何が起きたか。解禁、アップデート、大会の結果。必ず出典を引きます。
                </li>
                <li>
                  <span className="block font-display text-h4 font-bold tracking-tight">
                    セッション
                    <span className="ml-sm font-mono text-micro font-normal tracking-wider text-muted">
                      SESSION / CONTEXT
                    </span>
                  </span>
                  その日、何を踏んでどうだったか。セッション記事ではプレー履歴を図にして載せます。
                  ここは私の言葉であり、そう明記されます。
                </li>
                <li>
                  <span className="block font-display text-h4 font-bold tracking-tight">
                    ピックアップ
                    <span className="ml-sm font-mono text-micro font-normal tracking-wider text-muted">
                      PICKUP / PLAYER IMPACT
                    </span>
                  </span>
                  記録に残したいプレイ。リザルトの写真と、その譜面の話。これも私の言葉です。
                </li>
              </ol>
              <p>
                この区別は慣習ではなく、コンテンツスキーマが強制しています。
                <strong>ニュースの節が出典を引いていない記事は、ビルドが通りません。</strong>
              </p>
            </div>
          </section>

          <section aria-labelledby="ai-heading">
            <SectionHeading id="ai-heading" label="出典とAIについて" />
            <div className="mt-lg max-w-[62ch] space-y-lg font-body text-lead leading-normal">
              <p>
                記事の下書きや整形にAIを使うことがあります。しかし
                <strong>感想はAIが作りません</strong>。セッションとピックアップに書かれていることは、
                本人が言ったことだけです。
              </p>
              <p>
                そして<strong>AIの出力は出典ではありません</strong>。出典とは、公式の発表、
                自分のプレー履歴とリザルト、コミュニティの記録、データセット ——
                読者が自分で確かめにいけるもののことです。
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
            STEPWIREは個人のブログです。KONAMIとは無関係で、提携も承認も受けていません。
            各商標はそれぞれの権利者に帰属します。
          </p>
        </aside>
      </div>
    </div>
  );
}
