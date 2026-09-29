-- Individually reviewed candidate. No tenant activation, price, contract or consent backfill.
create table academy2_access.headquarters_document_revisions (
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 kind text not null check(kind in('application','cancellation','privacy','commerce','instructor_contract')),
 revision integer not null check(revision>0),version text not null,body text not null,
 saved_by uuid not null references auth.users(id),saved_at timestamptz not null default clock_timestamp(),
 primary key(headquarters_id,kind,revision)
);
alter table academy2_access.headquarters_document_revisions enable row level security;
revoke all on academy2_access.headquarters_document_revisions from public,anon,authenticated,service_role;
create trigger academy2_hq_document_immutable before update or delete on academy2_access.headquarters_document_revisions for each row execute function academy2_access.opening_immutable();

create function academy2_access.headquarters_settings(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare role text:=academy2_access.my_role(p_hq);result jsonb;billing_estimate jsonb:=null;
begin
 if (role in('owner','administrator')) is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if role='owner' and to_regprocedure('academy_roster_private.billable_people(uuid,timestamp with time zone,boolean)') is not null and to_regprocedure('private.academy_catalog_monthly_price_yen(integer)') is not null then
  execute 'select jsonb_build_object(''registered_instructor_count'',n,''catalog_price_yen'',private.academy_catalog_monthly_price_yen(n),''observed_at'',now()) from (select count(*)::integer n from academy_roster_private.billable_people($1,now(),false)) counts' into billing_estimate using p_hq;
 end if;
 select jsonb_build_object('basic',jsonb_build_object('name',h.name,'contact_email',coalesce(h.contact_email,''),'tagline',coalesce(h.tagline,''),'default_payment_note',coalesce(h.default_payment_note,''),'updated_at',h.updated_at),
 'documents',(select coalesce(jsonb_agg(to_jsonb(d)-array['headquarters_id','saved_by']),'[]') from (select distinct on(kind) * from academy2_access.headquarters_document_revisions where headquarters_id=p_hq order by kind,revision desc) d),
 'connect',(select jsonb_build_object('charges_enabled',p.charges_enabled,'payouts_enabled',p.payouts_enabled,'verified_at',p.verified_at,'valid_until',p.valid_until,'ready',academy2_access.payment_provider_ready(p_hq)) from academy2_access.payment_provider_connections p where p.headquarters_id=p_hq),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('handle',p.handle,'role',m.role,'active',m.active) order by m.role,p.handle),'[]') from academy2_access.memberships m left join public.profiles p on p.user_id=m.user_id where m.headquarters_id=p_hq),
 'invitations',case when role='owner' then (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'role',i.role,'channel',i.channel,'status',i.status,'delivery_status',i.delivery_status,'expires_at',i.expires_at) order by i.created_at desc),'[]') from academy2_access.staff_invitations i where i.headquarters_id=p_hq) else '[]'::jsonb end,
 'billing',case when role='owner' then jsonb_build_object('access',(select jsonb_build_object('access_kind',a.access_kind,'status',a.status,'starts_at',a.starts_at,'trial_ends_at',a.trial_ends_at,'paid_started_at',a.paid_started_at) from public.academy_headquarters_access_states a where a.headquarters_id=p_hq),'estimate',billing_estimate) else null end)
 into result from public.academy_headquarters h where h.id=p_hq;
 return result;
end $$;

create function academy2_access.save_headquarters_basic(p_hq uuid,p_expected timestamptz,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h public.academy_headquarters;key text;
begin
 if academy2_access.my_role(p_hq) is distinct from 'administrator' then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_expected is null or p_input is null or jsonb_typeof(p_input)<>'object' or not p_input?&array['name','contact_email','tagline','default_payment_note'] then raise exception 'academy2_invalid_settings' using errcode='22023';end if;
 for key in select jsonb_object_keys(p_input) loop
  if key<>all(array['name','contact_email','tagline','default_payment_note']) or jsonb_typeof(p_input->key)<>'string' or length(p_input->>key)>4000 then raise exception 'academy2_invalid_settings' using errcode='22023';end if;
 end loop;
 if nullif(btrim(p_input->>'name'),'') is null or length(p_input->>'name')>100 or length(p_input->>'contact_email')>320 or ((p_input->>'contact_email')<>'' and (p_input->>'contact_email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'academy2_invalid_settings' using errcode='22023';end if;
 select * into h from public.academy_headquarters where id=p_hq for update;
 if h.updated_at is distinct from p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 -- Keep the existing access-state and identity triggers. These columns are the existing canonical HQ information.
 update public.academy_headquarters set name=btrim(p_input->>'name'),contact_email=nullif(btrim(p_input->>'contact_email'),''),tagline=nullif(p_input->>'tagline',''),default_payment_note=nullif(p_input->>'default_payment_note','') where id=p_hq;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'settings.basic.saved',p_hq);
 return academy2_access.headquarters_settings(p_hq);
end $$;

create function academy2_access.save_headquarters_document(p_hq uuid,p_kind text,p_expected integer,p_version text,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_doc academy2_access.headquarters_document_revisions;
begin
 if academy2_access.my_role(p_hq) is distinct from 'administrator' then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if (p_kind in('application','cancellation','privacy','commerce','instructor_contract')) is distinct from true or p_expected is null or p_expected<0 or nullif(btrim(p_version),'') is null or length(p_version)>100 or nullif(btrim(p_body),'') is null or length(p_body)>50000 then raise exception 'academy2_invalid_settings' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_hq::text||':'||p_kind,94));
 select * into current_doc from academy2_access.headquarters_document_revisions where headquarters_id=p_hq and kind=p_kind order by revision desc limit 1;
 if current_doc.revision=p_expected+1 and current_doc.version=p_version and current_doc.body=p_body and current_doc.saved_by=auth.uid() then return academy2_access.headquarters_settings(p_hq);end if;
 if coalesce(current_doc.revision,0)<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 if exists(select 1 from academy2_access.headquarters_document_revisions where headquarters_id=p_hq and kind=p_kind and version=p_version and body<>p_body) then raise exception 'academy2_document_version_required' using errcode='22023';end if;
 insert into academy2_access.headquarters_document_revisions(headquarters_id,kind,revision,version,body,saved_by) values(p_hq,p_kind,p_expected+1,p_version,p_body,auth.uid());
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'settings.document.saved',p_hq);
 return academy2_access.headquarters_settings(p_hq);
end $$;
create function public.academy2_headquarters_settings(p_hq uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.headquarters_settings(p_hq)$$;
create function public.academy2_save_headquarters_basic(p_hq uuid,p_expected timestamptz,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.save_headquarters_basic(p_hq,p_expected,p_input)$$;
create function public.academy2_save_headquarters_document(p_hq uuid,p_kind text,p_expected integer,p_version text,p_body text) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.save_headquarters_document(p_hq,p_kind,p_expected,p_version,p_body)$$;
revoke all on function academy2_access.headquarters_settings(uuid),academy2_access.save_headquarters_basic(uuid,timestamptz,jsonb),academy2_access.save_headquarters_document(uuid,text,integer,text,text),public.academy2_headquarters_settings(uuid),public.academy2_save_headquarters_basic(uuid,timestamptz,jsonb),public.academy2_save_headquarters_document(uuid,text,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.headquarters_settings(uuid),academy2_access.save_headquarters_basic(uuid,timestamptz,jsonb),academy2_access.save_headquarters_document(uuid,text,integer,text,text),public.academy2_headquarters_settings(uuid),public.academy2_save_headquarters_basic(uuid,timestamptz,jsonb),public.academy2_save_headquarters_document(uuid,text,integer,text,text) to authenticated;
notify pgrst,'reload schema';
