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
    filter:                       # required unless the feed is DDR-only
      include: [DanceDanceRevolution, DDR]
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
| `filter` | no | Relevance terms. Required in practice for any feed that is not DDR-specific — see below. |
| `notes` | no | Terms, rate limits, contact — anything a future reviewer needs. |
| `options` | no | Adapter-specific. Only the JSON adapter uses it. |

Then check it:

```bash
pnpm news:collect --dry-run --source example-official
```

The registry is Zod-validated: a malformed entry, a bad id or a duplicate id
fails the run with a clear message, and `pnpm test` covers the same rules.

## Currently registered

| id | Source | Type | Enabled | Why |
| --- | --- | --- | --- | --- |
| `ddrcommunity` | DDRCommunity | RSS 2.0 | ✅ | The only DDR-only source found. Highest signal-to-noise; needs no filter. Also covers BPL and tournament results. |
| `bemaniwiki` | BEMANIWiki 2nd (RecentChanges) | RSS 2.0 | ✅ | Earliest signal that a DDR page changed. Filtered to DDR. |
| `4gamer` | 4Gamer.net | RSS 1.0 | ✅ | Catches the rare DDR story that reaches general games media. Filtered. |
| `bemani-youtube` | BEMANI CHANNEL (YouTube) | youtube (API v3) | ❌ | Implemented; needs `YOUTUBE_API_KEY`. Official BPL video. See below. |
| `bpl-official` | BEMANI PRO LEAGUE site | — | ❌ | Live, but publishes no feed of any kind. Manual route. |
| `reddit-ddr` | r/DanceDanceRevolution | Atom | ❌ | DDR-specific and a good fit, but Reddit rate-limits datacenter IPs — a runner would mostly see 429. |
| `fixture-*` | Sample feeds in `data/fixtures/` | fixture | ✅ | Exercise the pipeline in CI with no network access. |

### Sources with no feed

**KONAMI / e-amusement.** `p.eagate.573.jp` returns no `robots.txt` and sits
behind a WAF; `konami.com/amusement` has article pages but no index or RSS. The
**BEMANI PRO LEAGUE** site at `p.eagate.573.jp/game/bpl/` is live and returns
HTTP 200, but declares no RSS or Atom link at all — there is nothing to poll.

First-party announcements and BPL schedules therefore enter the inbox by hand,
through the *News candidate (manual)* issue template — or indirectly, since
`ddrcommunity` and `bemaniwiki` both cover BPL. That is the intended route, not
a gap: see the scraping policy below.

### YouTube: why the API and not the feed

`https://www.youtube.com/feeds/videos.xml?channel_id=…` returns a perfectly good
Atom feed for the official BEMANI channel, where BPL matches are streamed. This
project does not use it, because YouTube's `robots.txt` says:

```
User-agent: *
Disallow: /feeds/videos.xml
```

The collection policy says robots is checked before a source goes live, and a
policy that bends the first time it is inconvenient is not a policy. So official
video comes through the **YouTube Data API v3** — a documented, first-party
interface — via the `youtube` adapter.

The adapter calls `playlistItems.list` on the channel's uploads playlist. That
costs **1 quota unit** against a default of **10,000 per day**, so the
four-hourly schedule spends about **6 units a day**. Quota is not a constraint
here.

#### Enabling it

1. **Google Cloud Console** → create a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **Credentials → Create credentials → API key**. Restrict the key to the
   YouTube Data API v3 — an unrestricted key is a liability, not a convenience.
4. Put it in `.env.local` as `YOUTUBE_API_KEY`, and add the same value as a
   **GitHub Actions secret** named `YOUTUBE_API_KEY`. The workflow already
   passes it through.
5. Verify before enabling:

   ```bash
   pnpm news:collect --dry-run --source bemani-youtube
   ```

6. Flip `enabled: true` in `data/sources.yml`, in its own pull request.

Until the key exists the source reports one warning per run and **every other
source collects normally** — an unconfigured key is never able to break the
newsroom.

#### Configuring it

```yaml
    type: youtube
    url: youtube-data-api-v3     # a label; the adapter builds the real request
    options:
      channelId: UCVbHFsn9ymFxkT7xsFVE17Q   # uploads playlist: UC… -> UU…
      # or, for a curated playlist instead of uploads:
      # playlistId: PL…
```

The API key never appears in `data/sources.yml`. It is read from the
environment, which is why this needs its own adapter rather than the generic
`json` one — that, and the fact that the watch URL is built from
`resourceId.videoId` rather than read from a field.

#### What is and is not verified

The request path is verified against the live API: a missing key produces a
per-source warning, and an invalid key surfaces Google's own error reason
(`badRequest — API key not valid`) without echoing the key. The **success-path
field mapping is verified against the documentation only**, since capturing a
real response needs a valid key. `data/fixtures/youtube-playlist-items.sample.json`
is hand-built to the documented shape and says so; replace it with a trimmed
real capture once a key is available.

## Relevance filtering

Almost no real feed is DDR-specific: a wiki's recent-changes feed covers every
game it documents, and a games-media feed covers every game there is. Without a
filter one run would bury a single relevant item under fifty irrelevant ones,
and an inbox that cannot be triaged on a phone has lost its only advantage.

```yaml
    filter:
      include:              # keep an item matching ANY of these
        - DanceDanceRevolution
        - DDR
      exclude:              # ...unless it matches any of these
        - MenuBar
```

Matching is case-insensitive substring against the title and the summary.
Deliberately not regular expressions: the registry is editorial configuration
reviewed by a human in a pull request, and a mis-anchored regex fails in ways a
substring cannot.

The filter runs **before** `maxItems`, so a busy multi-game feed cannot spend
its per-source budget on items that are about to be discarded.

A run where the filter removes everything is normal and costs one request:

```
bemaniwiki: 15 item(s) fetched, 15 filtered out as off-topic
```

## Adapters

| `type` | Status | Notes |
| --- | --- | --- |
| `rss` | implemented | RSS 2.0, 0.9x **and RSS 1.0 (RDF)** — the last is still common on Japanese sites, and its `<item>` elements are siblings of `<channel>` rather than children |
| `atom` | implemented | Atom 1.0 — same adapter; the two formats describe the same thing and publishers mix them |
| `json` | implemented | JSON Feed, or any JSON endpoint via a field mapping |
| `youtube` | implemented | YouTube Data API v3. A first-party API rather than a feed — see below |
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

**Everything is filtered out.** Two different causes. `--max-age-days` defaults
to 14, so a feed republishing old items with old timestamps produces nothing.
Separately, a source's `filter` may simply not match anything in the current
window — for a general-interest feed that is the normal case, and the run log
says so explicitly (`… 15 filtered out as off-topic`).

**Dates are missing on every item.** The feed is probably stamping them with a
timezone abbreviation. `Date.parse` accepts the RFC-822 US zones; the adapter
adds the Asia-Pacific ones (JST, KST, HKT, SGT, AEST, NZST). Anything else
yields no date rather than a guessed one, which is safe — the item just skips
the age filter. Add the abbreviation to `TIMEZONE_OFFSETS` in
`lib/news/adapters/feed.ts` if it is unambiguous.
