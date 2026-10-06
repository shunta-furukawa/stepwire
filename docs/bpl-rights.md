# BPL display and rights review (2026-10-05)

Current mitigation, not a legal clearance or permission grant:

- Current `/bpl` displays no third-party logos, portraits, jackets, background textures, or copied promotional catchphrases.
- Season/team labels and generic player/music symbols are original UI. Team identification colors remain; they are not presented as an officially licensed palette.
- Removed the public CSS-file source link and image-download metadata. Public sources point to official human-readable pages and broadcast videos.
- Deleted the two artwork archive chunks from the current repository tree. Build preparation removes legacy extracted `public/bpl/assets` so reused workspaces cannot republish them.
- Retained factual match records, scores, participant/team/song names, roster histories, category designations, and official result URLs. No blanket conclusion that all reuse is permitted is asserted.
- STEPWIRE's own branding and its licensed bundled fonts remain.

Before restoring any third-party material: document the rightsholder, the exact material, the applicable written permission/guideline and scope (website reproduction, modification, share images), source URL and review date. Noncommercial status and attribution alone are not approval.

Remaining checks:

1. Confirm any BPL-specific permission covering website artwork reuse. No such permission has been established in this project.
2. Review the scope of systematic result collection and the source site's terms before adding automated collection.
3. Historical Git commits and earlier Vercel deployment URLs can still contain the removed artwork. This change removes it from the current tree/deployment; it does not rewrite Git history or delete old deployments.
4. This review covers the BPL archive. Existing STEPWIRE article illustrations/screenshots require a separate inventory if extending the review to the publication.

## Follow-up audit — 2026-10-06 JST

- Vercel project reports SSO protection `all_except_custom_domains`. Two historical URLs (deployments `dpl_J62oPQCXzuiFvxK8zse6SFNADbJN` and `dpl_5NfWKFypGjLV8Vcz4ByBeSZ78m5D`) redirect unauthenticated artwork requests to Vercel login. This is access protection, not deletion. No deployment was deleted or project setting changed.
- GitHub repository visibility is **public**. Historical artwork archives remain in commits beginning at `c2a449c82a2e39556d30e3df9fac2144e6b270d1`. The two blob IDs are `4d9c5102f35c0119a4346b06552468de2eb91598` and `b4c4419085948f5319b0a2dc39f6c38e9e76cdea`. Current default/production branch is `claude/stepwire-ddr-news-mvp-1eugh6`.
- Historical removal would require rewriting affected commits and updating the remote branch with a lease. Existing clones, GitHub cached commit views, pull-request refs, forks and old Vercel deployments are separate copies; rewriting a branch does not guarantee their removal. Prepare a recovery copy outside public hosting, coordinate other clones and contact GitHub support about remaining cached objects if necessary. The operator approved the targeted rewrite on 2026-10-06 JST; see the completion record below.
- `pnpm rights:check` checks BPL metadata fields, known legacy artwork references, copied bundles and unreviewed non-text files. Original SW app icons are identified by SHA-256 in `docs/bpl-original-icons.json`. Production builds run the policy check after cleaning legacy extracted assets. This is regression prevention, not automated legal approval; it cannot identify every artwork URL assembled by code.
- `pnpm rights:audit --write` regenerates `docs/article-assets-review.json`: 65 article image files/references, 35 used by published articles, all pending individual review. Credits and article sources are recorded, not interpreted as permission. Article bodies and image publication are unchanged in this follow-up.
- Draft/review status does **not** protect static files in `public/` or the existing public studio previews. Those are part of the next article-by-article review; an asset must be removed from the deployed output to become unavailable there.
- Corrected schema, renderer comments and video documentation that incorrectly implied attribution alone makes image reuse a quotation.

Reference checked: https://www.konami.com/siteinfo/ja/ . Source-site terms and each rightsholder's applicable guidelines must be reviewed for the actual use; this inventory does not determine whether an individual quotation is lawful.

## BPL archive history cleanup — 2026-10-06 JST

With explicit operator approval, reconstructed the 14 affected commits from the archive introduction through the follow-up audit. In each rewritten commit, only `vendor/bpl-assets.tar.gz.001` and `.002` were removed; all other file contents were retained. The final application tree before this audit-note update is byte-for-byte identical to the pre-rewrite tree. Original author names and dates are recorded in commit-message trailers because the connected commit API creates fresh commit metadata.

Verified both archive blob IDs are unreachable from the reconstructed head. All advertised remote branches/tags were inventoried; only the default/production branch contained the affected history. Update that branch using the previously observed head as a force-with-lease precondition. A recovery bundle was kept locally, not uploaded as a public backup branch.

Existing clones must synchronize to the rewritten history before pushing; do not merge or push the old affected commits back into the repository. Preserve any uncommitted work first. The local working copy used for this cleanup was clean.

This operation removes the archives from current branch history, not GitHub's retained unreachable objects/cached SHA views, old clones, or protected Vercel deployments. No guarantee of server-side physical deletion is made. Removing those copies requires separate platform cleanup; article image reviews are also still pending.

## Generated player illustrations — 2026-10-06 JST

At the operator's request, the generic player symbols are replaced with AI-generated chibi illustrations. The approved O4MA. illustration is the style reference for the set. Public official player photographs are used to identify facial features, while each output uses an independently composed front-facing bust and plain clothing without official uniforms, logos or text. These are **reference-based generated illustrations, not rights-cleared assets**. Changing style, pose or composition does not by itself resolve likeness, copyright or other rights questions. No player or team endorsement is asserted.

- `docs/bpl-generated-portraits.json` records player IDs, public profile-page sources, generated-file hashes, reference-photo hashes, generation method and the unresolved rights status. The inventory is technical provenance, not a permission record.
- Only the generated WebP portraits are deployed under `public/bpl/portraits/`. Source photographs are not checked in or bundled. The interface labels the illustrations as unofficial AI-made depictions in the archive's display/source information.
- The existing cleanup of `public/bpl/assets/`, legacy CDN-reference checks, original SW-icon hash inventory and vendor archive rejection remain in place. The new allowance is restricted to exact inventoried generated files with matching player mappings, and also rejects serving the recorded reference-photo bytes.
- This change does not restore official photographs, jackets, logos or backgrounds, nor change article publication, past Git objects, historical deployments, PWA settings or sharing-image artwork.
