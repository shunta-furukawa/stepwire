import Image from 'next/image';
import Link from 'next/link';

/** Both sizes use the master alphabet in scripts/build-brand.mjs. */
export function Wordmark({
  variant = 'inline',
  className = '',
}: { variant?: 'inline' | 'stacked'; className?: string }) {
  return <span className={`inline-block max-w-full ${className}`} data-variant={variant}>
    <Image src="/brand/wordmark.svg" alt="STEPWIRE" width={834} height={104} className="sw-wordmark" unoptimized />
  </span>;
}

export function MastheadLink({ className = '' }: { className?: string }) {
  return <Link href="/" className={`sw-home ${className}`} aria-label="STEPWIRE ホーム">
    <Image src="/brand/wordmark.svg" alt="STEPWIRE" width={834} height={104} className="sw-logo" priority unoptimized />
  </Link>;
}
