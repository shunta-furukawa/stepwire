# BPL DDR archive

`public/bpl/` is a standalone HTML/JS archive served by `/bpl/s`; a beforeFiles rewrite maps `/bpl` to that handler. It shares the STEPWIRE header and custom branding.

The fixed result dataset contains 64 fixtures, 166 battles and 308 performed-song records, with official result URLs and S6 roster records. ZERO has battle-level records, not song EX scores. Builds do not scrape or fetch third-party content.

The current archive uses original text labels, color-only song gradients with generic fallbacks, team identification colors and generated player illustrations. Official photo files, logos, jackets, background artwork and promotional copy remain removed. Player illustrations are independent chibi compositions using public profile photos as facial references; this does not establish likeness or other rights clearance. `docs/bpl-generated-portraits.json` records each exact player-to-file mapping, generation provenance and SHA-256 digest. Source photographs are not bundled or served.

`scripts/prepare-bpl.mjs` still deletes any stale extracted artwork directory before dev/build. `pnpm rights:check` verifies the exact icon/portrait inventory and rejects unlisted files, altered portrait bytes, unmapped artwork metadata and legacy bundles. This is regression prevention, not a legal classifier. Do not reintroduce official asset bundles without completing the review in `docs/bpl-rights.md`.

See `bpl-sharing.md` for sharing and OG behavior, and `bpl-s6.md` for viewing preferences and the player matrix.

## Four-color song gradients — 2026-10-06

`public/bpl/jacket-colors.json` contains 206 palettes for the archive's 213 exact song-title identifiers. Each has a stable ID and four HEX colors in top-left, top-right, bottom-left, bottom-right order. The seven unverified titles retain the music-note symbol. No source image is bundled or requested by the browser/build.

`public/bpl/jackets.js` validates the four colors before rendering decorative CSS; unknown/invalid palettes and optional palette/module load failures retain the note symbol. The existing song titles and jacket dimensions stay visible/unchanged. The same renderer covers match-card miniatures, match details and head-to-head rows. Player portraits, season artwork, masthead dimensions, sharing metadata and OG rendering are unaffected.

`docs/bpl-jacket-palettes.json` records the public official page/image mapping, source-image hash and dimensions, sampling time, algorithm, unresolved titles and exact runtime palette-file hash. This is provenance, not rights clearance. Runtime data allows no artwork URL or image bytes. The asset gate rejects altered/uninventoried palette content and preserves the official-artwork rejection rules.

Colors were extracted offline from the current official source images with per-quadrant Oklab clustering. Alpha below 32 is excluded; alpha weights coverage; modest chroma/near-black weighting reduces noise from small text and shadows. A representative pixel from each selected cluster is retained instead of averaging the entire quadrant. Analysis uses at most 128px thumbnails and a deterministic seed. White-led covers may legitimately yield nearly white gradients; colors are not invented to force distinction. Deleted artwork archives/history were not restored.

## Season standings and participation — 2026-10-06

`public/bpl/standings.js` transcribes the official regular-stage ranking order and league points, independently of final tournament finishes. Sources are linked directly in the UI. S2 preserves separate A/B groups; S4 preserves the official tie-breaking order, including Tradz / GAME PANIC / SILK HAT at 10 league points and 40 battle points; S5 is the seven-team, four-match-per-team irregular league. League points are 3/win, 1/draw, 0/loss, not battle points or EX SCORE. Unit tests reconcile W/D/L and league points with archived regular fixtures and lock official row order.

Tournament finishes use participation in the recorded quarterfinal, semifinal and final rounds: champion, runner-up, best four, best eight, or regular-stage exit. No overall 3rd/4th or 5th–8th order is invented. S4's 9–9 semifinal advances Tradz as established by the final participants; a drawn match is not treated as a guessed winner. ZERO remains separately labeled as an exhibition. S6 displays its seven participants with `開幕前 / 順位未確定`, without zero-point rankings.

Primary ranking sources checked on 2026-10-06:
- ZERO: https://p.eagate.573.jp/game/bpl/season2/ddr/zero/index.html
- S2: https://p.eagate.573.jp/game/bpl/season2/ddr/ranking/index.html
- S4: https://p.eagate.573.jp/game/bpl/season4/ddr/ranking/index.html (official table endpoint: `/game/bpl/season4/ddr/API/team/regular.html`)
- S5 DDR tab: https://p.eagate.573.jp/game/bpl/season5/ranking/index.html#tab3
- S6 participation: https://p.eagate.573.jp/game/bpl/season6/draft/index.html

Season outcomes appear before match cards and are invariant under match filters. All team filter options remain visible, with native disabled controls and explicit `不参加` labels for teams outside that season. Participation follows historical player registrations and fixtures, not the latest roster. Incompatible season/team/stage URL combinations normalize to a usable selection both in the browser and crawler/share metadata; Back/Forward restores each season's own valid selection. Existing S6 guide routing, spoiler behavior, portraits, season artwork, song palettes, and entity sharing remain unchanged.
