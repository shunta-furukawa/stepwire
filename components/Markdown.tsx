import type { Block, InlineNode } from '@/lib/content/markdown';
import { MonoMark, WireFace } from '@/components/Faces';

/**
 * Renders the article-body AST as React.
 *
 * Nothing here uses `dangerouslySetInnerHTML`: the parser produces a typed tree
 * and this component maps it to elements, so article bodies cannot inject
 * markup even if a future draft comes from an automated source.
 */

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case 'text':
            return <span key={index}>{node.value}</span>;
          case 'strong':
            return (
              <strong key={index} className="font-bold">
                <Inline nodes={node.children} />
              </strong>
            );
          case 'em':
            return (
              <em key={index}>
                <Inline nodes={node.children} />
              </em>
            );
          case 'code':
            return (
              <code key={index} className="bg-line px-1 font-mono text-[0.9em]">
                {node.value}
              </code>
            );
          case 'link':
            return (
              <a
                key={index}
                href={node.href}
                className="underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
                {...(node.href.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                <Inline nodes={node.children} />
              </a>
            );
          case 'citation':
            // The citation marker is the visible link between a claim and the
            // source that supports it. It jumps to the numbered source entry.
            return (
              <a
                key={index}
                href={`#source-${node.index}`}
                id={`citation-${node.index}`}
                className="ml-[2px] inline-flex h-[15px] min-w-[15px] items-center justify-center border border-line-strong align-super font-mono text-[10px] leading-none transition-colors hover:bg-accent hover:text-on-accent"
                aria-label={`Jump to source ${node.index}`}
              >
                {node.index}
              </a>
            );
        }
      })}
    </>
  );
}

export function Markdown({ blocks }: { blocks: Block[] }) {
  return (
    <div className="font-body text-lead leading-normal text-fg [&>*+*]:mt-lg">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'paragraph':
            return (
              <p key={index}>
                <Inline nodes={block.children} />
              </p>
            );
          case 'turn':
            // A line of the conversation: the speaker beside the words. The
            // name is text, not only a face, so the split survives styles off.
            return (
              <div key={index} className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-md">
                {block.speaker === 'WIRE' ? (
                  <WireFace mood={block.mood} className="h-[52px] w-[52px]" />
                ) : (
                  <MonoMark className="h-[52px] w-[52px]" />
                )}
                <div className="min-w-0 pt-[2px]">
                  <p className="font-mono text-micro font-bold uppercase tracking-wider">
                    <span className={block.speaker === 'WIRE' ? 'text-accent' : 'text-fg'}>{block.speaker}</span>
                    {block.speaker === 'WIRE' ? (
                      <span className="ml-sm font-normal text-faint">ASSISTANT AI</span>
                    ) : null}
                  </p>
                  <p className="mt-xs">
                    <Inline nodes={block.children} />
                  </p>
                </div>
              </div>
            );
          case 'heading': {
            const Tag = block.level === 3 ? 'h3' : 'h4';
            return (
              <Tag
                key={index}
                className="font-display text-h4 font-bold uppercase tracking-tight"
              >
                <Inline nodes={block.children} />
              </Tag>
            );
          }
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
              <Tag
                key={index}
                className={
                  block.ordered
                    ? 'list-decimal space-y-sm pl-lg marker:font-mono marker:text-small'
                    : 'list-none space-y-sm'
                }
              >
                {block.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className={block.ordered ? '' : 'relative pl-lg before:absolute before:left-0 before:top-[0.55em] before:h-[6px] before:w-[6px] before:bg-accent'}
                  >
                    <Inline nodes={item} />
                  </li>
                ))}
              </Tag>
            );
          }
          case 'blockquote':
            return (
              <blockquote
                key={index}
                className="border-l-4 border-line-strong pl-lg font-display text-h4 font-medium leading-tight tracking-tight"
              >
                <Inline nodes={block.children} />
              </blockquote>
            );
          case 'rule':
            return <hr key={index} className="border-line" />;
          case 'image':
            return (
              <figure key={index} className="border-2 border-line-strong bg-raised p-sm">
                {/* Operator-supplied files under public/, shown as they are: no
                    optimiser may resample a result screen's digits. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/${block.src.replace(/^\//, '')}`}
                  alt={block.alt}
                  loading="lazy"
                  className="mx-auto max-h-[70vh] w-auto max-w-full"
                />
                {block.caption || block.credit ? (
                  <figcaption className="mt-sm font-mono text-micro leading-snug text-muted">
                    {block.caption}
                    {block.caption && block.credit ? ' — ' : ''}
                    {block.credit ? <span className="text-accent">{block.credit}</span> : null}
                  </figcaption>
                ) : null}
              </figure>
            );
        }
      })}
    </div>
  );
}
