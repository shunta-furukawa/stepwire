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
