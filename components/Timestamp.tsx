import { formatDate, formatDateTime } from '@/lib/format';

export function Timestamp({
  iso,
  precise = false,
  className = '',
  label,
}: {
  iso: string;
  precise?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <time
      dateTime={iso}
      className={`font-mono text-micro uppercase tracking-wide text-gray700 ${className}`}
    >
      {label ? `${label} ` : ''}
      {precise ? formatDateTime(iso) : formatDate(iso)}
    </time>
  );
}
