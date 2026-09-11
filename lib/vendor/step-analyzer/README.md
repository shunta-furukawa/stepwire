# Step Analyzer analysis core

Generated from the same owner's repository, `shunta-furukawa/step-analyzer`,
commit `3114c83eb62df5f8448b20397ca95e8e32298d84`:
`lib/chart.ts`, `lib/timing.ts`, `lib/transform.ts`, `lib/edit.ts`.

This immutable snapshot keeps foot assignment, holds, shocks, transforms and
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
No Step Analyzer UI, WebGL context, MediaRecorder or remote assets are imported.
