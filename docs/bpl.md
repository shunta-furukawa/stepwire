# BPL DDR archive

`public/bpl/` is a standalone HTML/JS archive served by `/bpl/s`; a beforeFiles rewrite maps `/bpl` to that handler. It shares the STEPWIRE header and custom branding.

The fixed result dataset contains 64 fixtures, 166 battles and 308 performed-song records, with official result URLs and S6 roster records. ZERO has battle-level records, not song EX scores. Builds do not scrape or fetch third-party content.

The current archive uses original text labels, generic music symbols, team identification colors and generated player illustrations. Official photo files, logos, jackets, background artwork and promotional copy remain removed. Player illustrations are independent chibi compositions using public profile photos as facial references; this does not establish likeness or other rights clearance. `docs/bpl-generated-portraits.json` records each exact player-to-file mapping, generation provenance and SHA-256 digest. Source photographs are not bundled or served.

`scripts/prepare-bpl.mjs` still deletes any stale extracted artwork directory before dev/build. `pnpm rights:check` verifies the exact icon/portrait inventory and rejects unlisted files, altered portrait bytes, unmapped artwork metadata and legacy bundles. This is regression prevention, not a legal classifier. Do not reintroduce official asset bundles without completing the review in `docs/bpl-rights.md`.

See `bpl-sharing.md` for sharing and OG behavior, and `bpl-s6.md` for viewing preferences and the player matrix.
