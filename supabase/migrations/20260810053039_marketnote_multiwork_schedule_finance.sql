-- MarketNote multi-purpose schedule and opt-in finance foundation.
-- Existing market_events.genre values remain the event type. Existing rows are
-- already "出店" in the application, so no event migration is required.

alter table public.market_financial_records
  add column if not exists payment_method text,
  add column if not exists entry_kind text not null default 'manual';

update public.market_financial_records
set
  payment_method = coalesce(payment_method, nullif(trim(memo), '')),
  entry_kind = 'advance_expense'
where record_type = 'expense'
  and (
    title ilike '%出店%'
    or category = '出店料'
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.market_financial_records'::regclass
      and conname = 'market_financial_records_entry_kind_check'
  ) then
    alter table public.market_financial_records
      add constraint market_financial_records_entry_kind_check
      check (entry_kind in ('manual', 'advance_expense', 'quick_note'));
  end if;
end
$$;

comment on column public.market_financial_records.payment_method is
  'Optional user-facing payment method. Kept separate from the free-form memo.';

comment on column public.market_financial_records.entry_kind is
  'Origin of the record: manual finance entry, advance expense, or quick note.';
