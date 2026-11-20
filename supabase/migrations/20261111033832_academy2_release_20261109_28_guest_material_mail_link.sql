-- New payment notices only. Do not rewrite stored or already sent messages.
begin;
do $patch$
declare definition text;marker text:=$old$'headquartersName',h.name,$old$;addition text:=$new$'guestAccessPath',academy2_access.guest_material_receipt_path(new.id),'guestApplicationId',new.id,'materialsEnabled',(cfg#>>'{materials,enabled}')='true','headquartersName',h.name,$new$;
begin
 definition:=pg_get_functiondef('academy2_access.queue_guest_participation_mail()'::regprocedure);
 if position(marker in definition)=0 or position('guestApplicationId' in definition)>0 then raise exception 'guest_participation_payload_changed';end if;
 execute replace(definition,marker,addition);
end $patch$;
commit;
