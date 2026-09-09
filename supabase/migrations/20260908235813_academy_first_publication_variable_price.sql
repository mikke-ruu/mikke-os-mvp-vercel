-- Extend the existing published tariff; no policy/catalog seed or dispatch enablement.
-- 201+ instructors: JPY 20,000 + JPY 100 per instructor above 200.
alter table academy_publication_private.quote_display_catalog
 drop constraint quote_display_catalog_plan_key_check;
alter table academy_publication_private.quote_display_catalog
 add constraint quote_display_catalog_plan_key_check
 check(plan_key in ('small','medium','large','variable'));

-- Narrow, asserted replacements preserve function ACLs, signatures, locking,
-- quote expiry/consent checks, ingress gates and immutable billing snapshots.
do $$
declare source text; previous text; replacement text; target regprocedure;
begin
 target:='academy_publication_private.quote(uuid,text)'::regprocedure;
 source:=pg_get_functiondef(target);
 previous:='if estimate.catalog_price_yen is null or estimate.catalog_price_yen<=0 or estimate.registered_instructor_count>200 then raise exception ''variable_price_requires_review''; end if;';
 replacement:='if estimate.registered_instructor_count is null or estimate.registered_instructor_count<0 or estimate.catalog_price_yen is null or estimate.catalog_price_yen<=0 or estimate.catalog_price_yen is distinct from private.academy_catalog_monthly_price_yen(estimate.registered_instructor_count) then raise exception ''invalid_catalog_price''; end if;';
 if position(previous in source)=0 then raise exception 'unexpected_variable_quote_body'; end if;
 execute replace(source,previous,replacement);

 target:='academy_publication_private.snapshot_quote_display()'::regprocedure;
 source:=pg_get_functiondef(target);
 previous:='when new.instructor_count<=200 then ''large'' else null end;';
 replacement:='when new.instructor_count<=200 then ''large'' else ''variable'' end;';
 if position(previous in source)=0 then raise exception 'unexpected_variable_display_body'; end if;
 execute replace(source,previous,replacement);

 target:='public.academy_first_publication_outbox_claim(text,integer)'::regprocedure;
 source:=pg_get_functiondef(target);
 previous:='case when e.amount_yen=5000 then ''small'' when e.amount_yen=10000 then ''medium'' else ''large'' end';
 replacement:='case when e.amount_yen=5000 then ''small'' when e.amount_yen=10000 then ''medium'' when e.amount_yen=20000 then ''large'' when e.amount_yen>20000 and e.amount_yen%100=0 then ''variable'' else null end';
 if position(previous in source)=0 then raise exception 'unexpected_variable_outbox_body'; end if;
 execute replace(source,previous,replacement);

 target:='academy_publication_private.paid_bridge(text,uuid,jsonb)'::regprocedure;
 source:=pg_get_functiondef(target);
 previous:='case when e.amount_yen=5000 then ''small'' when e.amount_yen=10000 then ''medium'' when e.amount_yen=20000 then ''large'' else null end';
 if position(previous in source)=0 then raise exception 'unexpected_variable_bridge_body'; end if;
 execute replace(source,previous,replacement);

 target:='academy_publication_private.renewal_quote(text,timestamp with time zone)'::regprocedure;
 source:=pg_get_functiondef(target);
 previous:='case when r.amount_yen=5000 then ''small'' when r.amount_yen=10000 then ''medium'' when r.amount_yen=20000 then ''large'' else null end';
 replacement:='case when r.amount_yen=5000 then ''small'' when r.amount_yen=10000 then ''medium'' when r.amount_yen=20000 then ''large'' when r.amount_yen>20000 and r.amount_yen%100=0 then ''variable'' else null end';
 if position(previous in source)=0 then raise exception 'unexpected_variable_renewal_body'; end if;
 execute replace(source,previous,replacement);
end $$;
