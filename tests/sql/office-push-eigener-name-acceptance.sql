-- Abnahme · Mitteilungen tragen den Namen, den die Person ihrem Assistenten gibt (Migration office_push_eigener_name).
-- Erfundene Personen; alles läuft in einer Transaktion, die am Ende zurückgerollt wird. D hat den Assistenten
-- «Samantha» genannt, E hat nichts gewählt, F hat einen Namen, der nicht passt (er beginnt mit einem Zeichen eines
-- Tags). Geprüft wird: Ds Nachricht und Ds Testmitteilung heißen «Samantha», die Testmitteilung duzt; E und F
-- bekommen «KI-Assistent»; der Name einer anderen Person gilt nie; Apple sieht davon nichts (das prüft office-push).
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('f9100000-0000-4000-8000-00000000000d','authenticated','authenticated','name-d@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('f9100000-0000-4000-8000-00000000000e','authenticated','authenticated','name-e@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('f9100000-0000-4000-8000-00000000000f','authenticated','authenticated','name-f@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('f9100000-0000-4000-8000-00000000000d','name-d@example.invalid','Name D','member',true,false),
 ('f9100000-0000-4000-8000-00000000000e','name-e@example.invalid','Name E','member',true,false),
 ('f9100000-0000-4000-8000-00000000000f','name-f@example.invalid','Name F','member',true,false);
insert into public.conversations(id,user_id,app_scope) values
 ('f9100000-0000-4000-8000-0000000000d1','f9100000-0000-4000-8000-00000000000d','isabella'),
 ('f9100000-0000-4000-8000-0000000000e1','f9100000-0000-4000-8000-00000000000e','isabella'),
 ('f9100000-0000-4000-8000-0000000000f1','f9100000-0000-4000-8000-00000000000f','isabella');
insert into public.office_push_geraete(user_id,geraet_id,apns_token,umgebung,bundle_id,schluessel) values
 ('f9100000-0000-4000-8000-00000000000d','iphone-d-0001',repeat('d1',32),'production','com.example.window',encode(decode(repeat('11',32),'hex'),'base64')),
 ('f9100000-0000-4000-8000-00000000000e','iphone-e-0001',repeat('e1',32),'production','com.example.window',encode(decode(repeat('22',32),'hex'),'base64')),
 ('f9100000-0000-4000-8000-00000000000f','iphone-f-0001',repeat('f1',32),'production','com.example.window',encode(decode(repeat('33',32),'hex'),'base64'));
insert into public.isabella_preferences(user_id,preference_key,value,status,confidence) values
 ('f9100000-0000-4000-8000-00000000000d','assistant_name','{"name":" Samantha ","spitzname":"Sam"}','confirmed',1),
 ('f9100000-0000-4000-8000-00000000000f','assistant_name','{"name":"<b>Sam</b>"}','confirmed',1);

do $test$
declare
  r text := ''; t text;
  d constant uuid := 'f9100000-0000-4000-8000-00000000000d';
  e constant uuid := 'f9100000-0000-4000-8000-00000000000e';
  f constant uuid := 'f9100000-0000-4000-8000-00000000000f';
  erwartet constant text :=
       'D=Samantha; E=KI-Assistent; F=KI-Assistent; D_hinweis=Samantha; '
    || 'D_test=wartet; D_test_titel=Samantha; D_test_text=Testmitteilung: Die Mitteilungen deines Assistenten kommen auf diesem iPhone an.; '
    || 'E_test=wartet; E_test_titel=KI-Assistent; hilfe=verweigert; ';
begin
  insert into public.conversation_messages(user_id,conversation_id,role,content,client_key,metadata) values
   (d,'f9100000-0000-4000-8000-0000000000d1','assistant','Feierabend.','name-d1','{"source":"isabella_presence","app":"romy","moment":"cierre_del_dia"}'),
   (d,'f9100000-0000-4000-8000-0000000000d1','assistant','In 30 Minuten: Jour fixe.','name-d2','{"source":"attention_runtime","attention_route":"interrupt"}'),
   (e,'f9100000-0000-4000-8000-0000000000e1','assistant','Feierabend.','name-e1','{"source":"isabella_presence","app":"romy","moment":"cierre_del_dia"}'),
   (f,'f9100000-0000-4000-8000-0000000000f1','assistant','Feierabend.','name-f1','{"source":"isabella_presence","app":"romy","moment":"cierre_del_dia"}');
  select titel into t from public.office_push_nachrichten where user_id = d and art = 'romy'; r := r || 'D=' || t || '; ';
  select titel into t from public.office_push_nachrichten where user_id = e and art = 'romy'; r := r || 'E=' || t || '; ';
  select titel into t from public.office_push_nachrichten where user_id = f and art = 'romy'; r := r || 'F=' || t || '; ';
  select titel into t from public.office_push_nachrichten where user_id = d and art = 'hinweis'; r := r || 'D_hinweis=' || t || '; ';

  -- Die Testmitteilung, als D und als E angemeldet.
  perform set_config('request.jwt.claims', '{"sub":"f9100000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
  execute 'set local role authenticated';
  r := r || 'D_test=' || public.office_push_test() || '; ';
  execute 'reset role';
  select titel into t from public.office_push_nachrichten where user_id = d and art = 'test'; r := r || 'D_test_titel=' || t || '; ';
  select text into t from public.office_push_nachrichten where user_id = d and art = 'test'; r := r || 'D_test_text=' || t || '; ';
  perform set_config('request.jwt.claims', '{"sub":"f9100000-0000-4000-8000-00000000000e","role":"authenticated"}', true);
  execute 'set local role authenticated';
  r := r || 'E_test=' || public.office_push_test() || '; ';
  execute 'reset role';
  select titel into t from public.office_push_nachrichten where user_id = e and art = 'test'; r := r || 'E_test_titel=' || t || '; ';

  -- Die Hilfsfunktion ist nur für die Funktionen da, die eine Mitteilung anlegen, nicht für den Browser.
  perform set_config('request.jwt.claims', '{"sub":"f9100000-0000-4000-8000-00000000000e","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin perform private.office_assistent_name(d); r := r || 'hilfe=erlaubt; ';
  exception when insufficient_privilege then r := r || 'hilfe=verweigert; '; end;
  execute 'reset role';

  if r <> erwartet then
    raise exception E'office_push_eigener_name acceptance failed\n got: %\nwant: %', r, erwartet;
  end if;
  raise notice 'office_push_eigener_name acceptance ok: %', r;
end
$test$;

rollback;
