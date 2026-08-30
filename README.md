# STEPWIRE

**DDR News, Charts & Culture.**

An independent news and culture wire for DanceDanceRevolution, operated by
Mono ddr. Not affiliated with, endorsed by, or connected to KONAMI.

This repository is not just the website. It is the whole newsroom: the source
registry, the editorial inbox, the content store, the publishing pipeline and
the video studio.

---

## What STEPWIRE is

Two things at once.

**A news site.** Game updates, new songs and charts, events, tournaments, chart
data, and the community around the machine.

**An archive.** Scenes lose their own history quickly — announcements move,
forums close, and what everyone knew last year becomes unverifiable. Every story
here keeps its sources attached and its URL permanent, so the record outlives
the sources.

### The format

Every article is written in three parts, always in the same order:

| Section | Contains |
| --- | --- |
| **NEWS** | What happened. Reported fact — must cite a source. |
| **CONTEXT** | Why it is notable. STEPWIRE analysis, labelled as such. |
| **PLAYER IMPACT** | What actually changes for someone who plays. |

The split is enforced by the content schema, not by authoring discipline: a
published report whose NEWS section cites no source fails CI.

---

## Architecture

```
External sources
      ▼
Collector (GitHub Actions, 4-hourly)
      ▼
GitHub Issue  ── the editorial inbox
      ▼
Human review
      ▼
content/articles/*.mdx  ── the typed Article; the source of truth
      ▼
Pull request → CI → merge
      │
      ├──────────────────────────┬──────────────────────────┐
      ▼                          ▼                          ▼
  Website (Vercel)      Studio preview (/studio)      /api/render
                                                      → Vercel Sandbox
                                                      → Vercel Blob
```

One Article drives both the web page and the video. Nothing is written twice.

Full reasoning, including what was deliberately not built:
[`docs/architecture.md`](docs/architecture.md).

### Layout

```
app/          Next.js App Router — homepage, desks, article, studio, api/render
components/   Server components (the studio is the only client island)
content/      articles/ (real) · fixtures/ (labelled samples)
data/         sources.yml · fixtures/ (sample feeds) · news-ledger.json
lib/
  content/    schema · markdown · parsing · validation · loading
  news/       source registry · adapters · normalisation · deduplication
  github/     minimal REST client
  video/      composition registry · scene derivation · drivers · guards
  design/     tokens.ts — the one source of brand tokens
video/        Remotion root, compositions, scenes, primitives
scripts/      collect-news · create-article · validate-content · render-video
docs/         architecture · editorial-workflow · sources · video-system · figures
```

---

## Local setup

Requires **Node 22+** and **pnpm 10+**.

```bash
git clone https://github.com/shunta-furukawa/stepwire.git
cd stepwire
pnpm install
pnpm dev            # → http://localhost:3000
```

No environment variables are needed. The site, the collector's fixture sources,
the studio preview and local video rendering all work out of the box.

Copy `.env.example` to `.env.local` when you need cloud rendering or want to
file real issues from your own machine.

The repository ships with three clearly-labelled **sample fixture articles** so
the design and the video system can be developed without publishing anything
that could be mistaken for reporting. They carry a banner, are excluded from the
RSS feed, the sitemap and search indexing, and can be dropped from a production
build with `STEPWIRE_INCLUDE_FIXTURES=false`.

## Development

```bash
pnpm dev                 # website
pnpm verify              # lint + typecheck + test + content:validate + build
```

Run `pnpm verify` before every commit — CI runs the same gate.

## Creating an article

```bash
pnpm article:from-issue 42                              # draft from the inbox
pnpm article:new --title "Headline" --category UPDATE   # draft from scratch
pnpm content:validate                                   # the editorial gate
```

Then write the three sections, set `status: published`, and open a pull request.
The full loop is in [`docs/editorial-workflow.md`](docs/editorial-workflow.md).

## News collection

```bash
pnpm news:collect --dry-run          # fixtures only — no network, no issues
pnpm news:collect --create-issues    # file candidates into the inbox
```

Sources live in `data/sources.yml`; adding one is a config change, not a code
change. STEPWIRE collects from official feeds, official APIs and public feeds —
it does not scrape. See [`docs/sources.md`](docs/sources.md).

The collector never publishes. Its only output is a GitHub issue labelled
`news-inbox` for a human to accept or ignore.

## Video preview

```bash
pnpm dev            # → /studio — article selector, player, render controls
pnpm video:studio   # → Remotion Studio, for scene design
```

## Video rendering

```bash
pnpm video:render <slug>                              # local: free, no account
pnpm video:render <slug> --composition STEPWIRE_NEWS
```

Cloud rendering goes through `/api/render` (Vercel Sandbox → Vercel Blob) and is
guarded by an operator token, a rate limit and content-addressed duplicate
prevention. See [`docs/video-system.md`](docs/video-system.md).

---

## Deploying to Vercel

1. Import the repository. Framework preset **Next.js**; the defaults are
   correct. Node 22.
2. **Add a Blob store** (Storage → Blob). This sets `BLOB_READ_WRITE_TOKEN` and
   is where rendered videos are stored.
3. Set environment variables (Project → Settings → Environment Variables):

   | Variable | Needed for | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | custom domain | Otherwise derived from the Vercel URL |
   | `STEPWIRE_RENDER_TOKEN` | rendering | `openssl rand -hex 32`. Without it `/api/render` is disabled |
   | `VERCEL_TOKEN` | cloud rendering | Account → Tokens |
   | `VERCEL_TEAM_ID` | cloud rendering | Team → General |
   | `VERCEL_PROJECT_ID` | cloud rendering | Project → General |
   | `STEPWIRE_INCLUDE_FIXTURES` | production | Set to `false` to drop the sample articles |

   Cloud rendering needs all three Vercel variables; with any missing, the API
   falls back to the local driver rather than half-working.

4. Deploy. Every merge to `main` publishes.

### GitHub Secrets

**None are required.** The collector workflow uses the built-in
`secrets.GITHUB_TOKEN`, which already has the `issues: write` and
`contents: write` permissions the workflow declares.

Add a secret only if you later want the collector to reach a source that needs
an API key; reference it from `collect-news.yml` and read it in that source's
adapter.

---

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Run the website locally |
| `pnpm build` · `pnpm start` | Production build and serve |
| `pnpm verify` | lint + typecheck + test + content validation + build |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Individually |
| `pnpm content:validate` | Editorial gate: sourcing, citations, uniqueness |
| `pnpm article:new --title "…" [--category …]` | Scaffold a draft |
| `pnpm article:from-issue <n>` | Scaffold a draft from an inbox issue |
| `pnpm news:collect --dry-run` | Collect from fixtures; file nothing |
| `pnpm news:collect --create-issues` | Collect and open issues |
| `pnpm video:studio` | Remotion Studio |
| `pnpm video:data` | Write Remotion props files for real articles |
| `pnpm video:render <slug>` | Render locally to `video/out/` |

---

## Current limits

Honest about what this MVP does not do yet.

- **The render rate limiter is per-instance.** With several serverless instances
  the effective ceiling is higher than configured. The shared-secret gate is the
  real cost control; the limiter is behind an interface for when a shared store
  is warranted.
- **Render job status is in memory.** Polling can report `unknown` if it lands
  on a different instance. Harmless — the finished file is found in storage,
  which is authoritative.
- **The collection ledger is a committed JSON file.** Fine at a few candidates a
  day. At higher volume, deduplicate against issue search alone and drop it.
- **No HTML adapter.** Deliberate. See the scraping policy in `docs/sources.md`.
- **Video type uses a system font stack**, so metrics vary slightly by render
  platform. `@remotion/google-fonts` is the upgrade path.
- **No AI yet.** `lib/ai/` is a reserved boundary, not an implementation.
- **Article images are not yet used.** `heroImage` and `thumbnail` exist in the
  schema and validate, but no article template renders them.
- **`/studio` is unauthenticated** but `noindex`, and the render endpoint it
  calls is token-gated. Put it behind Vercel Deployment Protection if the
  deployment is public.

## Licence and attribution

STEPWIRE is an independent publication. All game trademarks belong to their
respective owners. Sample fixture content in `content/fixtures/` and
`data/fixtures/` describes invented events and is not reporting.
