# Video system

STEPWIRE videos are *derived* from articles. There is no video CMS, no script
file, and no second copy of the copy.

```
Article ──► buildSceneSequence() ──► Scene[] ──► canvas + WebCodecs (on the device) ──► MP4
```

## Two kinds of video

An article produces one of two films, depending on whether it has a recording.

| | Silent | Narrated |
| --- | --- | --- |
| Body | Cards derived from NEWS / CONTEXT / PLAYER IMPACT | Subtitle pages from the transcript |
| Pacing | Estimated reading time | The speaker's own timing |
| Length | Trimmed to the format's ceiling | As long as the recording |
| Audio | none | the recording |

Both open with the headline and close with the source card and the outro.
Everything else changes.

### The session card

An article with a `session` block opens on the session instead of the
headline: the thumbnail has already said what the film is about, so the first
seven seconds show what was played. The card is an infographic in motion — the
date and the window, the length counting up, tiles for charts played, average
level, personal bests and FLARE SKILL (with its rise as a pulsing chip), a bar
per play in the difficulty's colour with the personal bests marked, and the
difficulty mix as chips.

```yaml
session:
  date: '2026-09-03'
  start: '19:08'            # optional; with `end`, gives the window and the length
  end: '19:37'
  venue: 普段行かないゲーセン  # optional
  weather: 晴れ              # optional, in the operator's words
  style: SINGLE             # or DOUBLE
  flareSkill:               # optional; from the profile page after the session
    after: 88894
    before: 88100           # optional — the last write-up's value; gives the rise
    rank: SUN               # optional — the FLARE RANK name the profile shows
```

FLARE SKILL is a total, not a per-play number: the game sums the best thirty
charts of each of three categories, so a session moves it only when a play
enters that set. The tile rolls the number up to `after` — from `before`
when there is one, with the rise as a pulsing chip — and prints the rank
name where a unit would go. Plays that declare a `flare` rank add a second
row of chips under the difficulty mix, with EX filled in the game's rainbow.

Every number is counted by `lib/video/session-stats.ts` from the block and
from the first `plays` figure — the session log — and nothing is inferred: a
personal best is a `pb: true` the operator wrote on the row. Every motion on
the card is a function of the frame. The card is never trimmed under budget.

### The recording is the script

The operator talks to the phone; the words are transcribed; the video types
them. **The voice itself never reaches the film.** This is what the operator
asked for, and it removes the one place the article and the video were allowed
to differ in wording: the transcript is edited into the article, and the video
derives from that, like everything else.

Sourcing stays entirely on the article. A recording is never a source.

```bash
pnpm narration:transcribe <slug>     # local Whisper; writes content/transcripts/
```

**Read the transcript and fix it.** Whisper mishears DDR jargon constantly.

### The text box

Copy does not appear; it types. Each character lands on a fixed cadence
(`lib/video/reveal.ts`: two frames per character for a headline, one for body)
and a tick sounds as it lands — the rhythm-game register the brand sits in.
The cadence is the single source of timing: the renderer and the tick track
read the same `RevealPlan`, so a character lands on the frame its tick sounds.

### The soundtrack

Ticks over music, mixed on the device (`lib/video/canvas/mix.ts`). The ticks
are synthesised, not sampled — twenty lines of arithmetic rather than an asset
to license and lose. Music comes from the article:

```yaml
bgm:
  src: audio/bgm/macleod-getting-it-done.mp3   # under public/audio/bgm/
  credit: '"Getting it Done" Kevin MacLeod (incompetech.com) · CC BY 4.0'
  gain: 0.4
```

Three tracks ship with the repository, one per register — see
`docs/audio-sources.md` for which is which and the exact credit line.

`credit` is required. **What goes under a STEPWIRE video is an editorial and a
legal decision the software does not make.** A game's own tracks in a public
video will be matched by Content ID, and Japan has no general fair-use defence.
The mechanism is here; the file is the operator's.

### Images

```yaml
heroImage:                          # behind the opening headline
  src: images/hero.png
  alt: …
  credit: …
media:                              # shown after the reported fact
  - src: images/jacket.png
    alt: …
    credit: '© … / 公式サイトより'   # required
    caption: …
    kind: jacket                    # jacket · screenshot · post · photo
```

A picture can also be placed in the prose, on a line of its own:

```md
![](images/articles/2026-09-03-esw-7th-mca/result-decryption.jpg)

新曲3曲で一番きつかったのは「Decryption」だった。…
```

It must name a `media` entry (that is where the credit lives). In the video it
rides with the paragraph after it — a panel beside the copy in landscape,
above it in portrait — so the operator talks about a result while the result
is on screen. Pictures the prose never places still get their own card after
the reported fact.

A jacket, a screenshot or somebody's post in a published video is a quotation,
and the credit is what makes it one. The validator refuses an article without
one rather than the video quietly omitting the line.

### The field

Behind every card is a field of low-poly facets and sparks, drawn with WebGL
(`lib/video/field.ts`, the one module that imports `three`). It is the brand's
facet texture given depth: outlines in the off-white, a few filled in the lime,
sparks that rise and twinkle, a burst on every cut. Nothing else — no third
colour, no blur.

The field is a **function of the frame**. `lib/video/field-plan.ts` turns a
scene and a frame number into a small state (time, energy, burst, enter), and
`field.ts` paints that state; it never reads a clock. Rendering frame 240 twice
gives the same pixels, scrubbing backwards is correct, and the preview shows the
export. `FIELD_ENERGY` decides how lively the field is behind each scene type:
loud on the headline, quiet under a card being read.

The stack under every card is fixed in `lib/video/ground.ts` and painted in
this order: ground, the article's picture (with a slow push in), the field,
then the copy. `drawScene` paints it before the scene's drawer runs. Without
WebGL the film is plainer, not absent.

### The conversation cards

A paragraph that opens `WIRE: …` or `MONO: …` becomes a `turn` card: the
speaker's face and name over the words, on the analysis ground, typed like
every other card. WIRE's face (`lib/design/wire.ts`) takes the mood the
writer wrote — `WIRE(grin): …` — and blinks and floats as a function of the
frame; MONO's mark holds still. A picture placed before a turn rides with
it, as with a paragraph. Turn cards count against the section's card cap
and are dropped under budget like the paragraphs they replace.

## How a video is built

`lib/video/scenes.ts` turns an `ArticleVideoInput` into a scene sequence:

1. **Headline** — first, over the hero image, with category and date as the
   kicker. No ident up front: a feed gives a film two seconds to earn the next
   two, and an ident spends them on the brand. The ident is the sign-off.
2. **News** — the reported fact, split on sentence boundaries into typed cards.
3. **Images** — `media`, in order: what the story is about, shown before anyone
   says what it means.
4. **Context / Impact** — the analysis, typed.
5. **Figures** — one scene per entry in the article's `figures`, if any.
6. **Source** — the primary source. Never dropped.
7. **Outro** — the wordmark and tagline.

A typed card's duration is its reveal plus a hold: characters × cadence, then
the greater of 1.4s or 90% of the reveal, so a long card is read as well as
watched.

**The length of a video is therefore a property of the article's content** —
nobody types a duration anywhere; the exporter asks the sequence how long it is.

If the total exceeds the format's ceiling, `trimToBudget` drops trailing
analysis cards. The intro, headline, first news card, source and outro are never
dropped: a short video missing its last supporting point is still coherent; one
missing its source is not.

## Compositions

| Id | Size | fps | For |
| --- | --- | --- | --- |
| `STEPWIRE_SHORT` | 1080×1920 (9:16) | 30 | Shorts, Reels, TikTok, X. Target 20–45s |
| `STEPWIRE_NEWS` | 1920×1080 (16:9) | 30 | YouTube, embeds. Target 35–90s |

Both draw through one renderer (`lib/video/canvas/draw.ts`). They differ only
in the derived sequence — card budget, cards per section, duration bounds —
and in the landscape/portrait branches of the drawers, not in duplicated code.

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

## The studio — preview, export, thumbnail, post copy

```bash
pnpm dev     # → http://localhost:3000/studio
```

Everything happens on the device that opens the page. The studio lists
drafts and reviews as well as published articles, so a film can be watched
before the text is public.

- **Preview** draws any frame with the export renderer (`lib/video/canvas/
  draw.ts`) — the slider shows, pixel for pixel, what the file will contain.
  There is one renderer; there is nothing for a preview to disagree with.
- **Export** draws every frame to a canvas, encodes with WebCodecs (H.264 where
  the device offers it, VP9 otherwise), mixes the ticks and the music, and
  muxes an MP4 the phone can save or share. A 1080p minute takes about a
  quarter of real time on an iPhone.
- **Thumbnail** (`lib/video/canvas/thumbnail.ts`) is a 1920×1080 JPEG: the
  short title fitted as large as it goes, the highlighted results as chips in
  the game's colours, the result photos in a column.
- **Post copy** (`lib/video/post-copy.ts`) is the title, the description with
  the article link, every source and every credit, and the hashtags.

Nothing renders on a server, and nothing in the deployment can spend money on
a render. That is a rule (`CLAUDE.md`), not a limitation of the moment: the
on-device path was measured faster than the cloud one it replaced.

## Adding a scene

1. Add the type to `SCENE_TYPES` in `lib/video/scene-types.ts` and decide its
   tone in `SCENE_TONE` and its energy in `FIELD_ENERGY` — both are `Record`s,
   so a missing entry fails to compile.
2. Emit it in `buildSceneSequence`, with a duration derived from its content.
3. Write its drawer in `lib/video/canvas/draw.ts` and register it in `DRAWERS`.
4. If it should be droppable under budget pressure, add it to `droppable` in
   `trimToBudget`. If it must always appear, do not.
5. Add a case to `tests/video.test.ts` — scenes are tested as data, never by
   rendering. Look at the result in `/studio`.

## Adding a composition

1. Add an entry to `COMPOSITIONS` in `lib/video/compositions.ts`.
2. Add a profile to `PROFILES` in `lib/video/scenes.ts` (card budget, cards per
   section, picture budget, duration bounds, fixed-scene lengths).
3. If the aspect ratio is new, check the panel and band arithmetic in
   `lib/video/canvas/draw.ts`, which branches on landscape versus portrait.

`/studio` reads the registry, so nothing else needs changing.

## Type

The film and the thumbnail set copy in the system stacks from
`lib/design/tokens.ts`, with one exception: `font.impact`, Dela Gothic One,
a black Japanese display gothic self-hosted in `public/fonts/` under the
SIL OFL. It is used where the words have to win a tap — the thumbnail
headline and the film's headline card — and nowhere on the website, so
the 2.4 MB file is fetched only by the studio. A canvas paints with
whatever is loaded, so every drawer's caller awaits `ensureFonts()`
(`lib/video/canvas/fonts.ts`) first; without it the first thumbnail of a
session comes out in the fallback gothic.

The thumbnail headline is set as a poster: `fitHeadlineTight` sizes every
line on its own to fill the column's width and scales the block to the
height, trying one to four lines and keeping the split that fills the most
of the box. A line never breaks inside a Latin word, never starts with a
closing mark, and never holds a single character.

## Design system

Video styles come from `lib/design/tokens.ts` — the same module the website's
Tailwind theme mirrors. The renderer multiplies the web type scale by 3 for a
1080-class frame and scales by the frame's short edge; it defines no values of
its own. `tests/tokens.test.ts` fails if the palette ever drifts from the CSS.

The motifs the renderer draws, and where:

| Motif | Drawn by |
| --- | --- |
| The masthead (`STEPWIRE` and a meta line) | `drawWireBar` |
| The step timeline — how much is left | `drawProgressRail` |
| The facet hatch, as texture | `drawFacets` |
| The label chip, neutral for fact and lime for analysis | `drawLabelChip` |
| The article's picture, full-bleed and darkened where the copy sits | `drawBackdrop` |
| A result photo beside the copy | `drawPanel` |
| The particle field under everything | `lib/video/field.ts`, composited by `drawScene` |
| `KineticText` | Word-by-word reveal — emphasis, not busywork |
| `LabelChip` · `BodyText` · `Card` | Layout and typography |

Reported fact carries a neutral label chip; editorial analysis carries a lime
one. That is the same fact/analysis distinction the website draws with its
出典つき / MONO DDRの言葉 labels — the video does not invent its own vocabulary.

Fact also sits on the deepest ground and analysis on a raised one, but the chip
is what actually carries the distinction: on a dark-first palette the two
grounds differ by a few percent of luminance, which reads side by side and not
at all across a cut.

**Fonts.** Video type uses the same system stack as the website — no webfont.

The film is drawn on the device that exports it, and a phone has a Japanese
face. Loading Noto Sans JP from Google Fonts was tried when a server rendered
the film and reverted — hundreds of requests per render for a subset split
across unicode ranges — and the export needs no network at all, so a webfont
would be the one dependency it has. The cost is that glyph metrics differ
slightly between the phone that exports and a laptop that previews; for one
operator's setup that is the better trade.

## Troubleshooting

**The studio says there is no codec.** WebCodecs is missing or offers no
H.264/VP9 encoder — Firefox, or an old iOS. Export from Safari on iOS 17+ or
from Chrome.

**The export has no sound, or the sound will not play.** The studio verifies
the track it wrote and says so; `esds補完` in its report means Safari's AAC
encoder omitted the decoder config and the studio filled it in. OPUS in the
report means the device could not encode AAC, and Safari and QuickTime will
play that file silent.

**A card looks overfull.** The budget is per format in `PROFILES`. Shortening
the article's sentences is usually the better fix; it improves the web page too.
