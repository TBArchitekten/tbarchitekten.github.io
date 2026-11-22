-- TBA Office · KI-Assistenten ohne Tageslimit (22.11.2026, Claude; Entscheidung Gari: kein Limit für den
-- Assistenten des Terminplans und den der Kostenberechnung). Wie beim Assistenten des Office am 04.11.2026
-- (20261104213325): Anmeldung, Office-Mitgliedschaft und Sichtbarkeit des Plans bzw. der Kostenberechnung
-- bleiben geprüft, und jede Anfrage wird weiter gezählt, damit die Nutzung nachvollziehbar bleibt; eine Zahl,
-- die Anfragen begrenzt, gibt es nicht mehr. Nichts Destruktives: nur die beiden Funktionen werden ersetzt,
-- Tabellen, Zeilen, Rechte und Policies bleiben, wie sie sind.

create or replace function public.office_ai_consume_request(p_plan_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then return false; end if;
  if not (select private.office_is_member()) then return false; end if;
  if not exists(select 1 from public.office_terminplan_instances p where p.id = p_plan_id) then return false; end if;
  insert into public.office_terminplan_ai_requests(user_id, plan_id) values (uid, p_plan_id);
  return true;
end;
$$;
revoke all on function public.office_ai_consume_request(uuid) from public, anon;
grant execute on function public.office_ai_consume_request(uuid) to authenticated;
comment on function public.office_ai_consume_request(uuid) is
  'Zählt jede Anfrage an den KI-Assistenten des Terminplans; prüft Anmeldung, Office-Mitgliedschaft und Sichtbarkeit des Plans. Kein Tageslimit (Entscheidung Gari, 22.11.2026).';

create or replace function public.office_kosten_ai_consume_request(p_instance_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then return false; end if;
  if not (select private.office_is_member()) then return false; end if;
  if not exists(select 1 from public.office_kosten_instances i where i.id = p_instance_id) then return false; end if;
  insert into public.office_kosten_ai_requests(user_id, instance_id) values (uid, p_instance_id);
  return true;
end;
$$;
revoke all on function public.office_kosten_ai_consume_request(uuid) from public, anon;
grant execute on function public.office_kosten_ai_consume_request(uuid) to authenticated;
comment on function public.office_kosten_ai_consume_request(uuid) is
  'Zählt jede Anfrage an den KI-Assistenten der Kostenberechnung; prüft Anmeldung, Office-Mitgliedschaft und Sichtbarkeit der Kostenberechnung. Kein Tageslimit (Entscheidung Gari, 22.11.2026).';
