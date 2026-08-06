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
