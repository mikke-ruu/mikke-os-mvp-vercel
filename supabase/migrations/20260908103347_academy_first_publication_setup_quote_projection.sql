-- Service receives exactly the original immutable quote; no client fallback.
do $$ declare source text; begin
 source:=pg_get_functiondef('public.academy_first_publication_setup_reserve(uuid,uuid,uuid)'::regprocedure);
 if position('''policy_version'',q.policy_version);' in source)=0 then raise exception 'unexpected_setup_reserve_projection'; end if;
 source:=replace(source,'''policy_version'',q.policy_version);','''policy_version'',q.policy_version,''quote'',jsonb_build_object(''id'',q.id,''headquarters_id'',q.headquarters_id,''owner_user_id'',q.owner_user_id,''policy_version'',q.policy_version,''terms_revision'',q.terms_revision,''amount_yen'',q.amount_yen,''instructor_count'',q.instructor_count,''issued_at'',q.issued_at,''expires_at'',q.expires_at,''plan_key'',q.plan_key,''plan_name'',q.plan_name,''discount_description'',q.discount_description,''consent_revision'',q.consent_revision));');
 execute source;
end $$;
