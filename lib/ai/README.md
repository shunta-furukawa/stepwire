# `lib/ai/` — reserved boundary

Empty on purpose. No LLM SDK is in this project's dependency tree, and none
should be added to a core module.

## The rule

**Collection, editing, publishing and video rendering must all keep working
with AI absent.** Not degraded-but-limping — working. An outage, a cost ceiling,
a bad model update or a decision to stop using a vendor must never stop MONO DDR
from publishing a story.

That makes AI an optional accelerator layered on top of a complete pipeline,
never a link in it.

## The seams that already exist

The pipeline was shaped for this, so adding AI later is filling in a slot rather
than restructuring anything:

| Seam | Where | What AI could do |
| --- | --- | --- |
| `DuplicateDetector` | `lib/news/dedupe.ts` — an injected function behind an interface | Semantic near-duplicate detection across differently-worded headlines |
| Candidate enrichment | between `collectNews()` and `issueBody()` | Summarise a candidate, propose a category and an importance, suggest tags |
| Draft scaffolding | `scripts/create-article.ts` | Fill the NEWS section from the source, propose CONTEXT angles, suggest headlines |
| Video copy | `lib/video/scenes.ts` overrides | Propose a `video.headline` that fits a 9:16 frame, or a hook |

## Rules for anything added here

1. **No core module imports this directory.** The dependency points one way:
   `lib/ai/` may read the content and news types; nothing in `lib/content/`,
   `lib/news/` or `lib/video/` may import from here.
2. **Vendor SDKs stay inside this directory**, behind an interface defined here.
   Swapping providers must be one file.
3. **Every call is optional and fails soft.** A failure logs and returns
   `undefined`; the caller carries on with its non-AI path.
4. **AI output is never a source.** It may draft prose and propose metadata. It
   may not supply a fact, and it may never populate `sources`. See the sourcing
   rules in `docs/editorial-workflow.md`.
5. **A human still merges.** AI may open a draft; it may not publish, and it may
   not decide that something is worth publishing.
6. **Model choice is configuration**, not a hard-coded constant.

## Not yet decided

Which provider, whether inference runs in CI or locally, and whether drafting is
worth the review cost at all. None of those need answering to keep publishing
today, which is precisely why this directory is still empty.
