-- Production candidate; review and isolated validation required before approval.
-- Match ECMAScript String.trim whitespace for persisted refund explanations.
create function academy2_access.monthly_policy_text_present(value text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(length(btrim(value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')),0)>0
$$;
revoke all on function academy2_access.monthly_policy_text_present(text) from public,anon,authenticated,service_role;
do $patch$declare definition text;marker text;begin
 definition:=pg_get_functiondef('academy2_access.monthly_policy_issues(jsonb)'::regprocedure);
 marker:=$old$nullif(btrim(v->>'explanation'),'') is not null$old$;
 if position(marker in definition)=0 then raise exception 'academy2_monthly_refund_validation_changed';end if;
 execute replace(definition,marker,$new$academy2_access.monthly_policy_text_present(v->>'explanation')$new$);
end$patch$;
