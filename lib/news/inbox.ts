import { z } from 'zod';
import { CANDIDATE_MARKER, LABELS } from './issue';
import { CATEGORIES } from '../content/categories';
import { toDateStamp } from '../format';
import type { Category } from '../content/categories';
import type { SourceCategory } from './types';

/**
 * The wire board's read model.
 *
 * `/studio/wire` answers one question — *what has come in that nobody has
 * decided about yet* — and the answer already exists as GitHub issues. So this
 * reads the inbox rather than storing one: no database, no cache, no second
 * copy of the queue that can disagree with the issues an editor actually closes.
 *
 * An issue body is untrusted input. Anyone with write access edits it by hand,
 * which is the point of the format, so everything here degrades: a candidate
 * that no longer parses still appears on the board with whatever its title and
 * labels say. The board never hides a story because a comment got mangled.
 */

const sourceCategories = ['official', 'media', 'community'] as const;

const candidatePayloadSchema = z.object({
  collectorId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  sourceCategory: z.enum(sourceCategories),
  suggestedCategory: z.enum(CATEGORIES),
  title: z.string().min(1),
  url: z.string().url(),
  summary: z.string().optional(),
  publishedAt: z.string().optional(),
  collectedAt: z.string(),
});

export type Priority = 'breaking' | 'normal' | 'low';

export interface InboxItem {
  number: number;
  issueUrl: string;
  headline: string;
  /** The canonical link, when the issue still declares one. */
  url?: string;
  summary?: string;
  sourceId?: string;
  sourceName?: string;
  sourceCategory?: SourceCategory;
  suggestedCategory?: Category;
  /** What the board sorts and groups by: reported time, else collected time. */
  at?: string;
  publishedAt?: string;
  collectedAt?: string;
  priority: Priority;
  /** False once an editor has taken the `needs-review` label off. */
  needsReview: boolean;
  /** True when the machine-readable payload was missing or malformed. */
  degraded: boolean;
}

/** The shape this module needs from a GitHub issue — see `lib/github/client.ts`. */
export interface InboxIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: { name: string }[];
}

/**
 * Pulls the candidate payload back out of an issue body.
 *
 * Exported because "did this issue survive a hand edit" is worth being able to
 * ask directly, and because it is the one genuinely fiddly step here.
 */
export function parseCandidatePayload(body: string | null): z.infer<
  typeof candidatePayloadSchema
> | undefined {
  if (!body) return undefined;
  const marker = body.indexOf(CANDIDATE_MARKER);
  if (marker === -1) return undefined;

  const start = body.indexOf('{', marker);
  const end = body.indexOf('-->', marker);
  if (start === -1 || end === -1 || start > end) return undefined;

  try {
    const parsed = candidatePayloadSchema.safeParse(
      JSON.parse(body.slice(start, end).trim()),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    // A malformed comment is an editing accident, not an error condition: the
    // issue is still a story, and the board still has to show it.
    return undefined;
  }
}

const PRIORITY_LABELS: Record<string, Priority> = {
  [LABELS.priority.breaking]: 'breaking',
  [LABELS.priority.normal]: 'normal',
  [LABELS.priority.low]: 'low',
};

function priorityOf(labels: string[]): Priority {
  for (const label of labels) {
    const priority = PRIORITY_LABELS[label];
    if (priority) return priority;
  }
  return 'normal';
}

/** `source:community` → `community`, when the label is one the collector uses. */
function sourceCategoryOf(labels: string[]): SourceCategory | undefined {
  for (const category of sourceCategories) {
    if (labels.includes(LABELS.source[category])) return category;
  }
  return undefined;
}

function suggestedCategoryOf(labels: string[]): Category | undefined {
  return CATEGORIES.find((category) => labels.includes(`category:${category.toLowerCase()}`));
}

export function toInboxItem(issue: InboxIssue): InboxItem {
  const labels = issue.labels.map((label) => label.name);
  const candidate = parseCandidatePayload(issue.body);
  const at = candidate?.publishedAt ?? candidate?.collectedAt;

  return {
    number: issue.number,
    issueUrl: issue.html_url,
    // The issue title is the fallback headline, minus the prefix the collector
    // adds so the list is scannable in GitHub's own UI.
    headline: candidate?.title ?? issue.title.replace(/^\[inbox\]\s*/, ''),
    ...(candidate?.url ? { url: candidate.url } : {}),
    ...(candidate?.summary ? { summary: candidate.summary } : {}),
    ...(candidate?.sourceId ? { sourceId: candidate.sourceId } : {}),
    ...(candidate?.sourceName ? { sourceName: candidate.sourceName } : {}),
    // Labels are the fallback for the two fields that also exist as labels: an
    // issue whose payload was mangled still shows where it came from.
    ...((candidate?.sourceCategory ?? sourceCategoryOf(labels))
      ? { sourceCategory: candidate?.sourceCategory ?? sourceCategoryOf(labels) }
      : {}),
    ...((candidate?.suggestedCategory ?? suggestedCategoryOf(labels))
      ? { suggestedCategory: candidate?.suggestedCategory ?? suggestedCategoryOf(labels) }
      : {}),
    ...(at ? { at } : {}),
    ...(candidate?.publishedAt ? { publishedAt: candidate.publishedAt } : {}),
    ...(candidate?.collectedAt ? { collectedAt: candidate.collectedAt } : {}),
    priority: priorityOf(labels),
    needsReview: labels.includes(LABELS.needsReview),
    degraded: candidate === undefined,
  };
}

export interface InboxDay {
  /** `2026-08-30`, in newsroom time. */
  date: string;
  items: InboxItem[];
}

/**
 * Groups the board by day, newest first.
 *
 * The question the board answers is "what has come in recently", and a flat
 * list of thirty headlines does not answer it — a reader cannot see whether
 * something is today's or last week's without reading every timestamp. Days
 * with nothing in them are simply absent; an empty row is not information.
 *
 * Items with no date at all land in a final undated group, because dropping
 * them would silently lose a story.
 */
export function groupInboxByDay(items: InboxItem[]): InboxDay[] {
  const days = new Map<string, InboxItem[]>();

  for (const item of items) {
    const date = item.at ? toDateStamp(item.at) : '';
    const bucket = days.get(date);
    if (bucket) bucket.push(item);
    else days.set(date, [item]);
  }

  return [...days.entries()]
    .map(([date, group]) => ({
      date,
      items: [...group].sort((a, b) => (a.at ?? '') < (b.at ?? '') ? 1 : -1),
    }))
    // Undated items sort last: `''` is less than any real date stamp.
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface InboxSummary {
  total: number;
  needsReview: number;
  breaking: number;
  /** Candidate count per source id, most first. */
  bySource: { sourceId: string; sourceName: string; count: number }[];
}

export function summariseInbox(items: InboxItem[]): InboxSummary {
  const bySource = new Map<string, { sourceId: string; sourceName: string; count: number }>();

  for (const item of items) {
    if (!item.sourceId) continue;
    const existing = bySource.get(item.sourceId);
    if (existing) existing.count += 1;
    else
      bySource.set(item.sourceId, {
        sourceId: item.sourceId,
        sourceName: item.sourceName ?? item.sourceId,
        count: 1,
      });
  }

  return {
    total: items.length,
    needsReview: items.filter((item) => item.needsReview).length,
    breaking: items.filter((item) => item.priority === 'breaking').length,
    bySource: [...bySource.values()].sort(
      (a, b) => b.count - a.count || a.sourceId.localeCompare(b.sourceId),
    ),
  };
}
