-- TBA Office · Abschnitte je Projekt in Work (25.11.2026, Claude; Wunsch von Gari am 25.11.2026).
--
-- Gari: Terminplan, Kostenberechnung, Mustermappe, Produkte und Hersteller braucht nicht jedes Projekt (eine
-- Machbarkeitsstudie etwa keinen davon). Jedes Projekt nimmt sie über «+» am Ende der Reiter auf, was es gerade braucht.
-- Die Wahl gilt für das ganze Projektteam. Ausblenden löscht nichts: die Daten des Werkzeugs bleiben.
--
-- office_project_abschnitte   je Projekt und Abschnitt eine Zeile = der Reiter steht in Work. Lesen alle Mitglieder
--                             (wie die Projekte); aufnehmen und ausblenden Projektteam, Projektleitung und Admins.
--
-- Was schon Daten hat, bleibt sichtbar: Projekte mit Terminplan, Kostenberechnung, Mustermappe, ausgewählten Produkten
-- oder Kontakten zu Herstellern bekommen diese Abschnitte gleich mit (ohne Urheber, created_by bleibt leer).
--
-- Nichts Destruktives: eine neue Tabelle mit Policies und Zeilen nur in ihr.

create table public.office_project_abschnitte (
  project_id uuid not null references public.office_projects(id) on delete cascade,
  abschnitt text not null check (abschnitt in ('terminplan','kosten','mustermappe','produkte','hersteller')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, abschnitt)
);

alter table public.office_project_abschnitte enable row level security;
revoke all on public.office_project_abschnitte from public, anon, authenticated;
grant select, insert, delete on public.office_project_abschnitte to authenticated;

create policy office_project_abschnitte_lesen on public.office_project_abschnitte
  for select to authenticated using ((select private.office_is_member()));
create policy office_project_abschnitte_aufnehmen on public.office_project_abschnitte
  for insert to authenticated with check (
    (select private.office_is_member()) and created_by = (select auth.uid())
    and ((select private.office_leads_project(project_id)) or (select private.office_in_project_team(project_id))));
create policy office_project_abschnitte_ausblenden on public.office_project_abschnitte
  for delete to authenticated using (
    (select private.office_is_member())
    and ((select private.office_leads_project(project_id)) or (select private.office_in_project_team(project_id))));

-- Was schon Daten hat, bleibt sichtbar.
insert into public.office_project_abschnitte (project_id, abschnitt, created_by)
select p.id, 'terminplan', null from public.office_projects p
 where exists (select 1 from public.office_terminplan_instances t where t.project_id = p.id)
on conflict do nothing;
insert into public.office_project_abschnitte (project_id, abschnitt, created_by)
select p.id, 'kosten', null from public.office_projects p
 where exists (select 1 from public.office_kosten_instances k where k.project_id = p.id)
on conflict do nothing;
insert into public.office_project_abschnitte (project_id, abschnitt, created_by)
select p.id, 'mustermappe', null from public.office_projects p
 where exists (select 1 from public.office_projektdokumente d
               join public.office_projektdokument_zeilen z on z.dokument_id = d.id
               where d.project_id = p.id and z.daten->>'form' = 'mustermappe')
on conflict do nothing;
insert into public.office_project_abschnitte (project_id, abschnitt, created_by)
select p.id, 'produkte', null from public.office_projects p
 where exists (select 1 from public.office_produkt_verwendungen v where v.projekt_id = p.id and v.status <> 'verworfen')
on conflict do nothing;
insert into public.office_project_abschnitte (project_id, abschnitt, created_by)
select p.id, 'hersteller', null from public.office_projects p
 where exists (select 1 from public.office_hersteller_kontakte k where k.projekt_id = p.id)
    or exists (select 1 from public.office_produkt_verwendungen v where v.projekt_id = p.id and v.status <> 'verworfen')
on conflict do nothing;
