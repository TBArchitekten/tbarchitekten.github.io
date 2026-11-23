-- TBA Office · Kostenberechnungen lesen alle im Office (23.11.2026, Claude; Entscheidung Gari: wie der Terminplan
-- und wie die Projektordner auf dem Büroserver sieht jedes Office-Mitglied die Kostenberechnung jedes Projekts).
-- Fortschreiben, Stände festhalten, Anlegen und Löschen bleiben wie bisher bei der Person, die sie angelegt hat,
-- der Projektleitung (auch Admins) und dem Projektteam.
-- Nur hinzufügen, nichts entfernen: neue Policies, die neben den bisherigen gelten (Policies derselben Art
-- werden mit ODER verknüpft). Der Gesprächsverlauf mit dem Assistenten bleibt privat: jede Person liest nur
-- ihre eigenen Nachrichten; wer nur lesen darf, bekommt Antworten, aber keine Vorschläge (prüft die Funktion).

create policy office_kosten_instances_office_select on public.office_kosten_instances
  for select to authenticated using ((select private.office_is_member()));

create policy office_kosten_versions_office_select on public.office_kosten_versions
  for select to authenticated using ((select private.office_is_member()));

create policy office_kosten_dialogue_office_insert on public.office_kosten_dialogue_messages
  for insert to authenticated with check (
    user_id = (select auth.uid()) and (select private.office_is_member())
    and exists(select 1 from public.office_kosten_instances i where i.id = office_kosten_dialogue_messages.instance_id));

create policy office_kosten_dialogue_office_read on public.office_kosten_dialogue_messages
  for select to authenticated using (user_id = (select auth.uid()) and (select private.office_is_member()));

create policy office_kosten_ai_requests_office_insert on public.office_kosten_ai_requests
  for insert to authenticated with check (
    user_id = (select auth.uid()) and (select private.office_is_member())
    and exists(select 1 from public.office_kosten_instances i where i.id = office_kosten_ai_requests.instance_id));
