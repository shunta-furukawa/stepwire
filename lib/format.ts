/**
 * Formatting helpers.
 *
 * Every date on the site is rendered in Asia/Tokyo with a fixed locale. That is
 * an editorial decision (STEPWIRE is a Japan-based wire) and also a technical
 * one: a fixed timezone means the server and the client always produce the same
 * string, so timestamps never cause a hydration mismatch and pages stay static.
 */
export const NEWSROOM_TIME_ZONE = 'Asia/Tokyo';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: NEWSROOM_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: NEWSROOM_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso)).toUpperCase();
}

export function formatDateTime(iso: string): string {
  return `${dateTimeFormatter.format(new Date(iso)).toUpperCase()} JST`;
}

/** `2026-08-29` — used for `<time datetime>` and for filenames. */
export function toDateStamp(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NEWSROOM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
  return parts;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Lowercase kebab-case slug, ASCII only. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
    .replace(/-+$/g, '');
}
