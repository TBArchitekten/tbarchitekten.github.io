-- Abnahme · Guthaben und Monatslimit zusammen (Migration office_ki_guthaben_und_limit). Erfundene Person; alles in
-- einer Transaktion, die am Ende zurückgerollt wird. Geprüft wird: die Summen reichen bis zur Ablesung des Guthabens
-- vor 40 Tagen zurück (älter als das Fenster von 35 Tagen), was davor liegt, fehlt; jede Zeile sagt, ob sie nach dem
-- Guthaben (nach_guthaben) und nach der Ablesung des Monats (nach_stand) liegt; das Guthaben steht in der Antwort.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('f9500000-0000-4000-8000-00000000000a','authenticated','authenticated','guthaben-a@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('f9500000-0000-4000-8000-00000000000a','guthaben-a@example.invalid','Guthaben A','admin',true,false);
-- Guthaben vor 40 Tagen abgelesen; ein Aufruf davor, einer danach.
insert into public.office_ki_guthaben(betrag_usd, warnen_ab_tage, stand_am) values (12.01, 7, now() - interval '40 days');
insert into public.office_ki_verbrauch(funktion, modell, input_tokens, cached_input_tokens, output_tokens, total_tokens, details, created_at) values
 ('vor_guthaben', 'gpt-6.1-terra', 1000, 0, 100, 1100, '{}', now() - interval '45 days'),
 ('nach_guthaben', 'gpt-6.1-terra', 1000, 0, 100, 1100, '{}', now() - interval '38 days');
-- Monatslimit mit Ablesung jetzt; danach ein Aufruf.
insert into public.office_ki_monatslimit(limit_usd, warnen_ab_prozent, ausgegeben_usd, stand_am) values (50, 80, 7.93, clock_timestamp());
insert into public.office_ki_verbrauch(funktion, modell, input_tokens, cached_input_tokens, output_tokens, total_tokens, details, created_at) values
 ('nach_ablesung', 'gpt-6.1-terra', 1000, 0, 100, 1100, '{}', clock_timestamp() + interval '1 second');

do $test$
declare
  r text := ''; n int; j jsonb;
  ua constant text := '{"sub":"f9500000-0000-4000-8000-00000000000a","role":"authenticated"}';
  erwartet constant text :=
       'zeilen=2; alt=fehlt; nach_guthaben=2; nach_stand=1; nach_stand_ist=nach_ablesung; betrag=12.01; limit=50.00/7.93; '
    || 'seit_guthaben=ja; ';
begin
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  j := public.office_ki_nutzung();
  execute 'reset role';
  select count(*) into n from jsonb_array_elements(j->'zeilen') z where z->>'quelle' = 'office';
  r := r || 'zeilen=' || n || '; ';
  select count(*) into n from jsonb_array_elements(j->'zeilen') z where z->>'funktion' = 'vor_guthaben';
  r := r || 'alt=' || case when n = 0 then 'fehlt' else 'da' end || '; ';
  select count(*) into n from jsonb_array_elements(j->'zeilen') z where (z->>'nach_guthaben')::boolean;
  r := r || 'nach_guthaben=' || n || '; ';
  select count(*) into n from jsonb_array_elements(j->'zeilen') z where (z->>'nach_stand')::boolean;
  r := r || 'nach_stand=' || n || '; ';
  r := r || 'nach_stand_ist=' || coalesce((select z->>'funktion' from jsonb_array_elements(j->'zeilen') z where (z->>'nach_stand')::boolean limit 1), 'keine') || '; ';
  r := r || 'betrag=' || (j->'guthaben'->>'betrag_usd') || '; ';
  r := r || 'limit=' || (j->'monatslimit'->>'limit_usd') || '/' || (j->'monatslimit'->>'ausgegeben_usd') || '; ';
  r := r || 'seit_guthaben=' || case when (j->>'seit')::timestamptz <= now() - interval '39 days' then 'ja' else 'nein' end || '; ';
  if r <> erwartet then
    raise exception 'office_ki_guthaben_und_limit: erwartet [%] bekommen [%]', erwartet, r;
  end if;
  raise notice 'office_ki_guthaben_und_limit acceptance ok';
end
$test$;
rollback;
