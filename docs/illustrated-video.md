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

The animated plate `public/images/studio/mono-wire-stage-animated.webp` removes
only WIRE's painted eyes and mouth. `stage-motion.ts` draws registered eyes and
mouth with the existing article moods: neutral, grin, surprise, think, wink.
WIRE blinks and looks around, and its mouth moves while its text is revealing
(typewriter timing, not audio lip sync). When MONO speaks WIRE listens in neutral.
MONO keeps its established M mask and no mood tags are added to its dialogue.

The existing WebGL particle field is composited over the scenery again. Sparse
rotating facets and orbiting sparks add motion even without WebGL. Both character
silhouettes are masked out, with headings, media and dialogue drawn afterwards.
All animation derives from frame/fps; seeking and export are repeatable.
The original illustrated plate remains a fallback if the blank plate fails to
load, and the vector renderer remains the fallback if both plates fail.
No AI service runs during export.

## Independent body layers and featured photographs

`mono-wire-scenery.webp` is the empty set; `mono-wire-characters.webp` is a
1672 × 941 RGBA sprite plate. Its left and right halves are registered and drawn
independently by `stage-actors.ts`. WIRE's Canvas face uses the same body transform,
so eyes and mouth stay attached. Both actors breathe, lean and sway around the
waist. WIRE has a quicker speaking beat; MONO has slower motion; listeners give
occasional small nods. This is 2D upper-body animation, not separately articulated
arms or skeletal animation. Poses settle at scene boundaries and are derived
only from frame/fps. MONO retains its M mask.

Layer order: empty scenery → particles → large photograph → transparent actors
→ centered photo credit → dialogue. Landscape media bounds grow from 28% to 50%
of frame width and from 40% to 50% of height, with containment (no cropping), a
lime frame and a shadow. Characters move slightly outward around a photograph;
their silhouettes overlap its frame in the foreground. Portrait also enlarges
the media and places its top edge behind the character layer. If either new
layer is missing, both actors fall back together to the previous composite plate.

Additional built-in image generation prompts, using the animated plate as input:
- Extract both characters onto genuine transparency; preserve blank WIRE face,
  MONO M mask, antenna, hands and faceted palette; remove scenery and table.
- Remove both characters and reconstruct the dark industrial scenery; retain
  camera, table, railings, plants, palette and lighting; no new text or figures.

Asset provenance: built-in image generation, using the original plate as edit
target. Prompt: remove only the left robot's lime eyes and mouth; seamlessly
restore charcoal face facets; preserve head outline, antenna, arms, MONO mask,
lighting, background, camera and framing; no new text or objects.

## Verification

Run `pnpm verify`. Inspect a WIRE turn, a MONO turn, an image-bearing turn and
the longest dialogue in `/studio`, including half-resolution output. Export a
landscape video and confirm the resulting file; a canvas preview alone does not
verify a device's WebCodecs support. The vertical teaser may contain no `turn`
scenes by design, so its sequence selection has not been expanded here.
