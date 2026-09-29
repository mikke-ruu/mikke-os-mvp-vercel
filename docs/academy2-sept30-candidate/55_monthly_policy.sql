-- Production candidate; review and isolated validation required before approval.
-- Local settings contract only. No subscription activation or real payment.
create function academy2_access.monthly_policy_issues(m jsonb) returns text[]
language plpgsql immutable set search_path='' as $$
declare issues text[]:='{}';v jsonb;valid boolean;begin
 v:=m->'billing_policy';valid:=false;
 if jsonb_typeof(v)='object' then
  valid:=coalesce(v->>'anchor' in('join_date','month_start','day_of_month') and v->>'short_month'='last_day',false)
   and not exists(select 1 from jsonb_object_keys(v) k where k not in('anchor','day','short_month'));
  if v->>'anchor'='day_of_month' then
   valid:=valid and jsonb_typeof(v->'day')='number';
   if valid then valid:=(v->>'day')::numeric between 1 and 31 and trunc((v->>'day')::numeric)=(v->>'day')::numeric;end if;
  else valid:=valid and not(v?'day');end if;
 end if;
 if valid is distinct from true then issues:=array_append(issues,'billing_policy_required');end if;
 v:=m->'cancellation_policy';valid:=false;
 if jsonb_typeof(v)='object' then valid:=coalesce(v->>'kind' in('before_next_charge','administrator_review'),false) and not exists(select 1 from jsonb_object_keys(v) k where k<>'kind');end if;
 if valid is distinct from true then issues:=array_append(issues,'cancellation_policy_required');end if;
 v:=m->'refund_policy';valid:=false;
 if jsonb_typeof(v)='object' then
  valid:=coalesce(v->>'kind' in('no_refund','administrator_review','partial_refund'),false)
   and not exists(select 1 from jsonb_object_keys(v) k where k not in('kind','explanation','consultation'))
   and (not(v?'explanation') or jsonb_typeof(v->'explanation')='string')
   and (not(v?'consultation') or jsonb_typeof(v->'consultation')='string');
  if v->>'kind'='partial_refund' then valid:=valid and nullif(btrim(v->>'explanation'),'') is not null;end if;
 end if;
 if valid is distinct from true then issues:=array_append(issues,'refund_policy_required');end if;
 v:=m->'unpaid_policy';valid:=false;
 if jsonb_typeof(v)='object' then
  valid:=jsonb_typeof(v->'grace_days')='number' and not exists(select 1 from jsonb_object_keys(v) k where k<>'grace_days');
  if valid then valid:=(v->>'grace_days')::numeric between 0 and 2147483647 and trunc((v->>'grace_days')::numeric)=(v->>'grace_days')::numeric;end if;
 end if;
 if valid is distinct from true then issues:=array_append(issues,'unpaid_policy_required');end if;
 return issues;
end$$;
revoke all on function academy2_access.monthly_policy_issues(jsonb) from public,anon,authenticated,service_role;

create function academy2_access.validate_monthly_policy_draft(m jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare issue text;key text;begin
 -- Missing policy may remain in a draft, but malformed explicit values may not.
 foreach issue in array academy2_access.monthly_policy_issues(m) loop
  key:=regexp_replace(issue,'_required$','');
  if m?key then raise exception 'academy2_invalid_monthly_policy: %',key using errcode='22023';end if;
 end loop;
end$$;
revoke all on function academy2_access.validate_monthly_policy_draft(jsonb) from public,anon,authenticated,service_role;

create function academy2_access.monthly_billing_date(b jsonb,joined_on date,target_month date) returns date
language plpgsql immutable set search_path='' as $$
declare first_day date;last_day date;chosen integer;m jsonb;begin
 m:=jsonb_build_object('billing_policy',b,'cancellation_policy',jsonb_build_object('kind','before_next_charge'),'refund_policy',jsonb_build_object('kind','no_refund'),'unpaid_policy',jsonb_build_object('grace_days',0));
 if joined_on is null or target_month is null or not isfinite(joined_on) or not isfinite(target_month) or cardinality(academy2_access.monthly_policy_issues(m))<>0 then raise exception 'academy2_invalid_monthly_billing_date' using errcode='22023';end if;
 first_day:=make_date(extract(year from target_month)::integer,extract(month from target_month)::integer,1);
 last_day:=(first_day+interval '1 month'-interval '1 day')::date;
 chosen:=case b->>'anchor' when 'join_date' then extract(day from joined_on)::integer when 'month_start' then 1 else (b->>'day')::integer end;
 return first_day+(least(chosen,extract(day from last_day)::integer)-1);
end$$;
revoke all on function academy2_access.monthly_billing_date(jsonb,date,date) from public,anon,authenticated,service_role;

-- Narrowly extend the current save contract without overwriting later patches.
do $patch$
declare definition text;old_text text;new_text text;begin
 definition:=pg_get_functiondef('academy2_access.save_sales_plan_draft(uuid,uuid,integer,jsonb)'::regprocedure);
 old_text:=$old$('months','period','past_access','exit_policy_id','certification_timing','completion_condition_id')$old$;
 new_text:=$new$('months','period','past_access','exit_policy_id','certification_timing','completion_condition_id','billing_policy','cancellation_policy','refund_policy','unpaid_policy')$new$;
 if position(old_text in definition)=0 then raise exception 'academy2_monthly_save_contract_changed';end if;
 definition:=replace(definition,old_text,new_text);
 old_text:=$old$if kind='月額レッスン' then$old$;
 new_text:=$new$if kind='月額レッスン' then
  perform academy2_access.validate_monthly_policy_draft(conf->'monthly');$new$;
 if position(old_text in definition)=0 then raise exception 'academy2_monthly_save_branch_changed';end if;
 execute replace(definition,old_text,new_text);
end$patch$;


-- Preserve every existing public-release hold; append explicit missing-policy reasons.
do $patch$
declare definition text;marker text;begin
 definition:=pg_get_functiondef('academy2_access.plan_publication_readiness(uuid,uuid,integer,integer,uuid,integer)'::regprocedure);
 marker:='conf:=academy2_access.resolved_saved_plan_configuration(d.id,d.revision);';
 if position(marker in definition)=0 then raise exception 'academy2_monthly_readiness_contract_changed';end if;
 execute replace(definition,marker,marker||$new$
  if conf->>'kind'='月額レッスン' then reasons:=reasons||to_jsonb(academy2_access.monthly_policy_issues(conf->'monthly'));end if;
$new$);
end$patch$;
notify pgrst,'reload schema';
