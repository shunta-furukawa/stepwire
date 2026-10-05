# BPL DDR archive

`public/bpl/` is a standalone HTML/JS archive served by `/bpl/s`; a beforeFiles rewrite maps `/bpl` to that handler. It shares the STEPWIRE header and custom branding.

The fixed result dataset contains 64 fixtures, 166 battles and 308 performed-song records, with official result URLs and S6 roster records. ZERO has battle-level records, not song EX scores. Builds do not scrape or fetch third-party content.

The current archive uses original text labels, generic symbols and team identification colors. Third-party artwork and promotional copy have been removed pending permission review. `scripts/prepare-bpl.mjs` deletes any stale extracted artwork directory before dev/build. Do not reintroduce asset bundles without completing the review in `docs/bpl-rights.md`.

See `bpl-sharing.md` for sharing and OG behavior, and `bpl-s6.md` for viewing preferences and the player matrix.
