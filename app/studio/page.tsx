import type { Metadata } from 'next';
import Link from 'next/link';
import { getStudioArticles, getVideoInput } from '@/lib/content/loader';
import { ExportLab } from '@/components/studio/ExportLab';
import { site } from '@/lib/site';

/**
 * `/studio` — where a film is made, on the phone in the operator's hand.
 *
 * The article is chosen, previewed frame by frame, exported to an MP4 by the
 * device's own encoder, and sent on its way with a thumbnail and the words to
 * post it with. No server renders anything and nothing here costs money. The
 * cloud renderer this page once fronted is gone; the on-device path proved
 * faster than it and free.
 */
export const metadata: Metadata = {
  title: '動画スタジオ',
  robots: { index: false, follow: false },
};

export default async function StudioPage() {
  const articles = await getStudioArticles();
  const inputs = await Promise.all(articles.map((item) => getVideoInput(item)));

  return (
    <div className="mx-auto max-w-[560px] px-md py-xl">
      <header className="border-b-4 border-accent pb-lg">
        <p className="font-mono text-micro uppercase tracking-wider text-muted">STEPWIRE STUDIO</p>
        <h1 className="mt-sm font-display text-h2 font-black leading-headline tracking-headline">
          動画スタジオ
          <span className="mt-xs block font-mono text-micro font-normal tracking-wider text-muted">
            ON-DEVICE EXPORT
          </span>
        </h1>
        <p className="mt-md font-body text-base leading-snug text-muted">
          記事から動画を作ります。プレビューも書き出しもこの端末の中で完結し、
          サーバーもレンダリング費用も使いません。サムネイルと投稿用の文章も、同じ記事から出ます。
        </p>
        <nav className="mt-lg flex flex-wrap gap-md font-mono text-micro uppercase tracking-wider">
          <Link href="/studio/wire" className="border-2 border-line-strong px-md py-sm hover:bg-accent hover:text-on-accent">
            ワイヤー受信箱 →
          </Link>
          <Link href="/" className="px-md py-sm text-muted hover:text-accent">
            サイトへ戻る
          </Link>
        </nav>
      </header>

      <div className="pt-xl">
        <ExportLab articles={inputs} siteUrl={site.url} />
      </div>
    </div>
  );
}
