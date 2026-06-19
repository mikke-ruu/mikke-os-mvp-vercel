# mikke-os-mvp

Mikke OS initial MVP.

This app proves the first flow:

```text
MarketNote entry
→ Activity Log
→ Story MVP
→ DESK mini
```

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase JS
- lucide-react

## Supabase

Project: `mikke-os-dev`

Required tables:

- profiles
- activity_event_types
- activity_logs
- market_events
- market_check_items
- market_financial_records
- market_reflections

## Environment

Copy `.env.local.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Never commit `.env.local`.

## Scripts

```bash
npm.cmd run dev
npm.cmd run build
```
