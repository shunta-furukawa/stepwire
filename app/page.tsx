import Link from 'next/link';
import { getArticles } from '@/lib/content/loader';
import { CATEGORY_META, CATEGORIES, SECTIONS } from '@/lib/content/categories';
import { LeadStory, StoryList } from '@/components/StoryCard';
import { Ticker } from '@/components/Ticker';
import { SectionHeading } from '@/components/SectionHeading';
import { CategoryChip } from '@/components/CategoryChip';
import { site } from '@/lib/site';

/**
 * The front page.
 *
 * Fully static: article data comes off the filesystem at build time, so the
 * page ships as HTML with no client JavaScript beyond Next's router.
 */
export default async function HomePage() {
  const articles = await getArticles();
  const [lead, ...rest] = articles;
  const latest = rest.slice(0, 8);
  const activeCategories = CATEGORIES.filter((category) =>
    articles.some((article) => article.category === category),
  );

  return (
    <>
      <Ticker articles={articles.slice(0, 6)} />

      <div className="mx-auto max-w-[1180px] px-md">
        {lead ? (
          <section aria-labelledby="lead-heading" className="pt-xl">
            <h1 id="lead-heading" className="sr-only">
              {site.name} — {site.tagline}
            </h1>
            <LeadStory article={lead} />
          </section>
        ) : (
          <section className="py-3xl">
            <h1 className="font-display text-h1 font-black tracking-display">
              Nothing on the wire yet.
            </h1>
            <p className="mt-md max-w-[52ch] font-body text-lead text-gray700">
              Add an article to <code className="font-mono">content/articles/</code> and it will
              appear here.
            </p>
          </section>
        )}

        <div className="grid gap-2xl pt-2xl lg:grid-cols-[1fr_320px]">
          <section aria-labelledby="latest-heading">
            <SectionHeading
              id="latest-heading"
              label="Latest"
              description="Everything filed, newest first"
            />
            <StoryList articles={latest} showDek />
            {articles.length > 9 ? (
              <Link
                href="/news"
                className="mt-lg inline-block border-2 border-ink px-lg py-sm font-mono text-micro font-bold uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
              >
                All news →
              </Link>
            ) : null}
          </section>

          <aside className="space-y-2xl">
            <section aria-labelledby="desks-heading">
              <SectionHeading id="desks-heading" label="Desks" as="h2" />
              <ul className="mt-md space-y-md">
                {SECTIONS.map((section) => (
                  <li key={section.slug}>
                    <Link
                      href={`/${section.slug}`}
                      className="group block border-b border-gray300 pb-md"
                    >
                      <span className="font-display text-h4 font-bold uppercase tracking-tight transition-colors group-hover:text-signal">
                        {section.label}
                      </span>
                      <span className="mt-[2px] block font-mono text-micro uppercase tracking-wide text-gray700">
                        {section.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {activeCategories.length > 0 ? (
              <section aria-labelledby="categories-heading">
                <SectionHeading id="categories-heading" label="Categories" as="h2" />
                <ul className="mt-md flex flex-wrap gap-sm">
                  {activeCategories.map((category) => (
                    <li key={category}>
                      <CategoryChip category={category} />
                    </li>
                  ))}
                </ul>
                <p className="mt-md font-body text-small leading-snug text-gray700">
                  {CATEGORY_META[activeCategories[0]!].blurb}
                </p>
              </section>
            ) : null}

            <section aria-labelledby="wire-heading" className="border-2 border-ink p-lg">
              <SectionHeading id="wire-heading" label="How STEPWIRE reads" as="h2" />
              <ol className="mt-md space-y-md font-mono text-micro uppercase tracking-wide">
                <li>
                  <span className="text-signal">01</span> News — what happened, sourced.
                </li>
                <li>
                  <span className="text-signal">02</span> Context — why it is notable.
                </li>
                <li>
                  <span className="text-signal">03</span> Player impact — what changes for you.
                </li>
              </ol>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
