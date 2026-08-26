alter table public.market_schedule_source_preferences
  add column display_color text not null default '#9CCDB9';

alter table public.market_schedule_source_preferences
  add constraint market_schedule_source_preferences_display_color_check
  check (display_color ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.market_schedule_source_preferences.display_color is
  'Owner-selected display color used only in MarketNote and Manager calendar projections. It never writes back to the source.';
