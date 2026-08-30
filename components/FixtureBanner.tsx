/**
 * Fixture notice.
 *
 * Seeded sample articles describe events that never happened. They are useful
 * for developing the design and the video system, and dangerous if a reader
 * mistakes one for reporting — so the notice is loud, appears above the
 * headline, and is not dismissible.
 */
export function FixtureBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center border-2 border-ink bg-ink px-2 py-[2px] font-mono text-[10px] font-bold uppercase tracking-wider text-paper">
        Sample fixture
      </span>
    );
  }

  return (
    <aside
      role="note"
      className="wire-scan border-2 border-ink bg-paper p-lg"
      aria-label="Sample content notice"
    >
      <p className="font-mono text-micro font-bold uppercase tracking-wider text-signal">
        Sample fixture — not real news
      </p>
      <p className="mt-sm font-body text-base leading-snug text-ink">
        This article is <strong>fictional sample content</strong> used to develop the STEPWIRE
        layout and video system. The events, sources and figures described here are invented and
        are not reporting. Fixture articles are excluded from the RSS feed and the sitemap.
      </p>
    </aside>
  );
}
