# Architecture

STEPWIRE is a newsroom that happens to be a Git repository. This document
records the shape of the system and, more usefully, the reasoning behind the
decisions that would be expensive to reverse.

## The product constraint

Every technical decision here answers one question:

> Can Mono ddr, working alone, keep publishing?

That rules out anything with operational overhead: a CMS to run, a database to
migrate, a render service to keep deployed, a queue to drain. It also rules out
anything that creates a second place for content to live, because two places
means two things to keep in sync, and a solo operator will not win that fight.

## The pipeline

```
External sources
      │
      ▼
Collector  ─── GitHub Actions, every 4 hours
      │        adapters → normalize → deduplicate
      ▼
GitHub Issue  ─── the editorial inbox; label: news-inbox
      │
      ▼
Human review  ─── the only place a publishing decision is made
      │
      ▼
content/articles/YYYY-MM-DD-slug.mdx  ─── typed Article, the source of truth
      │
      ▼
Pull request → CI (lint, typecheck, test, content validation, build) → merge
      │
      ├────────────────────────┬───────────────────────────┐
      ▼                        ▼                           ▼
Static website           Remotion Player            /api/render
(Vercel)                 (/studio preview)          → Vercel Sandbox
                                                    → Vercel Blob → URL
```

## Decisions

### Git is the CMS

The final source of truth for an article is a file in this repository.

This is not a cost-saving compromise; it is what makes the rest of the system
possible. Because content is code:

- Review is a pull request. The editorial gate and the code gate are one gate.
- Validation is CI. A published report that cites no source cannot be merged.
- History is `git log`. STEPWIRE promises to be an archive, and an archive whose
  record lives in someone else's database is a promise you cannot keep.
- The render environment is the repository. The sandbox clones a commit and
  renders it; there is no separate service that can fall out of sync.

The cost is real: no rich-text editor, no non-technical contributor, no
scheduled publishing without a workflow. For one operator who already lives in
GitHub, that trade is clearly worth it. Revisit it when there are three editors,
not before.

### GitHub Issues are the editorial inbox

The collector's only output is an issue. It never opens a pull request, never
writes a draft, never publishes.

Automated collection is good at *finding* things and bad at *judging* them. An
issue is exactly the right artefact for that split: it is a queue a human can
triage on a phone, it carries labels for the machine's guesses, and it has a
comment thread for the reasoning that led to a decision.

Issues are also the deduplication ledger. The collector ID embedded in each
issue body means the state that prevents a story being filed twice lives in the
same place the story does — no database, and nothing to lose.

### One Article drives web and video

`lib/video/scenes.ts` derives a scene sequence from an Article. Scene durations
come from reading time, so the length of a video is a property of the article's
content. Nobody types a duration anywhere.

The alternative — a video script per article — was rejected because it fails in
the specific way that matters: an editor fixes a fact in the article, forgets
the script, and STEPWIRE publishes a video that contradicts its own reporting.

`article.video` exists for the genuine cases where the surfaces differ (a
headline too long for a 9:16 frame, a hook, a data readout). Every field is
optional, and an article with none still produces a complete video.

### A Markdown subset instead of a Markdown library

`lib/content/markdown.ts` parses a small subset to a typed AST.

Three reasons, in order of weight:

1. The same body text must render as React on the web and as plain text in a
   video scene. Parsing once to an AST gives both surfaces the same content —
   the core constraint above, made mechanical.
2. STEPWIRE has a syntax no parser knows: `[^n]` citation markers binding a
   claim to a source. Validation depends on understanding them.
3. The AST renders to React elements, so no `dangerouslySetInnerHTML` and no
   sanitiser is needed even if a future draft arrives from an automated source.

The subset is paragraphs, `###`/`####`, lists, quotes, rules, and inline bold /
italic / code / link / citation. Add to it when an article needs more, not
before.

### Categories are content classes; sections are navigation

Eight categories describe what a story *is*; four desks describe where a reader
*looks*. Keeping them separate means the information architecture can stay small
without flattening the data model — and adding a desk is one entry in `SECTIONS`
plus a four-line route file.

Categories are distinguished by glyph and typography rather than colour, so the
signal accent keeps meaning "this is important" instead of "this is an update".

### Two render drivers behind one interface

`local` runs Remotion in-process; `sandbox` runs it on a Vercel machine.

A Remotion render needs headless Chrome, minutes of CPU and hundreds of
megabytes — none of which belong in a serverless function. But requiring a cloud
account to see your own design change would make iteration miserable and the
bill silly. So both exist, `/api/render` does not know which it is using, and
`selectDriverName()` falls back to local when the cloud is not fully configured.

### Duplicate render prevention lives in blob storage

The render id is a hash of (slug, composition, content hash). Before rendering,
the API asks Vercel Blob whether that object already exists.

The in-memory job registry (`lib/video/jobs.ts`) serves progress polling only.
Serverless instances share no memory, so anything that must be correct across
instances has to be checked against shared state — and storage is the shared
state we already have. Losing the registry costs a progress bar; it never costs
a duplicate render.

### AI is a boundary, not a dependency

No LLM SDK is in the tree. `lib/ai/` is reserved for later: summarising
candidates, proposing categories, drafting a first pass, suggesting headlines.

The pipeline is already shaped for it. `DuplicateDetector` is an injected
function; adapters are isolated; drafting is a CLI that could gain a `--draft`
flag. When AI is added it plugs into those seams, and when it is unavailable —
outage, cost, bad output — collection, editing, publishing and rendering all
still work.

## What was deliberately not built

A CMS. Accounts, comments, follows. A recommendation engine. A database. A job
queue. A video timeline editor. A client-side state library. Server-side HTML
scraping.

Each would add operational surface to a one-person newsroom, and none is needed
to publish a story or a video today.

## Known limits

See "Current limits" in `README.md`. The ones with architectural weight:

- The in-memory rate limiter is per-instance. The shared-secret gate is the real
  cost control; swap in a shared store via the `RateLimiter` interface when
  there is more than one operator.
- The collection ledger is a committed JSON file. Fine at a handful of
  candidates per day; if collection volume grows, deduplicate against issue
  search alone and drop the file.
- Video type uses a system font stack. It removes a network dependency from both
  the web build and the headless render, at the cost of exact cross-platform
  metrics. `@remotion/google-fonts` is the upgrade path if that matters.

## Deviations from the original brief

- `app/stories/` was not created. Story categories are covered by the four desks
  (`/news`, `/charts`, `/data`, `/culture`), which matches the brief's own
  information architecture and its instruction to merge pages in the MVP.
- Composition ids are `STEPWIRE_SHORT` / `STEPWIRE_NEWS` everywhere a person or
  the API sees them. Remotion forbids underscores in composition ids, so each
  definition also carries a `remotionId` used only when registering and
  rendering.
- Article files use the `.mdx` extension as specified, but are parsed as the
  Markdown subset above. The extension is kept so MDX components can be enabled
  later without renaming published content.
