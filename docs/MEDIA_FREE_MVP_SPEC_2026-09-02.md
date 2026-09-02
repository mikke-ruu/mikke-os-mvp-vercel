# Media Free MVP local vertical slice

Date: 2026-09-02

## Product promise

Media provides the foundation to create, write, publish, and maintain a media property. It does not guarantee traffic, search ranking, affiliate revenue, or other earnings.

## Implemented in this slice

- One Media per mikke ID profile in the local store
- Media name, slug, description, author label, and categories
- TODAY dashboard
- Article list with draft, published, unpublished, and unpublished-change state
- Block editor: paragraph, heading, image, quote, list, divider, and safe link
- Debounced draft autosave and explicit draft save
- Draft preview
- Immutable published snapshot, republish, and unpublish
- Public Media index and article routes backed by published snapshots
- Media registration in the internal app registry; catalog visibility remains disabled
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

All routes above return 404 outside development until the database, authentication,
legal, deployment, and publication gates are approved.

## Current storage boundary

This slice uses `localStorage` key `mikke.media.free.v1`. It is a local usability prototype. A public route can only read the browser's own stored snapshot and is not an internet publication contract. The browser store is never authoritative ownership data and must not be imported or promoted automatically after sign-in.

The store keeps editable article data separate from `publishedSnapshot`. Editing a published article does not alter the visible snapshot until the owner publishes again. Unpublish removes the snapshot while retaining the editable draft.

## Proposed DB foundation (not applied)

- The core permits multiple Media per owner. Free's one-Media limit belongs in the service/entitlement layer so a personal Media and JLT can coexist later.
- Ownership comes only from `auth.uid()` plus RLS. Anonymous Auth sessions are rejected for owner operations.
- Site and article locale, translation group, and locale-scoped slug contracts keep the core usable for JLT and other overseas Media.
- Publish-state columns are excluded from direct client grants. Only transactional publish/unpublish RPCs may change them.
- Published slugs are reserved under a stable site lock, preventing reuse races and accidental link changes.
- Published versions carry a revision hash, typed asset bindings, immutable asset metadata, a terms/rights/privacy/affiliate-free attestation, and a publication outbox receipt.
- Public readers receive published projection fields without internal site/article UUIDs. Base tables are not granted to `anon`.
- `direct_owner` is the Free publishing policy. `managed_brand` remains fail-closed until Media Engine approvals and separate Legal/Privacy clearance are connected.

## Cross-room boundaries

- Media app owns Media settings, editor, drafts, categories, public web routes, theme, and the Media-specific analytics and monetization UI.
- Media Engine owns revision/provenance contracts, asset bindings, managed-brand approvals, exports/publications, delivery results, metrics, idempotency, and audit.
- Locale, brand configuration, social credentials, analytics properties, affiliate accounts, editorial policy, and original storage remain isolated per Media.
- External AI/MCP may later create drafts only. Human review and an explicit publish action remain mandatory.
- Anonymous/brand Media changes only the public author label; internal owner identity is never returned publicly. Collaboration roles are later work.

## Legal publication gate

General public publication remains blocked until approved Media terms, privacy notice,
prohibited-content rules, reporting/takedown flow, rights and personal-information
preflight, retention/hold behavior, and versioned consent evidence are implemented.
Free prohibits affiliate and sponsored content until a separate disclosure and link
contract is approved. Paid articles and automated affiliate behavior are later gates.

## Next gate: replay and client connection

- Replay the proposed migration against a disposable local database and run RLS, grant, and concurrency tests.
- Cover two human users plus an anonymous Auth session, direct state-column writes, published-slug races, foreign assets, unsafe blocks, draft leakage, republish/unpublish, and zero residue.
- Connect the client to the reviewed tables and RPCs, replacing localStorage only after the local contract passes.
- Connect Mikke Media usage records without weakening asset ownership.
- Add server metadata, canonical URLs, sitemap entries, and Article structured data from the published version.
- Test RLS, grants, authenticated ownership, anonymous reads, draft non-disclosure, and update/publish races separately.

No migration, production database change, deploy, catalog/menu entitlement, billing, external publication, AI, affiliate automation, or paid article behavior is included in this slice.
