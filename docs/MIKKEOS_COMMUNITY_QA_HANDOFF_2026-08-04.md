# mikke COMMUNITY QA handoff - 2026-08-04

## Purpose

This document separates what Codex should finish before user review from what the user should manually verify.

The product boundary remains:

- `mikke COMMUNITY` is a generic standalone Community app.
- `Official Academy COMMUNITY` is only one Community tenant.
- Academy app linkage, Stripe billing, and automatic qualification sync are later integrations.
- The 2026-08-07 goal is a usable standalone Community with free rooms, entitlement rooms, staff rooms, and manual entitlement grants.

## Current status

Codex can continue without user action while the work is limited to:

- route smoke checks;
- TypeScript checks scoped to COMMUNITY;
- responsive layout fixes that do not change product behavior;
- documentation and QA checklist updates;
- non-destructive UI safeguards;
- read-only Supabase policy/migration verification.

User review starts when all items in "Codex gate before user review" pass.

## Latest Codex check result

Checked on 2026-08-04.

- Route smoke: passed for all routes listed below.
- COMMUNITY-scoped TypeScript: passed.
- COMMUNITY diff whitespace check: passed.
- Temporary `tsconfig.community.json`: removed after the check.
- Production Supabase migration history: confirmed through `community_staff_archived_room_read`.
- User-side production actions: not performed.

## Codex gate before user review

### Route smoke

Run and confirm `200` for these routes:

- `/community`
- `/community/create`
- `/community/login`
- `/community/c/official-academy-community`
- `/community/c/official-academy-community/join`
- `/community/c/official-academy-community/rooms`
- `/community/c/official-academy-community/events`
- `/community/c/official-academy-community/library`
- `/community/c/official-academy-community/profile`
- `/community/c/official-academy-community/owner`
- `/community/c/official-academy-community/owner/settings`
- `/community/c/official-academy-community/owner/rooms`
- `/community/c/official-academy-community/owner/members`
- `/community/c/official-academy-community/owner/content`

### Code checks

- COMMUNITY-scoped TypeScript check passes.
- `git diff --check` passes for COMMUNITY files and COMMUNITY migrations.
- Browser console has no new duplicate-key warning for COMMUNITY navigation.
- The temporary `tsconfig.community.json` is removed after checks.

### Data and security checks

- Production Supabase has these COMMUNITY migrations:
  - `community_standalone_mvp`
  - `community_generic_room_access`
  - `community_room_access_policy_cleanup`
  - `community_foreign_key_indexes`
  - `community_creation_flow`
  - `community_staff_hidden_post_read`
  - `community_staff_archived_room_read`
- Staff can read hidden posts for moderation.
- Staff can read archived rooms for restore.
- Non-staff room catalog remains limited to non-archived rooms.
- Non-staff post content remains limited by room access.

### Responsive checks

Check 390px, 768px, and PC width for:

- login / signup;
- join screen;
- Community hub;
- Room list;
- Room detail and comment form;
- owner dashboard;
- owner rooms;
- owner members;
- owner content.

Pass criteria:

- no horizontal overflow;
- no text clipped inside buttons;
- bottom nav does not duplicate or hide items;
- owner forms remain usable without side scrolling.

## User review trigger

Ask the user to review only after the Codex gate above is green.

Do not ask the user to click "無料で参加する" or "ownerになる" until Codex explicitly says:

> ここからは実アカウントで確認お願いします。

Reason: those actions create production Supabase records.

## User review checklist

When the user review starts, ask the user to verify these in order.

### Free participant flow

1. Open `/community/c/official-academy-community`.
2. Register or login with a test user.
3. Join for free.
4. Confirm free rooms are visible.
5. Confirm locked rooms are visible as locked but content is not available.

### Owner setup flow

1. Open owner settings.
2. Claim owner if the Community has no owner.
3. Edit Community name and description.
4. Keep join mode as `open_free` for initial free acquisition.

### Room and entitlement flow

1. Create a free room.
2. Create an entitlement room.
3. Create or use an entitlement definition such as `paid:member`.
4. Confirm a free participant cannot open the entitlement room.
5. Grant the entitlement manually.
6. Confirm the same participant can open the entitlement room.
7. Revoke the entitlement.
8. Confirm access is locked again.

### Owner operations flow

1. Create a notice.
2. Pin and unpin the notice.
3. Hide and restore the notice.
4. Create an event.
5. Close, reopen, and cancel the event.
6. Create a resource link.
7. Stop publishing and republish the resource.
8. Archive and restore a room.
9. Change a member role to `moderator`, then back to `member`.
10. Suspend and restore a test participant.

## Known intentionally deferred items

- Stripe checkout and real paid subscription sync.
- Academy-to-Community automatic entitlement adapter.
- Invite codes.
- Email broadcast.
- File upload / native resource storage.
- Post, event, and resource drag ordering.
- Full app-wide build across unrelated dirty worktree areas.

## Stop conditions

Stop and ask the user before:

- clicking a button that creates or changes production user/community data;
- claiming owner on the user's actual account;
- suspending a real participant;
- changing real production access levels;
- deleting or reverting unrelated dirty worktree changes;
- committing or pushing changes.
