import type { ArticleVideoInput } from '../../content/article';
import type { MediaRef } from '../../content/schema';
import { CATEGORY_META } from '../../content/categories';
import { difficultyLabel, formatScore } from '../../content/figures';
import { color, difficulty, font, tracking } from '../../design/tokens';
import { formatDate } from '../../format';
import { wrapText } from './text';
import { drawMono, drawWire } from './face';

/**
 * The thumbnail — one frame that has to win a tap.
 *
 * Everything the film says slowly, this says at once: the headline as large
 * as the frame allows, the pictures the article carries, the results that
 * matter in the game's own colours, and no empty corner. It is drawn from the
 * same article the page and the film come from, so it cannot promise a
 * result the article does not report.
 *
 * Design units are a 1280×720 frame; `scale` maps them to whatever size the
 * caller renders at, so a 1920×1080 export is the same picture, sharper.
 */

export interface ThumbnailPlan {
  headline: string;
  kicker: string;
  /** Pictures for the tile column, hero excluded, at most three. */
  tiles: MediaRef[];
  /** Behind the headline. The hero, or the first picture. */
  backdrop?: MediaRef;
  /** Results to shout about: highlighted rows of the article's plays figures. */
  chips: { label: string; score: string; rank?: string; difficulty: keyof typeof difficulty }[];
  /**
   * WIRE and MONO in the picture column, when the article has no pictures
   * of its own and is told as a conversation: the two are what it shows.
   */
  pair: boolean;
}

export function thumbnailPlan(article: ArticleVideoInput): ThumbnailPlan {
  const backdrop = article.heroImage
    ? { ...article.heroImage, credit: article.heroImage.credit ?? '' }
    : article.media[0];
  const tiles = article.media.filter((m) => m.src !== backdrop?.src).slice(0, 3);

  // One chip per chart, at its best score: a session log lists the same
  // chart twice when it was played twice, and the thumbnail wants the result,
  // not the attempt.
  const best = new Map<string, { score: number; chip: ThumbnailPlan['chips'][number] }>();
  for (const figure of article.figures) {
    if (figure.kind !== 'plays') continue;
    for (const item of figure.items) {
      if (!item.highlight) continue;
      const key = `${item.song}:${item.difficulty}`;
      const current = best.get(key);
      if (current && current.score >= item.score) continue;
      best.set(key, {
        score: item.score,
        chip: {
          label: difficultyLabel(item),
          score: formatScore(item.score),
          ...(item.rank ? { rank: item.rank } : {}),
          difficulty: item.difficulty,
        },
      });
    }
  }
  // Best score first: the thumbnail leads with the strongest number.
  const chips = [...best.values()].sort((a, b) => b.score - a.score).map((entry) => entry.chip);

  const conversation = Object.values(article.blocks ?? {}).some((blocks) =>
    blocks.some((block) => block.kind === 'turn'),
  );

  return {
    headline: article.shortTitle ?? article.title,
    kicker: `${CATEGORY_META[article.category].label} · ${formatDate(article.publishedAt)}`,
    tiles,
    ...(backdrop ? { backdrop } : {}),
    chips: chips.slice(0, 3),
    pair: !backdrop && tiles.length === 0 && conversation,
  };
}

export interface ThumbnailContext {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  images: ReadonlyMap<string, CanvasImageSource>;
}

/**
 * The largest size at which the headline fits its box, measured for real.
 *
 * Steps down from a size that would fill the box with one line to one that
 * keeps four; whatever fits first wins. Exported for the test, which hands it
 * a measure that pretends every glyph is one em.
 */
export function fitHeadline(
  text: string,
  box: { width: number; height: number },
  measure: (text: string, size: number) => number,
  lineHeight = 1.04,
): { size: number; lines: string[] } {
  let size = box.height;
  while (size > 24) {
    const lines = wrapText(text, box.width, (line) => measure(line, size));
    // Fits in height, and no line runs past the box: a single Latin word has
    // nowhere to wrap, and shrinking for height alone let one off the edge.
    const widest = Math.max(0, ...lines.map((line) => measure(line, size)));
    if (lines.length * size * lineHeight <= box.height && widest <= box.width) return { size, lines };
    size *= 0.94;
  }
  return { size, lines: wrapText(text, box.width, (line) => measure(line, size)) };
}

/** Characters a line may not begin with — the simplest kinsoku rule. */
const NO_LINE_START = new Set([...'。、．，」』）】〕〉》!?！？ー～…‥:：;；']);
/** Where a line would rather break: after these, or at a script boundary. */
const BREAK_AFTER = new Set([...' 。、！？…」』）】']);

const script = (ch: string) => (/[A-Za-z0-9,.'&+-]/.test(ch) ? 'latin' : 'other');

/**
 * Splits `text` into `n` lines of roughly equal measured width.
 *
 * A break is allowed at a space, after punctuation, where the script
 * changes, or between two Japanese characters — never inside a Latin word,
 * and never before a character that may not start a line. Each cut goes to
 * the allowed break nearest its share of the width; if the text has fewer
 * allowed breaks than cuts, fewer lines come back, and the caller skips
 * that count.
 */
function balance(text: string, n: number, measure: (text: string) => number): string[] {
  const chars = [...text.trim()];
  if (n <= 1 || chars.length < n) return [chars.join('')];
  const allowed: number[] = [];
  for (let i = 1; i < chars.length; i += 1) {
    const prev = chars[i - 1] ?? '';
    const next = chars[i] ?? '';
    if (NO_LINE_START.has(next)) continue;
    const ok =
      prev === ' ' ||
      next === ' ' ||
      BREAK_AFTER.has(prev) ||
      script(prev) !== script(next) ||
      (script(prev) === 'other' && script(next) === 'other');
    if (ok) allowed.push(i);
  }
  const total = measure(chars.join(''));
  const lines: string[] = [];
  let start = 0;
  for (let line = 0; line < n - 1; line += 1) {
    const target = (total * (line + 1)) / n;
    const candidates = allowed.filter((i) => i > start);
    if (candidates.length === 0) break;
    const cut = candidates.reduce((best, i) =>
      Math.abs(measure(chars.slice(0, i).join('')) - target) < Math.abs(measure(chars.slice(0, best).join('')) - target)
        ? i
        : best,
    );
    const piece = chars.slice(start, cut).join('').trim();
    if (piece.length === 0) break;
    lines.push(piece);
    start = cut;
  }
  const rest = chars.slice(start).join('').trim();
  if (rest.length > 0) lines.push(rest);
  return lines;
}

/**
 * The headline as a poster: every line sized on its own to fill the box's
 * width, the whole block scaled to its height.
 *
 * `fitHeadline` keeps one size for every line and leaves the short line
 * short; this lets 「とは」 stand as wide as 「STEPWIRE」 above it, which is
 * the gap-free block a thumbnail wants. Tries one to four lines and keeps
 * the split that fills the most of the box, docked when its smallest line
 * would be a sliver next to its largest.
 */
export function fitHeadlineTight(
  text: string,
  box: { width: number; height: number },
  measure: (text: string, size: number) => number,
  lineHeight = 1.0,
): { text: string; size: number }[] {
  const unit = (line: string) => Math.max(1e-6, measure(line, 100) / 100);
  let best: { text: string; size: number }[] = [];
  let bestScore = -1;
  for (let n = 1; n <= 4; n += 1) {
    const lines = balance(text, n, unit);
    if (lines.length !== n) continue;
    // A lone character is not a line: 「と」 over 「は」 fills the box and
    // reads as nothing.
    if (n > 1 && lines.some((line) => [...line].length < 2)) continue;
    let sized = lines.map((line) => ({ text: line, size: box.width / unit(line) }));
    const total = sized.reduce((t, line) => t + line.size * lineHeight, 0);
    if (total > box.height) {
      const k = box.height / total;
      sized = sized.map((line) => ({ ...line, size: line.size * k }));
    }
    const sizes = sized.map((line) => line.size);
    const filled = sizes.reduce((t, size) => t + size * lineHeight, 0);
    // Docked in proportion to how much of a sliver the smallest line is.
    const ratio = Math.min(...sizes) / Math.max(...sizes);
    const score = filled * Math.min(1, ratio / 0.3);
    if (score > bestScore) {
      bestScore = score;
      best = sized;
    }
  }
  return best;
}

function cover(
  ctx: ThumbnailContext['ctx'],
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  focus = 0.5,
) {
  const iw = 'width' in image ? Number(image.width) : w;
  const ih = 'height' in image ? Number(image.height) : h;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // Portrait result photos carry their number in the upper half; `focus`
  // slides the crop up so the score, not the cabinet, is what shows.
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) * focus, dw, dh);
  ctx.restore();
}

export function drawThumbnail(d: ThumbnailContext, plan: ThumbnailPlan) {
  const { ctx, width, height } = d;
  const s = width / 1280;
  const px = (v: number) => v * s;
  const fontOf = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`;

  ctx.fillStyle = color.deep;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // The tile column takes the right 36% when there are pictures; the
  // headline takes what is left, which is still most of the frame.
  const tileColumn = plan.tiles.length > 0 || plan.pair ? px(460) : 0;
  const textRight = width - tileColumn;

  // Backdrop: the hero, darkened where the words go.
  const backdrop = plan.backdrop ? d.images.get(plan.backdrop.src) : undefined;
  if (backdrop) {
    cover(ctx, backdrop, 0, 0, width, height, 0.5);
    const shade = ctx.createLinearGradient(0, 0, textRight, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0.92)');
    shade.addColorStop(0.7, 'rgba(0,0,0,0.84)');
    shade.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, textRight, height);
  }

  // Tiles: the result photos, stacked, each cropped to its number.
  if (plan.tiles.length > 0) {
    const x = textRight;
    const gap = px(6);
    const tileH = (height - gap * (plan.tiles.length - 1)) / plan.tiles.length;
    plan.tiles.forEach((tile, i) => {
      const y = i * (tileH + gap);
      const image = d.images.get(tile.src);
      if (image) cover(ctx, image, x, y, tileColumn, tileH, 0.42);
      else {
        ctx.fillStyle = color.raised;
        ctx.fillRect(x, y, tileColumn, tileH);
      }
    });
    // The seam: a lime rule between words and pictures.
    ctx.fillStyle = color.accent;
    ctx.fillRect(x - px(8), 0, px(8), height);
  }

  // The pair, where the pictures would be: WIRE over MONO, facing the words.
  if (plan.pair) {
    const x = textRight;
    ctx.fillStyle = color.raised;
    ctx.fillRect(x, 0, tileColumn, height);
    const face = px(250);
    const cx = x + (tileColumn - face) / 2;
    drawWire(ctx, cx, px(70), face, 'grin', 1);
    drawMono(ctx, cx, height - px(70) - face, face);
    ctx.fillStyle = color.accent;
    ctx.fillRect(x - px(8), 0, px(8), height);
  }

  // Top strip: category chip and date.
  const pad = px(40);
  const chipSize = px(26);
  ctx.font = fontOf(900, chipSize, font.mono);
  const kickerParts = plan.kicker.split(' · ');
  const category = (kickerParts[0] ?? '').toUpperCase();
  const date = kickerParts[1] ?? '';
  const chipW = ctx.measureText(category).width + px(36);
  ctx.fillStyle = color.accent;
  ctx.fillRect(pad, pad, chipW, chipSize + px(18));
  ctx.fillStyle = color.onAccent;
  ctx.fillText(category, pad + px(18), pad + chipSize + px(3));
  ctx.font = fontOf(700, chipSize, font.mono);
  ctx.fillStyle = color.fg;
  ctx.fillText(date, pad + chipW + px(20), pad + chipSize + px(3));

  // Chips at the bottom: difficulty badge, score, rank. Measured first and
  // laid out in rows, because three results are wider than the column and a
  // result that does not fit is not a result to drop.
  const badgeSize = px(20);
  const scoreSize = px(34);
  const chipH = px(64);
  const chipGap = px(8);
  const measured = plan.chips.map((chip) => {
    ctx.font = fontOf(900, badgeSize, font.mono);
    const badgeW = ctx.measureText(chip.label).width + px(18);
    const rankW = chip.rank ? ctx.measureText(chip.rank).width + px(10) : 0;
    ctx.font = fontOf(900, scoreSize, font.mono);
    const scoreW = ctx.measureText(chip.score).width;
    return { chip, badgeW, scoreW, rankW, boxW: badgeW + px(12) + scoreW + rankW + px(18) };
  });
  const rows: (typeof measured)[] = [];
  for (const item of measured) {
    const row = rows[rows.length - 1];
    const used = row ? row.reduce((t, m) => t + m.boxW + chipGap, 0) : 0;
    if (row && used + item.boxW <= textRight - pad * 2) row.push(item);
    else if (rows.length < 3) rows.push([item]);
  }
  const chipRowsH = rows.length > 0 ? rows.length * chipH + (rows.length - 1) * chipGap : 0;
  const chipTop = height - pad - chipRowsH;
  rows.forEach((row, r) => {
    let cx = pad;
    const y = chipTop + r * (chipH + chipGap);
    for (const { chip, badgeW, scoreW, boxW } of row) {
      ctx.fillStyle = color.deep;
      ctx.fillRect(cx, y, boxW, chipH);
      ctx.strokeStyle = color.lineStrong;
      ctx.lineWidth = px(3);
      ctx.strokeRect(cx, y, boxW, chipH);

      ctx.fillStyle = difficulty[chip.difficulty];
      ctx.fillRect(cx + px(8), y + px(8), badgeW, chipH - px(16));
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color.onAccent;
      ctx.font = fontOf(900, badgeSize, font.mono);
      ctx.fillText(chip.label, cx + px(17), y + chipH / 2 + px(2));

      ctx.fillStyle = color.fg;
      ctx.font = fontOf(900, scoreSize, font.mono);
      ctx.fillText(chip.score, cx + px(8) + badgeW + px(12), y + chipH / 2 + px(3));

      if (chip.rank) {
        ctx.fillStyle = chip.rank === 'AAA' ? color.accent : color.muted;
        ctx.font = fontOf(900, badgeSize, font.mono);
        ctx.fillText(chip.rank, cx + px(8) + badgeW + px(12) + scoreW + px(10), y + chipH / 2 + px(2));
      }
      ctx.textBaseline = 'alphabetic';
      cx += boxW + chipGap;
    }
  });

  // Headline: as large as the box allows, then a lime rule under it.
  const boxTop = pad + chipSize + px(18) + px(28);
  const boxBottom = chipTop - (rows.length > 0 ? px(24) : 0);
  const box = { width: textRight - pad * 2, height: boxBottom - boxTop - px(24) };
  // Each line fills the column's width at its own size, in the impact face;
  // a headline that leaves a gap is a headline that could have been larger.
  const lines = fitHeadlineTight(plan.headline, box, (text, at) => {
    ctx.font = fontOf(400, at, font.impact);
    return ctx.measureText(text).width;
  });
  // Bottom-anchored: the words sit on the chips, and any slack goes to the
  // top where the chip strip is, not into a hole above the results.
  const blockH = lines.reduce((t, line) => t + line.size, 0);
  let y = Math.max(boxBottom - px(24) - blockH, boxTop);
  for (const line of lines) {
    ctx.font = fontOf(400, line.size, font.impact);
    const baseline = y + line.size * 0.84;
    ctx.fillStyle = color.deep;
    ctx.fillText(line.text, pad + px(4), baseline + px(4));
    ctx.fillStyle = color.fg;
    ctx.fillText(line.text, pad, baseline);
    y += line.size;
  }
  ctx.fillStyle = color.accent;
  ctx.fillRect(pad, Math.min(y + px(6), height - pad - px(10)), Math.min(box.width, px(320)), px(10));

  // Wordmark, small, bottom-right of the text column when there are no chips;
  // otherwise tucked at the top-right of the text column.
  const wmSize = px(30);
  ctx.font = fontOf(900, wmSize, font.display);
  const stepW = ctx.measureText('STEP').width;
  const wireW = ctx.measureText('WIRE').width;
  const wmX = textRight - pad - stepW - wireW;
  const wmY = pad + chipSize + px(3);
  ctx.fillStyle = color.fg;
  ctx.fillText('STEP', wmX, wmY);
  ctx.fillStyle = color.accent;
  ctx.fillText('WIRE', wmX + stepW, wmY);
  ctx.font = fontOf(700, px(16), font.mono);
  ctx.fillStyle = color.muted;
  const opW = [...'MONO DDR'].length * px(16) * (0.62 + tracking.wider);
  ctx.fillText('MONO DDR', textRight - pad - opW, wmY + px(24));
}
