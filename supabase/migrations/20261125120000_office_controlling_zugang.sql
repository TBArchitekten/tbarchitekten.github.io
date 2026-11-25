-- TBA Office · Controlling: voller Zugang für die Buchhaltung (25.11.2026, Claude; Wunsch von Gari am 25.11.2026).
--
-- Gari: Die Kollegin, die sich im Büro um die Buchhaltung kümmert, soll im Controlling alles sehen und eintragen können
-- wie die Admins: alle Projekte, Stunden je Person, Sätze und Gehälter. Admin des Office wird sie dafür nicht
-- (Mitglieder, Projekte und die übrigen Werkzeuge bleiben, wie sie sind).
--
-- office_controlling_zugang           Personen mit vollem Zugang zum Controlling, zusätzlich zu den Admins. Pflegen nur
--                                     Admins; jede Person sieht ihre eigene Zeile, Admins alle.
-- private.office_controlling_voll()   Admin oder aktives Mitglied mit Zugang.
-- office_controlling_lesen(p)         neuer Körper: auch mit vollem Zugang (alle Projekte).
-- office_controlling_summen(p)        neuer Körper: der Wert zum Gehalt auch mit vollem Zugang.
-- Policies                            zusätzlich und permissiv, neben denen für Admins: voller Zugang liest Stunden, Sätze
--                                     und Einstellungen und schreibt überall wie ein Admin.
--
-- Nichts Destruktives: eine neue Tabelle, eine neue Funktion, neue Policies; zwei Funktionen bekommen bei gleicher
-- Signatur einen neuen Körper. Keine Policy wird entfernt.

create table public.office_controlling_zugang (
  user_id uuid primary key references public.office_members(user_id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.office_controlling_zugang enable row level security;
revoke all on public.office_controlling_zugang from public, anon, authenticated;
grant select, insert, delete on public.office_controlling_zugang to authenticated;
create policy office_controlling_zugang_lesen on public.office_controlling_zugang
  for select to authenticated using (user_id = (select auth.uid()) or (select private.office_is_admin()));
create policy office_controlling_zugang_anlegen on public.office_controlling_zugang
  for insert to authenticated with check ((select private.office_is_admin()) and created_by = (select auth.uid()));
create policy office_controlling_zugang_entfernen on public.office_controlling_zugang
  for delete to authenticated using ((select private.office_is_admin()));

create function private.office_controlling_voll() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.office_is_admin())
      or exists (select 1 from public.office_controlling_zugang z
                 join public.office_members m on m.user_id = z.user_id
                 where z.user_id = (select auth.uid()) and m.is_active)
$$;
revoke all on function private.office_controlling_voll() from public, anon;
grant execute on function private.office_controlling_voll() to authenticated;

-- Lesen: Projektteam, Projektleitung, Admins und voller Zugang.
create or replace function private.office_controlling_lesen(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.office_is_member())
     and ((select private.office_controlling_voll())
          or (select private.office_leads_project(p_project)) or (select private.office_in_project_team(p_project)))
$$;
revoke all on function private.office_controlling_lesen(uuid) from public, anon;
grant execute on function private.office_controlling_lesen(uuid) to authenticated;

-- Schreiben und die Daten nur für Admins: dasselbe für vollen Zugang.
create policy office_controlling_pakete_voll_anlegen on public.office_controlling_pakete
  for insert to authenticated with check ((select private.office_controlling_voll()) and created_by = (select auth.uid()));
create policy office_controlling_pakete_voll_aendern on public.office_controlling_pakete
  for update to authenticated using ((select private.office_controlling_voll())) with check ((select private.office_controlling_voll()));
create policy office_controlling_pakete_voll_entfernen on public.office_controlling_pakete
  for delete to authenticated using ((select private.office_controlling_voll()));
create policy office_controlling_staende_voll_anlegen on public.office_controlling_staende
  for insert to authenticated with check ((select private.office_controlling_voll()) and created_by = (select auth.uid()));
create policy office_controlling_staende_voll_aendern on public.office_controlling_staende
  for update to authenticated using ((select private.office_controlling_voll())) with check ((select private.office_controlling_voll()));
create policy office_controlling_staende_voll_entfernen on public.office_controlling_staende
  for delete to authenticated using ((select private.office_controlling_voll()));
create policy office_controlling_zahlungen_voll_anlegen on public.office_controlling_zahlungen
  for insert to authenticated with check ((select private.office_controlling_voll()) and created_by = (select auth.uid()));
create policy office_controlling_zahlungen_voll_aendern on public.office_controlling_zahlungen
  for update to authenticated using ((select private.office_controlling_voll())) with check ((select private.office_controlling_voll()));
create policy office_controlling_zahlungen_voll_entfernen on public.office_controlling_zahlungen
  for delete to authenticated using ((select private.office_controlling_voll()));
create policy office_controlling_stunden_voll_lesen on public.office_controlling_stunden
  for select to authenticated using ((select private.office_controlling_voll()));
create policy office_controlling_stunden_voll_anlegen on public.office_controlling_stunden
  for insert to authenticated with check ((select private.office_controlling_voll()) and created_by = (select auth.uid()));
create policy office_controlling_stunden_voll_aendern on public.office_controlling_stunden
  for update to authenticated using ((select private.office_controlling_voll())) with check ((select private.office_controlling_voll()));
create policy office_controlling_stunden_voll_entfernen on public.office_controlling_stunden
  for delete to authenticated using ((select private.office_controlling_voll()));
create policy office_controlling_saetze_voll_lesen on public.office_controlling_saetze
  for select to authenticated using ((select private.office_controlling_voll()));
create policy office_controlling_saetze_voll_anlegen on public.office_controlling_saetze
  for insert to authenticated with check ((select private.office_controlling_voll()) and created_by = (select auth.uid()));
create policy office_controlling_saetze_voll_aendern on public.office_controlling_saetze
  for update to authenticated using ((select private.office_controlling_voll())) with check ((select private.office_controlling_voll()));
create policy office_controlling_saetze_voll_entfernen on public.office_controlling_saetze
  for delete to authenticated using ((select private.office_controlling_voll()));
create policy office_controlling_einstellungen_voll on public.office_controlling_einstellungen
  for all to authenticated using ((select private.office_controlling_voll())) with check ((select private.office_controlling_voll()));

-- Summen je Stand: wie bisher; den Wert zum Gehalt sehen jetzt Admins und voller Zugang.
create or replace function public.office_controlling_summen(p_project uuid)
returns table (stand_id uuid, paket_id uuid, stichtag date, leistungsstand numeric,
               stunden numeric, wert_kalkulation numeric, wert_gehalt numeric)
language sql stable security definer set search_path = '' as $$
  with zugang as (
    select (select private.office_controlling_lesen(p_project)) as lesen, (select private.office_controlling_voll()) as admin
  ), s as (
    select st.id, st.paket_id, st.stichtag, st.leistungsstand, k.kalkulationssatz as paket_satz
    from public.office_controlling_staende st
    join public.office_controlling_pakete k on k.id = st.paket_id
    where k.project_id = p_project and (select lesen from zugang)
  ), h as (
    select st.paket_id, st.stichtag, x.person_id,
           coalesce(x.person_id::text, 'name:' || lower(btrim(x.person_name)), 'team') as pkey, x.stunden
    from public.office_controlling_stunden x join s st on st.id = x.stand_id
  ), pers as (
    select distinct h.paket_id, h.pkey, h.person_id from h
  ), raster as (
    select s.id as sid, s.paket_id as pid, s.stichtag as tag, s.paket_satz, p.pkey, p.person_id,
           coalesce((select h2.stunden from h h2
                     where h2.paket_id = s.paket_id and h2.pkey = p.pkey and h2.stichtag <= s.stichtag
                     order by h2.stichtag desc limit 1), 0) as kum
    from s join pers p on p.paket_id = s.paket_id
  ), zuwachs as (
    select r.*, r.kum - coalesce(lag(r.kum) over (partition by r.pid, r.pkey order by r.tag), 0) as delta
    from raster r
  ), bewertet as (
    select z.sid, z.kum, z.delta,
           coalesce((select sa.kalkulationssatz from public.office_controlling_saetze sa
                     where z.person_id is not null and sa.person_id = z.person_id
                       and sa.kalkulationssatz is not null and sa.gueltig_ab <= z.tag
                     order by sa.gueltig_ab desc limit 1), z.paket_satz) as satz_k,
           (select sa.monatsgehalt * 12 * (1 + e.arbeitgeberanteil_prozent / 100) / e.jahresstunden
              from public.office_controlling_saetze sa cross join public.office_controlling_einstellungen e
             where z.person_id is not null and sa.person_id = z.person_id
               and sa.monatsgehalt is not null and sa.gueltig_ab <= z.tag
             order by sa.gueltig_ab desc limit 1) as satz_g
    from zuwachs z
  ), je_stand as (
    select b.sid, sum(b.kum) as stunden, sum(b.delta * b.satz_k) as wert_k,
           case when bool_and(b.satz_g is not null or b.delta = 0) then sum(b.delta * coalesce(b.satz_g, 0)) end as wert_g
    from bewertet b group by b.sid
  ), laufend as (
    select s.id, s.paket_id, s.stichtag, s.leistungsstand,
           coalesce(j.stunden, 0) as stunden,
           coalesce(sum(j.wert_k) over w, 0) as wert_k,
           bool_and(j.sid is null or j.wert_g is not null) over w as gehalt_vollstaendig,
           sum(j.wert_g) over w as wert_g
    from s left join je_stand j on j.sid = s.id
    window w as (partition by s.paket_id order by s.stichtag)
  )
  select l.id, l.paket_id, l.stichtag, l.leistungsstand, l.stunden, round(l.wert_k, 2),
         case when (select admin from zugang) and l.gehalt_vollstaendig then round(coalesce(l.wert_g, 0), 2) end
  from laufend l
  order by l.paket_id, l.stichtag
$$;
revoke all on function public.office_controlling_summen(uuid) from public, anon;
grant execute on function public.office_controlling_summen(uuid) to authenticated;
