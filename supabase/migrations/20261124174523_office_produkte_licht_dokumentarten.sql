-- TBA Office · Produktbibliothek: Kategorie «Licht», Dokumentarten «Angebot» und «Sicherheitsdatenblatt»
-- (24.11.2026, Claude; OK von Gari am 24.11.2026 für genau diese Änderung).
--
-- Für das nächste Paket der Bemusterung (Licht) braucht die Bibliothek die Kategorie «Licht»; der Herstellerkatalog
-- kennt sie schon. Angebote und Sicherheitsdatenblätter lagen bisher als «Sonstiges» bei den Produkten.
-- Ersetzt werden nur die beiden Prüfregeln: die alte Regel wird entfernt und erweitert neu angelegt. Keine Zeile wird
-- geändert oder gelöscht; die neuen Regeln enthalten alle bisherigen Werte, also bleiben alle Einträge gültig.

alter table public.office_produkte drop constraint office_produkte_kategorie_check;
alter table public.office_produkte add constraint office_produkte_kategorie_check
  check (kategorie in ('bodenbelag','wandbelag','decke','fassade','fenster_tueren','sanitaer','licht','beschlaege','sonstiges'));

alter table public.office_produkt_dokumente drop constraint office_produkt_dokumente_art_check;
alter table public.office_produkt_dokumente add constraint office_produkt_dokumente_art_check
  check (art in ('datenblatt','preisliste','verlegeanleitung','pflegeanleitung','leistungserklaerung','epd','zertifikat',
                 'angebot','sicherheitsdatenblatt','bild','sonstiges'));
