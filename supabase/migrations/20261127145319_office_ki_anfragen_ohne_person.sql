-- TBA Office · KI-Anfragen ohne Person (27.11.2026, Claude; OK von Gari am 27.11.2026 für genau diese Änderung).
-- Die vier Werkzeuge mit KI (Terminplan, Kostenberechnung, Produktbibliothek, Projektdokumente) speicherten jede
-- Anfrage mit der Person, für ein Tageslimit, das es seit dem 22.11.2026 nicht mehr gibt. Den Verbrauch zählt seit dem
-- 27.11.2026 office_ki_verbrauch, je Funktion und Projekt und ohne Person. Die Funktionen prüfen weiter Anmeldung,
-- Office-Mitgliedschaft und Sichtbarkeit von Plan bzw. Kostenberechnung, speichern aber nichts mehr; die gespeicherten
-- Anfragen werden gelöscht. Die Tabellen bleiben (leer), Rechte und Policies bleiben, wie sie sind.

create or replace function public.office_ai_consume_request(p_plan_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null then return false; end if;
  if not (select private.office_is_member()) then return false; end if;
  return exists(select 1 from public.office_terminplan_instances p where p.id = p_plan_id);
end;
$$;
comment on function public.office_ai_consume_request(uuid) is
  'Prüft vor einer Anfrage an den KI-Assistenten des Terminplans Anmeldung, Office-Mitgliedschaft und Sichtbarkeit des Plans. Speichert nichts (seit 27.11.2026 ohne Person); den Verbrauch zählt office_ki_verbrauch.';

create or replace function public.office_kosten_ai_consume_request(p_instance_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null then return false; end if;
  if not (select private.office_is_member()) then return false; end if;
  return exists(select 1 from public.office_kosten_instances i where i.id = p_instance_id);
end;
$$;
comment on function public.office_kosten_ai_consume_request(uuid) is
  'Prüft vor einer Anfrage an den KI-Assistenten der Kostenberechnung Anmeldung, Office-Mitgliedschaft und Sichtbarkeit der Kostenberechnung. Speichert nichts (seit 27.11.2026 ohne Person); den Verbrauch zählt office_ki_verbrauch.';

create or replace function public.office_produkt_ai_consume_request() returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  return (select auth.uid()) is not null and (select private.office_is_member());
end;
$$;
comment on function public.office_produkt_ai_consume_request() is
  'Prüft vor einer Anfrage an den Datenblatt-Leser Anmeldung und Office-Mitgliedschaft. Speichert nichts (seit 27.11.2026 ohne Person); den Verbrauch zählt office_ki_verbrauch.';

create or replace function public.office_projektdokument_ai_consume_request() returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  return (select auth.uid()) is not null and (select private.office_is_member());
end;
$$;
comment on function public.office_projektdokument_ai_consume_request() is
  'Prüft vor einer Anfrage an Romy in den Projektdokumenten Anmeldung und Office-Mitgliedschaft. Speichert nichts (seit 27.11.2026 ohne Person); den Verbrauch zählt office_ki_verbrauch.';

delete from public.office_terminplan_ai_requests;
delete from public.office_kosten_ai_requests;
delete from public.office_produkt_ai_requests;
delete from public.office_projektdokument_ai_requests;
