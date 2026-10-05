# BPL sharing

- `/bpl/s?view=player&id=O4MA.` is a shareable HTML document, with server-rendered Open Graph and Twitter large-card metadata. It serves the existing standalone app, without a redirect or a second Next layout.
- `/bpl/og` accepts the same parameters and returns a 1200×630 PNG. Cards use archive records, the STEPWIRE vector logo and the bundled, OFL-licensed Japanese font. No remote requests are required to render.
- `/bpl` rewrites to the HTML handler so the archive landing URL also has a card. Existing hash links continue to work; hashes alone cannot provide entity-specific metadata to crawlers.
- Page-level share/copy/preview controls cover seasons, teams, players, head-to-head and methodology. The match dialog has its own controls. The address bar is synchronized to the share URL using replaceState, retaining the navigation hash.
- Selected seasons, team/stage, player search/sort, duo partners and roster season are restored. A match URL opens the dialog on entry. Closing it restores the underlying view's share context.
- Native Web Share runs directly from a click. Unsupported browsers copy the URL; clipboard failure exposes a selected readonly URL. Cancelling the native share sheet is not an error. Preview failures have a visible retry instruction.
- `lib/bpl/share.ts` validates entity IDs and enums before rendering metadata/cards. User text is escaped. Unknown IDs return 404. The image never prints arbitrary search text or fetches a user-supplied image URL.
- CDN caching: HTML 1 hour, images 1 day. Social networks have their own caches and may delay refreshed previews.

Validation: unit tests cover every match, player, team, ZERO, filters, sort options and invalid IDs. Manual Node/jsdom checks cover shared URL restoration, dialog closing and the existing archive interactions. Call the route handlers directly under `node --import tsx` to validate PNG generation without a listening server.
