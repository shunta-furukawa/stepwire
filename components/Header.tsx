import Link from 'next/link';
import { MastheadLink } from './Wordmark';
import { SECTIONS } from '@/lib/content/categories';

const NAV = [
  ...SECTIONS.map((section) => ({ href: `/${section.slug}`, label: section.label })),
  { href: '/about', label: 'STEPWIREについて' },
];

export function Header() {
  return (
    <header className="sw-masthead">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-md focus:top-md focus:z-50 focus:border-2 focus:border-line-strong focus:bg-raised focus:px-md focus:py-sm focus:font-mono focus:text-small"
      >
        本文へスキップ
      </a>

      <div className="sw-masthead-inner">
        <MastheadLink />
        <div className="sw-sections" role="navigation" aria-label="サイト切り替え">
          <Link href="/" aria-current="page">記事</Link>
          <a href="/bpl">BPL戦績</a>
        </div>
      </div>

      <nav aria-label="セクション" className="border-t border-line">
        <ul className="mx-auto flex max-w-[1180px] items-stretch gap-0 overflow-x-auto px-md">
          {NAV.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className="block border-r border-line px-md py-sm font-mono text-micro font-bold uppercase tracking-wider transition-colors hover:bg-accent hover:text-on-accent"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="ml-auto shrink-0">
            <Link
              href="/studio"
              className="block px-md py-sm font-mono text-micro uppercase tracking-wider text-muted transition-colors hover:text-accent"
            >
              Studio
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
