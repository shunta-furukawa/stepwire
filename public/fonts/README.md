# Fonts

Self-hosted faces the studio draws with. A canvas cannot draw a face the
page has not loaded, so each face here is declared in `app/globals.css`
and loaded with `ensureFonts()` (`lib/video/canvas/fonts.ts`) before the
first frame.

| file | face | licence | used for |
| --- | --- | --- | --- |
| `DelaGothicOne-Regular.woff2` | Dela Gothic One | SIL OFL 1.1 (`OFL-DelaGothicOne.txt`) | the thumbnail headline and the film's headline card (`font.impact`) |

The OFL asks that the licence travels with the font; it does not ask for a
credit on the card. The website itself stays on the system stack — this
file is 1.1 MB (WOFF2, the full face) and is fetched only when something draws with it.
