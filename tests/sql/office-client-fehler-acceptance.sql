-- Abnahme · Fehler aus dem Browser (Migration office_client_fehler). Erfundene Personen; alles in einer Transaktion,
-- die am Ende zurückgerollt wird. A ist aktives Mitglied, C nicht mehr aktiv; anon hat keinen Zugang. Geprüft wird:
-- melden nur als aktives Mitglied; bereinigt (Parameter in Adressen, E-Mail, Token, Seite ohne Parameter); derselbe
-- Fehler zählt hoch statt eine neue Zeile; höchstens 50 verschiedene je Person und Tag, ein bekannter zählt weiter;
-- lesen und direkt schreiben darf über die App niemand.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('f9100000-0000-4000-8000-00000000000a','authenticated','authenticated','fehler-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('f9100000-0000-4000-8000-00000000000c','authenticated','authenticated','fehler-c@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('f9100000-0000-4000-8000-00000000000a','fehler-a@example.invalid','Fehler A','member',true,false),
 ('f9100000-0000-4000-8000-00000000000c','fehler-c@example.invalid','Fehler C','member',false,false);

do $test$
declare
  r text := ''; n int; t text; i int;
  a constant uuid := 'f9100000-0000-4000-8000-00000000000a';
  ua constant text := '{"sub":"f9100000-0000-4000-8000-00000000000a","role":"authenticated"}';
  uc constant text := '{"sub":"f9100000-0000-4000-8000-00000000000c","role":"authenticated"}';
  jwt constant text := 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig';
  erwartet constant text :=
       'A_melden=ok; A_lesen=verweigert; A_direkt=verweigert; zeilen=1; anzahl=2; seite=/app/; '
    || 'nachricht=Fetch https://x.example/rest/v1/y fehlgeschlagen für [E-Mail] mit [Token]; '
    || 'ort=/app/app.js?v=office58:1:2; promise=promise; gedrosselt=50; bekannt_zaehlt=2; C=0; anon=verweigert; ';
begin
  -- A meldet denselben Fehler zweimal (nur der Parameter in der Adresse unterscheidet sich): eine Zeile, zweimal gezählt.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  perform public.office_client_fehler_melden('/app/?projekt=1#x', 'fehler',
    'Fetch https://x.example/rest/v1/y?apikey=geheim fehlgeschlagen für anna@example.com mit ' || jwt,
    '/app/app.js?v=office58:1:2', null, 'Safari 18 · macOS', 'app.js?v=office58');
  perform public.office_client_fehler_melden('/app/', 'fehler',
    'Fetch https://x.example/rest/v1/y?apikey=anders fehlgeschlagen für anna@example.com mit ' || jwt,
    '/app/app.js?v=office58:1:2');
  r := r || 'A_melden=ok; ';
  begin perform 1 from public.office_client_fehler; r := r || 'A_lesen=erlaubt; ';
  exception when insufficient_privilege then r := r || 'A_lesen=verweigert; '; end;
  begin
    insert into public.office_client_fehler(user_id, fingerabdruck, seite, art, nachricht) values (a, md5('x'), '/', 'fehler', 'x');
    r := r || 'A_direkt=erlaubt; ';
  exception when insufficient_privilege then r := r || 'A_direkt=verweigert; '; end;
  execute 'reset role';
  select count(*) into n from public.office_client_fehler where user_id = a; r := r || 'zeilen=' || n || '; ';
  select anzahl into n from public.office_client_fehler where user_id = a; r := r || 'anzahl=' || n || '; ';
  select seite into t from public.office_client_fehler where user_id = a; r := r || 'seite=' || t || '; ';
  select nachricht into t from public.office_client_fehler where user_id = a; r := r || 'nachricht=' || t || '; ';
  select ort into t from public.office_client_fehler where user_id = a; r := r || 'ort=' || t || '; ';

  -- Ein abgelehntes Versprechen; dann 60 verschiedene Fehler: mehr als 50 Zeilen am Tag gibt es nicht, ein bekannter
  -- Fehler zählt auch danach weiter.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  perform public.office_client_fehler_melden('/app/', 'promise', 'Unbehandelt');
  for i in 1..60 loop perform public.office_client_fehler_melden('/app/', 'fehler', 'Fehler ' || i); end loop;
  perform public.office_client_fehler_melden('/app/', 'fehler', 'Fehler 1');
  execute 'reset role';
  select art into t from public.office_client_fehler where user_id = a and nachricht = 'Unbehandelt'; r := r || 'promise=' || t || '; ';
  select count(*) into n from public.office_client_fehler where user_id = a; r := r || 'gedrosselt=' || n || '; ';
  select anzahl into n from public.office_client_fehler where user_id = a and nachricht = 'Fehler 1'; r := r || 'bekannt_zaehlt=' || n || '; ';

  -- C ist nicht mehr aktiv: nichts wird gespeichert. anon darf die Funktion nicht aufrufen.
  perform set_config('request.jwt.claims', uc, true);
  execute 'set local role authenticated';
  perform public.office_client_fehler_melden('/app/', 'fehler', 'von C');
  execute 'reset role';
  select count(*) into n from public.office_client_fehler where nachricht = 'von C'; r := r || 'C=' || n || '; ';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin perform public.office_client_fehler_melden('/', 'fehler', 'anon'); r := r || 'anon=erlaubt; ';
  exception when insufficient_privilege then r := r || 'anon=verweigert; '; end;
  execute 'reset role';

  if r <> erwartet then
    raise exception 'office_client_fehler: erwartet [%] bekommen [%]', erwartet, r;
  end if;
  raise notice 'office_client_fehler acceptance ok';
end
$test$;

-- Aufbewahrung (Migration office_client_fehler_aufbewahrung): was zuletzt vor mehr als 30 Tagen auftrat, wird gelöscht,
-- alles Jüngere bleibt; aufrufen darf das nur die Datenbank selbst (Cron), nicht die App; der Cron-Job besteht einmal.
do $aufbewahrung$
declare
  r text := ''; n int;
  a constant uuid := 'f9100000-0000-4000-8000-00000000000a';
  ua constant text := '{"sub":"f9100000-0000-4000-8000-00000000000a","role":"authenticated"}';
  erwartet constant text := 'geloescht=1; alt=0; fast=1; heute=50; app=verweigert; cron=1; ';
begin
  insert into public.office_client_fehler(user_id, tag, fingerabdruck, seite, art, nachricht, erstes_mal, letztes_mal) values
    (a, current_date - 31, md5('alt'), '/', 'fehler', 'alt', now() - interval '31 days', now() - interval '31 days'),
    (a, current_date - 29, md5('fast'), '/', 'fehler', 'fast', now() - interval '29 days', now() - interval '29 days');
  r := r || 'geloescht=' || private.office_client_fehler_aufraeumen() || '; ';
  select count(*) into n from public.office_client_fehler where nachricht = 'alt'; r := r || 'alt=' || n || '; ';
  select count(*) into n from public.office_client_fehler where nachricht = 'fast'; r := r || 'fast=' || n || '; ';
  select count(*) into n from public.office_client_fehler where user_id = a and tag = (now() at time zone 'Europe/Berlin')::date;
  r := r || 'heute=' || n || '; ';
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  begin perform private.office_client_fehler_aufraeumen(); r := r || 'app=erlaubt; ';
  exception when insufficient_privilege then r := r || 'app=verweigert; '; end;
  execute 'reset role';
  if to_regclass('cron.job') is null then n := 1;
  else select count(*) into n from cron.job where jobname = 'office_client_fehler_aufraeumen_v1'; end if;
  r := r || 'cron=' || n || '; ';
  if r <> erwartet then
    raise exception 'office_client_fehler Aufbewahrung: erwartet [%] bekommen [%]', erwartet, r;
  end if;
  raise notice 'office_client_fehler Aufbewahrung ok';
end
$aufbewahrung$;
rollback;
