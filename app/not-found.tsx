import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1180px] px-md py-3xl">
      <p className="font-mono text-micro font-bold uppercase tracking-wider text-signal">
        404 — off the wire
      </p>
      <h1 className="mt-md font-display text-h1 font-black leading-display tracking-display lg:text-display">
        No story at this address.
      </h1>
      <p className="mt-lg max-w-[52ch] font-body text-lead text-gray700">
        STEPWIRE article URLs are permanent, so this one was never published — or you followed a
        link that was mistyped.
      </p>
      <Link
        href="/"
        className="mt-xl inline-block border-2 border-ink px-lg py-sm font-mono text-micro font-bold uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
      >
        ← Back to the wire
      </Link>
    </div>
  );
}
