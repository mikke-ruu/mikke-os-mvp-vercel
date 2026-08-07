# COMMUNITY paid product roadmap

Updated: 2026-08-06

## Product position

COMMUNITY is a standalone, multi-tenant Community product. Each tenant owns its name, content, members, access rules, and invitation URL. `by mikke` is a small provider credit, not the tenant brand.

The product must feel like a place where people are present and conversations continue. It should not look like a generic admin board. Shared app chrome follows the Mikke OS editorial color rules; tenant branding is applied inside that frame.

## Room model

Room behavior and access permissions are separate settings.

- THREAD: a compact topic list leading to a topic detail with comments. Suitable for announcements, questions, introductions, and archives.
- CHAT: continuous LINE-like conversation. Replies and reactions belong to messages rather than large posts.
- EVENT: date, location, participation status, event updates, and an event discussion area.

Each Room independently controls:

- who can view it: free participants, entitlement holders, or staff;
- who can start content: participants or staff only;
- who can reply: participants, staff only, or nobody;
- whether attachments are accepted.
- a display color chosen by the operator from the Mikke fixed palette. Color meaning belongs to each tenant and is not inferred from Room behavior.

Unauthorized Rooms are not listed. A paid or staff-only Room must not be exposed as a locked teaser to free participants.

## Self-introduction policy

A self-introduction Room is not created automatically. A Community that wants introductions can create an ordinary THREAD Room and choose its posting/comment permissions.

When tenant templates are introduced, `Create a self-introduction Room` is an optional, default-off switch. This avoids imposing an onboarding custom on groups that do not use introductions.

## Delivery phases

### Phase 1: conversation foundation

- THREAD Room list -> thread detail -> all comments;
- visible back navigation;
- author name/avatar presentation;
- author edit and soft-delete for own posts/comments;
- no `normal` or `free` badges in the participant UI;
- no input when the participant lacks write/comment permission;
- inaccessible Rooms hidden by database RLS and UI filtering;
- Room ordering with direct up/down controls;
- Mikke fixed palette used consistently while allowing operators to assign blue, orange, yellow, pink, or green to each Room.

### Phase 2: tenant identity and media

- Community logo and wide banner;
- profile avatar upload;
- post/comment image and file upload from the device;
- Supabase Storage buckets, MIME/size limits, private delivery, and RLS;
- tenant theme presets that preserve contrast and Mikke OS layout rules.

### Phase 3: social expression and chat

- custom stamp packs managed by each tenant;
- reactions, mentions, unread state, and notification preferences;
- Realtime CHAT Room with message edit/delete, replies, and moderation;
- pinned welcome content and first-visit onboarding.

### Phase 4: events and paid operations

- EVENT Room calendar/detail/RSVP integration;
- entitlement and subscription lifecycle integration;
- scheduled posts, search, bookmarks, reports, moderation queue, audit/recovery UI;
- reusable tenant templates with individually selectable Rooms, including optional introductions.

## Release gates

Every phase is verified separately for local UI, responsive layout, TypeScript/lint, production build, applied Supabase migration, RLS with real roles, deployment, and production authenticated flow. Passing one gate is not evidence for another.

## Implementation checkpoints

- Phase 1 conversation foundation: committed as `2e5a093`.
- Phase 2 tenant identity/media plus custom stamps: committed as `ab7cc9b`; production migrations applied.
- Phase 3A Realtime CHAT foundation: implemented locally on 2026-08-07. Includes independent Room conversation mode, continuous message timeline, replies, tenant stamps, author edit/soft-delete, staff moderation, and Postgres Changes subscription. Production schema/RLS are applied, including a database guard that prevents thread posts in CHAT Rooms; real-member allow/deny tests and the webpack production build passed. Local user review is pending before commit.
- Phase 3A Room creation fix: avoid `INSERT ... RETURNING` against the stable Room visibility helper by generating the Room UUID client-side. The exact owner insert/read sequence passed in a rolled-back production RLS test; creation errors now render beside the submit button.
- Phase 3A chat composer: add an inline emoji picker that inserts common emoji at the current cursor position. Native keyboard and pasted Unicode emoji remain supported independently of tenant custom stamps.
- Phase 3B reactions and unread state: implemented locally on 2026-08-07. Chat messages support six quick reactions with per-user toggles and aggregated counts. Room cards show a BLUE unread count for new posts, comments, and chat messages from other members; opening a Room updates only the signed-in member's read state. Production RLS, real-member allow/deny tests, advisors, and the webpack production build passed. Local user review is pending before commit.
- Mentions, notification preferences, and first-visit onboarding remain later Phase 3 checkpoints.
