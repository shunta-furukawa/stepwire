import { stepAnalyzerEmbedUrl, stepAnalyzerUrlSchema } from '@/lib/content/step-analyzer';

export function StepAnalyzerEmbed({ url, title }: { url: string; title: string }) {
  const standaloneUrl = stepAnalyzerUrlSchema.parse(url);
  return (
    <figure className="border-2 border-line-strong bg-raised p-sm">
      <iframe
        src={stepAnalyzerEmbedUrl(standaloneUrl)}
        title={`踏み順の可視化：${title}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="block h-[680px] w-full border-0"
      />
      <figcaption className="mt-sm flex flex-wrap items-center justify-between gap-sm text-sm leading-snug text-muted">
        <span>{title}</span>
        <a href={standaloneUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">
          Step Analyzerで開く ↗
        </a>
      </figcaption>
    </figure>
  );
}
