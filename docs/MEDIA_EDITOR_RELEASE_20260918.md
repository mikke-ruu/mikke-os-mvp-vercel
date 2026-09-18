# Media editor production integration

User approved publishing the demonstrated editor and mobile dashboard on 2026-09-18.

## Included

- Inline + insertion, Enter paragraph splitting, move/duplicate/delete controls.
- Existing seven cloud block types, private image picker and cloud publication confirmation.
- Draft save / publish / update labels and publication request locking.
- Mobile three-column counters linking to all/draft/published article lists; search, category/month filters and 12-item pagination.
- Authenticated account name, profile handle and account email display in the owner UI only.
- Same-owner auth reconfirmation recovery; different-user/logout transitions remain invalidating.

## Boundaries

No DB migration, RLS change, image feature flag change, shared Academy editor replacement, localStorage production fallback, or legal/terms change.

Local rich text, image-link metadata, extra layout blocks, My Media/social actions and analytics are not enabled by this release. Their persistence is not supported by the existing cloud publication contract. The production-specific adapter never offers fields which would be silently dropped or rejected when publishing. Existing cloud articles and their owner checks are retained.

## Validation

- scripts/media-cloud-editor-blocks-check.mjs: real input and parent editor handlers, strict publication fields, private asset IDs, IME-safe Enter, insertion/move/duplicate/delete.
- scripts/media-publication-ui-check.mjs: confirmation checks, update label, duplicate publish protection and failure recovery.
- scripts/media-cloud-repository-check.mjs: owner identity, anonymous denial, A/B/A race, same-owner session reconfirmation and sanitized errors.
- Type checking, production build and browser checks recorded in workspace Consultation Logs with release results.
