# CLAUDE.md

STEPWIRE — a DDR news wire and archive, operated by MONO DDR. This repository is
the CMS, the editorial workflow and the video studio, not just the website.

Detailed guides live in `docs/`. This file holds the standing rules only.

## Architecture

```
sources.yml → collector → GitHub Issue → human review → content/*.mdx → PR → merge
                                                             │
                                              ┌──────────────┴──────────────┐
                                          website (Vercel)          video (Remotion)
```

One Article is the source of truth for both the web page and the video. There is
no second content store, and there must never be one.

- `content/articles/` real articles · `content/fixtures/` labelled samples
- `lib/content/` schema, parsing, validation, loading
- `lib/news/` source registry, adapters, normalisation, deduplication
- `lib/video/` composition registry, scene derivation, render drivers, guards
- `lib/design/tokens.ts` the one source of brand tokens
- `video/` Remotion root, compositions, scenes, primitives
- `app/` Next.js App Router · `components/` server components (studio is the
  only client island)

## Commands

```bash
pnpm dev                 # website, localhost:3000
pnpm verify              # lint + typecheck + test + content:validate + build

pnpm content:validate    # editorial gate
pnpm article:new --title "Headline" --category UPDATE
pnpm article:from-issue 42
pnpm article:from-post https://x.com/DDR_573/status/…   # official oEmbed, no scraping

pnpm news:collect --dry-run          # fixtures only, no network, no issues
pnpm news:collect --create-issues    # file candidates into the inbox

pnpm video:studio                    # Remotion studio (scene design)
pnpm video:render <slug>             # local render, no cloud, no cost
pnpm narration:transcribe <slug>     # local Whisper; writes content/transcripts/
```

Run `pnpm verify` before every commit. Never leave the tree failing.

## Content rules

Article bodies are `.mdx` with typed YAML frontmatter and exactly three
sections, always in this order:

```
## NEWS            reported fact — must cite a source with [^n]
## CONTEXT         STEPWIRE analysis
## PLAYER IMPACT   STEPWIRE analysis
```

- **NEWS is fact; CONTEXT and PLAYER IMPACT are analysis.** Never blur them.
  The website labels which is which and readers rely on it.
- **Every published report cites a source.** `[^1]` markers bind a claim to an
  entry in `sources`. `pnpm content:validate` fails the build otherwise.
- **Claude drafts; MONO DDR publishes.** Material comes in as post URLs, words
  and photos (`docs/handoff.md`); the draft goes out at `status: review`, and
  only the operator sets `published`. Nothing in CONTEXT or PLAYER IMPACT is
  the operator's opinion unless the operator said it.
- **AI output is never a source.** A source is something a reader can check: a
  first-party announcement, a published report, a community record, a dataset.
- **A figure is written, never inferred.** `figures` in the frontmatter declares
  the rows; the page and the video both draw them. Nothing generates a chart
  from prose or from a transcript — see `docs/figures.md`.
- **Slugs are permanent.** Once published, a URL never changes — the archive
  promise depends on it.
- **Fixtures must stay obviously fake.** Anything in `content/fixtures/` is
  sample content: keep "SAMPLE" in the title, and never remove the banner, the
  `noindex`, or the feed/sitemap exclusions.

## Coding conventions

- TypeScript strict, `noUncheckedIndexedAccess`. No `any`; no non-null
  assertions outside tests.
- Server components by default. Add `'use client'` only where interaction
  genuinely requires it (today: the studio, and nothing else).
- Zod validates everything entering the system: frontmatter, `sources.yml`,
  API request bodies.
- Import via the `@/` alias from `app/` and `components/`; relative paths inside
  `lib/`, `video/` and `scripts/`.
- Comments explain *why*. Do not narrate what the code already says.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate && pnpm build
```

Tests are pure logic and run in about a second. **Never write a test that
renders a video** — scene derivation is tested as data, and the rendering is
verified by eye with `pnpm video:render`.

## Important constraints

- **Brand tokens have one home.** `lib/design/tokens.ts`, mirrored into
  `app/globals.css`. `tests/tokens.test.ts` fails if they drift — it also
  asserts WCAG AA for every text tone on every ground, so contrast is a build
  failure rather than a review note. Changing a colour means changing both.
- **The palette is greyscale plus one hue.** Black ground, off-white type, and
  the MONO DDR lime (`accent`, with `accentHot` for live and breaking). Alert
  and data are separated by *form* — a filled chip that pulses versus accent
  text — never by adding a second hue. Token names describe the role
  (`surface`, `raised`, `fg`, `muted`, `line`), never the pigment: a name like
  `ink` stops being true the moment the ground flips.
- **No HTML scraping.** Official feeds, official APIs and public feeds only. A
  site-specific adapter requires the checks in `docs/sources.md` first.
- **The collector never publishes.** Its only output is a GitHub issue for a
  human to accept or ignore. It also never labels anything `priority:breaking`;
  that is an editorial judgement.
- **Rendering costs money.** `/api/render` fails closed without
  `STEPWIRE_RENDER_TOKEN`. Duplicate prevention is the Blob existence check —
  it is the only state shared across serverless instances, so do not replace it
  with in-memory bookkeeping. Do not bulk-render while iterating; use
  `pnpm video:render` locally.
- **Do not add a video CMS.** Video copy is derived from the article. If a video
  needs different wording, add a narrow override under `article.video`, never a
  parallel file.
- **The recording is the script, not the soundtrack.** The operator talks, the
  words are transcribed into `content/transcripts/*.json`, and the video TYPES
  them. The voice never reaches the film. Sourcing stays entirely on the
  article; a recording is never a source.
- **Copy types; it does not appear.** Every card's characters land on the
  cadence in `lib/video/reveal.ts`, and a tick sounds as they do. Both renderers
  and the tick track read that one plan. No renderer decides when a character
  appears.
- **Images and music are quotations, and the rights are editorial.** `media`
  and `bgm` require a `credit` or the article fails validation. The system
  never fetches a picture or a track; the operator puts a file under `public/`
  and answers for it. A game's own music in a public video is a rights question
  software cannot settle.
- **Keep dependencies minimal.** Prefer a small typed module over a library. Do
  not add a database, a CMS, a job queue, or a state-management framework.
  `three` is the one exception, and only `lib/video/field.ts` may import it.
- **The field is a function of the frame.** `lib/video/field-plan.ts` decides
  what the particle field does on a frame; `field.ts` paints it. Nothing in the
  field reads a clock or `Math.random`, and the ground under every scene comes
  from `lib/video/ground.ts` in both renderers — see `docs/video-system.md`.
- **Free music still needs its credit on the card.** `docs/audio-sources.md`
  lists libraries whose only condition is attribution. The outro prints every
  credit the film owes; the operator still downloads the file and reads the
  licence.
- **Keep AI at the boundary.** `lib/ai/` may be added later for drafting and
  triage. Collection, editing, publishing and rendering must all keep working
  with it absent, and no core module may import a vendor SDK.
