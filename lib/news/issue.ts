import type { CandidateNews } from './types';
import { formatDateTime, hostnameOf } from '../format';

/**
 * Candidate → GitHub issue.
 *
 * The editorial inbox is GitHub Issues. An issue has to be readable on a phone
 * in ten seconds (is this worth writing up?) and complete enough to draft from
 * later, so the body leads with the human-facing fields and keeps the machine
 * fields at the bottom.
 *
 * The `Collector ID` line is load-bearing: it is how a later run recognises
 * that this candidate already has an issue.
 */

export const COLLECTOR_ID_MARKER = 'STEPWIRE-COLLECTOR-ID:';

export const LABELS = {
  inbox: 'news-inbox',
  needsReview: 'needs-review',
  source: {
    official: 'source:official',
    media: 'source:media',
    community: 'source:community',
  },
  priority: {
    breaking: 'priority:breaking',
    normal: 'priority:normal',
    low: 'priority:low',
  },
} as const;

/** Every label the collector may apply, with colour and description. */
export const LABEL_DEFINITIONS = [
  { name: 'news-inbox', color: '0B0B0C', description: 'Candidate news collected by the STEPWIRE collector' },
  { name: 'needs-review', color: 'E8341C', description: 'Awaiting an editorial decision' },
  { name: 'source:official', color: '0B6BD6', description: 'First-party announcement' },
  { name: 'source:media', color: '565550', description: 'Reported by another outlet' },
  { name: 'source:community', color: '8A8983', description: 'Community-run source' },
  { name: 'category:news', color: 'E4E3DE', description: 'Suggested category: NEWS' },
  { name: 'category:update', color: 'E4E3DE', description: 'Suggested category: UPDATE' },
  { name: 'category:charts', color: 'E4E3DE', description: 'Suggested category: CHARTS' },
  { name: 'category:event', color: 'E4E3DE', description: 'Suggested category: EVENT' },
  { name: 'category:tournament', color: 'E4E3DE', description: 'Suggested category: TOURNAMENT' },
  { name: 'category:data', color: 'E4E3DE', description: 'Suggested category: DATA' },
  { name: 'category:culture', color: 'E4E3DE', description: 'Suggested category: CULTURE' },
  { name: 'category:community', color: 'E4E3DE', description: 'Suggested category: COMMUNITY' },
  { name: 'priority:breaking', color: 'E8341C', description: 'Time-critical' },
  { name: 'priority:normal', color: 'C2C1BB', description: 'Standard turnaround' },
  { name: 'priority:low', color: 'F3F2EE', description: 'Archive-worthy, not urgent' },
] as const;

export function labelsFor(candidate: CandidateNews): string[] {
  return [
    LABELS.inbox,
    LABELS.needsReview,
    LABELS.source[candidate.sourceCategory],
    `category:${candidate.suggestedCategory.toLowerCase()}`,
    // Priority is an editorial judgement. The collector never claims something
    // is breaking; it files everything as normal and a human promotes it.
    LABELS.priority.normal,
  ];
}

export function issueTitle(candidate: CandidateNews): string {
  const prefix = `[inbox] `;
  const maxTitle = 256 - prefix.length - candidate.sourceId.length - 4;
  const headline =
    candidate.title.length > maxTitle
      ? `${candidate.title.slice(0, maxTitle - 1)}…`
      : candidate.title;
  return `${prefix}${headline}`;
}

function quote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

export function issueBody(candidate: CandidateNews): string {
  const published = candidate.publishedAt
    ? formatDateTime(candidate.publishedAt)
    : 'not reported by the source';

  return `## Headline

${candidate.title}

## Source

**${candidate.sourceName}** (\`${candidate.sourceId}\`) · ${candidate.sourceCategory} · ${hostnameOf(candidate.url)}

## Canonical URL

${candidate.url}

Normalized: \`${candidate.normalizedUrl}\`

## Published at

${published}

## Collected at

${formatDateTime(candidate.collectedAt)}

## Summary

${candidate.summary ? quote(candidate.summary) : '_The source provided no summary._'}

## Why it may matter

<!--
Fill this in during review. This is the CONTEXT half of the STEPWIRE format —
if you cannot say why it matters, it probably should not be a story.
-->

- [ ] Verified against a first-party source
- [ ] Decided category and importance
- [ ] Worth writing up

## Raw metadata

\`\`\`json
${JSON.stringify(candidate.raw ?? {}, null, 2)}
\`\`\`

## Collector ID

\`${candidate.collectorId}\`

---

Draft an article from this issue with:

\`\`\`bash
pnpm article:from-issue <issue-number>
\`\`\`

<!-- ${COLLECTOR_ID_MARKER} ${candidate.collectorId} -->
`;
}

/** Recovers a collector id from an existing issue body. */
export function parseCollectorId(body: string): string | undefined {
  const match = new RegExp(`${COLLECTOR_ID_MARKER}\\s*([A-Za-z0-9-]+)`).exec(body);
  return match?.[1];
}
