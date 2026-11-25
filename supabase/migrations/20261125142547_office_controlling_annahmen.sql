-- TBA Office · Controlling: Wochenstunden je Person und Annahmen für die Selbstkosten (25.11.2026, Claude; Wunsch von
-- Gari am 25.11.2026).
--
-- Gari: Ohne die Wochenstunden stimmt der Stundensatz aus dem Gehalt für Teilzeit nicht (wer 20 h in der Woche
-- arbeitet, hat die Hälfte der Jahresstunden einer Vollzeitkraft). Dazu der Gemeinkostenfaktor des Büros, auf das
-- Bruttogehalt allein gerechnet, für die Selbstkosten einer Stunde; und Platz, um festzuhalten, woher die Annahmen
-- stammen und wann sie bestätigt wurden.
--
-- office_controlling_saetze.wochenstunden        Wochenstunden laut Vertrag ab gueltig_ab; leer = Vollzeit.
-- office_controlling_einstellungen
--   .vollzeit_wochenstunden                        Bezug der Jahresstunden (Vollzeit), Standard 40.
--   .gemeinkostenfaktor                            Faktor auf das Bruttogehalt; leer = keine Selbstkosten. Den Wert des
--                                                  Büros trägt die Seite ein (Daten, nicht im Repo).
--   .annahmen_notiz, .annahmen_bestaetigt          Herkunft der Annahmen und der Tag, an dem sie bestätigt wurden.
-- office_controlling_summen(p)                     neuer Körper bei gleicher Signatur: Jahresstunden einer Person =
--                                                  Jahresstunden × Wochenstunden ÷ Vollzeit-Wochenstunden.
--
-- Nichts Destruktives: neue Spalten (leer oder mit Standard), eine Funktion mit neuem Körper bei gleicher Signatur.
-- Die Rechte bleiben: Sätze und Einstellungen liest und schreibt nur, wer auf der Liste office_controlling_zugang steht
-- (Migration office_controlling_nur_liste); die Rechte auf Tabellenebene gelten auch für die neuen Spalten.

alter table public.office_controlling_saetze
  add column wochenstunden numeric(4,1)
    check (wochenstunden is null or (wochenstunden > 0 and wochenstunden <= 80));

alter table public.office_controlling_einstellungen
  add column vollzeit_wochenstunden numeric(4,1) not null default 40
    check (vollzeit_wochenstunden > 0 and vollzeit_wochenstunden <= 80),
  add column gemeinkostenfaktor numeric(4,2)
    check (gemeinkostenfaktor is null or (gemeinkostenfaktor >= 1 and gemeinkostenfaktor <= 5)),
  add column annahmen_notiz text
    check (annahmen_notiz is null or char_length(annahmen_notiz) <= 2000),
  add column annahmen_bestaetigt date;

-- Wie bisher (Migration office_controlling_zugang), nur der Stundensatz aus dem Gehalt rechnet mit den Jahresstunden
-- der Person: die Wochenstunden kommen aus demselben Eintrag wie das Gehalt.
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
                   / (e.jahresstunden * coalesce(sa.wochenstunden, e.vollzeit_wochenstunden) / e.vollzeit_wochenstunden)
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
