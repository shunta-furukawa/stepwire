'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import type { ArticleVideoInput } from '@/lib/content/article';
import { buildSceneSequence } from '@/lib/video/scenes';
import { COMPOSITIONS, COMPOSITION_IDS, type CompositionId } from '@/lib/video/compositions';
import { formatDuration } from '@/lib/video/timing';
import { StepwireVideo } from '@/video/compositions/StepwireVideo';
import { SectionHeading } from '@/components/SectionHeading';

/**
 * The studio.
 *
 * Scope is deliberately narrow: pick an article, pick a format, watch it,
 * render it. There is no timeline editor — the video is *derived* from the
 * article, so the way to change the video is to edit the article, and a
 * timeline would only create a second place for the content to live.
 */

type StudioArticle = ArticleVideoInput & { fixture: boolean };

interface RenderState {
  status: 'idle' | 'starting' | 'running' | 'complete' | 'failed';
  renderId?: string;
  url?: string;
  error?: string;
  log: string[];
  reused?: boolean;
}

const TOKEN_STORAGE_KEY = 'stepwire.renderToken';
const POLL_INTERVAL_MS = 4000;

export function StudioClient({
  articles,
  initialSlug,
}: {
  articles: StudioArticle[];
  initialSlug: string;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [composition, setComposition] = useState<CompositionId>('STEPWIRE_SHORT');
  const [token, setToken] = useState('');
  const [render, setRender] = useState<RenderState>({ status: 'idle', log: [] });
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const article = useMemo(
    () => articles.find((item) => item.slug === slug) ?? articles[0],
    [articles, slug],
  );
  const definition = COMPOSITIONS[composition];

  // The render token is an operator secret, not a user credential. It stays in
  // this browser and is never sent anywhere except the render endpoint.
  useEffect(() => {
    try {
      setToken(window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? '');
    } catch {
      /* storage unavailable — the field simply starts empty */
    }
  }, []);

  const sequence = useMemo(
    () => (article ? buildSceneSequence(article, composition, definition.fps) : null),
    [article, composition, definition.fps],
  );

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  // Changing the selection invalidates any render result on screen.
  useEffect(() => {
    setRender({ status: 'idle', log: [] });
  }, [slug, composition]);

  const poll = useCallback(
    async (renderId: string, secret: string) => {
      try {
        const response = await fetch(
          `/api/render?renderId=${encodeURIComponent(renderId)}`,
          { headers: { 'x-stepwire-render-token': secret }, cache: 'no-store' },
        );
        const body = await response.json();

        if (body.status === 'complete') {
          setRender((previous) => ({
            ...previous,
            status: 'complete',
            url: body.url,
            log: body.log ?? previous.log,
          }));
          return;
        }

        if (body.status === 'failed') {
          setRender((previous) => ({
            ...previous,
            status: 'failed',
            error: body.error ?? 'render failed',
            log: body.log ?? previous.log,
          }));
          return;
        }

        setRender((previous) => ({
          ...previous,
          status: 'running',
          log: body.log ?? previous.log,
        }));
        pollTimer.current = setTimeout(() => void poll(renderId, secret), POLL_INTERVAL_MS);
      } catch (error) {
        setRender((previous) => ({
          ...previous,
          status: 'failed',
          error: (error as Error).message,
        }));
      }
    },
    [],
  );

  const startRender = useCallback(async () => {
    if (!article) return;

    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      /* non-fatal */
    }

    setRender({ status: 'starting', log: [] });

    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-stepwire-render-token': token,
        },
        body: JSON.stringify({ articleSlug: article.slug, composition }),
      });
      const body = await response.json();

      if (!response.ok && response.status !== 202) {
        setRender({
          status: 'failed',
          error: body.error ?? `render request failed (${response.status})`,
          log: [],
        });
        return;
      }

      if (body.status === 'complete') {
        setRender({
          status: 'complete',
          renderId: body.renderId,
          url: body.url,
          reused: body.reused,
          log: ['既存のレンダリングを再利用しました — 追加の課金はありません'],
        });
        return;
      }

      setRender({
        status: 'running',
        renderId: body.renderId,
        reused: body.reused,
        log: body.log ?? [],
      });
      pollTimer.current = setTimeout(
        () => void poll(body.renderId, token),
        POLL_INTERVAL_MS,
      );
    } catch (error) {
      setRender({ status: 'failed', error: (error as Error).message, log: [] });
    }
  }, [article, composition, poll, token]);

  if (!article || !sequence) {
    return (
      <div className="mx-auto max-w-[1180px] px-md py-3xl">
        <h1 className="font-display text-h2 font-black tracking-display sm:text-h1">Studio</h1>
        <p className="mt-md font-body text-lead text-muted">
          レンダリングできる公開記事がまだありません。
        </p>
        <Link
          href="/studio/wire"
          className="mt-lg inline-block border-2 border-line-strong px-md py-sm font-mono text-micro uppercase tracking-wider hover:bg-accent hover:text-on-accent"
        >
          ワイヤー受信箱 →
        </Link>
      </div>
    );
  }

  const busy = render.status === 'starting' || render.status === 'running';

  return (
    <div className="mx-auto max-w-[1180px] px-md py-xl">
      <header className="border-b-4 border-accent pb-lg">
        <p className="font-mono text-micro font-bold uppercase tracking-wider text-accent">
          社内ツール
        </p>
        <h1 className="mt-sm font-display text-h2 font-black leading-headline tracking-headline sm:text-h1">
          動画スタジオ
        </h1>
        <p className="mt-md max-w-[62ch] font-body text-lead leading-snug text-muted">
          動画は記事から導出されます。別に書くものではありません。動画の内容を変えるには記事を編集してください。
          シーンも尺もペースも、それに追随します。
        </p>
        <nav className="mt-lg flex flex-wrap gap-md font-mono text-micro uppercase tracking-wider">
          <Link
            href="/studio/wire"
            className="border-2 border-line-strong px-md py-sm hover:bg-accent hover:text-on-accent"
          >
            ワイヤー受信箱 →
          </Link>
          <Link href="/" className="px-md py-sm text-muted hover:text-accent">
            サイトへ戻る
          </Link>
        </nav>
      </header>

      <div className="grid gap-2xl pt-xl lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="preview-heading" className="min-w-0">
          <SectionHeading
            id="preview-heading"
            label="Preview"
            description={`${definition.width}×${definition.height} · ${definition.aspectRatio} · ${definition.fps}fps`}
          />

          <div
            className="mt-lg bg-deep p-md"
            style={{ maxWidth: definition.orientation === 'vertical' ? 420 : '100%' }}
          >
            <Player
              component={StepwireVideo}
              inputProps={{ article, composition }}
              durationInFrames={sequence.durationInFrames}
              fps={sequence.fps}
              compositionWidth={definition.width}
              compositionHeight={definition.height}
              style={{ width: '100%' }}
              controls
              doubleClickToFullscreen
              acknowledgeRemotionLicense
            />
          </div>

          <dl className="mt-lg grid grid-cols-2 gap-md border-t border-line pt-md font-mono text-micro uppercase tracking-wide sm:grid-cols-4">
            <div>
              <dt className="text-muted">Duration</dt>
              <dd className="text-h4 font-bold tracking-tight">
                {formatDuration(sequence.durationInFrames, sequence.fps)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Frames</dt>
              <dd className="text-h4 font-bold tabular-nums tracking-tight">
                {sequence.durationInFrames}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Scenes</dt>
              <dd className="text-h4 font-bold tabular-nums tracking-tight">
                {sequence.scenes.length}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Aspect</dt>
              <dd className="text-h4 font-bold tracking-tight">{definition.aspectRatio}</dd>
            </div>
          </dl>

          <section aria-labelledby="scenes-heading" className="mt-xl">
            <SectionHeading id="scenes-heading" label="Scene sequence" as="h2" />
            <ol className="mt-md">
              {sequence.scenes.map((scene) => (
                <li
                  key={scene.id}
                  className="grid grid-cols-[3ch_1fr_auto] items-baseline gap-md border-b border-line py-sm font-mono text-micro uppercase tracking-wide"
                >
                  <span className="text-muted tabular-nums">
                    {String(scene.index + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="font-bold">{scene.id}</span>
                    {scene.label ? (
                      <span className="ml-sm text-muted">{scene.label}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-muted">
                    {formatDuration(scene.durationInFrames, sequence.fps)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </section>

        <aside className="space-y-xl">
          <section aria-labelledby="source-heading">
            <SectionHeading id="source-heading" label="Source article" as="h2" />
            <label
              htmlFor="studio-article"
              className="mt-md block font-mono text-micro uppercase tracking-wide text-muted"
            >
              Article
            </label>
            <select
              id="studio-article"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="mt-sm w-full border-2 border-line-strong bg-raised px-md py-sm font-display text-base"
            >
              {articles.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.fixture ? '[SAMPLE] ' : ''}
                  {item.shortTitle ?? item.title}
                </option>
              ))}
            </select>

            <label
              htmlFor="studio-composition"
              className="mt-lg block font-mono text-micro uppercase tracking-wide text-muted"
            >
              Composition
            </label>
            <select
              id="studio-composition"
              value={composition}
              onChange={(event) => setComposition(event.target.value as CompositionId)}
              className="mt-sm w-full border-2 border-line-strong bg-raised px-md py-sm font-display text-base"
            >
              {COMPOSITION_IDS.map((id) => (
                <option key={id} value={id}>
                  {COMPOSITIONS[id].id} — {COMPOSITIONS[id].label}
                </option>
              ))}
            </select>
            <p className="mt-sm font-mono text-micro uppercase tracking-wide text-muted">
              {definition.usage}
            </p>

            {/*
             * Whether this article has a voice is the single most important
             * thing about its video, so it is stated plainly rather than left
             * to be inferred from the scene list.
             */}
            <div className="mt-lg border-t border-line pt-md">
              <p className="font-mono text-micro uppercase tracking-wide text-muted">ナレーション</p>
              {article.narration ? (
                <>
                  <p className="mt-xs font-display text-base font-bold">
                    あり · {article.narration.durationInSeconds.toFixed(1)}秒
                    {article.narration.speaker ? ` · ${article.narration.speaker}` : ''}
                  </p>
                  <p className="mt-xs font-body text-small leading-snug text-muted">
                    尺と場面の切り替わりは音声に従います。字幕は
                    <code className="font-mono">content/transcripts/{article.slug}.json</code>
                    を直接編集して直せます。
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-xs font-display text-base font-bold text-muted">なし（無音）</p>
                  <p className="mt-xs font-body text-small leading-snug text-muted">
                    本文から組み立てた無音の動画です。声を入れるには録音を
                    <code className="font-mono">public/audio/</code>
                    に置き、記事に <code className="font-mono">narration.audio</code> を書いて
                    <code className="font-mono">pnpm narration:transcribe {article.slug}</code>
                    を実行します。
                  </p>
                </>
              )}
            </div>

            {article.fixture ? (
              <p className="mt-lg border-2 border-accent-hot bg-accent-hot px-md py-sm font-mono text-micro font-bold uppercase tracking-wider text-on-accent">
                サンプル記事です — この動画を公開しないでください
              </p>
            ) : null}
          </section>

          <section aria-labelledby="render-heading" className="border-2 border-line-strong p-lg">
            <SectionHeading id="render-heading" label="Render" as="h2" />

            <p className="mt-md font-body text-small leading-snug text-muted">
              レンダリングはクラウド上で実行され、費用が発生します。エンドポイントは運用トークンを要求し、
              同一内容のレンダリングは再利用されるため二重に課金されません。
            </p>

            <label
              htmlFor="studio-token"
              className="mt-lg block font-mono text-micro uppercase tracking-wide text-muted"
            >
              Render token
            </label>
            <input
              id="studio-token"
              type="password"
              value={token}
              autoComplete="off"
              onChange={(event) => setToken(event.target.value)}
              placeholder="STEPWIRE_RENDER_TOKEN"
              className="mt-sm w-full border-2 border-line-strong bg-raised px-md py-sm font-mono text-small"
            />

            <button
              type="button"
              onClick={() => void startRender()}
              disabled={busy || token.length === 0}
              className="mt-lg w-full border-2 border-accent bg-accent px-md py-sm font-mono text-micro font-bold uppercase tracking-wider text-on-accent transition-colors hover:bg-accent-hot hover:border-accent-hot disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-muted"
            >
              {busy ? 'Rendering…' : `Render ${composition}`}
            </button>

            <div aria-live="polite" className="mt-lg">
              <p className="font-mono text-micro uppercase tracking-wide">
                <span className="text-muted">Status </span>
                <span
                  className={
                    render.status === 'failed'
                      ? 'font-bold text-accent'
                      : render.status === 'complete'
                        ? 'font-bold'
                        : 'text-muted'
                  }
                >
                  {render.status}
                  {render.reused ? ' (reused)' : ''}
                </span>
              </p>

              {render.renderId ? (
                <p className="mt-sm break-all font-mono text-[10px] text-muted">
                  {render.renderId}
                </p>
              ) : null}

              {render.error ? (
                <p className="mt-sm font-body text-small leading-snug text-accent">
                  {render.error}
                </p>
              ) : null}

              {render.url ? (
                <div className="mt-md">
                  <p className="font-mono text-micro uppercase tracking-wide text-muted">
                    Output
                  </p>
                  <a
                    href={render.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-xs block break-all font-mono text-small underline decoration-line underline-offset-4 hover:decoration-accent"
                  >
                    {render.url}
                  </a>
                </div>
              ) : null}

              {render.log.length > 0 ? (
                <ol className="mt-md max-h-[180px] overflow-y-auto border-t border-line pt-sm font-mono text-[10px] leading-relaxed text-muted">
                  {render.log.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="local-heading">
            <SectionHeading id="local-heading" label="Render locally" as="h2" />
            <p className="mt-md font-body text-small leading-snug text-muted">
              クラウドのアカウントは不要です。
            </p>
            <pre className="mt-sm overflow-x-auto border border-line bg-raised p-md font-mono text-[11px]">
              {`pnpm video:render ${article.slug} \\\n  --composition ${composition}`}
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
}
