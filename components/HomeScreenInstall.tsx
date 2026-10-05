import Image from 'next/image';
import Script from 'next/script';

export function HomeScreenInstall() {
  return (
    <>
      <details id="site-install" className="home-screen-install">
        <summary>
          <Image src="/brand/icons/icon-180.png" width={28} height={28} alt="" />
          ホーム画面に追加
        </summary>
        <div>
          <p id="site-install-guide">
            Safariでこのページを開き、共有ボタン（□に↑）→「ホーム画面に追加」→「追加」。
            「Webアプリとして開く」が表示されたらオンにしてください。
          </p>
          <button id="site-install-button" type="button" hidden>ホーム画面に追加する</button>
        </div>
      </details>
      <Script src="/brand/install.js" strategy="afterInteractive" />
    </>
  );
}
