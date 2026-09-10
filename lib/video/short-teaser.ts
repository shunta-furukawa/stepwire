import type { ArticleVideoInput } from '../content/article';
import type { Scene, SceneSequence } from './scenes';
import { planReveal } from './reveal';
import { visualLength } from './text';
import { resolveCharacterPoses } from './character-poses';
import { COMPOSITIONS } from './compositions';
import { formatDate } from '../format';
import { CATEGORY_META } from '../content/categories';

/** Pure selection from the full film: no invented dialogue, external AI or second script. */
export function buildShortTeaser(article: ArticleVideoInput, full: SceneSequence, fps: number): SceneSequence {
  const title = article.video?.headline ?? article.shortTitle ?? article.title;
  // Only a title may be shortened mid-line; a spoken sentence is never chopped.
  const hook = article.video?.shortHook ?? title;
  const hookText = [...hook].length > 60 ? `${[...hook].slice(0, 59).join('')}…` : hook;
  const reveal = planReveal(hookText, 'headline', fps);
  const hero = article.heroImage ?? article.media[0];
  const headline: Scene = {
    id: 'short-hook', type: 'headline', text: hookText, reveal,
    durationInFrames: Math.max(3 * fps, reveal.revealFrames + reveal.holdFrames),
    kicker: `${CATEGORY_META[article.category].label} · ${formatDate(article.publishedAt)}`,
    meta: '本編の見どころを、ひと足先に。',
    ...(hero ? { image: { ...hero, credit: hero.credit ?? '' } } : {}),
    index: 0, total: 0,
  };
  const poster = article.thumbnail ?? article.heroImage;
  const credits = [...(full.scenes.find((s) => s.type === 'outro')?.credits ?? [])];
  // A full-film outro override must not silently remove the trailer's credits.
  for (const image of [hero, ...article.media, poster]) {
    if (image?.credit && !credits.includes(`IMAGE: ${image.credit}`)) credits.push(`IMAGE: ${image.credit}`);
  }
  if (article.bgm && !credits.includes(`MUSIC: ${article.bgm.credit}`)) credits.push(`MUSIC: ${article.bgm.credit}`);
  const ctaText = article.youtubeVideoId ? '続きは、横動画で。' : '続きは、STEPWIREで。';
  const outro: Scene = {
    id: 'short-outro', type: 'outro', text: ctaText,
    reveal: planReveal(ctaText, 'headline', fps), durationInFrames: 7 * fps,
    meta: article.youtubeVideoId ? '関連動画から本編へ' : '記事・本編はSTEPWIREで',
    promotion: { title: article.shortTitle ?? article.title, destination: article.youtubeVideoId ? 'youtube' : 'article' },
    ...(poster ? { image: { ...poster, credit: poster.credit ?? '' } } : {}),
    credits, index: 0, total: 0,
  };
  const source = full.scenes.find((s) => s.type === 'source');
  const ending = [...(source ? [{ ...source, durationInFrames: Math.min(4 * fps, source.durationInFrames) }] : []), outro];
  const maxFrames = COMPOSITIONS.STEPWIRE_SHORT.targetSeconds.max * fps;
  const duration = (scenes: readonly Scene[]) => scenes.reduce((n, s) => n + s.durationInFrames, 0);
  const picked: Scene[] = [];
  const used = new Set<string>();
  const pictures = new Set<string>();
  // Portrait has a narrower dialogue box. Skip overlong excerpts instead of
  // dropping a qualification, cutting off the answer or speeding up the type.
  const readable = (s: Scene) => Boolean(s.text) && visualLength(s.text ?? '') <= (s.image ? 190 : 210);
  const reframe = (s: Scene): Scene => {
    const plan = planReveal(s.text ?? '', 'body', fps);
    return { ...s, reveal: plan, resolvedCharacterPoses: undefined,
      durationInFrames: Math.max(3 * fps, plan.revealFrames + plan.holdFrames) };
  };
  const add = (group: Scene[]) => {
    if (!group.length || group.some((s) => used.has(s.id) || !readable(s))) return false;
    const next = group.map(reframe);
    if (duration([headline, ...picked, ...next, ...ending]) > maxFrames) return false;
    picked.push(...next);
    group.forEach((s) => { used.add(s.id); if (s.image) pictures.add(s.image.src); });
    return true;
  };

  // Keep a complete adjacent exchange; never manufacture a reply by splicing
  // two distant turns. Session PICKUPs rank first, pictured exchanges next.
  const pairs = full.scenes.flatMap((s, i) => {
    const reply = full.scenes[i + 1];
    if (s.type !== 'turn' || reply?.type !== 'turn' || s.speaker !== 'WIRE' || reply.speaker !== 'MONO') return [];
    if (!readable(s) || !readable(reply)) return [];
    const score = (article.session && s.id.startsWith('impact') ? 4 : 0)
      + (s.image || reply.image ? 2 : 0) + (/[？?]/.test(s.text ?? '') ? 1 : 0);
    return [{ scenes: [s, reply], score, index: i }];
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  const pair = pairs.find((candidate) => add(candidate.scenes));

  if (!pair) {
    // Without dialogue, one factual card supplies enough context for a glimpse.
    const first = full.scenes.find((s) => ['news', 'narration'].includes(s.type) && readable(s));
    if (first) add([first]);
  }

  // One opening excerpt per pictured chapter: recognition + one useful point,
  // leaving the rest of its explanation for the full film. Stable source order.
  for (let i = 0; i < full.scenes.length && pictures.size < 3; i += 1) {
    const s = full.scenes[i];
    if (!s) continue;
    if (!s.image || pictures.has(s.image.src) || !['turn', 'context', 'impact'].includes(s.type)) continue;
    const previous = full.scenes[i - 1];
    if (previous?.image?.src === s.image.src) continue;
    // A stand-alone response can be meaningless without the question.
    if (s.type === 'turn' && s.speaker === 'MONO') continue;
    add([s]);
  }

  if (!picked.some((s) => s.image)) {
    // Text-only articles still get a substantive glimpse, not just a CTA.
    const detail = full.scenes.find((s) => ['context', 'impact', 'narration'].includes(s.type) && !used.has(s.id) && readable(s));
    if (detail) add([detail]);
  }

  // An existing unanswered question is an honest cliffhanger; no new MONO
  // opinion is generated. Only use one that occurs after the chosen excerpt.
  const last = Math.max(-1, ...picked.map((s) => full.scenes.findIndex((original) => original.id === s.id)));
  const question = full.scenes.slice(last + 1).find((s) =>
    s.type === 'turn' && s.speaker === 'WIRE' && /[？?]\s*$/.test(s.text ?? '') && readable(s));
  if (question) add([question]);

  const drafts = [headline, ...picked, ...ending];
  const scenes = resolveCharacterPoses(drafts).map((s, index) => ({ ...s, index, total: drafts.length }));
  return { scenes, durationInFrames: duration(scenes), fps, composition: 'STEPWIRE_SHORT' };
}
