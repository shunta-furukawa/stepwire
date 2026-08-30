import { describe, expect, it } from 'vitest';
import { issueBody, labelsFor, LABELS } from '../lib/news/issue';
import {
  groupInboxByDay,
  parseCandidatePayload,
  summariseInbox,
  toInboxItem,
  type InboxIssue,
} from '../lib/news/inbox';
import type { CandidateNews } from '../lib/news/types';

const candidate: CandidateNews = {
  collectorId: 'ddrcommunity-abc123',
  sourceId: 'ddrcommunity',
  sourceName: 'DDR Community',
  sourceCategory: 'community',
  suggestedCategory: 'CHARTS',
  title: '新しい譜面パックが公開',
  url: 'https://example.com/post?utm_source=feed',
  normalizedUrl: 'https://example.com/post',
  summary: '6曲が追加された。',
  publishedAt: '2026-08-29T20:30:00+09:00',
  collectedAt: '2026-08-30T01:00:00+09:00',
  raw: { guid: 'abc' },
};

function issue(overrides: Partial<InboxIssue> = {}): InboxIssue {
  return {
    number: 42,
    title: `[inbox] ${candidate.title}`,
    body: issueBody(candidate),
    html_url: 'https://github.com/owner/stepwire/issues/42',
    labels: labelsFor(candidate).map((name) => ({ name })),
    ...overrides,
  };
}

describe('candidate payload round trip', () => {
  it('recovers the fields the board needs from an issue the collector wrote', () => {
    const parsed = parseCandidatePayload(issueBody(candidate));
    expect(parsed).toMatchObject({
      collectorId: candidate.collectorId,
      sourceId: candidate.sourceId,
      sourceName: candidate.sourceName,
      sourceCategory: 'community',
      suggestedCategory: 'CHARTS',
      title: candidate.title,
      url: candidate.url,
      publishedAt: candidate.publishedAt,
    });
  });

  it('carries the original URL, not the normalized one', () => {
    // Normalization exists to compare links, not to send a reader somewhere
    // with the tracking parameters silently rewritten.
    expect(parseCandidatePayload(issueBody(candidate))?.url).toBe(candidate.url);
  });

  it('omits the feed metadata, which is already in the body for a human', () => {
    expect(parseCandidatePayload(issueBody(candidate))).not.toHaveProperty('raw');
  });

  it('returns nothing for a body with no payload, an empty body, or broken JSON', () => {
    expect(parseCandidatePayload('just some text')).toBeUndefined();
    expect(parseCandidatePayload(null)).toBeUndefined();
    expect(parseCandidatePayload('<!-- STEPWIRE-CANDIDATE: {"sourceId": -->')).toBeUndefined();
  });

  it('rejects a payload that no longer matches the schema', () => {
    const body = `<!-- STEPWIRE-CANDIDATE: {"collectorId":"a","url":"not-a-url"} -->`;
    expect(parseCandidatePayload(body)).toBeUndefined();
  });
});

describe('toInboxItem', () => {
  it('builds a complete item from a collector-written issue', () => {
    expect(toInboxItem(issue())).toMatchObject({
      number: 42,
      headline: candidate.title,
      url: candidate.url,
      summary: candidate.summary,
      sourceName: 'DDR Community',
      sourceCategory: 'community',
      suggestedCategory: 'CHARTS',
      priority: 'normal',
      needsReview: true,
      degraded: false,
    });
  });

  it('sorts and groups by the reported time, not the collected time', () => {
    // Those differ across midnight often enough to matter: a feed item posted
    // late evening is routinely collected the next morning.
    expect(toInboxItem(issue()).at).toBe(candidate.publishedAt);
  });

  it('falls back to the collected time when the source reported none', () => {
    const undated = { ...candidate };
    delete undated.publishedAt;
    const item = toInboxItem(issue({ body: issueBody(undated) }));
    expect(item.at).toBe(candidate.collectedAt);
    expect(item.publishedAt).toBeUndefined();
  });

  it('still shows an issue whose payload was mangled by a hand edit', () => {
    const item = toInboxItem(issue({ body: '編集されました' }));
    expect(item.degraded).toBe(true);
    expect(item.headline).toBe(candidate.title);
    // Labels survive an edit to the body, so these two do too.
    expect(item.sourceCategory).toBe('community');
    expect(item.suggestedCategory).toBe('CHARTS');
  });

  it('reads priority from the labels, where an editor sets it', () => {
    const promoted = issue({
      labels: [{ name: LABELS.inbox }, { name: LABELS.priority.breaking }],
    });
    expect(toInboxItem(promoted).priority).toBe('breaking');
    expect(toInboxItem(issue({ labels: [{ name: LABELS.inbox }] })).priority).toBe('normal');
  });

  it('notices that an editor removed the needs-review label', () => {
    const triaged = issue({ labels: [{ name: LABELS.inbox }] });
    expect(toInboxItem(triaged).needsReview).toBe(false);
  });
});

describe('groupInboxByDay', () => {
  const at = (iso: string, number: number): InboxIssue =>
    issue({ number, body: issueBody({ ...candidate, publishedAt: iso }) });

  it('groups by newsroom day, newest day first', () => {
    const days = groupInboxByDay(
      [
        at('2026-08-28T10:00:00+09:00', 1),
        at('2026-08-30T10:00:00+09:00', 2),
        at('2026-08-30T18:00:00+09:00', 3),
      ].map(toInboxItem),
    );
    expect(days.map((day) => day.date)).toEqual(['2026-08-30', '2026-08-28']);
    expect(days[0]!.items.map((item) => item.number)).toEqual([3, 2]);
  });

  it('groups by Tokyo time, not by UTC', () => {
    // 2026-08-29T16:00Z is already the 30th in the newsroom, and a board that
    // filed it under the 29th would be describing a different day's news.
    const days = groupInboxByDay([toInboxItem(at('2026-08-29T16:00:00Z', 1))]);
    expect(days[0]!.date).toBe('2026-08-30');
  });

  it('keeps an item with no date at all, in a group at the end', () => {
    const undated = { ...candidate };
    delete undated.publishedAt;
    const items = [
      toInboxItem(at('2026-08-30T10:00:00+09:00', 1)),
      toInboxItem(issue({ number: 2, body: '編集されました' })),
    ];
    const days = groupInboxByDay(items);
    expect(days.at(-1)!.date).toBe('');
    expect(days.flatMap((day) => day.items)).toHaveLength(2);
  });
});

describe('summariseInbox', () => {
  it('counts the queue and ranks the sources by volume', () => {
    const other: CandidateNews = { ...candidate, sourceId: 'bemaniwiki', sourceName: 'BEMANIWiki' };
    const items = [
      toInboxItem(issue({ number: 1 })),
      toInboxItem(issue({ number: 2 })),
      toInboxItem(issue({ number: 3, body: issueBody(other) })),
    ];
    const summary = summariseInbox(items);
    expect(summary.total).toBe(3);
    expect(summary.needsReview).toBe(3);
    expect(summary.breaking).toBe(0);
    expect(summary.bySource).toEqual([
      { sourceId: 'ddrcommunity', sourceName: 'DDR Community', count: 2 },
      { sourceId: 'bemaniwiki', sourceName: 'BEMANIWiki', count: 1 },
    ]);
  });

  it('is empty rather than undefined for an empty inbox', () => {
    expect(summariseInbox([])).toEqual({ total: 0, needsReview: 0, breaking: 0, bySource: [] });
  });
});
