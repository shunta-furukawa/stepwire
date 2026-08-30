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
        サンプル
      </span>
    );
  }

  return (
    <aside
      role="note"
      className="wire-scan border-2 border-ink bg-paper p-lg"
      aria-label="サンプルコンテンツの注意"
    >
      <p className="font-mono text-micro font-bold uppercase tracking-wider text-signal">
        サンプル記事 — 実際のニュースではありません
      </p>
      <p className="mt-sm font-body text-base leading-snug text-ink">
        この記事は、STEPWIREのレイアウトと動画システムを開発するための
        <strong>架空のサンプル</strong>です。ここに書かれた出来事・出典・数値はすべて作られたもので、
        報道ではありません。サンプル記事はRSSフィードとサイトマップから除外されています。
      </p>
    </aside>
  );
}
