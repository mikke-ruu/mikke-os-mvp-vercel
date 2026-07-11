# mikkeOS Design Tokens WP-1

Created: 2026-07-12

This memo records the first shared UI token pass from `MIKKEOS_DESIGN_REVIEW_AND_NEXT_PHASE_2026-07-11.md`.

## Scope

WP-1 only standardizes visual tokens and moves the current Story / shell colors onto those tokens.

In scope:

- `app/globals.css`
- `components/mikkeos/OsShell.tsx`
- `components/mikkeos/StoryProfile.tsx`

Out of scope:

- DB migration
- Supabase connection changes
- RLS / policy changes
- App data model changes
- Full MarketNote / DESK redesign

## Token Direction

The Story look is the current visual baseline.

```text
Text:        --mikke-text            #111827
Soft text:   --mikke-text-soft       #2f3747
Muted text:  --mikke-muted           #4b5563
Line:        --mikke-line            #dfe3ee
Soft line:   --mikke-line-soft       #edf0f5
Primary:     --mikke-primary         #1f2a7a
Accent:      --mikke-accent          #f46a14
Success:     --mikke-success         #2e7d46
Surface:     --mikke-surface         #ffffff
Soft surface:--mikke-surface-soft    #f8fafc
```

## Decisions

- `#111827` is the main text color for the Story-based UI.
- `#1f2a7a` remains the calm primary navigation / action color.
- Orange is kept for accent and active attention states, not broad page branding.
- Public-facing Story surfaces should stay app-first, with `Story by mikke` only as a small footer signal.
- `Log` / `Activity Log` should not be promoted into public or ordinary user-facing navigation.

## Next Work Packages

- WP-2: Extract `MikkeAppShell` and `MikkeOwnerMenu` from the current Story / shell patterns.
- WP-3: Extract small shared parts: `MikkeSection`, `MikkeListRow`, `MikkeStatusBadge`, `MikkeActionCard`, `MikkeEmptyState`.
- WP-5: Rebuild DESK from Story-baseline UI.
- WP-6: Align only MarketNote's header, cards, list, and detail surfaces without changing logic or storage.
