-- TBA Office · Controlling: Herleitung der Jahresstunden aus dem Kalender (25.11.2026, Claude; Frage von Gari am
-- 25.11.2026: zählen die 1.600 Jahresstunden die Feiertage des Jahres?).
--
-- Die Jahresstunden einer Vollzeitkraft bleiben eine Annahme (office_controlling_einstellungen.jahresstunden); die Seite
-- leitet sie auf Wunsch aus dem Kalender her: Werktage des Jahres minus Feiertage am Sitz des Büros (rechnet die Seite)
-- minus Urlaub, Krankheit und weitere Tage ohne Projekt, mal Wochenstunden ÷ 5, mal Projektanteil. Damit die Herleitung
-- nachvollziehbar bleibt, stehen ihre Angaben hier:
--
-- office_controlling_einstellungen
--   .urlaubstage             Urlaubstage einer Vollzeitkraft im Jahr (in Teilzeit anteilig; das decken die Wochenstunden ab).
--   .krankheitstage          angenommene Krankheitstage im Jahr.
--   .weitere_tage            weitere Tage ohne Projekt (Fortbildung, Betriebsausflug, Heiligabend, Silvester).
--   .projektanteil_prozent   Anteil der Arbeitszeit für Projekte (ohne Akquise, Büroorganisation, interne Termine).
--
-- Nichts Destruktives: vier neue Spalten, leer und ohne Standard. Die Rechte bleiben: lesen und schreiben nur, wer auf
-- der Liste office_controlling_zugang steht (Migration office_controlling_nur_liste).

alter table public.office_controlling_einstellungen
  add column urlaubstage numeric(4,1)
    check (urlaubstage is null or (urlaubstage >= 0 and urlaubstage <= 60)),
  add column krankheitstage numeric(4,1)
    check (krankheitstage is null or (krankheitstage >= 0 and krankheitstage <= 100)),
  add column weitere_tage numeric(4,1)
    check (weitere_tage is null or (weitere_tage >= 0 and weitere_tage <= 100)),
  add column projektanteil_prozent numeric(5,2)
    check (projektanteil_prozent is null or (projektanteil_prozent > 0 and projektanteil_prozent <= 100));
