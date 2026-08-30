# Sources

How the collector learns about a feed, and the rules it collects under.

## Adding a source

Sources live in `data/sources.yml`. Adding one is a change to that file — no
code, no deploy.

```yaml
sources:
  - id: example-official          # lowercase-kebab-case, permanent
    name: Example Official News   # shown in the issue and in attribution
    type: rss                     # rss | atom | json | fixture
    url: https://example.com/feed.xml
    enabled: false                # start disabled; enable in its own PR
    category: official            # official | media | community
    suggestedCategory: UPDATE     # the STEPWIRE category a human will usually pick
    homepage: https://example.com/
    maxItems: 10                  # per-run cap for this source
    notes: >-
      Terms permit automated polling. Publishes 2–3 items a week.
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | **Permanent.** It seeds every collector ID from this source, so renaming it re-collects everything. |
| `name` | yes | Human-readable. |
| `type` | yes | See adapters below. |
| `url` | yes | The feed endpoint — not the homepage. For `fixture`, a repo-relative path. |
| `enabled` | no | Defaults to `false`, so a new source is never live by accident. |
| `category` | yes | Becomes the `source:*` issue label. |
| `suggestedCategory` | no | Defaults to `NEWS`. |
| `homepage` | no | Attribution link. |
| `maxItems` | no | Defaults to 10. Protects against a feed flood. |
| `notes` | no | Terms, rate limits, contact — anything a future reviewer needs. |
| `options` | no | Adapter-specific. Only the JSON adapter uses it. |

Then check it:

```bash
pnpm news:collect --dry-run --source example-official
```

The registry is Zod-validated: a malformed entry, a bad id or a duplicate id
fails the run with a clear message, and `pnpm test` covers the same rules.

## Adapters

| `type` | Status | Notes |
| --- | --- | --- |
| `rss` | implemented | RSS 2.0 |
| `atom` | implemented | Atom 1.0 — same adapter; the two formats describe the same thing and publishers mix them |
| `json` | implemented | JSON Feed, or any JSON endpoint via a field mapping |
| `fixture` | implemented | Reads from `data/fixtures/`. How the pipeline is tested without touching the network |
| `html` | **not implemented** | See the scraping policy below |
| `manual` | **not implemented** | Use the *News candidate (manual)* issue template instead |

Adapters are isolated. Each knows only its own format, and the collector catches
per-adapter failures — so a publisher changing their feed shape produces one
warning line, not a failed run. `pnpm test` asserts exactly that.

### The JSON adapter's field mapping

An official JSON API can be added without writing a new adapter:

```yaml
  - id: chart-api
    name: Chart Release API
    type: json
    url: https://example.com/api/releases
    enabled: false
    category: official
    suggestedCategory: CHARTS
    options:
      itemsPath: data.releases      # dot path to the array
      fields:
        url: link
        title: name
        summary: note
        publishedAt: released_at
```

Defaults match JSON Feed (`items`, `url`, `title`, `summary`, `date_published`),
so a JSON Feed needs no `options` at all.

## Scraping policy

**STEPWIRE does not scrape.** There is no `html` adapter, and that is a
deliberate position rather than an unfinished feature.

Official feeds, official APIs and public feeds are the collection surface. They
are stable, they are offered for this purpose, and they do not put load on
anyone's server.

If a genuinely important source publishes no feed, a site-specific adapter may
be added — one adapter per site, never a generic scraper — and only after all of
the following:

1. **robots.txt and terms** checked and recorded in the source's `notes`.
2. **Request budget** set. One request per run, at the existing 4-hour cadence.
   Never crawl beyond the index page.
3. **Caching** via conditional requests (`ETag` / `If-Modified-Since`) so an
   unchanged page costs the publisher nothing.
4. **Attribution** by name on every story that uses it — which the issue body
   and the article's `sources` already do.
5. **Failure is contained.** A DOM change breaks that one adapter and nothing
   else. This is already how the adapter interface works; keep it that way.

If any of those cannot be satisfied, the answer is to file candidates by hand
with the manual issue template. Use the **Add a source** issue template to
propose one — it carries these checks as a checklist.

## Deduplication

The same story reaches STEPWIRE more than once: a feed re-serves it, two outlets
syndicate it, a URL picks up a campaign parameter. Three rules, in order:

1. **Collector ID.** `sha256(sourceId + normalized URL)`, truncated. Stable
   across runs, mirrors and tracking parameters.
2. **Normalised URL.** Catches the same document arriving from a *different*
   source.
3. **Normalised headline.** Catches syndication, where two outlets publish the
   same announcement at different URLs. Only applied to headlines of 24
   characters or more — below that a collision is too weak a signal.

URL normalisation strips tracking parameters (`utm_*`, `fbclid`, `gclid`, and
friends), lowercases the host, drops `www.`, treats `http` and `https` as one
document, sorts the remaining query parameters, and removes the fragment and a
trailing slash. The original URL is preserved in the issue — the link must go
where the source put it.

The "already seen" set is rebuilt each run from the committed ledger
(`data/news-ledger.json`) **and** from the collector IDs embedded in existing
`news-inbox` issues, so deduplication survives a lost ledger.

To change the rules, replace `defaultDuplicateDetector` in `lib/news/dedupe.ts`.
It is a plain function behind an interface precisely so that a later revision
(embedding similarity, an LLM judgement) can be swapped in without touching the
pipeline.

## Schedule

`.github/workflows/collect-news.yml` runs every four hours — 07:10, 11:10,
15:10, 19:10, 23:10 and 03:10 JST. Offset off the hour to avoid the top-of-hour
spike on shared runners.

Run it on demand from the Actions tab, optionally scoped to a few sources or
limited to a dry run.

The collector is a separate workflow from CI and from deployment on purpose: a
broken feed, an expired token or a rate-limited source must never be able to
hold up the website.

## Troubleshooting

```bash
pnpm news:collect --dry-run                      # everything enabled, no issues filed
pnpm news:collect --dry-run --source my-source   # one source
pnpm news:collect --dry-run --limit 3 --max-age-days 30
```

**A source reports an error.** The message is the adapter's. `HTTP 404` means
the feed moved; a parse error usually means the endpoint now returns HTML (a
consent wall or a redirect).

**Nothing new, but the feed has new items.** They are being deduplicated. Check
`data/news-ledger.json` and the closed `news-inbox` issues for the collector ID.

**Everything is filtered out.** `--max-age-days` defaults to 14. A feed that
republishes old items with old timestamps will produce nothing.
