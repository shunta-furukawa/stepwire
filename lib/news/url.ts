/**
 * URL normalisation.
 *
 * Two links to the same story routinely differ by campaign parameters, a
 * trailing slash, or a host prefix. Normalising before hashing is what makes
 * deduplication work across feeds that syndicate each other.
 */

/** Query parameters that never identify a document. */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^ga_/i,
  /^mc_/i,
  /^pk_/i,
  /^hsa_/i,
  /^_hs/i,
  /^ref$/i,
  /^referrer$/i,
  /^source$/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^dclid$/i,
  /^msclkid$/i,
  /^igshid$/i,
  /^twclid$/i,
  /^yclid$/i,
  /^spm$/i,
  /^cmpid$/i,
  /^campaign$/i,
  /^s_kwcid$/i,
];

function isTracking(name: string): boolean {
  return TRACKING_PARAMS.some((pattern) => pattern.test(name));
}

/**
 * Produces a stable, comparable form of a URL.
 *
 * - lowercases scheme and host, drops `www.`
 * - upgrades `http` to `https` (feeds are inconsistent about this; the same
 *   document served over both is still one story)
 * - removes tracking parameters and sorts the rest
 * - removes the fragment and any trailing slash
 *
 * Returns the input unchanged if it cannot be parsed, so a malformed link
 * degrades to "unique" rather than throwing mid-run.
 */
export function normalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return input.trim();
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return input.trim();
  }

  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  url.hash = '';
  url.username = '';
  url.password = '';

  if (
    (url.port === '80' && url.protocol === 'http:') ||
    (url.port === '443' && url.protocol === 'https:')
  ) {
    url.port = '';
  }

  const params = [...url.searchParams.entries()]
    .filter(([name]) => !isTracking(name))
    .sort(([a], [b]) => a.localeCompare(b));

  url.search = '';
  for (const [name, value] of params) {
    url.searchParams.append(name, value);
  }

  let normalized = url.toString();
  // Drop a trailing slash on the path, but never turn "https://host/" into
  // "https://host".
  normalized = normalized.replace(/(?<=\/[^/?#]+)\/(?=$|\?)/, '');

  return normalized;
}

/** Normalises a title for near-duplicate comparison across syndicating feeds. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”"'’‘`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
