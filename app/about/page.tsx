import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { SectionHeading } from '@/components/SectionHeading';
import { Wordmark } from '@/components/Wordmark';

export const metadata: Metadata = {
  title: 'About',
  description: `About ${site.name} — ${site.description}`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1180px] px-md py-xl">
      <header className="border-b-4 border-ink pb-lg">
        <Wordmark variant="stacked" className="text-h1 sm:text-display" />
        <p className="mt-lg font-mono text-micro font-bold uppercase tracking-wider text-gray700">
          {site.tagline}
        </p>
      </header>

      <div className="grid gap-2xl pt-2xl lg:grid-cols-[1fr_320px]">
        <div className="space-y-2xl">
          <section aria-labelledby="what-heading">
            <SectionHeading id="what-heading" label="What this is" />
            <div className="mt-lg max-w-[68ch] space-y-lg font-body text-lead leading-normal">
              <p>
                {site.name} is an independent news and culture wire for DanceDanceRevolution,
                operated by {site.operator}. It covers game updates, new songs and charts, events,
                tournaments, chart data, and the people around the machine.
              </p>
              <p>
                It is also an <strong>archive</strong>. Scenes lose their own history quickly:
                announcements move, forums close, and what everyone knew last year becomes
                unverifiable. Every story here keeps its sources attached and its URL stable, so
                that the record survives the sources.
              </p>
            </div>
          </section>

          <section aria-labelledby="format-heading">
            <SectionHeading id="format-heading" label="The format" />
            <div className="mt-lg max-w-[68ch] space-y-lg font-body text-lead leading-normal">
              <p>Every story is written in three parts, always in the same order.</p>
              <ol className="space-y-lg">
                <li>
                  <span className="block font-display text-h4 font-bold uppercase tracking-tight">
                    News
                  </span>
                  What happened. Reported fact, and it must cite a source.
                </li>
                <li>
                  <span className="block font-display text-h4 font-bold uppercase tracking-tight">
                    Context
                  </span>
                  Why it is notable. This is editorial analysis, and it is labelled as such.
                </li>
                <li>
                  <span className="block font-display text-h4 font-bold uppercase tracking-tight">
                    Player impact
                  </span>
                  What actually changes for someone who plays. Also editorial analysis.
                </li>
              </ol>
              <p>
                The split is enforced by the content schema, not by habit: a published report that
                does not cite a source in its News section fails the build.
              </p>
            </div>
          </section>

          <section aria-labelledby="ai-heading">
            <SectionHeading id="ai-heading" label="On sourcing and AI" />
            <div className="mt-lg max-w-[68ch] space-y-lg font-body text-lead leading-normal">
              <p>
                Automated tools may be used to gather candidate stories and to draft. They are
                never a source. A source is a first-party announcement, a published report, a
                community record or a dataset — something a reader can go and check.
              </p>
            </div>
          </section>
        </div>

        <aside className="space-y-lg">
          <section className="border-2 border-ink p-lg" aria-labelledby="masthead-heading">
            <SectionHeading id="masthead-heading" label="Masthead" as="h2" />
            <dl className="mt-md space-y-md font-mono text-micro uppercase tracking-wide">
              <div>
                <dt className="text-gray700">Operator</dt>
                <dd>{site.operator}</dd>
              </div>
              <div>
                <dt className="text-gray700">Feed</dt>
                <dd>
                  <a href="/feed.xml" className="underline underline-offset-4 hover:text-signal">
                    /feed.xml
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <p className="font-body text-small leading-snug text-gray700">
            {site.name} is not affiliated with, endorsed by, or connected to KONAMI. All trademarks
            belong to their respective owners.
          </p>
        </aside>
      </div>
    </div>
  );
}
