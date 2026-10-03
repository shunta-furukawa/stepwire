# 2026-10-02 session — editorial review

Article: `content/articles/2026-10-03-8th-mca-footnotes-on-bpm.mdx`, `status: review`.

## Evidence

- The operator supplied three e-amusement "最近プレーした楽曲" screenshots, saved as `session-history-1..3.webp` (resized to 900 px). The log has 31 plays on October 2, 21:39–22:56. The September 24 row is excluded.
- The five operator posts were read through official X oEmbed (`lib/news/oembed.ts`). The operator asked, in the session, for the photos to be taken by the embed route used before; their URLs came from the syndication JSON (`cdn.syndication.twimg.com/tweet-result?id=…&token=a`), the same route as `bemani-daisuki-2026.md` and `teto-first-session.md`. No X page HTML or login was used.
- 14 photos were downloaded unchanged from `pbs.twimg.com/media/<id>.jpg?name=medium` (900 × 1200) and each was checked by eye. 12 are in the article, re-encoded as WebP q80 at the same size:
  - Post 2106021866343374930: `HToXtGEbwAAZ0h5` → monstafesta-first, `HToXtF1a4AAft6U` → monstafesta-pfc, `HToXtGDbEAAZzAr` → turning-down, `HToXtGAagAAypNX` → footnotes-first.
  - Post 2106022273375453374: `HToYFSZasAEYiCN` → footnotes-first-aaa, `HToYFSUbwAA_6Z1` → footnotes-best. `HToYFSLbEAAca_c` (981,430) and `HToYFR_bsAAf-l4` (985,930) are not included because the article holds 12 images at most; their numbers are in the plays figure.
  - Post 2106022652632879353: `HToYbL3bkAALSrj` → bloody-iron-maiden-pfc, `HToYbL0a8AAAzCd` → any-percent-pfc, `HToYbL_aEAE2Yjt` → keep-on-movin-pfc, `HToYbLvawAAm2s3` → shoku-pfc.
  - Post 2106023043734872258 (a reply to the Footnotes post): `HToYyfObQAEojpv` → footnotes-difficult-pfc.
  - Post 2106023214044663825: `HToY8kRaEAA7qCl` → harukaze-restart-pfc.
- Read from the photos: levels (Bloody Iron Maiden / Any% / 燭 / Footnotes DIFFICULT 12, KEEP ON MOVIN' CHALLENGE 12, MonstaFesta EXPERT 13, TURNING DOWN EXPERT 14, Footnotes / はるかぜリスタート！ EXPERT 15), lamps, flare ranks, and NEW RECORD deltas. A row is marked `pb` only when its screen shows an improvement over a previous best score above 0. First plays (best 0) are not counted. 987,020 has no photo; it carries no lamp or flare.
- "12の未PFC" = the four DIFFICULT/CHALLENGE 12 PFC photos in that post. "新規15 PFC" = はるかぜリスタート！ EXPERT 15, 999,630. "激と踊は全く別曲" is a reply in the Footnotes thread, and its photo is Footnotes DIFFICULT 12.
- The NEWS song list comes from DDRCommunity, because the official post does not name the songs in its text.
- Weather: JMA Tokyo 10-minute values, 21:40–23:00, 19.4–19.9 ℃, no precipitation. The sky word is left to the operator.

## Operator answers (2026-10-03)

- GhostStep Training and Scores → Recent screenshots supplied (`ghoststep-flare-skill.webp`, `ghoststep-recent.webp`). FLARE SKILL 88,894 / SUN+++, unchanged from the last record, so `before` = `after`.
- From Recent: 魄 EXPERT 14 GFC, +1,730 → `pb`; QuoN CHALLENGE 17. QuoN also shows a green +431,730, but it is not marked `pb` because the operator quit that play partway.
- 燭's E plays: the soflan stop partway through. QuoN: the operator ran out of stamina and stopped partway. ロリ神 is CHALLENGE 12; a PFC is too far for now and it is shelved. These lines are the operator's words, tidied.
- ZENDEGI DANCE: the operator asked for it not to be mentioned. The prose does not name it. Its row stays in the full play log with no note.
- Sky word for the weather is still open; the card shows 20℃ only.
