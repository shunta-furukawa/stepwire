import { HEAD_OUTLINE, type Mouth } from './wire';

/**
 * MONO's face: the head, the mark, a mouth.
 *
 * The mark is MONO DDR's low-poly M — two equilateral triangles of side
 * three units, set two units apart so their bases overlap by one, each cut
 * into nine unit facets. The overlap is exactly one unit triangle at the
 * foot of the M's centre, and that one is lime: the same construction as
 * the logo, computed rather than traced, so it is right at every size.
 *
 * The head is WIRE's silhouette, on the deepest ground with the type-colour
 * edge, so the pair reads as a pair. MONO has no moods — the operator's face
 * is the operator's own — and the mouth is the one MONO always wears.
 */

export interface Facet {
  points: [number, number][];
  /** Facets are the type colour at these opacities: the low-poly shading. */
  alpha: number;
  lime?: boolean;
}

export interface MonoFace {
  head: [number, number][];
  facets: Facet[];
  mouth: Mouth;
}

/** Shading per facet, row-major from the apex: up, down, up, down, up … */
const LEFT_SHADE = [1, 0.92, 0.76, 0.88, 0.68, 0.84, 0.6, 0.8, 0.9];
const RIGHT_SHADE = [0.96, 0.86, 0.7, 0.9, 0.64, 0.82, 0.74, 0.58, 0.88];

/**
 * The nine facets of an equilateral triangle of side `3u` with its apex at
 * (ax, ay), row-major from the apex.
 */
function facetsOf(ax: number, ay: number, u: number, shade: number[]): Facet[] {
  const h = (u * Math.sqrt(3)) / 2;
  const out: Facet[] = [];
  for (let r = 0; r < 3; r += 1) {
    const top = ay + r * h;
    const bottom = ay + (r + 1) * h;
    for (let k = 0; k <= r; k += 1) {
      const left = ax - ((r + 1) * u) / 2 + k * u;
      out.push({
        points: [[left, bottom], [left + u, bottom], [left + u / 2, top]],
        alpha: shade[out.length] ?? 0.8,
      });
      if (k < r) {
        const dl = ax - (r * u) / 2 + k * u;
        out.push({
          points: [[dl, top], [dl + u, top], [dl + u / 2, bottom]],
          alpha: shade[out.length] ?? 0.8,
        });
      }
    }
  }
  return out;
}

/** The M alone, `width` wide with its base at `baseY`, centred on `cx`. */
export function monoMark(cx: number, baseY: number, width: number): Facet[] {
  const u = width / 5;
  const h = (u * Math.sqrt(3)) / 2;
  const x0 = cx - width / 2;
  const apexY = baseY - 3 * h;
  const left = facetsOf(x0 + 1.5 * u, apexY, u, LEFT_SHADE);
  const right = facetsOf(x0 + 3.5 * u, apexY, u, RIGHT_SHADE);
  // The one unit the two triangles share, at the foot of the centre.
  const shared: Facet = {
    points: [[x0 + 2 * u, baseY], [x0 + 3 * u, baseY], [x0 + 2.5 * u, baseY - h]],
    alpha: 1,
    lime: true,
  };
  return [...left, ...right, shared];
}

export function monoFace(): MonoFace {
  return {
    head: HEAD_OUTLINE,
    facets: monoMark(50, 64, 60),
    mouth: { kind: 'curve', points: [[42, 75], [46, 80], [54, 80], [58, 75]] },
  };
}
