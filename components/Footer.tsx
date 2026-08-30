import Link from 'next/link';
import { Wordmark } from './Wordmark';
import { SECTIONS } from '@/lib/content/categories';
import { site } from '@/lib/site';

export function Footer() {
  return (
    <footer className="mt-3xl border-t-4 border-ink bg-ink text-paper">
      <div className="mx-auto grid max-w-[1180px] gap-xl px-md py-2xl sm:grid-cols-[1fr_auto]">
        <div>
          <Wordmark variant="stacked" className="text-h2 sm:text-h1" />
          <p className="mt-md max-w-[46ch] font-mono text-micro uppercase tracking-wider text-gray300">
            {site.tagline}
          </p>
          <p className="mt-lg max-w-[52ch] font-body text-small leading-snug text-gray300">
            DanceDanceRevolutionの独立系ニュースワイヤー兼アーカイブ。運営は{site.operator}。
            KONAMIとは無関係で、提携も承認も受けていません。
          </p>
        </div>

        <nav aria-label="フッター" className="font-mono text-micro uppercase tracking-wider">
          <ul className="space-y-sm">
            {SECTIONS.map((section) => (
              <li key={section.slug}>
                <Link href={`/${section.slug}`} className="hover:text-signal-on-dark">
                  {section.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/about" className="hover:text-signal-on-dark">
                STEPWIREについて
              </Link>
            </li>
            <li>
              <a href="/feed.xml" className="hover:text-signal-on-dark">
                RSS
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-gray700">
        <p className="mx-auto max-w-[1180px] px-md py-md font-mono text-micro uppercase tracking-wider text-gray500">
          © {new Date().getFullYear()} {site.name} · {site.operator}
        </p>
      </div>
    </footer>
  );
}
