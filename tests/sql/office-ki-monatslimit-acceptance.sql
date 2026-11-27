-- Abnahme · Monatslimit der KI-Nutzung (Migration office_ki_monatslimit). Erfundene Personen; alles in einer
-- Transaktion, die am Ende zurückgerollt wird. A ist Administratorin, B Mitarbeiter. Geprüft wird: nur Administratoren
-- tragen ein; Limit und «warnen ab» bleiben, wenn nicht neu angegeben; eine Ablesung aus dem Vormonat zählt nicht;
-- die KI-Nutzung nennt Limit, Ablesung dieses Monats und Monatsbeginn und trennt vor und nach der Ablesung.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('f9400000-0000-4000-8000-00000000000a','authenticated','authenticated','limit-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('f9400000-0000-4000-8000-00000000000b','authenticated','authenticated','limit-b@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('f9400000-0000-4000-8000-00000000000a','limit-a@example.invalid','Limit A','admin',true,false),
 ('f9400000-0000-4000-8000-00000000000b','limit-b@example.invalid','Limit B','member',true,false);
-- Ein Aufruf vor der Ablesung.
insert into public.office_ki_verbrauch(funktion, modell, input_tokens, cached_input_tokens, output_tokens, total_tokens, details, created_at) values
 ('kosten', 'gpt-6.1-terra', 1000, 0, 100, 1100, '{}', now() - interval '1 hour');

do $test$
declare
  r text := ''; n int; j jsonb; t text;
  ua constant text := '{"sub":"f9400000-0000-4000-8000-00000000000a","role":"authenticated"}';
  ub constant text := '{"sub":"f9400000-0000-4000-8000-00000000000b","role":"authenticated"}';
  erwartet constant text :=
       'B_eintragen=verweigert; A_direkt=verweigert; ohne_limit=abgewiesen; alter_monat=50.00/leer; '
    || 'limit=100.00; warnen=80; ausgegeben=leer; ablesung=7.92; limit_bleibt=100.00; warnen_neu=90; '
    || 'limit_0=abgewiesen; negativ=abgewiesen; warnen_falsch=abgewiesen; '
    || 'nutzung=100.00/7.92/90; monat=ja; vor=1; nach=1; ohne_person=ja; ';
begin
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  begin perform public.office_ki_monatslimit_eintragen(100); r := r || 'B_eintragen=erlaubt; ';
  exception when insufficient_privilege then r := r || 'B_eintragen=verweigert; '; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  begin perform 1 from public.office_ki_monatslimit; r := r || 'A_direkt=erlaubt; ';
  exception when insufficient_privilege then r := r || 'A_direkt=verweigert; '; end;
  begin perform public.office_ki_monatslimit_eintragen(); r := r || 'ohne_limit=angenommen; ';
  exception when invalid_parameter_value then r := r || 'ohne_limit=abgewiesen; '; end;
  execute 'reset role';

  -- Eine Ablesung aus dem Vormonat: das Limit gilt weiter, die Ablesung nicht.
  insert into public.office_ki_monatslimit(limit_usd, warnen_ab_prozent, ausgegeben_usd, stand_am)
  values (50, 80, 40, date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' - interval '2 days');
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  j := public.office_ki_nutzung();
  r := r || 'alter_monat=' || (j->'monatslimit'->>'limit_usd') || '/' || coalesce(j->'monatslimit'->>'ausgegeben_usd', 'leer') || '; ';

  -- Limit, dann eine Ablesung, dann nur «warnen ab».
  j := public.office_ki_monatslimit_eintragen(100);
  r := r || 'limit=' || (j->>'limit_usd') || '; warnen=' || (j->>'warnen_ab_prozent') || '; ausgegeben=' || coalesce(j->>'ausgegeben_usd', 'leer') || '; ';
  j := public.office_ki_monatslimit_eintragen(null, 7.924);
  r := r || 'ablesung=' || (j->>'ausgegeben_usd') || '; limit_bleibt=' || (j->>'limit_usd') || '; ';
  j := public.office_ki_monatslimit_eintragen(null, null, 90);
  r := r || 'warnen_neu=' || (j->>'warnen_ab_prozent') || '; ';
  begin perform public.office_ki_monatslimit_eintragen(0); r := r || 'limit_0=angenommen; ';
  exception when invalid_parameter_value then r := r || 'limit_0=abgewiesen; '; end;
  begin perform public.office_ki_monatslimit_eintragen(100, -1); r := r || 'negativ=angenommen; ';
  exception when invalid_parameter_value then r := r || 'negativ=abgewiesen; '; end;
  begin perform public.office_ki_monatslimit_eintragen(100, null, 5); r := r || 'warnen_falsch=angenommen; ';
  exception when invalid_parameter_value then r := r || 'warnen_falsch=abgewiesen; '; end;
  execute 'reset role';

  -- Ein Aufruf nach der Ablesung.
  insert into public.office_ki_verbrauch(funktion, modell, input_tokens, cached_input_tokens, output_tokens, total_tokens, details, created_at) values
   ('produkte', 'gpt-6.1-terra', 2000, 0, 200, 2200, '{}', clock_timestamp());
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  j := public.office_ki_nutzung();
  r := r || 'nutzung=' || (j->'monatslimit'->>'limit_usd') || '/' || (j->'monatslimit'->>'ausgegeben_usd') || '/'
         || (j->'monatslimit'->>'warnen_ab_prozent') || '; ';
  r := r || 'monat=' || case when (j->>'monat_beginn')::date = date_trunc('month', now() at time zone 'Europe/Berlin')::date then 'ja' else 'nein' end || '; ';
  select count(*) into n from jsonb_array_elements(j->'zeilen') z where (z->>'nach_stand')::boolean = false and z->>'quelle' = 'office';
  r := r || 'vor=' || n || '; ';
  select count(*) into n from jsonb_array_elements(j->'zeilen') z where (z->>'nach_stand')::boolean and z->>'quelle' = 'office';
  r := r || 'nach=' || n || '; ';
  t := j::text;
  r := r || 'ohne_person=' || case when t like '%f9400000-0000-4000-8000-00000000000%' or t like '%user_id%' then 'nein' else 'ja' end || '; ';
  execute 'reset role';

  if r <> erwartet then
    raise exception 'office_ki_monatslimit: erwartet [%] bekommen [%]', erwartet, r;
  end if;
  raise notice 'office_ki_monatslimit acceptance ok';
end
$test$;
rollback;
