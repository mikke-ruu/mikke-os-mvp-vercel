-- MarketNote: let each profile opt an event type into private activity summary counts.
-- This does not publish events to STORY and does not change Activity Log visibility.

alter table public.market_event_types
  add column if not exists counts_toward_summary boolean not null default false;

comment on column public.market_event_types.counts_toward_summary is
  'When true, non-cancelled MarketNote activity logs of this event type may count toward the owner summary. Default false.';
