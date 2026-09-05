import {
  barFractions,
  difficultyLabel,
  formatBarValue,
  formatScore,
  type BarsFigure,
  type Figure as FigureData,
  type PlaysFigure,
  type StatFigure,
  type TimelineFigure,
} from '@/lib/content/figures';
import { color, difficulty, flareEx } from '@/lib/design/tokens';

/**
 * Figures on the page.
 *
 * The article declares the data; this draws it. The video draws the same rows
 * from the same frontmatter through `video/scenes/index.tsx`, and the bar
 * lengths come from `barFractions` on both surfaces — a bar is never a
 * different length in the video than it is here.
 *
 * The numbers are always present as text. The bars are decoration on top of a
 * readable list, so the figure still works with styles off, in a feed reader,
 * or read aloud.
 *
 * Quantities are set in `wire`, not `signal`. Red is the wire's alert colour —
 * breaking, live, urgent — and a number is none of those. Blue is what the
 * video already uses for data, and one colour has to mean one thing on both
 * surfaces.
 */
export function Figure({ figure }: { figure: FigureData }) {
  return (
    <figure className="border-2 border-line-strong bg-raised p-md sm:p-lg">
      {figure.title ? (
        <p className="font-mono text-micro font-bold uppercase tracking-wider">{figure.title}</p>
      ) : null}

      <div className={figure.title ? 'mt-md' : undefined}>
        {figure.kind === 'stat' ? <StatRows figure={figure} /> : null}
        {figure.kind === 'bars' ? <BarRows figure={figure} /> : null}
        {figure.kind === 'timeline' ? <TimelineRows figure={figure} /> : null}
        {figure.kind === 'plays' ? <PlayRows figure={figure} /> : null}
      </div>

      {figure.caption ? (
        <figcaption className="mt-md border-t border-line pt-sm font-mono text-micro leading-snug text-muted">
          {figure.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

// Tailwind resolves classes at build time, so the count maps to a literal.
const STAT_COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
};

function StatRows({ figure }: { figure: StatFigure }) {
  return (
    <dl className={`grid grid-cols-2 gap-md ${STAT_COLUMNS[figure.items.length] ?? ''}`}>
      {figure.items.map((item) => (
        <div key={item.label} className="border-t-2 border-line-strong pt-sm">
          <dt className="font-mono text-micro uppercase tracking-wide text-muted">
            {item.label}
          </dt>
          <dd className="mt-xs font-display text-h3 font-black leading-headline tracking-tight text-accent">
            {item.value}
          </dd>
          {item.note ? (
            <p className="mt-xs font-mono text-micro leading-snug text-muted">{item.note}</p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

function BarRows({ figure }: { figure: BarsFigure }) {
  const fractions = barFractions(figure);

  return (
    <ul className="space-y-sm">
      {figure.items.map((item, index) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-md">
            <span className="min-w-0 truncate font-mono text-micro uppercase tracking-wide">
              {item.label}
            </span>
            <span
              className={`shrink-0 font-mono text-small tabular-nums ${
                item.highlight ? 'font-bold text-accent' : ''
              }`}
            >
              {formatBarValue(figure, item.value)}
            </span>
          </div>
          {/* The value above is the accessible content; the bar restates it. */}
          {/* On a dark ground the filled bar is the LIGHTER of the two: a dark
              bar on a lighter track reads as an empty one. */}
          <div aria-hidden="true" className="mt-xs h-[10px] bg-line">
            <div
              className={`h-full ${item.highlight ? 'bg-accent' : 'bg-muted'}`}
              // A proportion is data, not design: it cannot come from a class.
              style={{ width: `${Math.max((fractions[index] ?? 0) * 100, 1)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TimelineRows({ figure }: { figure: TimelineFigure }) {
  return (
    // One grid for the whole list rather than one per row, so the `at` column
    // is a single width down the timeline — its content is free text of any
    // length, and per-row grids would give a ragged left edge.
    <ol className="grid grid-cols-[minmax(56px,max-content)_1fr] gap-x-md">
      {figure.items.map((item) => (
        <li key={`${item.at}-${item.label}`} className="col-span-2 grid grid-cols-subgrid pb-md">
          <span
            className={`border-t-2 pt-sm font-mono text-micro uppercase leading-snug tracking-wide ${
              item.highlight ? 'border-accent text-accent' : 'border-line-strong text-muted'
            }`}
          >
            {item.at}
          </span>
          <div className="min-w-0 border-t border-line pt-sm">
            <p
              className={`font-display text-base leading-snug ${
                item.highlight ? 'font-bold' : 'font-medium'
              }`}
            >
              {item.label}
            </p>
            {item.note ? (
              <p className="mt-xs font-mono text-micro leading-snug text-muted">{item.note}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The difficulty badge, in the game's own colour.
 *
 * Inline style rather than a Tailwind class on purpose: these five colours
 * are a quotation of DDR's, not part of the theme, and giving them utility
 * classes would invite them onto things that are not a difficulty.
 */
export function DifficultyBadge({ row }: { row: PlaysFigure['items'][number] }) {
  return (
    <span
      className="inline-block whitespace-nowrap px-sm py-[3px] font-mono text-[10px] font-bold uppercase leading-none tracking-wider"
      style={{ background: difficulty[row.difficulty], color: color.onAccent }}
    >
      {difficultyLabel(row)}
    </span>
  );
}

function PlayRows({ figure }: { figure: PlaysFigure }) {
  return (
    <ol className="divide-y divide-line">
      {figure.items.map((item, index) => (
        <li
          key={`${item.song}-${index}`}
          className="grid grid-cols-[max-content_minmax(0,1fr)_max-content] items-center gap-x-md py-sm"
        >
          <DifficultyBadge row={item} />
          <div className="min-w-0">
            <p
              className={`truncate font-display text-base leading-snug ${
                item.highlight ? 'font-bold' : 'font-medium'
              }`}
            >
              {item.song}
            </p>
            {item.note ? (
              <p className="font-mono text-micro leading-snug text-muted">{item.note}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="font-mono text-base tabular-nums leading-snug">{formatScore(item.score)}</p>
            {item.rank || item.flare ? (
              <p className="font-mono text-micro font-bold leading-snug">
                {item.rank ? (
                  <span className={item.rank === 'AAA' ? 'text-accent' : 'text-muted'}>{item.rank}</span>
                ) : null}
                {item.rank && item.flare ? <span className="text-faint"> · </span> : null}
                {item.flare ? (
                  <span
                    className={item.flare === 'EX' ? 'bg-clip-text text-transparent' : 'text-faint'}
                    // The FLARE EX rainbow is a quotation of the game, like the
                    // difficulty colours: inline from the tokens, not a class.
                    style={item.flare === 'EX' ? { backgroundImage: `linear-gradient(90deg, ${flareEx.join(', ')})` } : undefined}
                  >
                    FLARE {item.flare}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The article's figures as one labelled block. Renders nothing when empty. */
export function FigureList({ figures }: { figures: FigureData[] }) {
  if (figures.length === 0) return null;

  return (
    <section aria-labelledby="figures-heading" className="scroll-mt-24" id="figures">
      <div className="flex items-baseline gap-md border-b-2 border-line-strong pb-sm">
        <span aria-hidden="true" className="font-mono text-micro text-accent">
          ◆
        </span>
        <h2 id="figures-heading" className="font-display text-h4 font-black tracking-tight">
          データ
          <span className="ml-sm font-mono text-micro font-normal tracking-wider text-muted">
            FIGURES
          </span>
        </h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted">
          記事のデータ
        </span>
      </div>
      <div className="mt-lg space-y-lg">
        {figures.map((figure, index) => (
          <Figure key={figure.title ?? index} figure={figure} />
        ))}
      </div>
    </section>
  );
}
