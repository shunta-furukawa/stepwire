# BPL DDR archive

The existing BPL DDR RECORDS snapshot is vendored in `public/bpl/`. Next.js rewrites `/bpl` to `/bpl/index.html`; all assets and data are rooted under `/bpl/`. Its hash routes stay on `/bpl` and keep the archive’s independent CSS, team colors, official materials and noncommercial attribution. The main STEPWIRE navigation uses a normal document link because this is a standalone document rather than an RSC route.

Imported from BPL DDR RECORDS source commit `10e44dc57bd32fe488cbc79b7be0b0e7b6626f84`, snapshot 2026-10-04. Covers 64 fixtures, 166 battles, 308 performed-song records, 213 song jackets and the S6 roster. ZERO has battle scores and categories but no song-level results. All official image and result source URLs are retained in `brand.json` and `data.json`; seven jackets use CSS viewports into unchanged official news images.

This is an explicitly requested independent archive, not an article or a new collector. No scraping, fetching of third-party assets, or data regeneration runs in the build or production. Update the checked-in snapshot deliberately, retaining source links and the `/bpl/` asset prefix.

Artwork is stored without modification in `vendor/bpl-assets.tar.gz.001` and `.002`. `scripts/prepare-bpl.mjs` validates entry paths and extracts ordinary static files into ignored `public/bpl/assets/` before dev/build. No network fetch is needed at build time. To update artwork, replace the bundle along with its `brand.json` references.
