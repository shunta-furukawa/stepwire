'use client';

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
          log: ['reused an existing render — no new render was billed'],
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
        <p className="mt-md font-body text-lead text-gray700">
          There are no published articles to render yet.
        </p>
      </div>
    );
  }

  const busy = render.status === 'starting' || render.status === 'running';

  return (
    <div className="mx-auto max-w-[1180px] px-md py-xl">
      <header className="border-b-4 border-ink pb-lg">
        <p className="font-mono text-micro font-bold uppercase tracking-wider text-signal">
          Internal tool
        </p>
        <h1 className="mt-sm font-display text-h2 font-black uppercase leading-display tracking-display sm:text-h1">
          Video studio
        </h1>
        <p className="mt-md max-w-[62ch] font-body text-lead leading-snug text-gray700">
          Videos are derived from the article, not authored separately. To change what a video
          says, edit the article — the scenes, the pacing and the length all follow.
        </p>
      </header>

      <div className="grid gap-2xl pt-xl lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="preview-heading" className="min-w-0">
          <SectionHeading
            id="preview-heading"
            label="Preview"
            description={`${definition.width}×${definition.height} · ${definition.aspectRatio} · ${definition.fps}fps`}
          />

          <div
            className="mt-lg bg-ink p-md"
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

          <dl className="mt-lg grid grid-cols-2 gap-md border-t border-gray300 pt-md font-mono text-micro uppercase tracking-wide sm:grid-cols-4">
            <div>
              <dt className="text-gray700">Duration</dt>
              <dd className="text-h4 font-bold tracking-tight">
                {formatDuration(sequence.durationInFrames, sequence.fps)}
              </dd>
            </div>
            <div>
              <dt className="text-gray700">Frames</dt>
              <dd className="text-h4 font-bold tabular-nums tracking-tight">
                {sequence.durationInFrames}
              </dd>
            </div>
            <div>
              <dt className="text-gray700">Scenes</dt>
              <dd className="text-h4 font-bold tabular-nums tracking-tight">
                {sequence.scenes.length}
              </dd>
            </div>
            <div>
              <dt className="text-gray700">Aspect</dt>
              <dd className="text-h4 font-bold tracking-tight">{definition.aspectRatio}</dd>
            </div>
          </dl>

          <section aria-labelledby="scenes-heading" className="mt-xl">
            <SectionHeading id="scenes-heading" label="Scene sequence" as="h2" />
            <ol className="mt-md">
              {sequence.scenes.map((scene) => (
                <li
                  key={scene.id}
                  className="grid grid-cols-[3ch_1fr_auto] items-baseline gap-md border-b border-gray300 py-sm font-mono text-micro uppercase tracking-wide"
                >
                  <span className="text-gray700 tabular-nums">
                    {String(scene.index + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="font-bold">{scene.id}</span>
                    {scene.label ? (
                      <span className="ml-sm text-gray700">{scene.label}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-gray700">
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
              className="mt-md block font-mono text-micro uppercase tracking-wide text-gray700"
            >
              Article
            </label>
            <select
              id="studio-article"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="mt-sm w-full border-2 border-ink bg-paper px-md py-sm font-display text-base"
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
              className="mt-lg block font-mono text-micro uppercase tracking-wide text-gray700"
            >
              Composition
            </label>
            <select
              id="studio-composition"
              value={composition}
              onChange={(event) => setComposition(event.target.value as CompositionId)}
              className="mt-sm w-full border-2 border-ink bg-paper px-md py-sm font-display text-base"
            >
              {COMPOSITION_IDS.map((id) => (
                <option key={id} value={id}>
                  {COMPOSITIONS[id].id} — {COMPOSITIONS[id].label}
                </option>
              ))}
            </select>
            <p className="mt-sm font-mono text-micro uppercase tracking-wide text-gray700">
              {definition.usage}
            </p>

            {article.fixture ? (
              <p className="mt-lg border-2 border-ink bg-ink px-md py-sm font-mono text-micro font-bold uppercase tracking-wider text-paper">
                Sample fixture — do not publish this video
              </p>
            ) : null}
          </section>

          <section aria-labelledby="render-heading" className="border-2 border-ink p-lg">
            <SectionHeading id="render-heading" label="Render" as="h2" />

            <p className="mt-md font-body text-small leading-snug text-gray700">
              Rendering runs on a cloud machine and costs money. The endpoint requires the
              operator token, and an identical render is reused rather than billed twice.
            </p>

            <label
              htmlFor="studio-token"
              className="mt-lg block font-mono text-micro uppercase tracking-wide text-gray700"
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
              className="mt-sm w-full border-2 border-ink bg-paper px-md py-sm font-mono text-small"
            />

            <button
              type="button"
              onClick={() => void startRender()}
              disabled={busy || token.length === 0}
              className="mt-lg w-full border-2 border-ink bg-ink px-md py-sm font-mono text-micro font-bold uppercase tracking-wider text-paper transition-colors hover:bg-signal hover:border-signal disabled:cursor-not-allowed disabled:border-gray300 disabled:bg-gray300 disabled:text-gray700"
            >
              {busy ? 'Rendering…' : `Render ${composition}`}
            </button>

            <div aria-live="polite" className="mt-lg">
              <p className="font-mono text-micro uppercase tracking-wide">
                <span className="text-gray700">Status </span>
                <span
                  className={
                    render.status === 'failed'
                      ? 'font-bold text-signal'
                      : render.status === 'complete'
                        ? 'font-bold'
                        : 'text-gray700'
                  }
                >
                  {render.status}
                  {render.reused ? ' (reused)' : ''}
                </span>
              </p>

              {render.renderId ? (
                <p className="mt-sm break-all font-mono text-[10px] text-gray700">
                  {render.renderId}
                </p>
              ) : null}

              {render.error ? (
                <p className="mt-sm font-body text-small leading-snug text-signal">
                  {render.error}
                </p>
              ) : null}

              {render.url ? (
                <div className="mt-md">
                  <p className="font-mono text-micro uppercase tracking-wide text-gray700">
                    Output
                  </p>
                  <a
                    href={render.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-xs block break-all font-mono text-small underline decoration-gray300 underline-offset-4 hover:decoration-signal"
                  >
                    {render.url}
                  </a>
                </div>
              ) : null}

              {render.log.length > 0 ? (
                <ol className="mt-md max-h-[180px] overflow-y-auto border-t border-gray300 pt-sm font-mono text-[10px] leading-relaxed text-gray700">
                  {render.log.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="local-heading">
            <SectionHeading id="local-heading" label="Render locally" as="h2" />
            <p className="mt-md font-body text-small leading-snug text-gray700">
              No cloud account needed:
            </p>
            <pre className="mt-sm overflow-x-auto border border-gray300 bg-paper p-md font-mono text-[11px]">
              {`pnpm video:render ${article.slug} \\\n  --composition ${composition}`}
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
}
