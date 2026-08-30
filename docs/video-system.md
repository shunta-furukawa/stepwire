# Video system

STEPWIRE videos are *derived* from articles. There is no video CMS, no script
file, and no second copy of the copy.

```
Article ──► buildSceneSequence() ──► Scene[] ──► Remotion ──► MP4
```

## Two kinds of video

An article produces one of two films, depending on whether it has a recording.

| | Silent | Narrated |
| --- | --- | --- |
| Body | Cards derived from NEWS / CONTEXT / PLAYER IMPACT | Subtitle pages from the transcript |
| Pacing | Estimated reading time | The speaker's own timing |
| Length | Trimmed to the format's ceiling | As long as the recording |
| Audio | none | the recording |

Both open with the ident and headline and close with the source card and the
outro. Everything else changes.

### Why narration exists

Writing an article from a transcript and then rendering a silent typography
video sands off the thing that made it worth recording. So a recording is not
only an input to the text — **it is the video's audio**. The article and the
video stop being two renderings of the same prose and become two renderings of
the same recording: the page gets the edited written record, the video gets the
actual voice.

The rule that keeps this honest:

> **The article is the record. The recording is the performance.**
> They may differ in wording. They may not differ in fact.

Sourcing stays entirely on the article. A recording is never a source.

### Adding narration to an article

1. Put the recording in `public/audio/` — the same file then serves the website
   and the render, with no second copy.
2. Reference it in the article's frontmatter:

   ```yaml
   narration:
     audio: audio/2026-08-24-summer-update.m4a
     speaker: MONO DDR
   ```

3. Transcribe it:

   ```bash
   pnpm narration:transcribe sample-ddr-world-summer-update
   ```

   This runs **Whisper.cpp locally** — no API, no per-minute cost, no vendor.
   The first run installs whisper.cpp and downloads a model into `.whisper/`
   (git-ignored) and takes a while; later runs do not.

4. **Read the transcript and fix it.** Whisper mishears DDR jargon constantly —
   song titles, chart names, "DDR WORLD". `content/transcripts/<slug>.json` is
   committed precisely so it can be corrected by hand; it is the subtitle track
   a viewer reads, not a byproduct.

5. `pnpm video:render <slug>`.

The transcript is found by convention at `content/transcripts/<slug>.json` and
is not named in the frontmatter — one fewer thing to keep in sync. An article
with a recording but no transcript falls back to the silent form rather than
rendering a video that cannot be subtitled or timed.

### How the pages are cut

`createTikTokStyleCaptions` from `@remotion/captions` was tried first and merged
an entire fourteen-second take into a single page: it groups tokens that fall
within a time window of each other, and continuous speech has no gaps wide
enough to break on. Correct for its purpose, wrong for subtitles.

`lib/video/captions.ts` pages on **sentence endings first**, falling back to a
length or duration limit only when a speaker runs on, and breaking immediately
on a real pause. Length is measured with `visualLength`, the same weighted
measure the card budgets use, so one number describes a readable page in either
script.

Each page becomes one scene, held until the next page begins — so a subtitle
never disappears while the voice continues. The audio is mounted over exactly
the span the narration scenes occupy, so the ident plays silent before it and
the recording is never clipped.

## How a video is built

`lib/video/scenes.ts` turns an `ArticleVideoInput` into a scene sequence:

1. **Intro** — the ident, with the category and date.
2. **Headline** — `video.headline` ?? `shortTitle` ?? `title`, with the summary.
3. **News / Context / Impact** — each section is split on sentence boundaries
   and packed into cards up to a per-format character budget.
4. **Figures** — one scene per entry in the article's `figures`, if any.
5. **Source** — the primary source. Never dropped.
6. **Outro** — the wordmark and tagline.

Each card's duration comes from its reading time — roughly 12 weighted
characters per second, plus time to register the card, clamped per format.
"Weighted" is `visualLength`, which counts a CJK character twice, so the same
number works out to ~12 Latin or ~6 Japanese characters per second.

**The length of a video is therefore a property of the article's content** —
nobody types a duration anywhere. Remotion learns the total through
`calculateMetadata`.

For a narrated article none of this applies: the recording decides.

If the total exceeds the format's ceiling, `trimToBudget` drops trailing
analysis cards. The intro, headline, first news card, source and outro are never
dropped: a short video missing its last supporting point is still coherent; one
missing its source is not.

## Compositions

| Id | Size | fps | For |
| --- | --- | --- | --- |
| `STEPWIRE_SHORT` | 1080×1920 (9:16) | 30 | Shorts, Reels, TikTok, X. Target 20–45s |
| `STEPWIRE_NEWS` | 1920×1080 (16:9) | 30 | YouTube, embeds. Target 35–90s |

Both render from one component tree (`video/compositions/StepwireVideo.tsx`).
They differ only in the derived sequence — card budget, cards per section,
duration bounds and layout scale — not in duplicated React.

> Remotion composition ids may not contain underscores. `STEPWIRE_SHORT` is the
> name used by the API, the studio and these docs; each definition also carries
> a `remotionId` (`STEPWIRE-SHORT`) used only when registering and rendering.

## Overrides

Article frontmatter may narrow what the video says. Every field is optional, and
an article with none still produces a complete video.

```yaml
video:
  headline: A shorter headline that fits a 9:16 frame
  hook: One line under the ident
  scenes:
    context-2:
      skip: true
    intro:
      durationInSeconds: 2.5
    impact:
      text: A tighter line, written for the screen
```

Use them sparingly. If a line reads badly on screen it usually reads badly on
the page too, and fixing the article fixes both. An override is for a real
difference between the surfaces — a headline that will not fit, a hook that
only makes sense over an ident.

Data is **not** an override. `figures` sits at the top level of the frontmatter
and is drawn by both the page and the video; see `docs/figures.md`.

Scene keys are scene ids as shown in the studio's scene list (`news-1`,
`context-2`, `source`…). `pnpm content:validate` rejects a malformed key.

## Previewing

**In the website** (live article data, an article selector, render controls):

```bash
pnpm dev     # → http://localhost:3000/studio
```

**In Remotion Studio** (scene design, frame-by-frame, timeline scrubbing):

```bash
pnpm video:studio
```

Remotion Studio bundles for the browser and cannot read `content/` off disk, so
it opens with the committed sample in `video/defaultProps.ts`. To preview a real
article there:

```bash
pnpm video:data
pnpm exec remotion studio video/index.ts --props=video/data/<slug>.json
```

## Rendering

### Locally — free, no account

```bash
pnpm video:render <slug>
pnpm video:render <slug> --composition STEPWIRE_NEWS
pnpm video:render <slug> --out out/clip.mp4
```

Runs `@remotion/bundler` + `@remotion/renderer` in-process and writes to
`video/out/`. A 40-second short takes about 80 seconds on a laptop-class
machine. Use this while iterating on design — it costs nothing.

Run `pnpm video:render` with no slug to list the published articles.

### In the cloud — Vercel Sandbox

The studio's **Render** button posts to `/api/render`, which:

1. checks the operator token,
2. computes a render id from the slug, the composition and the article's content
   hash,
3. returns the existing Blob URL if that id has already been rendered,
4. otherwise starts a background job: create a sandbox at the deployed commit,
   install, `remotion render`, stream the MP4 back, upload to Vercel Blob.

The response is immediate (`202`) with a render id; the studio polls
`GET /api/render?renderId=…`.

```bash
curl -X POST https://stepwire.example/api/render \
  -H 'content-type: application/json' \
  -H "x-stepwire-render-token: $STEPWIRE_RENDER_TOKEN" \
  -d '{"articleSlug":"a-slug","composition":"STEPWIRE_SHORT"}'
```

### Cost protection

Rendering bills real money, so the endpoint is guarded in layers:

- **Shared secret.** `STEPWIRE_RENDER_TOKEN` in the `x-stepwire-render-token`
  header, compared in constant time. **No token configured means the endpoint is
  disabled** and returns 503 — a partial deployment fails closed, not open.
- **Duplicate prevention.** The render id is content-addressed, so re-clicking
  Render is free and editing the article produces a genuinely new id. The
  authoritative check is "does the object exist in Blob storage", because that
  is the only state shared across serverless instances.
- **Rate limit.** Ten renders per hour per instance by default
  (`STEPWIRE_RENDER_RATE_LIMIT`), behind a `RateLimiter` interface so a shared
  store can replace it when there is more than one operator.
- **In-flight check.** A render already running on this instance returns the
  existing job rather than starting a second one.
- **Logs.** Every render logs its id and outcome to the function log.

Use `pnpm video:render` while iterating. Do not bulk-render.

## Adding a scene

1. Add the type to `SceneType` in `lib/video/scenes.ts`.
2. Emit it in `buildSceneSequence`, with a duration derived from its content.
3. Write the component in `video/scenes/index.tsx` taking `{ scene, orientation }`.
4. Register it in `SCENE_COMPONENTS`.
5. If it should be droppable under budget pressure, add it to `droppable` in
   `trimToBudget`. If it must always appear, do not.
6. Add a case to `tests/video.test.ts` — scenes are tested as data, never by
   rendering.

## Adding a composition

1. Add an entry to `COMPOSITIONS` in `lib/video/compositions.ts`, including a
   `remotionId` with no underscores.
2. Add a profile to `PROFILES` in `lib/video/scenes.ts` (card budget, cards per
   section, duration bounds, fixed-scene lengths).
3. If the aspect ratio is new, extend `layout()` in `video/scenes/index.tsx`.

`video/Root.tsx`, `/studio` and `/api/render` all read the registry, so nothing
else needs changing.

## Design system

Video styles come from `lib/design/tokens.ts` — the same module the website's
Tailwind theme mirrors. `video/styles/theme.ts` scales the type and spacing
scales by 3 for a 1080p-class canvas; it does not define new values.
`tests/tokens.test.ts` fails if the two ever drift.

Shared primitives live in `video/components/primitives.tsx`:

| Primitive | Motif |
| --- | --- |
| `Arrow` | One shape at four rotations — the arrow abstraction |
| `PanelGrid` | The four-panel layout as a structural background |
| `ProgressRail` | The step timeline, doing real work: how much is left |
| `ScanLines` | Wire transmission, as texture |
| `WireBar` | The persistent masthead, instead of a watermark |
| `KineticText` | Word-by-word reveal — emphasis, not busywork |
| `LabelChip` · `BodyText` · `Card` | Layout and typography |

Reported fact carries a neutral label chip; editorial analysis carries a lime
one. That is the same fact/analysis distinction the website draws with its
報道 / STEPWIREの分析 labels — the video does not invent its own vocabulary.

Fact also sits on the deepest ground and analysis on a raised one, but the chip
is what actually carries the distinction: on a dark-first palette the two
grounds differ by a few percent of luminance, which reads side by side and not
at all across a cut.

**Fonts.** Video type uses the same system stack as the website — no webfont.

Loading Noto Sans JP from Google Fonts was tried and reverted: the Japanese
subset is split across ~124 unicode ranges per weight, and Remotion waits for
all of them before the first frame. That was **363 network requests per render**
plus a hard dependency on `fonts.gstatic.com` being reachable — strictly worse
than the system stack, which renders Japanese correctly on any machine that has
a CJK face.

So the requirement sits on the render environment rather than in the bundle:

- **Sandbox renders** — the driver checks `fc-list` and installs
  `fonts-noto-cjk` if the image has none. A failed install warns rather than
  failing the render.
- **Local renders** — macOS and Windows always have Japanese fonts. On Linux,
  install one (`apt-get install fonts-noto-cjk`) or Japanese text renders as
  tofu. Check with:

  ```bash
  fc-list | grep -ci cjk
  ```

The cost of this choice is that glyph metrics vary slightly between render
machines. For a wire that publishes from one operator's setup, that is a
better trade than a render that cannot run offline.

## Troubleshooting

**"Composition id can only contain a-z, A-Z, 0-9, CJK characters and -"** — a
composition was registered with its public name instead of its `remotionId`.

**A render succeeds but returns no URL.** `BLOB_READ_WRITE_TOKEN` is missing.
The render ran and was discarded; add a Blob store to the project.

**The studio says `status: unknown` while polling.** The job started on a
different serverless instance. The finished file will still appear — storage,
not the job registry, is authoritative.

**The deployment fails with `invalid_max_duration`.** `/api/render` declares a
`maxDuration`, and a value above the plan's limit fails the whole deployment —
not just that route. It is set to 300, the Hobby ceiling. Raising it to 800
gives a long sandbox render the headroom it wants, but only on a plan that
allows it.

**A card looks overfull.** The budget is per format in `PROFILES`. Shortening
the article's sentences is usually the better fix; it improves the web page too.
