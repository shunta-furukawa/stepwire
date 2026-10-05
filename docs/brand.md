# STEPWIRE identity

Both the publication and `/bpl` use the same faceted white/gray/lime identity.

- `scripts/build-brand.mjs` defines a master vector alphabet. Run `node scripts/build-brand.mjs` to regenerate `public/brand/{wordmark,monogram,icon}.svg`.
- S and W use exactly the same paths and facet colors in the full wordmark and initials; both E letters also share one definition.
- `public/brand/site.css` contains the shared masthead. Next imports it from `app/globals.css`; the standalone archive links it directly.
- `public/bpl/theme.css` styles archive surfaces without replacing official team palettes, song jackets, or category badges.
- Cross-section links use ordinary anchors because `/bpl` is a standalone HTML document, not an RSC route.
- Branding remains independent and unofficial; MONO is the creator's personal identity, not the publication's name.
