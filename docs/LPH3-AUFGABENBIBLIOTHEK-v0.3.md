# TBA Office · Aufgabenbibliothek LPH 3 · v0.3.5
Stand 24.11.2026 (v0.3.5: Themenpakete von einer Person vollständig bearbeitet, `L3.MAT.1` und `L3.MUS.1` entfallen, neu `L3.WEI.1`; v0.3.4: Bauteilkatalog durch die Bauphysik, bezogen auf Vorlage v1.6 – ohne Notizen, Hinweise in `docs/LPH3-MUSTER-TERMINPLAN-HINWEISE.md`; v0.3.3: Themenpaket Bodenbeläge) · **Entwurf zur gemeinsamen Prüfung, nicht freigegeben** · ersetzt als Muster-Planner die Fassung v0.2.1 (`app/data/muster-planner-lph3-v0.2.json` bleibt als Referenz der Konkordanz im Repo)

## Was das ist
Ein System, das den Muster-Terminplan LPH 3 mit dem Planner verbindet. Wer ein Projekt beginnt, soll einen strukturierten, änderbaren Arbeitsraum bekommen: Abgaben als Buckets, Aufgaben mit Prüfpunkten, und jede Aufgabe weiß, welchen Vorgang sie ausführt und welche Ergebnisse sie braucht.

**Kette:** Terminplan-Vorgang → Abgabe (= Bucket) → Aufgabe → Prüfpunkt. Quer dazu das **Ergebnisregister**: Jede Aufgabe *erzeugt* Ergebnisstände und *braucht* Ergebnisstände anderer Aufgaben.

## Regeln
1. **Kodierung** `L3.<Objekt>.<Zustand>`. Objekt = Arbeitsergebnis (3 Buchstaben, phasenunabhängig, z. B. GRU Grundrisse, BAD Themenpaket Bäder) oder Abgabe (A1 … A7). Zustand = Stand des Ergebnisses (1 Arbeitsstand 01, 2 Stand 02, 3 Endstand) oder Schritt der Abgabe (PRF, AUS, ABS). Prüfpunkt `<Aufgabe>-NN`, z. B. `L3.GRU.1-03`. Eine Aufgabe trägt den Code des Ergebnisstands, den sie erzeugt. Codes werden nie neu vergeben und hängen nicht an Bucket, Reihenfolge oder PSP.
2. **Anatomie jeder Abgabe:** Erarbeiten (n Karten) → Ausgeben (genau eine Karte, Label „Abgabe“) → Abschließen (genau eine Karte). Eine Karte endet mit der letzten Handlung des Büros; Prüfzeiten Dritter sind Wartezeit (`waitsFor`) der folgenden Karte.
3. **Ein Bucket je Abgabe** des Terminplans. Organisationsaufgaben sind Aufgaben in der Abgabe, zu der sie gehören, kein eigener Bucket. Projekte dürfen weitere Buckets anlegen.
4. **Pläne** werden nach Planart geteilt (Grundrisse, Schnitte, Ansichten, Lageplan), Vertiefungen nach Thema (Bäder, Treppen, Fassade, Licht …): ein Thema, eine Person – seit v0.3.5 mit allem, was zum Thema gehört (Recherche, Varianten, Muster, Entscheidungsvorlage).
5. **Checklisten** so lang wie nötig (0–10 Punkte, derzeit 4–10). Wiederkehrende Routinen sind als Baustein markiert (PLAN, AUS, F, ABS, THEMA).
6. **Verknüpfung mit dem Terminplan über die Vorgangs-ID** (`t030`), nie über PSP oder Titel: `executes` (eigener Vorgang), `waitsFor` (Vorgang Dritter), `anchor` (Fälligkeit). Die PSP-Nummern im JSON sind aus der Vorlage abgeleitet.
7. Keine Stundenwerte; Mustertermine sind keine Vertragsfristen; nur TBA-eigene Arbeit.

## Bemusterung (A5) seit Muster-Terminplan v1.3 (Dauer seit v1.4: 20 AT)
Bis v1.2 hatte die Vorbereitung der Bemusterung keinen Vorgang; 04.03 (`t030`) bildete nur die Abstimmung ab. v1.3 ergänzt in PSP 04:
- `t058` **Bemusterungsunterlagen vorbereiten · Qualitäten, Materialien und Themenpläne** (ARC, 20 AT seit v1.4 – vorher 15 AT, Anfang nach `t010` Rückmeldung zum Arbeitsstand 01; Orientierungswert),
- `t059` **Bemusterungsunterlagen an Auftraggeber übergeben** (Meilenstein),
- `t030` wartet zusätzlich auf `t059` (EA + 1).

Kein bestehender Vorgang verschiebt sich, das Musterende bleibt. Folge für die PSP: Abstimmung `t030` ist jetzt 04.05, M06 `t031` 04.06. In der Bibliothek führen die Vorbereitungskarten (seit v0.3.5 acht: QUA, MAP, fünf Themenpakete und «weitere») `t058` aus, `L3.A5.AUS` endet mit `t059`, und `L3.A5.ABS` umfasst Bemusterungstermin(e) `t030` bis M06 `t031`.

## Bauteilkatalog (seit v0.3.4 und Muster-Terminplan v1.5)
Entscheidung Gari (15.11.2026), gestützt auf HOAI Anlage 1 Nr. 1.2.2 (Bauphysik: LPH 2 Besondere Leistung „Erstellen eines fachübergreifenden Bauteilkatalogs“, LPH 3 c) „Bemessen der Bauteile des Gebäudes“):
- `L3.BTK.1` **Aufbauvorgaben für die Bauphysik festlegen** (Architektur, Bucket A1, fällig mit M01 `t012`): Konstruktionsart, Schichtenfolge, Materialien, Oberflächen und angenommene Dicken je Bauteil; gehen mit den Planungsgrundlagen (`L3.A1.AUS`) an die Bauphysik.
- Den Bauteilkatalog liefert die Bauphysik als Fachplanungsbeitrag Arbeitsstand 01: neuer Vorgang `t060` (BPH, parallel zu ELT/HLS/TWP, vor M03 `t022`); geprüft in `L3.KLA.1`.
- `L3.BTK.2` **Bauteilkatalog der Bauphysik prüfen und übernehmen** (Architektur, A4, `t025`).
- `L3.A5.ABS` gibt die Entscheidungen der Bemusterung an die Bauphysik; deren Endstand kommt mit dem abgestimmten Beitrag: neuer Vorgang `t061` (BPH, vor M07 `t036`, endet nicht vor M06 `t031`); geprüft in `L3.KLA.3`, das jetzt `BTK.3` erzeugt.

v1.5 ändert keinen Termin und nicht das Musterende; PSP: `t060` 02.07 (M03 jetzt 02.08), `t061` 05.05 (M07 jetzt 05.06). Ohne beauftragte Bauphysik ist die Zuständigkeit für den Bauteilkatalog vertraglich zu klären.

## Themenpakete (seit v0.3.3; seit v0.3.5 eine Person je Paket)
Bäder (BAD), Treppen (TRE), Fassade (FAS), Licht (LIC), Bodenbeläge (BOD) und **weitere Entscheidungsfelder (WEI)**.

**Entscheidung Gari (24.11.2026):** Im Büro bearbeitet eine Person ein Paket vollständig – die Bäder samt Recherche und Mustern für die Bäder, die Treppen samt Recherche und Mustern für die Treppen. Bis v0.3.4 schnitt A5 dieselbe Matrix zweimal: die Themenkarten als Zeilen, `L3.MAT.1` (recherchieren und bewerten) und `L3.MUS.1` (Muster) als Spalten; jede Zelle stand in zwei Karten, und `L3.MUS.1` wartete auf alle Themen. Seit v0.3.5:
- **Jedes Themenpaket gehört einer Person**, vom Plan bis zur Entscheidungsvorlage. Gemeinsames Gerüst (Baustein THEMA): Umfang und Grenzen zu den Nachbarpaketen – Geometrie im vertieften Maßstab – mindestens zwei Varianten je Entscheidungsfeld, recherchiert und geprüft – Vergleich mit Empfehlung, Preis mit Quelle und Datum – Muster angefragt (Lieferzeit ist Wartezeit) – Muster geprüft, im Zusammenhang beurteilt, mit Referenzcode in der Musterliste – Schnittstellen zu den Fachplanern – Codes, Mengen und Kostenwirkung – Entscheidungsvorlage des Pakets – Abgrenzung LPH 5. Dazu die Zeilen des Themas (Badtypen, Treppengeometrie, Prinzipschnitt, Leuchtenpositionen, Belagsplan).
- **`L3.MAT.1` und `L3.MUS.1` entfallen**; ihre Codes werden nicht neu vergeben. Was wirklich übergreifend war, liegt jetzt in `L3.QUA.1` (jedes Entscheidungsfeld genau einem Paket zugeordnet, je Paket eine Person, gemeinsame Regeln: Referenzcodes und Musterliste, Vergleichskriterien, Preis mit Quelle und Datum, Form der Entscheidungsvorlage, produktneutral bei öffentlichem Auftraggeber) und in `L3.A5.AUS` (Pakete untereinander abgeglichen, Muster gemeinsam beurteilt).
- **`L3.WEI.1` (neu):** Felder ohne eigenes Thema (etwa Wände und Decken, Türen, Einbauten, Küche) brauchen ebenfalls ein Paket – vorher deckte sie `L3.MAT.1` ab. Die Karte wird im Projekt nach dem Thema benannt, je weiterem Paket eine (P-THE enthält «weitere»).
- `L3.MAP.1` führt die Codes der Pakete zusammen (der Boden kommt aus dem Belagsplan) und braucht deshalb die Pakete.
- Andockpunkte: die Musterliste eines Projekts ist die Produktbibliothek (Verwendung mit Code und Stand vorgeschlagen → bemustert → freigegeben), die Entscheidungsvorlage des Pakets entsteht im Projektstart (Entscheidungsliste und Vorlage).

## Planner ↔ Terminplan (seit 14.11.2026)
Eine Projekt-Aufgabe ist verknüpft, wenn `metadata.office_planner.terminplan = {instance_id, executes, waits_for, anchor}` gesetzt ist (Vorgangs-IDs des Projekt-Terminplans). Der Knopf **„Termine aus Terminplan“** im Planner (nur sichtbar, wenn es verknüpfte Aufgaben gibt) rechnet Start = frühester Start, Fällig = spätestes Ende der ausgeführten Vorgänge (ohne eigenen Vorgang: Ankerdatum), zeigt alle Änderungen und speichert erst nach „Übernehmen“. Erledigte Aufgaben bleiben unverändert. Logik: `app/planner-terminplan-sync.js` (rein, getestet).

## Dateien
- `app/data/muster-planner-lph3-v0.3.json` – vom Planner gelesen (`app/work.js`, nur Ansicht). Enthält zusätzlich `coding`, `steps`, `blocks`, `results`, `parameters`, `retired`, `validation` und je Aufgabe `produces`, `requires`, `schedule`, `origin`.
- `scripts/lph3-bibliothek/lib.py` – Inhalt (Ergebnisregister, Abgaben, Aufgaben, Prüfpunkte, Konkordanz).
- `scripts/lph3-bibliothek/build.py` – prüft und erzeugt: `python3 scripts/lph3-bibliothek/build.py [/tmp/ordner]` (braucht `openpyxl`); schreibt das JSON und eine Excel-Prüfmatrix. Bricht bei jedem FEHLER ab.

**Nie das JSON von Hand ändern:** Änderungen in `lib.py`, dann `build.py`, dann `node --test tests/*.test.cjs tests/*.test.mjs`.

## Maschinelle Prüfungen (build.py, teilweise auch in den Node-Tests)
Codes eindeutig und formgerecht · jeder Ergebnisstand genau einmal erzeugt · alle Voraussetzungen aufgelöst · zyklenfrei · **zeitlich konsistent mit den Musterterminen** (kein Ergebnis wird gebraucht, bevor es laut Terminplan fertig ist) · Wartezeiten enden rechtzeitig · alle 61 Vorgänge zugeordnet · Vorgänge Dritter nie als Büroarbeit · gleiche Anatomie in allen Abgaben · HOAI Anlage 10 LPH 3 a)–g) abgedeckt · ≤ 10 Prüfpunkte · Konkordanz zu den 137 Karten der drei Vorversionen vollständig.

## Offen
Fachliche Prüfung aller Karten durch das Büro; Übernahme in reale Projekte (heute nur Ansicht); Parameter (P-THE, P-MUS …) in der Projektanlage; Prüfpunkte, die nur unter einem Parameter gelten (Muster bei P-MUS = nein), stehen noch im Text statt als Bedingung.
