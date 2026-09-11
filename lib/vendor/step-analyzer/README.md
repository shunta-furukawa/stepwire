# Step Analyzer analysis core

Generated from the same owner's repository, `shunta-furukawa/step-analyzer`,
commit `f71d3ed952e99caaba6279e546e20b8e2029b6a5`:
`lib/chart.ts`, `lib/timing.ts`, `lib/transform.ts`, `lib/edit.ts`,
`lib/arrowShape.ts`, `lib/arrowCanvas.ts`, `lib/footScene.ts`, `lib/clap.ts`.

This immutable snapshot keeps arrow artwork, 3D geometry, foot assignment, holds, shocks, transforms and
timing consistent with the analyzer without requiring a network request while
building or exporting a film. JavaScript and declarations preserve the upstream
compiler assumptions; STEPWIRE's adapters and renderer remain strict TypeScript.
Do not hand-edit generated files or duplicate the foot-assignment algorithm.

Regenerate with the repository's installed TypeScript:

```sh
node scripts/sync-step-analyzer.mjs /path/to/step-analyzer
```

To upgrade, explicitly update the pinned revision in the script and here,
regenerate, and run the chart-video regression tests and the full verification.
The upstream 3D scene owns a browser WebGL context, with explicit frame-time input
for video. No Step Analyzer React UI, MediaRecorder or remote assets are imported.
