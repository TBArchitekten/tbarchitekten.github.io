-- TBA Office · Controlling: Urlaub je Person (25.11.2026, Claude; Wunsch von Gari am 25.11.2026: nicht alle im Büro
-- haben gleich viele Urlaubstage).
--
-- Bisher hatte jede Person die Jahresstunden einer Vollzeitkraft, anteilig nach ihren Wochenstunden: das setzt voraus,
-- dass ihr Urlaub dem des Büros entspricht (in Teilzeit anteilig). Wer mehr oder weniger Urlaub hat, bekommt jetzt seine
-- eigenen Jahresstunden:
--
--   Jahresstunden der Person = Jahresstunden × Wochenstunden ÷ Vollzeit-Wochenstunden
--     + (Urlaubstage des Büros × Wochenstunden ÷ 5 − eigene Urlaubstage × Wochenstunden ÷ Arbeitstage je Woche)
--       × Projektanteil
--
-- Die eigenen Urlaubstage zählen in den eigenen Arbeitstagen (wer an 2 Tagen arbeitet, hat etwa 12 statt 30 Tage);
-- ohne Arbeitstage je Woche gelten 5. Die Korrektur greift nur, wenn das Büro seine Urlaubstage (Vollzeit) unter den
-- Annahmen eingetragen hat (Migration office_controlling_jahresstunden); sonst bleibt alles wie bisher.
--
-- office_controlling_saetze.urlaubstage        Urlaubstage im Jahr laut Vertrag, ab gueltig_ab; leer = wie das Büro.
-- office_controlling_saetze.arbeitstage_woche  Arbeitstage je Woche laut Vertrag; leer = 5.
-- office_controlling_summen(p)                 neuer Körper bei gleicher Signatur, mit der Korrektur oben.
--
-- Nichts Destruktives: zwei neue Spalten (leer), eine Funktion mit neuem Körper bei gleicher Signatur. Die Rechte
-- bleiben (Sätze nur für die Liste office_controlling_zugang).

alter table public.office_controlling_saetze
  add column urlaubstage numeric(4,1)
    check (urlaubstage is null or (urlaubstage >= 0 and urlaubstage <= 60)),
  add column arbeitstage_woche numeric(2,1)
    check (arbeitstage_woche is null or (arbeitstage_woche > 0 and arbeitstage_woche <= 6));

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
           (select sa.monatsgehalt * 12 * (1 + e.arbeitgeberanteil_prozent / 100)
                   / nullif(e.jahresstunden * coalesce(sa.wochenstunden, e.vollzeit_wochenstunden) / e.vollzeit_wochenstunden
                     + case when sa.urlaubstage is not null and e.urlaubstage is not null
                            then (e.urlaubstage * coalesce(sa.wochenstunden, e.vollzeit_wochenstunden) / 5
                                  - sa.urlaubstage * coalesce(sa.wochenstunden, e.vollzeit_wochenstunden) / coalesce(sa.arbeitstage_woche, 5))
                                 * coalesce(e.projektanteil_prozent, 100) / 100
                            else 0 end, 0)
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
