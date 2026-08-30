import Link from 'next/link';
import { Wordmark } from './Wordmark';
import { SECTIONS } from '@/lib/content/categories';
import { site } from '@/lib/site';

export function Footer() {
  return (
    <footer className="mt-3xl border-t-4 border-ink bg-ink text-paper">
      <div className="mx-auto grid max-w-[1180px] gap-xl px-md py-2xl sm:grid-cols-[1fr_auto]">
        <div>
          <Wordmark variant="stacked" className="text-h1" />
          <p className="mt-md max-w-[46ch] font-mono text-micro uppercase tracking-wider text-gray300">
            {site.tagline}
          </p>
          <p className="mt-lg max-w-[52ch] font-body text-small leading-snug text-gray300">
            An independent DanceDanceRevolution news wire and archive, operated by {site.operator}.
            Not affiliated with, endorsed by, or connected to KONAMI.
          </p>
        </div>

        <nav aria-label="Footer" className="font-mono text-micro uppercase tracking-wider">
          <ul className="space-y-sm">
            {SECTIONS.map((section) => (
              <li key={section.slug}>
                <Link href={`/${section.slug}`} className="hover:text-signal">
                  {section.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/about" className="hover:text-signal">
                About
              </Link>
            </li>
            <li>
              <a href="/feed.xml" className="hover:text-signal">
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
