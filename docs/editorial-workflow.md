# Editorial workflow

From "something happened" to "the video is posted", in seven steps.

```
Collect → Inbox → Verify → Draft → Review → Publish → Video
```

The whole loop is designed to be run by one person in an evening.

---

## 1. Collect

A GitHub Action runs every four hours and files candidate stories into the
editorial inbox.

```bash
# Run it yourself, safely — fixtures only, no network, no issues created
pnpm news:collect --dry-run
```

The collector reads `data/sources.yml`, fetches each enabled source through its
adapter, normalises what it finds, discards anything already seen, and opens a
GitHub issue for the rest.

It never publishes, never drafts, and never marks anything as breaking. Adding a
source is covered in [`sources.md`](./sources.md).

**Nothing found?** That is a normal outcome. A quiet wire is quiet.

## 2. Inbox

Open the issues labelled [`news-inbox`](../../issues?q=is%3Aissue+is%3Aopen+label%3Anews-inbox),
or read the same queue on the **wire board**:

```bash
pnpm dev     # → http://localhost:3000/studio/wire
```

The board shows every open candidate grouped by the day it happened, with its
source, its summary and its suggested category visible without opening anything
— which is what a list of issue titles cannot tell you. It reads the issues and
writes nothing: there is no accept button, because accepting a candidate is
`pnpm article:from-issue <n>` (a file and a diff) and dismissing one is closing
the issue. Without `GITHUB_TOKEN` and `GITHUB_REPOSITORY` the board says so
rather than failing.

Each issue carries the headline, the source and its canonical URL, when it was
published and collected, the source's own summary, the raw feed metadata, and
the collector ID. It also carries a small machine-readable copy of those fields
in an HTML comment, which is what the board reads; edit the prose freely, and an
issue whose comment gets mangled still appears on the board from its title and
labels alone.

Labels are the machine's guess, not a decision:

| Label | Meaning |
| --- | --- |
| `news-inbox` | Filed by the collector or the manual template |
| `needs-review` | Nobody has looked at it yet |
| `source:official` · `source:media` · `source:community` | Where it came from |
| `category:*` | Suggested STEPWIRE category |
| `priority:*` | Always `normal` from the collector — you set the real one |

Triage is blunt on purpose:

- **Not a story** → close it. The collector will not re-file it.
- **Interesting but not now** → `priority:low`, leave it open. This is the
  archive queue.
- **Worth writing up** → continue.

Something the collector cannot see (a post in a chat, a conversation at an
arcade) goes in by hand with the **News candidate (manual)** issue template.

## 3. Verify

Before drafting. This is the step that makes STEPWIRE worth reading.

- **Find the first-party source.** If an outlet is reporting an announcement,
  link the announcement, not the report. If both are useful, list both.
- **Check the claim actually says what the headline says.** Feed summaries
  routinely overstate.
- **Decide what you do not know.** Anything unverified either gets attributed
  in the text ("according to X") or does not appear.

If there is no source a reader could check, there is no article. Close the
issue.

## 4. Draft

```bash
pnpm article:from-issue 42
```

This reads the issue, pulls out the headline, source and summary, picks the
category from the issue's labels, and writes
`content/articles/YYYY-MM-DD-slug.mdx` with `status: draft`.

Without an issue:

```bash
pnpm article:new --title "Headline here" --category UPDATE
```

From a post on X — the story starts with an announcement or a result someone
posted:

```bash
pnpm article:from-post https://x.com/DDR_573/status/… --category CHARTS
```

This reads the post through X's official oEmbed API (no scraping, no key),
fills in the source with the author and date, and quotes the post into NEWS as
a starting point. The post's picture is not fetched: save it under
`public/images/` yourself and declare it with a credit. The division of labour
when Claude does the drafting is in [`handoff.md`](./handoff.md).

Then write the three sections. They are the format, and the split is enforced by
the schema:

### `## NEWS` — what happened

Reported fact, and nothing else. Every factual claim carries a citation marker
tying it to an entry in `sources`:

```markdown
The update adds a per-panel accuracy readout to the results screen.[^1]
```

The marker renders as a numbered link to the source list, and the source list
links back. A reader can move between a claim and its evidence in either
direction.

### `## CONTEXT` — why it is notable

STEPWIRE's own analysis, labelled as such on the page. The useful question is
not "what else happened" but "what does this change about how the scene works".

### `## PLAYER IMPACT` — what changes for a player

Concrete and practical. What is different next time someone stands on a
cabinet? If the honest answer is "nothing yet", write that — it is more useful
than manufactured significance.

### Frontmatter worth thinking about

| Field | Notes |
| --- | --- |
| `slug` | **Permanent.** Never change it after publishing. |
| `shortTitle` | Used in cards and as the video headline. Set it when the title is long. |
| `dek` | One sentence under the headline. Also the meta description. |
| `summary` | One factual sentence. Feeds the social card and the video. |
| `importance` | `breaking` and `major` show a signal flag. Use them rarely. |
| `sources` | Ordered. `[^1]` is the first entry. |
| `video` | Optional overrides only — see [`video-system.md`](./video-system.md). |

Check your work:

```bash
pnpm content:validate
```

It fails on a published report with no source, a citation pointing at nothing, a
NEWS section that cites nothing, a duplicate slug or id, or an `updatedAt`
before `publishedAt`. It warns about a source listed but never cited.

## 5. Review

```bash
pnpm verify        # lint + typecheck + test + content validation + build
pnpm dev           # read it at localhost:3000
```

Then open a pull request:

```bash
git checkout -b article/short-slug
git add content/articles/
git commit -m "Add: <headline>"
git push -u origin article/short-slug
```

Reference the issue in the description (`Closes #42`) so the inbox clears itself
on merge. CI runs the same gate.

Reading the diff is worth the minute. In this workflow a pull request is the
last point at which an unsourced claim can be caught.

## 6. Publish

Set `status: published`, merge, and Vercel deploys.

What happens automatically on merge: the article page is generated with a
permanent URL, it appears on the homepage and its desk, a social card is
rendered, and it enters the sitemap and the RSS feed.

To correct a published article, edit it and set `updatedAt`. The URL never
changes. For a substantive correction, say what changed in the body — a wire
that quietly rewrites itself is not an archive.

## 7. Video

```
open /studio → pick the article → pick a composition → preview → render → post
```

The video is derived from the article you just published. Nothing to rewrite.

- **STEPWIRE_SHORT** (1080×1920) — Shorts, Reels, TikTok, X
- **STEPWIRE_NEWS** (1920×1080) — YouTube, embeds

Preview it in the studio. If a line reads badly on screen, the fix is usually to
improve the article's wording, which improves both surfaces at once. Reach for
`article.video` overrides only when the surfaces genuinely differ.

Rendering costs money, so:

```bash
pnpm video:render <slug>                              # local, free, no account
pnpm video:render <slug> --composition STEPWIRE_NEWS
```

Cloud rendering (the studio's **Render** button) needs the operator token and
reuses an existing render for unchanged content. Details in
[`video-system.md`](./video-system.md).

---

## The loop, condensed

```bash
# see what came in
pnpm dev                       # /studio/wire

pnpm article:from-issue 42     # draft
$EDITOR content/articles/...   # write
pnpm content:validate          # check
pnpm verify                    # prove
# PR → merge → deployed

pnpm dev                       # /studio → preview → render → post
```
