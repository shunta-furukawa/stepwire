import type { Metadata } from 'next';
import Link from 'next/link';
import { getArticles, getVideoInput } from '@/lib/content/loader';
import { ExportLab } from '@/components/studio/ExportLab';

/**
 * `/studio/lab` — the export spike.
 *
 * Answers one question with measurement rather than opinion: can the phone in
 * the operator's hand encode a STEPWIRE video by itself? Everything here is
 * disposable. If the numbers are good it becomes the studio's export path and
 * rendering stops costing money; if not, this page is why the idea was dropped.
 */
export const metadata: Metadata = {
  title: '書き出しラボ',
  robots: { index: false, follow: false },
};

export default async function LabPage() {
  const articles = await getArticles();
  const inputs = await Promise.all(articles.map((item) => getVideoInput(item)));

  return (
    <div className="mx-auto max-w-[560px] px-md py-xl">
      <header className="border-b-4 border-accent pb-lg">
        <p className="font-mono text-micro uppercase tracking-wider text-muted">STEPWIRE STUDIO</p>
        <h1 className="mt-sm font-display text-h2 font-black leading-headline tracking-headline">
          書き出しラボ
          <span className="mt-xs block font-mono text-micro font-normal tracking-wider text-muted">
            EXPORT LAB
          </span>
        </h1>
        <p className="mt-md font-body text-base leading-snug text-muted">
          この端末だけでMP4を作れるかを実測します。サーバーもレンダリング費用も使いません。
          動画はcanvasに描き、WebCodecsでエンコードします。既定は納品形式の16:9です。
        </p>
        <nav className="mt-lg flex flex-wrap gap-md font-mono text-micro uppercase tracking-wider">
          <Link href="/studio" className="border-2 border-line-strong px-md py-sm hover:bg-accent hover:text-on-accent">
            動画スタジオ →
          </Link>
        </nav>
      </header>

      <div className="pt-xl">
        <ExportLab articles={inputs} />
      </div>
    </div>
  );
}
