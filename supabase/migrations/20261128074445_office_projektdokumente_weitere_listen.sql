-- TBA Office · Projektdokumente: weitere Listen der Bürovorlage LPH 3 (28.11.2026, Claude; OK von Gari am 28.11.2026 für
-- genau diese Änderung).
--
-- Fachplanerbedarf, Schnittstellen, Fragenliste und Eingang werden Dokumente des Projekts wie Klärungs- und
-- Entscheidungsliste (Gari: die Listen des Projektstarts im Projekt bearbeiten, statt ein Excel herunterzuladen). Dazu
-- schon die Arten der nächsten Schritte: Planliste, Dokumente, Ausgaben, Verteiler, Austausch, Ablage, und als Texte
-- Projektstartvermerk und Kick-off. Ersetzt wird nur die Prüfregel der Spalte «art»: die alte Regel wird entfernt und
-- erweitert neu angelegt, in einer Transaktion. Keine Zeile wird geändert oder gelöscht; die neue Regel enthält alle
-- bisherigen Werte, also bleiben alle Dokumente gültig. Rechte (RLS), Trigger und Nummernvergabe bleiben, wie sie sind.

alter table public.office_projektdokumente drop constraint office_projektdokumente_art_check;
alter table public.office_projektdokumente add constraint office_projektdokumente_art_check
  check (art in ('klaerungsliste','entscheidungsliste','entscheidungsvorlagen',
                 'fachplanerbedarf','schnittstellen','fragenliste','eingang',
                 'planliste','dokumente','ausgaben','verteiler','austausch','ablage',
                 'projektstartvermerk','kickoff'));
