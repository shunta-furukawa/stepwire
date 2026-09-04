# Figures

A figure is a diagram an article carries: a row of headline numbers, a
comparison, a sequence of dated events.

**The article declares the data; the system draws it.** Nothing infers a chart
from prose, and nothing generates one from a transcript. The rows are written
into the frontmatter, reviewed in a pull request like any other claim, and
rendered deterministically on both surfaces.

```
frontmatter.figures ──┬──► components/Figure.tsx        (the page)
                      └──► lib/video/canvas/draw.ts    (the video)
```

Both read the same rows and both size their bars with `barFractions()` from
`lib/content/figures.ts`, so a bar is never a different length in the video than
it is on the page.

## Why it is written by hand

The tempting version is "the AI reads the transcript and draws the chart". That
is where the quality of a wire goes to die. A generated figure is confidently
wrong in ways prose is not — prose that is unsure hedges; a bar chart never
does — and a wire that publishes a wrong number has done more damage than one
that published nothing.

So the most an automated tool may ever do here is **propose** rows for a human
to confirm. The schema is the review surface, and `pnpm content:validate` is the
gate.

Figures live at the top level of the frontmatter rather than under `video`,
because they belong to the article. A figure that existed only in the video
would be information the article omits.

## The three kinds

An article may carry up to three figures, of four kinds.

### `stat` — headline numbers

The shape DDR coverage needs most often, and the one that survives being read on
a phone. One to four items; values are strings, so `パネル別` and `18` are both
legal.

```yaml
figures:
  - kind: stat
    title: パックの規模
    items:
      - label: 曲数
        value: '6'
      - label: 最高BPM
        value: '300'
        note: 後半を通して持続
```

### `bars` — a comparison

Two to six items. Values are **numbers**, not strings: the point of `bars` over
`stat` is that the lengths are true to scale, and that only holds if the system
can do arithmetic on them. `unit` is appended to every value.

Bars are baselined at zero whenever the values are positive. Baselining at the
smallest value is the most common way a chart misleads without stating anything
false, so it is not an option the frontmatter offers.

`highlight: true` marks the row the story is about.

```yaml
figures:
  - kind: bars
    title: 持続BPMの比較
    unit: BPM
    caption: 出典の数値をSTEPWIREが整理したもの。
    items:
      - label: CHART F
        value: 300
        highlight: true
      - label: CHART E
        value: 205
```

### `timeline` — a sequence

Two to six dated events: an update history, an event schedule, how a final
played out. `at` is free text rather than a date, because `2026.08`, `第3節` and
`未定` all occur in DDR coverage and none of them is a timestamp.

```yaml
figures:
  - kind: timeline
    title: 決勝の経過
    items:
      - at: 第3曲
        label: 同スコア
      - at: タイブレーク
        label: ランダム選曲で決着
        highlight: true
```

### `plays` — a session log, or the results the story is about

```yaml
figures:
  - kind: plays
    title: 9月3日のセッション
    items:
      - song: "I'll Be With You"
        difficulty: EXPERT        # BEGINNER · BASIC · DIFFICULT · EXPERT · CHALLENGE
        level: 13                 # optional — the play-data list omits it
        score: 999200
        rank: AAA                 # as the game grades it
        note: PERFECT FULL COMBO  # or a time of day, or a caveat
        highlight: true
```

One row per play, up to twelve, exactly as a result screen or the play-data
page shows it. The difficulty badge is printed in the game's own colour
(`difficulty` in `lib/design/tokens.ts`) — the one place a second hue is
allowed, because EXPERT is green to a player before it is a word. The level
is optional: the e-amusement play list does not show it, a result photo does.
`AAA` is set in the accent; every other rank in `muted`.

## Sourcing

A figure makes a claim, so it is sourced like one. Cite the source in the body
text that introduces the figure — `[^n]` markers bind claims to `sources`, and
that binding is what `pnpm content:validate` checks.

Use `caption` for the caveat the numbers need: what was measured, what was
excluded, what STEPWIRE derived rather than read. Anything a reader would need
in order to disagree with the chart belongs there.

## On the page

`FigureList` renders after the three body sections, above the sources. The
numbers are always present as text; the bars are drawn on top of a readable
list, so a figure still works with styles off, in a feed reader, or read aloud.

## In the video

One scene per figure, its duration derived from the row count rather than fixed
— a six-row timeline needs longer on screen than two numbers do. Rows arrive one
after another in reading order, and a bar's reveal scales the drawn length only:
the proportion it settles at is always the true one.

Figure scenes are not dropped by `trimToBudget`. If a video is too long, the
answer is fewer rows or shorter prose, not a chart that silently disappears.
