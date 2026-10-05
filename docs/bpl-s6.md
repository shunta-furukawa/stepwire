# S6 observation guide

The archive landing view is now `#s6`. `#seasons` retains the historical archive.

- The seven teams and 28 registered players come from the existing official-draft dataset. Movement compares S5 registrations with S6: 継続 / 移籍 / 復帰 / 新加入. New and returning are explicitly defined relative to archive coverage, not claims about an athlete's whole career.
- `/bpl/s?view=preview&previewA=round1&previewB=gigo` restores a two-team comparison. It is labelled a comparison, not a scheduled or predicted match. Team history and player matrix include only seasons before S6.
- `public/bpl/s6.json` contains sourced announcements and confirmed fixtures. On 2026-10-04 the official overall BPL start was Nov 25; DDR pairings and order were not verified. Do not infer DDR match dates from the common schedule. The empty fixtures array is intentional.
- Add confirmed fixtures as `{ "teams": ["round1", "gigo"], "date": "official DDR broadcast date", "source": "official result/card URL", "video": "optional official broadcast URL" }`. Favorites filter these fixtures; when the array is empty, show announcement-pending rather than making predictions.
- Favorite and spoiler preferences use localStorage key `stepwire-bpl-prefs`, guarded against unavailable storage. Defaults: no favorite, S6 results hidden. No account or personal data is uploaded.
- Hidden mode removes S6 matches from the active archive dataset, including aggregate team/player records and head-to-head scores. The full dataset is retained separately for masked fixture links. A blocked match shows only teams and broadcast/source links until the user explicitly enables all S6 results. Past-season comparisons are unaffected.
- Sharing carries `hideResults=1|0`; the server independently hides S6 scores and excludes S6 from aggregate card counts. Public raw records remain available: this is a viewing preference, not access control.
- Existing match-card and head-to-head scoring logic remains unchanged. Add S6 official results to the existing data schema to surface them in the S6 guide and archive; this release does not scrape unpublished results or establish a polling automation.
- Validation: 7×4 roster checks, movement derivation, reciprocal team comparison, synthetic S6 masking and metadata leak tests, jsdom UI preference and URL round trips, and generated S6 PNG cards.

## 選手対戦マトリクス

S6登録選手の4×4表は、過去所属を横断してS2・S4・S5の個人EX SCOREを比較する。ZEROとS6は含めない。勝率は勝数÷曲数（引分含む）、小数点以下四捨五入。記録0曲の勝率はnullで、0%とは区別する。Duoは相手側の選手のみ比較し、公式ペア得点とは別。

`public/bpl/matrix.js`をブラウザとOGサーバーで共用。`matrixSeason`、`matrixFormat`、`matrixCategory`、`matrixStyle`で絞り込む。カテゴリーは各対戦の公式themeを使用し、POPULARや指定曲にSTANDARD/TRICKYを推測して付与しない。セルを選択すると同条件でカテゴリ別集計と楽曲別スコアを表示し、試合詳細の公式出典に進める。

表の専用URLは`/bpl/s?view=matrix&previewA=round1&previewB=gigo&matrixCategory=GOLD`。専用OGは同じ条件の表を1200×630で生成。画像プレビュー内では対応ブラウザのWeb Share files APIでPNGを共有でき、未対応の場合は画像を開いて保存する。集計データ・ルールの自動更新は行わない。
