# Media Free MVP local vertical slice

Date: 2026-09-02

## Product promise

Media provides the foundation to create, write, publish, and maintain a media property. It does not guarantee traffic, search ranking, affiliate revenue, or other earnings.

## Implemented in this slice

- One Media per mikkeID profile in the local store
- Media name, slug, description, author label, and categories
- TODAY dashboard
- Article list with draft, published, unpublished, and unpublished-change state
- Block editor: paragraph, heading, image, quote, list, divider, and safe link
- Debounced draft autosave and explicit draft save
- Draft preview
- Immutable published snapshot, republish, and unpublish
- Public Media index and article routes backed by published snapshots
- Media registration in the existing Apps catalog
- Focused local-store contract check

## Routes

- `/apps/media`
- `/apps/media/new`
- `/apps/media/write`
- `/apps/media/write/preview`
- `/apps/media/articles`
- `/apps/media/settings`
- `/media/[mediaSlug]`
- `/media/[mediaSlug]/[articleSlug]`

## Current storage boundary

This slice uses `localStorage` key `mikke.media.free.v1`. It is a local usability prototype. A public route can only read the browser's own stored snapshot and is not an internet publication contract.

The store keeps editable article data separate from `publishedSnapshot`. Editing a published article does not alter the visible snapshot until the owner publishes again. Unpublish removes the snapshot while retaining the editable draft.

## Proposed DB foundation (not applied)

- Migration `20260902054001_media_free_foundation.sql` proposes `media_sites`, `media_categories`, `media_articles`, and immutable `media_article_versions`.
- Allow the authenticated owner to manage only their own Media and drafts.
- Allow anonymous access only to explicitly published versions.
- Add transactional publish and unpublish RPCs, unique slug guards, and narrow grants.
- Public readers receive only published snapshot fields through narrow RPCs; base article and version tables are not granted to `anon`.

## Next gate: replay and client connection

- Replay the proposed migration against a disposable local database and run RLS, grant, and concurrency tests.
- Connect the client to the reviewed tables and RPCs, replacing localStorage only after the local contract passes.
- Connect Mikke Media usage records without weakening asset ownership.
- Add server metadata, canonical URLs, sitemap entries, and Article structured data from the published version.
- Test RLS, grants, authenticated ownership, anonymous reads, draft non-disclosure, and update/publish races separately.

No migration, production database change, deploy, menu entitlement, billing, external publication, AI, affiliate automation, or paid article behavior is included in this slice.
