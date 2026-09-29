-- Reuse the existing mail-body source. This migration changes no queued mail,
-- delivery switch, subject, provider, legacy RPC or existing user's settings.
create function academy2_access.receipt_mail_settings(p_headquarters_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare settings public.academy_offering_mail_settings;
begin
 if auth.uid() is null or not academy2_access.can(p_headquarters_id,'notifications.manage') then raise exception 'academy2_notification_forbidden' using errcode='42501';end if;
 select * into settings from public.academy_offering_mail_settings where headquarters_id=p_headquarters_id;
 return jsonb_build_object('version',coalesce(settings.version,0),'body',settings.bodies->'receipt');
end$$;

create function academy2_access.save_receipt_mail_settings(p_headquarters_id uuid,p_expected_version integer,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare settings public.academy_offering_mail_settings;body text:=p_body;remainder text;merged jsonb;
begin
 if auth.uid() is null or not academy2_access.can(p_headquarters_id,'notifications.manage') then raise exception 'academy2_notification_forbidden' using errcode='42501';end if;
 if p_expected_version is null or p_expected_version<0 or p_expected_version=2147483647 then raise exception 'academy2_notification_invalid_version' using errcode='22023';end if;
 if body is not null and char_length(body)>4000 then raise exception 'academy2_notification_body_too_long' using errcode='22023';end if;
 -- Match the existing renderer's supported placeholders. Unknown variables never
 -- silently disappear from a saved message. Null/blank restores the current default.
 remainder:=regexp_replace(coalesce(body,''),'\{\{(name|title|price|materials_url|applications_url|manager_url|instructor_url|invitation_url|order_url)\}\}','','g');
 if strpos(remainder,'{{')>0 or strpos(remainder,'}}')>0 then raise exception 'academy2_notification_unknown_variable' using errcode='22023';end if;
 if body ~ '^[[:space:]]*$' then body:=null;end if;
 -- Same row lock order as the legacy writer serializes first writes and retains
 -- a single version across all event bodies. Saving receipt never resets siblings.
 perform 1 from public.academy_headquarters where id=p_headquarters_id for update;
 if not found then raise exception 'academy2_notification_forbidden' using errcode='42501';end if;
 select * into settings from public.academy_offering_mail_settings where headquarters_id=p_headquarters_id for update;
 if coalesce(settings.version,0)<>p_expected_version then raise exception 'academy2_notification_version_conflict' using errcode='PT409';end if;
 merged:=coalesce(settings.bodies,'{}'::jsonb)||jsonb_build_object('receipt',body);
 insert into public.academy_offering_mail_settings(headquarters_id,version,bodies,updated_by)
 values(p_headquarters_id,p_expected_version+1,merged,auth.uid())
 on conflict(headquarters_id) do update set version=excluded.version,bodies=excluded.bodies,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id)
 values(p_headquarters_id,auth.uid(),'notification.receipt_body_saved',p_headquarters_id);
 return jsonb_build_object('version',p_expected_version+1,'body',body);
end$$;

create function public.academy2_receipt_mail_settings(p_headquarters_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$select academy2_access.receipt_mail_settings(p_headquarters_id)$$;
create function public.academy2_save_receipt_mail_settings(p_headquarters_id uuid,p_expected_version integer,p_body text) returns jsonb
language sql security definer set search_path='' as $$select academy2_access.save_receipt_mail_settings(p_headquarters_id,p_expected_version,p_body)$$;
revoke all on function academy2_access.receipt_mail_settings(uuid),academy2_access.save_receipt_mail_settings(uuid,integer,text) from public,anon,authenticated,service_role;
revoke all on function public.academy2_receipt_mail_settings(uuid),public.academy2_save_receipt_mail_settings(uuid,integer,text) from public,anon,service_role;
grant execute on function public.academy2_receipt_mail_settings(uuid),public.academy2_save_receipt_mail_settings(uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
