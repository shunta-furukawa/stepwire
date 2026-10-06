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

`BplShare.ttf` is a TrueType subset of the bundled Dela Gothic One font,
used by the BPL social-card renderer (Satori requires TTF/OTF rather than WOFF2).
It retains the original font name; the SIL OFL in `OFL-DelaGothicOne.txt` applies.
The subset includes printable ASCII plus characters in the BPL data, share model,
and image renderer. Regenerate with `python3 scripts/subset-bpl-font.py`
(requires fontTools + brotli) when adding new names or card copy.
