import Link from 'next/link';

/**
 * The STEPWIRE wordmark.
 *
 * `stacked` sets STEP over WIRE as a two-line block — the masthead treatment.
 * `inline` sets it on one line for compact contexts. Both are pure type: the
 * brand has no logo asset to load, break, or get out of sync with the video.
 */
export function Wordmark({
  variant = 'inline',
  className = '',
}: {
  variant?: 'inline' | 'stacked';
  className?: string;
}) {
  if (variant === 'stacked') {
    return (
      <span className={`block font-display leading-[0.82] tracking-display ${className}`}>
        <span className="block font-black">STEP</span>
        <span className="block font-black text-signal">WIRE</span>
      </span>
    );
  }

  return (
    <span className={`font-display font-black tracking-display ${className}`}>
      STEP<span className="text-signal">WIRE</span>
    </span>
  );
}

export function MastheadLink({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-block ${className}`}
      aria-label="STEPWIRE — home"
    >
      <Wordmark className="text-h3" />
    </Link>
  );
}
