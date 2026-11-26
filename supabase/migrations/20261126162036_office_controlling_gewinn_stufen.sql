-- Controlling: der Gewinn je Honorarpaket als Stufe für das ganze Projektteam (Gari, 26.11.2026).
--
-- Wer im Projekt arbeitet, soll wissen, ob es Geld verdient oder verliert. «Ergebnis netto» vergleicht nur mit der
-- Kalkulation (Stunden zum Kalkulationssatz) und ist nicht der Gewinn. Den Betrag des Gewinns sieht weiterhin nur der
-- volle Zugang: mit Honorar, Stunden und Betrag ließe sich in kleinen Teams ein Gehalt ausrechnen. Diese Funktion gibt
-- deshalb nur die Stufe zurück (plus, knapp, minus) und ob die Annahmen noch vorläufig sind; keine Beträge, keine
-- Gehälter, keine Stunden je Person.
--
-- Gerechnet wie im Projektblatt (controlling-kern.js, kennzahlen und bewertung):
--   Personalkosten je Stand wie in office_controlling_summen (Zuwachs je Person zum Satz am Stichtag);
--   Selbstkosten = Personalkosten × Gemeinkostenfaktor ÷ (1 + Arbeitgeberanteil): beide Sätze teilen dieselben
--     Jahresstunden der Person (Bruttogehalt × 12 × Faktor bzw. × (1 + Anteil), geteilt durch dieselben Stunden);
--   Gewinn am Ende = Honorar − Selbstkosten ÷ Leistungsstand (abgeschlossen: 100 %);
--   Stufe: über +5 % des Honorars plus, unter −5 % minus, dazwischen knapp (K.gewinnStufe, dieselben Grenzen).
-- Leer, wenn etwas fehlt: kein Stand, ein Gehalt oder nur Team-Stunden, kein Faktor, kein Leistungsstand, kein Honorar.
--
-- Lesen darf, wer das Projekt im Controlling sieht (private.office_controlling_lesen). Nichts Destruktives: eine neue
-- Funktion; office_controlling_summen bleibt, wie sie ist.

create or replace function public.office_controlling_gewinn_stufen(p_project uuid)
returns table (paket_id uuid, stufe text, vorlaeufig boolean)
language sql stable security definer set search_path = '' as $$
  with zugang as (
    select (select private.office_controlling_lesen(p_project)) as lesen
  ), s as (
    select st.id, st.paket_id, st.stichtag, st.leistungsstand
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
    select s.id as sid, s.paket_id as pid, s.stichtag as tag, p.pkey, p.person_id,
           coalesce((select h2.stunden from h h2
                     where h2.paket_id = s.paket_id and h2.pkey = p.pkey and h2.stichtag <= s.stichtag
                     order by h2.stichtag desc limit 1), 0) as kum
    from s join pers p on p.paket_id = s.paket_id
  ), zuwachs as (
    select r.*, r.kum - coalesce(lag(r.kum) over (partition by r.pid, r.pkey order by r.tag), 0) as delta
    from raster r
  ), bewertet as (
    select z.sid, z.delta,
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
    select b.sid,
           case when bool_and(b.satz_g is not null or b.delta = 0) then sum(b.delta * coalesce(b.satz_g, 0)) end as wert_g
    from bewertet b group by b.sid
  ), laufend as (
    select s.id, s.paket_id, s.leistungsstand,
           bool_and(j.sid is null or j.wert_g is not null) over w as vollstaendig,
           sum(j.wert_g) over w as wert_g,
           row_number() over (partition by s.paket_id order by s.stichtag desc) as neu
    from s left join je_stand j on j.sid = s.id
    window w as (partition by s.paket_id order by s.stichtag)
  ), annahmen as (
    select e.gemeinkostenfaktor as faktor, e.arbeitgeberanteil_prozent as ag, e.annahmen_bestaetigt
    from public.office_controlling_einstellungen e limit 1
  ), gewinn as (
    select k.id as paket_id, k.honorar_netto as honorar, a.annahmen_bestaetigt,
           case when l.id is not null and l.vollstaendig and a.faktor is not null and a.ag is not null and k.honorar_netto > 0
                     and (k.status = 'abgeschlossen' or l.leistungsstand > 0)
                then k.honorar_netto - coalesce(l.wert_g, 0) * a.faktor / (1 + a.ag / 100) * 100
                     / (case when k.status = 'abgeschlossen' then 100 else l.leistungsstand end)
           end as betrag
    from public.office_controlling_pakete k
    left join laufend l on l.paket_id = k.id and l.neu = 1
    left join annahmen a on true
    where k.project_id = p_project and (select lesen from zugang)
  )
  select g.paket_id,
         case when g.betrag is null then null
              when g.betrag > 0.05 * g.honorar then 'plus'
              when g.betrag < -0.05 * g.honorar then 'minus'
              else 'knapp' end,
         g.annahmen_bestaetigt is null
  from gewinn g
$$;

revoke all on function public.office_controlling_gewinn_stufen(uuid) from public, anon;
grant execute on function public.office_controlling_gewinn_stufen(uuid) to authenticated;
