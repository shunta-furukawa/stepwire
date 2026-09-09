import { Markdown } from '@/components/Markdown';

/** The finished film belongs above the story, separate from the original MVs cited in it. */
export function ArticleVideo({ videoId, title }: { videoId?: string; title: string }) {
  if (!videoId) return null;

  return (
    <section id="stepwire-video" aria-labelledby="stepwire-video-heading" className="scroll-mt-24">
      <h2 id="stepwire-video-heading" className="mb-md font-display text-h4 font-black tracking-tight">
        STEPWIRE動画で見る
      </h2>
      <Markdown blocks={[{ type: 'youtube', videoId, title: `${title} / STEPWIRE` }]} />
    </section>
  );
}
