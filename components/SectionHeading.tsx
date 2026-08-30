/**
 * A section rule. The horizontal hairline plus a mono label is the recurring
 * structural device of the whole site — it is what makes a dense page scannable.
 */
export function SectionHeading({
  label,
  description,
  as: Tag = 'h2',
  id,
}: {
  label: string;
  description?: string;
  as?: 'h1' | 'h2' | 'h3';
  id?: string;
}) {
  return (
    <div className="border-b-2 border-line-strong pb-sm">
      <Tag
        id={id}
        className="flex items-baseline gap-md font-mono text-micro font-bold uppercase tracking-wider"
      >
        {label}
        {description ? (
          <span className="hidden font-normal normal-case tracking-normal text-muted sm:inline">
            {description}
          </span>
        ) : null}
      </Tag>
    </div>
  );
}
