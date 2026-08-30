import Link from 'next/link';
import { MastheadLink } from './Wordmark';
import { SECTIONS } from '@/lib/content/categories';
import { site } from '@/lib/site';

const NAV = [
  ...SECTIONS.map((section) => ({ href: `/${section.slug}`, label: section.label })),
  { href: '/about', label: 'About' },
];

export function Header() {
  return (
    <header className="border-b-2 border-ink bg-off-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-md focus:top-md focus:z-50 focus:border-2 focus:border-ink focus:bg-paper focus:px-md focus:py-sm focus:font-mono focus:text-small"
      >
        Skip to content
      </a>

      <div className="mx-auto flex max-w-[1180px] items-baseline justify-between gap-md px-md py-md">
        <div className="flex items-baseline gap-md">
          <MastheadLink />
          <p className="hidden font-mono text-micro uppercase tracking-wider text-gray700 sm:block">
            {site.tagline}
          </p>
        </div>
        <p className="font-mono text-micro uppercase tracking-wider text-gray700">
          <span aria-hidden="true" className="wire-pulse mr-[6px] inline-block h-[6px] w-[6px] bg-signal align-middle" />
          Wire live
        </p>
      </div>

      <nav aria-label="Sections" className="border-t border-gray300">
        <ul className="mx-auto flex max-w-[1180px] items-stretch gap-0 overflow-x-auto px-md">
          {NAV.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className="block border-r border-gray300 px-md py-sm font-mono text-micro font-bold uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="ml-auto shrink-0">
            <Link
              href="/studio"
              className="block px-md py-sm font-mono text-micro uppercase tracking-wider text-gray700 transition-colors hover:text-signal"
            >
              Studio
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
