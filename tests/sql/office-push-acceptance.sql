-- Abnahme · Romys Mitteilungen auf das iPhone (Migration office_push). Erfundene Personen; alles läuft in einer
-- Transaktion, die am Ende zurückgerollt wird. A und B sind aktive Mitglieder, C ist nicht mehr aktiv; anon hat keinen
-- Zugang. Geprüft wird: anmelden nur als aktives Mitglied, mit gültigem Token und einem Schlüssel von 32 Byte; die Person
-- sieht ihr Gerät, nie Token oder Schlüssel, und niemand das Gerät eines anderen; direkt schreibt niemand; ein Token
-- wandert mit der Person, ein älteres Token desselben iPhones gilt nicht mehr, abmelden beendet es; Romys eigene
-- Nachricht und dringende Hinweise kommen in die Warteschlange, beim Öffnen der App, ohne Gerät, für Nachrichten der
-- Person oder normale Antworten nicht; der Test höchstens einmal pro Minute; abholen darf nur der Dienst, Abgelaufenes
-- wird nicht mehr geschickt.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('f9000000-0000-4000-8000-00000000000a','authenticated','authenticated','push-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('f9000000-0000-4000-8000-00000000000b','authenticated','authenticated','push-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('f9000000-0000-4000-8000-00000000000c','authenticated','authenticated','push-c@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('f9000000-0000-4000-8000-00000000000a','push-a@example.invalid','Push A','member',true,false),
 ('f9000000-0000-4000-8000-00000000000b','push-b@example.invalid','Push B','member',true,false),
 ('f9000000-0000-4000-8000-00000000000c','push-c@example.invalid','Push C','member',false,false);
insert into public.conversations(id,user_id,app_scope) values
 ('f9000000-0000-4000-8000-0000000000a1','f9000000-0000-4000-8000-00000000000a','isabella'),
 ('f9000000-0000-4000-8000-0000000000b1','f9000000-0000-4000-8000-00000000000b','isabella');

do $test$
declare
  r text := ''; n int; t text;
  a constant uuid := 'f9000000-0000-4000-8000-00000000000a';
  b constant uuid := 'f9000000-0000-4000-8000-00000000000b';
  ua constant text := '{"sub":"f9000000-0000-4000-8000-00000000000a","role":"authenticated"}';
  ub constant text := '{"sub":"f9000000-0000-4000-8000-00000000000b","role":"authenticated"}';
  uc constant text := '{"sub":"f9000000-0000-4000-8000-00000000000c","role":"authenticated"}';
  tok1 constant text := repeat('ab', 32);
  tok2 constant text := repeat('cd', 32);
  schluessel constant text := encode(decode(repeat('11', 32), 'hex'), 'base64');
  erwartet constant text :=
       'A_sieht=1; A_token_klein=1; A_token=verweigert; A_schluessel=verweigert; A_direkt=verweigert; '
    || 'A_nachricht_direkt=verweigert; kurzer_schluessel=22023; falsches_token=22023; test1=wartet; test2=schon_unterwegs; '
    || 'A_nachrichten=1; A_holen=verweigert; A_aktiv=1; '
    || 'B_sieht=0; B_nachrichten=0; B_test=kein_geraet; B_aktiv=1; A_nach_wechsel=0; B_abmelden=1; B_aktiv_danach=0; '
    || 'C=42501; anon=verweigert; anon_lesen=verweigert; '
    || 'warteschlange_A=3; romy=1; hinweis=1; text=Feierabend: morgen ist die Bemusterung.; lang=600; B_warteschlange=0; '
    || 'geholt=4; versuche=1; nochmal=0; abgelaufen=1; ';
begin
  -- A meldet sein iPhone an (Token in Großbuchstaben, gespeichert klein) und sieht es, ohne Token und Schlüssel.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  perform public.office_push_geraet_anmelden('iphone-a-0001', upper(tok1), 'production', 'com.example.window', schluessel, '0.1.0 (30)');
  select count(*) into n from public.office_push_geraete; r := r || 'A_sieht=' || n || '; ';
  execute 'reset role';
  select count(*) into n from public.office_push_geraete where user_id = a and apns_token = tok1; r := r || 'A_token_klein=' || n || '; ';
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  begin perform apns_token from public.office_push_geraete; r := r || 'A_token=sichtbar; ';
  exception when insufficient_privilege then r := r || 'A_token=verweigert; '; end;
  begin perform schluessel from public.office_push_geraete; r := r || 'A_schluessel=sichtbar; ';
  exception when insufficient_privilege then r := r || 'A_schluessel=verweigert; '; end;
  begin
    insert into public.office_push_geraete(user_id,geraet_id,apns_token,umgebung,bundle_id,schluessel)
    values (a,'iphone-a-0009',repeat('ee',32),'production','com.example.window',schluessel);
    r := r || 'A_direkt=erlaubt; ';
  exception when insufficient_privilege then r := r || 'A_direkt=verweigert; '; end;
  begin
    insert into public.office_push_nachrichten(user_id,art,titel,text,dedupe,gueltig_bis)
    values (a,'test','Romy','direkt','direkt:1',now() + interval '1 hour');
    r := r || 'A_nachricht_direkt=erlaubt; ';
  exception when insufficient_privilege then r := r || 'A_nachricht_direkt=verweigert; '; end;
  begin
    perform public.office_push_geraet_anmelden('iphone-a-0001', tok1, 'production', 'com.example.window', encode(decode(repeat('11', 16), 'hex'), 'base64'));
    r := r || 'kurzer_schluessel=angenommen; ';
  exception when sqlstate '22023' then r := r || 'kurzer_schluessel=22023; '; end;
  begin
    perform public.office_push_geraet_anmelden('iphone-a-0001', 'zz', 'production', 'com.example.window', schluessel);
    r := r || 'falsches_token=angenommen; ';
  exception when sqlstate '22023' then r := r || 'falsches_token=22023; '; end;
  -- Eine Testmitteilung, höchstens eine pro Minute.
  r := r || 'test1=' || public.office_push_test() || '; ';
  r := r || 'test2=' || public.office_push_test() || '; ';
  select count(*) into n from public.office_push_nachrichten; r := r || 'A_nachrichten=' || n || '; ';
  begin perform public.office_push_holen(5); r := r || 'A_holen=erlaubt; ';
  exception when insufficient_privilege then r := r || 'A_holen=verweigert; '; end;
  -- Dasselbe iPhone mit einem neuen Token: das alte gilt nicht mehr.
  perform public.office_push_geraet_anmelden('iphone-a-0001', tok2, 'production', 'com.example.window', schluessel);
  select count(*) into n from public.office_push_geraete where aktiv; r := r || 'A_aktiv=' || n || '; ';
  execute 'reset role';

  -- B sieht nichts von A; ohne Gerät gibt es keinen Test. Meldet sich B auf A's iPhone an, wandert das Token zu B.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_push_geraete; r := r || 'B_sieht=' || n || '; ';
  select count(*) into n from public.office_push_nachrichten; r := r || 'B_nachrichten=' || n || '; ';
  r := r || 'B_test=' || public.office_push_test() || '; ';
  perform public.office_push_geraet_anmelden('iphone-a-0001', tok2, 'production', 'com.example.window', schluessel);
  select count(*) into n from public.office_push_geraete where aktiv; r := r || 'B_aktiv=' || n || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_push_geraete where aktiv; r := r || 'A_nach_wechsel=' || n || '; ';
  -- A meldet sein eigenes iPhone wieder an (für den Auslöser unten).
  perform public.office_push_geraet_anmelden('iphone-a-0002', tok1, 'production', 'com.example.window', schluessel);
  execute 'reset role';
  -- B meldet sich von Office ab: keine Mitteilungen mehr auf dieses iPhone.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  r := r || 'B_abmelden=' || public.office_push_geraet_abmelden('iphone-a-0001') || '; ';
  select count(*) into n from public.office_push_geraete where aktiv; r := r || 'B_aktiv_danach=' || n || '; ';
  execute 'reset role';

  -- C ist nicht mehr aktiv; anon hat keinen Zugang.
  perform set_config('request.jwt.claims', uc, true);
  execute 'set local role authenticated';
  begin
    perform public.office_push_geraet_anmelden('iphone-c-0001', repeat('ef', 32), 'production', 'com.example.window', schluessel);
    r := r || 'C=angenommen; ';
  exception when sqlstate '42501' then r := r || 'C=42501; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    perform public.office_push_geraet_anmelden('iphone-x-0001', repeat('ef', 32), 'production', 'com.example.window', schluessel);
    r := r || 'anon=angenommen; ';
  exception when insufficient_privilege then r := r || 'anon=verweigert; '; end;
  begin perform count(*) from public.office_push_geraete; r := r || 'anon_lesen=erlaubt; ';
  exception when insufficient_privilege then r := r || 'anon_lesen=verweigert; '; end;
  execute 'reset role';

  -- Der Auslöser, wie der Motor schreibt: nur Romys eigene Nachricht (nicht beim Öffnen) und dringende Hinweise,
  -- nur mit Gerät; Leerzeichen werden zusammengezogen, Überlanges gekürzt.
  perform set_config('request.jwt.claims', '', true);
  insert into public.conversation_messages(user_id,conversation_id,role,content,client_key,metadata) values
   (a,'f9000000-0000-4000-8000-0000000000a1','assistant','Schön, dass du da bist.','push-p1','{"source":"isabella_presence","app":"romy","moment":"app_abierta"}'),
   (a,'f9000000-0000-4000-8000-0000000000a1','assistant','Feierabend:  morgen' || chr(10) || 'ist die Bemusterung.','push-p2','{"source":"isabella_presence","app":"romy","moment":"cierre_del_dia"}'),
   (a,'f9000000-0000-4000-8000-0000000000a1','assistant','Termin in 30 Minuten: ' || repeat('Jour fixe ', 80),'push-h1','{"source":"attention_runtime","attention_route":"interrupt"}'),
   (a,'f9000000-0000-4000-8000-0000000000a1','assistant','Das kommt ins Briefing.','push-h2','{"source":"attention_runtime","attention_route":"briefing"}'),
   (a,'f9000000-0000-4000-8000-0000000000a1','assistant','Eine normale Antwort.','push-c1','{"source":"isabella_chat_server"}'),
   (a,'f9000000-0000-4000-8000-0000000000a1','user','Eine Frage.','push-u1','{"source":"isabella_presence"}'),
   (b,'f9000000-0000-4000-8000-0000000000b1','assistant','B ist abgemeldet.','push-b1','{"source":"isabella_presence","app":"romy","moment":"cierre_del_dia"}');
  select count(*) into n from public.office_push_nachrichten where user_id = a; r := r || 'warteschlange_A=' || n || '; ';
  select count(*) into n from public.office_push_nachrichten where user_id = a and art = 'romy'
     and gueltig_bis between now() + interval '11 hours' and now() + interval '13 hours'; r := r || 'romy=' || n || '; ';
  select count(*) into n from public.office_push_nachrichten where user_id = a and art = 'hinweis'
     and gueltig_bis between now() + interval '2 hours' and now() + interval '4 hours'; r := r || 'hinweis=' || n || '; ';
  select text into t from public.office_push_nachrichten where user_id = a and art = 'romy'; r := r || 'text=' || t || '; ';
  select length(text) into n from public.office_push_nachrichten where user_id = a and art = 'hinweis'; r := r || 'lang=' || n || '; ';
  select count(*) into n from public.office_push_nachrichten where user_id = b; r := r || 'B_warteschlange=' || n || '; ';

  -- Abholen: der Dienst bekommt alles Fällige einmal (reserviert), Abgelaufenes nicht.
  insert into public.office_push_nachrichten(user_id,art,titel,text,dedupe,gueltig_bis,created_at)
  values (a,'romy','Romy','Zu spät.','push-alt:1',now() - interval '1 minute',now() - interval '13 hours');
  insert into public.office_push_nachrichten(user_id,art,titel,text,dedupe,gueltig_bis)
  values (b,'hinweis','Romy','Für B, fällig.','push-b:2',now() + interval '1 hour');
  execute 'set local role service_role';
  select count(*) into n from public.office_push_holen(20);
  execute 'reset role';
  r := r || 'geholt=' || n || '; ';
  select max(versuche) into n from public.office_push_nachrichten where status = 'wird_gesendet'; r := r || 'versuche=' || n || '; ';
  execute 'set local role service_role';
  select count(*) into n from public.office_push_holen(20);
  execute 'reset role';
  r := r || 'nochmal=' || n || '; ';
  select count(*) into n from public.office_push_nachrichten where dedupe = 'push-alt:1' and status = 'abgelaufen'; r := r || 'abgelaufen=' || n || '; ';

  if r <> erwartet then
    raise exception E'office_push acceptance failed\n got: %\nwant: %', r, erwartet;
  end if;
  raise notice 'office_push acceptance ok: %', r;
end
$test$;

rollback;
