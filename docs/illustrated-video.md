# Illustrated conversation stage

`/studio` now draws conversation (`turn`) scenes with the approved MONO × WIRE
art direction. Both preview and MP4 encoding call `drawScene`, preload the same
assets through `sceneImageSources`, and use the same character reveal plan.

The reusable plate is `public/images/studio/mono-wire-stage.webp` (177 KB),
generated for this project from the operator-approved prototype. It contains
characters and scenery only. Titles, speaker names, AI identification, dialogue,
progress and quoted article images are rendered as live canvas content.

- Heading: `video.headline`, then `shortTitle`, then `title`.
- Dialogue: the existing scene text and reveal timing, unchanged.
- Media: the actual article image, contained without cropping and credited.
- Landscape: large characters around the central media, dialogue along the bottom.
- Portrait: a contained two-character scene above media/dialogue; neither face is cropped.
- Missing plate: the existing vector conversation renderer remains the fallback.
- Other scene types and thumbnails keep their existing renderers.

This first illustrated version is a static character plate: individual eye,
mouth and mood animation is not applied to the painted characters. The active
speaker is identified by the name underline and dialogue border. The original
vector fallback retains its mood/blink behavior. No AI service runs during export.

## Verification

Run `pnpm verify`. Inspect a WIRE turn, a MONO turn, an image-bearing turn and
the longest dialogue in `/studio`, including half-resolution output. Export a
landscape video and confirm the resulting file; a canvas preview alone does not
verify a device's WebCodecs support. The vertical teaser may contain no `turn`
scenes by design, so its sequence selection has not been expanded here.
