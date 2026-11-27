-- Abnahme · KI-Verbrauch der Office-Funktionen (Migration office_ki_verbrauch). Erfundene Personen und ein erfundenes
-- Projekt; alles in einer Transaktion, die am Ende zurückgerollt wird. Geprüft wird: die Tabelle hat keine Spalte für
-- die Person; Mitglieder dürfen weder lesen noch schreiben, anon auch nicht; der Dienst schreibt; ungültige Werte werden
-- abgewiesen; ein Lauf mit Schlüssel «einmal» zählt nur einmal; ein gelöschtes Projekt lässt die Summen stehen.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('f9200000-0000-4000-8000-00000000000a','authenticated','authenticated','verbrauch-a@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('f9200000-0000-4000-8000-00000000000a','verbrauch-a@example.invalid','Verbrauch A','admin',true,false);

do $test$
declare
  r text := ''; n int; p uuid;
  ua constant text := '{"sub":"f9200000-0000-4000-8000-00000000000a","role":"authenticated"}';
  erwartet constant text :=
       'ohne_person=ja; admin_lesen=verweigert; admin_schreiben=verweigert; anon=verweigert; dienst=ok; '
    || 'falsche_funktion=abgewiesen; negativ=abgewiesen; einmal=1; projekt_geloescht=zeile_bleibt; ';
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'office_ki_verbrauch' and column_name in ('user_id', 'person', 'email');
  r := r || 'ohne_person=' || case when n = 0 then 'ja' else 'nein' end || '; ';

  -- Auch ein Administrator liest die Zeilen nicht direkt und schreibt nichts hinein.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  begin perform 1 from public.office_ki_verbrauch; r := r || 'admin_lesen=erlaubt; ';
  exception when insufficient_privilege then r := r || 'admin_lesen=verweigert; '; end;
  begin insert into public.office_ki_verbrauch(funktion, modell, total_tokens) values ('kosten', 'gpt-5.6', 1);
    r := r || 'admin_schreiben=erlaubt; ';
  exception when insufficient_privilege then r := r || 'admin_schreiben=verweigert; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin perform 1 from public.office_ki_verbrauch; r := r || 'anon=erlaubt; ';
  exception when insufficient_privilege then r := r || 'anon=verweigert; '; end;
  execute 'reset role';

  -- Der Dienst schreibt; ungültige Funktion und negative Tokens weist die Tabelle ab.
  insert into public.office_projects(id, number, name) values ('f9200000-0000-4000-8000-0000000000b1', 'T-9201', 'Testprojekt Verbrauch')
    returning id into p;
  execute 'set local role service_role';
  insert into public.office_ki_verbrauch(funktion, modell, input_tokens, cached_input_tokens, output_tokens, total_tokens, project_id)
    values ('kosten', 'gpt-5.6', 1200, 200, 300, 1500, p);
  r := r || 'dienst=ok; ';
  begin insert into public.office_ki_verbrauch(funktion, modell) values ('Kosten!', 'gpt-5.6'); r := r || 'falsche_funktion=angenommen; ';
  exception when check_violation then r := r || 'falsche_funktion=abgewiesen; '; end;
  begin insert into public.office_ki_verbrauch(funktion, modell, input_tokens) values ('kosten', 'gpt-5.6', -1); r := r || 'negativ=angenommen; ';
  exception when check_violation then r := r || 'negativ=abgewiesen; '; end;
  insert into public.office_ki_verbrauch(funktion, modell, total_tokens, details)
    values ('romy_faehigkeit', 'gpt-6-astra', 10, '{"einmal":"lauf-1"}');
  begin insert into public.office_ki_verbrauch(funktion, modell, total_tokens, details)
      values ('romy_faehigkeit', 'gpt-6-astra', 10, '{"einmal":"lauf-1"}');
  exception when unique_violation then null; end;
  execute 'reset role';
  select count(*) into n from public.office_ki_verbrauch where details->>'einmal' = 'lauf-1';
  r := r || 'einmal=' || n || '; ';

  delete from public.office_projects where id = p;
  select count(*) into n from public.office_ki_verbrauch where funktion = 'kosten' and project_id is null and total_tokens = 1500;
  r := r || 'projekt_geloescht=' || case when n = 1 then 'zeile_bleibt' else 'zeile_weg' end || '; ';

  if r <> erwartet then
    raise exception 'office_ki_verbrauch: erwartet [%] bekommen [%]', erwartet, r;
  end if;
  raise notice 'office_ki_verbrauch acceptance ok';
end
$test$;
rollback;
