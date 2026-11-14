# TBA Office · Aufgabenbibliothek LPH 3 · v0.3.1
Stand 14.11.2026 · **Entwurf zur gemeinsamen Prüfung, nicht freigegeben** · ersetzt als Muster-Planner die Fassung v0.2.1 (`app/data/muster-planner-lph3-v0.2.json` bleibt als Referenz der Konkordanz im Repo)

## Was das ist
Ein System, das den Muster-Terminplan LPH 3 mit dem Planner verbindet. Wer ein Projekt beginnt, soll einen strukturierten, änderbaren Arbeitsraum bekommen: Abgaben als Buckets, Aufgaben mit Prüfpunkten, und jede Aufgabe weiß, welchen Vorgang sie ausführt und welche Ergebnisse sie braucht.

**Kette:** Terminplan-Vorgang → Abgabe (= Bucket) → Aufgabe → Prüfpunkt. Quer dazu das **Ergebnisregister**: Jede Aufgabe *erzeugt* Ergebnisstände und *braucht* Ergebnisstände anderer Aufgaben.

## Regeln
1. **Kodierung** `L3.<Objekt>.<Zustand>`. Objekt = Arbeitsergebnis (3 Buchstaben, phasenunabhängig, z. B. GRU Grundrisse, BAD Themenpaket Bäder) oder Abgabe (A1 … A7). Zustand = Stand des Ergebnisses (1 Arbeitsstand 01, 2 Stand 02, 3 Endstand) oder Schritt der Abgabe (PRF, AUS, ABS). Prüfpunkt `<Aufgabe>-NN`, z. B. `L3.GRU.1-03`. Eine Aufgabe trägt den Code des Ergebnisstands, den sie erzeugt. Codes werden nie neu vergeben und hängen nicht an Bucket, Reihenfolge oder PSP.
2. **Anatomie jeder Abgabe:** Erarbeiten (n Karten) → Ausgeben (genau eine Karte, Label „Abgabe“) → Abschließen (genau eine Karte). Eine Karte endet mit der letzten Handlung des Büros; Prüfzeiten Dritter sind Wartezeit (`waitsFor`) der folgenden Karte.
3. **Ein Bucket je Abgabe** des Terminplans. Organisationsaufgaben sind Aufgaben in der Abgabe, zu der sie gehören, kein eigener Bucket. Projekte dürfen weitere Buckets anlegen.
4. **Pläne** werden nach Planart geteilt (Grundrisse, Schnitte, Ansichten, Lageplan), Vertiefungen nach Thema (Bäder, Treppen, Fassade, Licht …): ein Thema, eine Person.
5. **Checklisten** so lang wie nötig (0–10 Punkte, derzeit 4–10). Wiederkehrende Routinen sind als Baustein markiert (PLAN, AUS, F, ABS, THEMA).
6. **Verknüpfung mit dem Terminplan über die Vorgangs-ID** (`t030`), nie über PSP oder Titel: `executes` (eigener Vorgang), `waitsFor` (Vorgang Dritter), `anchor` (Fälligkeit). Die PSP-Nummern im JSON sind aus der Vorlage abgeleitet.
7. Keine Stundenwerte; Mustertermine sind keine Vertragsfristen; nur TBA-eigene Arbeit.

## Bemusterung (A5) seit Muster-Terminplan v1.3
Bis v1.2 hatte die Vorbereitung der Bemusterung keinen Vorgang; 04.03 (`t030`) bildete nur die Abstimmung ab. v1.3 ergänzt in PSP 04:
- `t058` **Bemusterungsunterlagen vorbereiten · Qualitäten, Materialien und Themenpläne** (ARC, 15 AT, Anfang nach `t010` Rückmeldung zum Arbeitsstand 01; Orientierungswert),
- `t059` **Bemusterungsunterlagen an Auftraggeber übergeben** (Meilenstein),
- `t030` wartet zusätzlich auf `t059` (EA + 1).

Kein bestehender Vorgang verschiebt sich, das Musterende bleibt. Folge für die PSP: Abstimmung `t030` ist jetzt 04.05, M06 `t031` 04.06. In der Bibliothek führen die acht Vorbereitungskarten `t058` aus, `L3.A5.AUS` endet mit `t059`, und `L3.A5.ABS` umfasst Bemusterungstermin(e) `t030` bis M06 `t031`.

## Dateien
- `app/data/muster-planner-lph3-v0.3.json` – vom Planner gelesen (`app/work.js`, nur Ansicht). Enthält zusätzlich `coding`, `steps`, `blocks`, `results`, `parameters`, `retired`, `validation` und je Aufgabe `produces`, `requires`, `schedule`, `origin`.
- `scripts/lph3-bibliothek/lib.py` – Inhalt (Ergebnisregister, Abgaben, Aufgaben, Prüfpunkte, Konkordanz).
- `scripts/lph3-bibliothek/build.py` – prüft und erzeugt: `python3 scripts/lph3-bibliothek/build.py [/tmp/ordner]` (braucht `openpyxl`); schreibt das JSON und eine Excel-Prüfmatrix. Bricht bei jedem FEHLER ab.

**Nie das JSON von Hand ändern:** Änderungen in `lib.py`, dann `build.py`, dann `node --test tests/*.test.cjs tests/*.test.mjs`.

## Maschinelle Prüfungen (build.py, teilweise auch in den Node-Tests)
Codes eindeutig und formgerecht · jeder Ergebnisstand genau einmal erzeugt · alle Voraussetzungen aufgelöst · zyklenfrei · **zeitlich konsistent mit den Musterterminen** (kein Ergebnis wird gebraucht, bevor es laut Terminplan fertig ist) · Wartezeiten enden rechtzeitig · alle 59 Vorgänge zugeordnet · Vorgänge Dritter nie als Büroarbeit · gleiche Anatomie in allen Abgaben · HOAI Anlage 10 LPH 3 a)–g) abgedeckt · ≤ 10 Prüfpunkte · Konkordanz zu den 137 Karten der drei Vorversionen vollständig.

## Offen
Fachliche Prüfung aller Karten durch das Büro; Übernahme in reale Projekte (heute nur Ansicht); weitere Themenpakete; Parameter (P-THE, P-MUS …) in der Projektanlage.
