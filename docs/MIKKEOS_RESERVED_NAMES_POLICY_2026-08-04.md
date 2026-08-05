# mikkeOS reserved names policy

Updated: 2026-08-04

This policy applies across mikkeOS apps whenever a user can create a public URL id, handle, slug, group name, Community name, profile handle, shop id, page id, or app-owned namespace.

## Core rule

Generic users should not be able to create names that look like official mikke, system, admin, support, or certified/official operator spaces.

The product model stays open: users can create their own Community, Page, Fund project, Story profile, shop, or other app entity. But official-looking namespaces are reserved so that future mikke-owned surfaces remain trustworthy.

## Reserved exact slugs

The shared implementation starts with these exact reserved values:

- `mikke`
- `mikkeos`
- `mikke-os`
- `mikke-id`
- `mikke-community`
- `mikkeruu`
- `official`
- `officialacademy`
- `official-academy`
- `official-academy-community`
- `officialpartner`
- `official-partner`
- `officialtrainer`
- `official-trainer`
- `admin`
- `administrator`
- `api`
- `app`
- `apps`
- `auth`
- `billing`
- `community`
- `communities`
- `dashboard`
- `help`
- `home`
- `login`
- `logout`
- `manager`
- `member`
- `members`
- `owner`
- `profile`
- `root`
- `settings`
- `staff`
- `support`
- `system`

## Reserved prefixes

Generic user-created slugs should also reject:

- `admin-*`
- `api-*`
- `mikke-*`
- `mikkeos-*`
- `mikkeruu-*`
- `official-*`
- `system-*`

## Display-name warning / rejection words

For display names, reject or warn when the name includes:

- `mikke`
- `mikkeOS`
- `Official Academy`
- `公式`
- `運営`
- `管理者`
- `認定`
- `オフィシャル`

## Implementation rule

Use the shared helper:

- `lib/mikkeos/reserved-names.ts`

When an app also exposes database-side creation, add the same guard to the RPC or table constraint/policy layer. Frontend-only validation is not enough.

## Current application

COMMUNITY creation now uses this rule:

- frontend create form warning and submit guard;
- `createCommunity()` client guard;
- `community_create` RPC guard via migration `20260804104000_mikke_reserved_names_guard.sql`.

