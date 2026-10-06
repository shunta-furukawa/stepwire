# Offline moderate jacket palette extractor

This reproduces the approved seven-song moderate comparison. It is not used at
build time or by the website. It never writes or serves source-image bytes.

Install the pinned packages in `requirements.txt`, then run:

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python -m unittest discover -s scripts/bpl-palettes -v
```

`extract(image)` returns four sampled colors; `clusters(image)` and `select(rows)`
provide the intermediate color-only analysis. `approved-clusters.json` contains
only cluster colors/statistics from the seven approved comparisons, not images.

The preparation sequence is unchanged: convert to RGBA, Pillow's default
`thumbnail((128,128))`, split at integer midpoints in TL/TR/BL/BR order, ignore
alpha below 32, and run alpha-weighted Oklab KMeans with up to five clusters,
`random_state=23`, `n_init=8`, and `max_iter=80`. Each candidate is the actual
analysis-thumbnail RGB pixel nearest its Oklab centroid.

For each quadrant, clusters with an alpha-weighted area fraction below 0.05
receive score zero. If any cluster has both fraction >= 0.05 and centroid chroma
C >= 0.06, use:

`fraction ** 0.7 * (1 + 2 * min(C / 0.10, 1) ** 2)`

Otherwise use the original selector for the entire quadrant:

`fraction * (0.75 + 0.65 * min(C / 0.15, 1))`

In either case multiply a cluster's score by 0.7 when centroid lightness < 0.18
and fraction < 0.65. Candidate clusters remain stably ordered by descending
fraction, and the first maximum wins, exactly as in the approved comparison.
The neutral guard does not discard neutral competitors. No pixel's chroma is
boosted, and no new color is synthesized.

For the all-song refresh, only the 206 official URLs already recorded in
`docs/bpl-jacket-palettes.json` were read by the normal public route. Each image
was decoded in memory, checked against the previous SHA-256 and dimensions,
then discarded. The original selector reproduced all 824 production colors
before moderate selection was accepted. All seven approved comparison tuples
also had to match. The updated provenance records resampling time, exact
selector settings, source-match counts, change/fallback totals, and the runtime
JSON SHA-256. The seven unresolved titles retain the existing music symbol.

No official image is included here, and technical provenance does not assert
copyright or other rights clearance. CSS corner ordering and blending are
unchanged.
