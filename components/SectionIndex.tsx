import { getArticlesByCategories } from '@/lib/content/loader';
import { getSection, type SectionSlug } from '@/lib/content/categories';
import { LeadStory, StoryList } from '@/components/StoryCard';
import { SectionHeading } from '@/components/SectionHeading';
import { CategoryChip } from '@/components/CategoryChip';
import { notFound } from 'next/navigation';

/**
 * The shared index page for every desk.
 *
 * News / Charts / Data / Culture differ only in which categories they collect,
 * so they share one implementation. Adding a desk is a change to `SECTIONS`
 * plus a four-line route file.
 */
export async function SectionIndex({ slug }: { slug: SectionSlug }) {
  const section = getSection(slug);
  if (!section) notFound();

  const articles = await getArticlesByCategories([...section.categories]);
  const [lead, ...rest] = articles;

  return (
    <div className="mx-auto max-w-[1180px] px-md py-xl">
      <header className="border-b-4 border-ink pb-lg">
        <p className="font-mono text-micro font-bold uppercase tracking-wider text-signal">
          Desk
        </p>
        <h1 className="mt-sm font-display text-h2 font-black uppercase leading-display tracking-display sm:text-h1">
          {section.label}
        </h1>
        <p className="mt-md max-w-[56ch] font-body text-lead leading-snug text-gray700">
          {section.description}
        </p>
        <ul className="mt-lg flex flex-wrap gap-sm">
          {section.categories.map((category) => (
            <li key={category}>
              <CategoryChip category={category} href={false} />
            </li>
          ))}
        </ul>
      </header>

      {lead ? (
        <div className="pt-xl">
          <LeadStory article={lead} />
        </div>
      ) : null}

      <section aria-labelledby="more-heading" className="pt-2xl">
        <SectionHeading
          id="more-heading"
          label={lead ? 'More from this desk' : 'Filed'}
        />
        <StoryList articles={rest} showDek />
      </section>
    </div>
  );
}
