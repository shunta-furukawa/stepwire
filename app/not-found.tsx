import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1180px] px-md py-3xl">
      <p className="font-mono text-micro font-bold uppercase tracking-wider text-signal">
        404 — 回線の外
      </p>
      <h1 className="mt-md font-display text-h2 font-black leading-headline tracking-headline sm:text-h1">
        このアドレスに記事はありません。
      </h1>
      <p className="mt-lg max-w-[52ch] font-body text-lead text-gray700">
        STEPWIREの記事URLは永続的です。つまりこのURLは一度も公開されていないか、
        リンクが誤っています。
      </p>
      <Link
        href="/"
        className="mt-xl inline-block border-2 border-ink px-lg py-sm font-mono text-micro font-bold uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
      >
        ← ワイヤーに戻る
      </Link>
    </div>
  );
}
