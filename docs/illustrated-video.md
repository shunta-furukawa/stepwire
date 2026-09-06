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
Its small mouth opens during its own text reveal and returns to the painted
closed mouth while listening or holding completed text. Mouth position is
registered for all four poses. This is typewriter-driven motion, not audio sync.

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
independently by `stage-actors.ts`. WIRE's Canvas face stays registered to its head.
Body sway, rotation and breathing transforms have been removed: arms now change
by swapping authored illustrations on each turn. MONO retains its M mask.

## Arm and hand pose variants

Each character has four illustrations. The default uses the original sprite;
three additional RGBA plates live in `public/images/studio/`:

| Pose | WIRE | MONO | Asset |
| --- | --- | --- | --- |
| `default` | One palm open | Cheek resting on hand | `mono-wire-characters.webp` |
| `explain` | Both palms open | One hand extended | `mono-wire-pose-explain.webp` |
| `think` | Hand at chin, other arm folded | Arms crossed | `mono-wire-pose-think.webp` |
| `celebrate` | Both fists raised | One fist raised | `mono-wire-pose-celebrate.webp` |

The speaking character defaults to `explain`. Only the speaker's pose can change;
the listener holds its last pose (initially `default`). Pose history is resolved
after scene trimming and stored on each scene, so seeking directly to a later
turn reproduces the same result as sequential playback. Non-dialogue scenes do
not reset that history. Character positions also remain fixed when photos change.
WIRE's existing `think` mood selects `think`, and `grin` selects `celebrate`.
MONO's emotional poses are author-controlled, not guessed from its words.
Poses stay fixed within a turn while WIRE's eyes and mouth continue animating.
The speaker's pose can be overridden in article frontmatter. A setting for the
listener in that turn is ignored, so it cannot make both bodies change together:

```yaml
video:
  scenes:
    context-2:
      characterPoses:
        MONO: celebrate
```

Use the scene's actual id (`context-2` must be a MONO turn in this example).
No dialogue text or facial mood is changed by this
override. Unknown pose names are rejected during content validation. Preloading
includes only selected variants, plus the default for missing-asset fallback.
Each pose has its own sprite split and registration; a failed load uses the
default's registration too. Preview and export use the same selection logic.

Built-in image generation prompts for each new plate used the animated stage as
reference: extract both characters with true transparency and preserve identity,
blank WIRE face, antenna, MONO M mask and faceted charcoal/lime palette; replace
arms/hands with the matching pose in the table above. RGB outputs with baked-in
checkerboards were rejected. All three shipped images have verified alpha.

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
