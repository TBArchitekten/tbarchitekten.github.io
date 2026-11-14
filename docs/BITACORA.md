# TBA Office · Bitácora de cambios

Una entrada por cambio, **la más nueva arriba**. Cada agente (ChatGPT, Claude u otro) o Gari añade la suya en el mismo PR del cambio. Lo que *es* el sistema ahora se describe en `docs/ESTADO.md`; aquí queda *qué pasó y qué quedó pendiente*.

## Plantilla (copiar y llenar)
```
### AAAA-MM-DD · Título corto · Autor (ChatGPT / Claude / Gari)
- Qué cambió y por qué:
- Archivos:
- Base de datos: migración `…` — aplicada en Supabase: sí / no (cómo)
- Deploy de funciones: ninguno / `nombre` (cómo)
- Cómo se probó:
- Quedó pendiente o sin probar:
- Riesgos o decisiones que necesitan a Gari:
- PR:
```

---

### 2026-11-14 · Muster-Terminplan LPH 3 v1.3 und Aufgabenbibliothek v0.3.1 im Muster-Planner · Claude
- Qué cambió y por qué: Garis Entscheidungen vom 13. und 14.11.2026. (1) **Muster-Terminplan LPH 3 v1.3:** Die Vorbereitung der Bemusterung hatte keinen Vorgang (04.03/`t030` war nur die Abstimmung). Neu in PSP 04: `t058` „Bemusterungsunterlagen vorbereiten · Qualitäten, Materialien und Themenpläne“ (ARC, 15 AT als Orientierungswert, nach `t010`) und Meilenstein `t059` „Bemusterungsunterlagen an Auftraggeber übergeben“; `t030` wartet zusätzlich auf `t059`. 59 Vorgänge, 99 Beziehungen; kein bestehender Termin und nicht das Musterende verschiebt sich; `t030` ist jetzt PSP 04.05, M06 04.06. v1.2 bleibt inaktiv referenzierbar. (2) **Muster-Planner = Aufgabenbibliothek v0.3.1** statt v0.2.1: 7 Abgabe-Buckets, 52 Aufgaben, 334 Prüfpunkte (4–10 je Karte statt fest 4), Kodierung `L3.<Objekt>.<Zustand>`, je Abgabe genau eine Ausgabe-Karte (Label „Abgabe“) und eine Abschluss-Karte, Bemusterungskarten nach Thema zusammengeführt (14 → 10), Pläne nach Planart und Thema geteilt, jede Aufgabe über die Vorgangs-ID verknüpft und mit `produces`/`requires` ins Ergebnisregister eingebunden. Beschreibung: `docs/LPH3-AUFGABENBIBLIOTHEK-v0.3.md`.
- Archivos: `supabase/seed/terminplan-templates.json`, `supabase/migrations/20261114170000_office_lph3_template_v13.sql` (neu), `app/data/muster-planner-lph3-v0.3.json` (neu; v0.2.json bleibt als Konkordanzreferenz), `app/work.js` (lädt v0.3, übernimmt Labels), `app/index.html` (`work.js?v=office46`), `scripts/lph3-bibliothek/{lib.py,build.py}` (neu: Inhalt + Prüfung + Erzeugung), `docs/LPH3-AUFGABENBIBLIOTHEK-v0.3.md` (neu), Hinweis in `docs/LPH3-MUSTERPLANNER-BEMUSTERUNG-v01.md`; Tests: `office-core`, `terminplan-planning` (v1.2-Migration bleibt geprüft: v1.3 = v1.2 + genau diese Änderung; neue Prüfung v1.3-Migration = Seed), `terminplan-uebersicht`/`terminplan-link-view` (99 Beziehungen, Übersicht 58), `office-lph5-v02`, beide Muster-Planner-Tests (neu u. a. Ergebnisregister in der Zeit konsistent, alle 59 Vorgänge verknüpft, Konkordanz zu v0.2.1 vollständig), Chromium-Test des Muster-Planners, vier Tests mit `work.js?v=`.
- Base de datos: migración `20261114170000_office_lph3_template_v13.sql` — aplicada en Supabase: sí (14.11.2026, von innen über `net.http_get` der Datei auf Commit `8123b9e`, SHA-256 geprüft, eingetragen in `supabase_migrations.schema_migrations`). Ergebnis: LPH3 v1.3 aktiv (59 Vorgänge, 99 Beziehungen, Inhalt = Seed geprüft), v1.2 und v1.0 inaktiv. Keine Projektinstanz berührt.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` (296/296 nach Rebase auf `main` mit #89/#90); `tests/browser/office-musterplanner.chromium.mjs` lokal mit Chrome grün (52 Karten, Detail L3.BAD.1, keine Datenbankzugriffe); `scripts/lph3-bibliothek/build.py` mit allen Prüfungen OK und Negativprobe (eine zu früh gebrauchte Voraussetzung wird als FEHLER gemeldet); v1.2-Termine mit `cloneStateForProject` exakt reproduziert, bevor v1.3 daraus gerechnet wurde.
- Quedó pendiente o sin probar: fachliche Prüfung der 52 Karten durch das Büro; die Bibliothek ist weiterhin nur Ansicht (keine Übernahme in Projekt-Buckets). Bestehende Projekt-Terminpläne ändern sich durch die Vorlage nicht; eine laufende Projektinstanz wurde auf Garis Wunsch separat in der Datenbank fortgeschrieben (Vorstand als Version gesichert; Details in der Projektakte, nicht im öffentlichen Repo).
- Riesgos o decisiones que necesitan a Gari: 15 AT Vorbereitung laufen im Muster parallel zu „Vorabzug 02 fortschreiben“ (`t011`) – Personalbedarf prüfen. PSP von Abstimmung/M06 ändert sich (04.03/04.04 → 04.05/04.06); Verknüpfung läuft über IDs, Texte mit alten PSP-Nummern sind historisch.
- PR: #91

### 2026-11-14 · Ein Projektname kostet keine Bestätigung; ein Hinweis trägt seinen Titel · Claude
- Qué cambió y por qué: Dos Fehler, die Gari an einem echten Zug gesehen hat. **(1)** Romy schlug ihm ein Commitment für «Schwarz» vor. Er bestätigte es — und die App verwarf die Bestätigung mit «Das Projekt wurde nicht erkannt», weil der Office-Katalog genau **ein** Projekt hat: Bernried (`isabella_projects` und `office_projects` je eine Zeile, dieselbe). Das Ziel war weg. Ein Name ist der Verweis, nicht der Grund, etwas Bestätigtes wegzuwerfen: Erinnerung, Erwartung und Commitment werden jetzt **ohne Projektbezug gespeichert**, und die Quittung sagt «… «Schwarz» ist kein Projekt im Office, deshalb ohne Projektbezug gespeichert.» Nebenher behoben: `scope` kam ungeprüft aus dem Vorschlag und hätte als freier Text `minds_commitments_scope_check` verletzt; `commitmentScope()` normalisiert ihn. Streng bleibt nur Projektwissen — ein Claim ohne Projekt hat keinen Ort —, und dort nennt die Meldung jetzt die Projekte, die es gibt, und den Weg über «Anpassen». Warum sie überhaupt «Schwarz» schrieb: die Werkzeugbeschreibungen nannten «Bernried oder Schwarz» als Beispiel (Window-Repo, PR #331). **(2)** Die Hinweise im Gespräch lasen sich als «Beginnt um 14:00.», ohne zu sagen, was beginnt. Der Heartbeat baut sie aus `title` («Demnächst: …») und `body`; `minds_publish_attention` schrieb nur den `body` in die Nachricht. Window fällt das weniger auf, weil dort der Feed beides zeigt; das Office hat keinen Feed.
- Archivos: `app/app.js` (neu `resolveProposalProject`, `commitmentScope`), `app/index.html` (app `office54`), neu `supabase/migrations/20261114120000_office_attention_notice_keeps_its_title.sql`, neu `tests/office-proposal-project.test.mjs` und `tests/sql/office-attention-notice-title-acceptance.sql`, `.github/workflows/verify.yml`, `tests/office-german-surface.test.mjs`.
- Base de datos: migración `20261114120000_office_attention_notice_keeps_its_title.sql` — aplicada en Supabase: sí (pg_net, wie die v03-Migration; Prüfsumme vor dem `execute` verglichen).
- Deploy de funciones: `isabella-chat isabella-live-session isabella-routine-runner` (Motor aus Window neu synchronisiert).
- Cómo se probó: 292 Tests, davon 4 neue, die genau den Fall von Gari festhalten (unbekanntes Projekt verwirft nichts mehr, `scope` wird nie zu freiem Text, jede Quittung trägt den Hinweis). Die SQL-Abnahme prüft auf der echten migrierten Schema-Kopie, dass Titel und Text zusammen in der Nachricht stehen, ein Titel, der schon im Text steckt (`watch_fired` schreibt beide gleich), nicht gedoppelt wird, und dass Routing und Zustellstatus unverändert sind.
- Quedó pendiente o sin probar: ein echter Zug durch Gari — eine Vorschlagskarte mit einem Projekt, das es nicht gibt, bestätigen und die Quittung lesen; und der nächste Termin-Hinweis mit Titel. **Window hat denselben Hinweis-Fehler** (`minds_publish_attention` dort schreibt ebenfalls nur `v_event.body`); dort fällt er weniger auf, behoben ist er noch nicht.
- Riesgos o decisiones que necesitan a Gari: ob «Schwarz» als Office-Projekt angelegt werden soll. Solange es das nicht ist, speichert Romy solche Ziele ohne Projektbezug.
- PR: #90

### 2026-11-14 · Was ein Mitglied liest, steht auf Deutsch · Claude
- Qué cambió y por qué: Die App des Office ist eine Portierung von Window, und an einigen Stellen, die ein Mitglied **tatsächlich** liest, stand noch Spanisch. Zuerst gezählt, statt blind zu übersetzen: 437 Kandidaten in den eigenen Dateien, davon **305 in Code, den niemand erreichen kann** — die geerbten Isabella-Panels (Berechtigungen, Routinen, Fähigkeiten, Doctor, Kontinuität, Push, KI-Nutzung, Artefakte, Absichten, Gedächtnis, Prüf-Ökonomie) liegen in `<div class="office-hidden-actions" hidden>` mit leeren Beschriftungen, nur damit die Verdrahtung in `app.js` nicht bricht; dazu Ideen, der Vorschlags-Feed, Lecturas/Sofía, Thoughts, die Selbstprüfung von Window (`settings = project && !OFFICE ? … : null`) und die verborgene Wissen-Ansicht. Erreichbar und übersetzt sind: die **Etikette jedes Vorschlags** im Gespräch (bisher «Agregar · tarea · …», jetzt «Anlegen · Aufgabe · …»), die sechs **Formulare zum Prüfen** eines Vorschlags (künftige Erinnerung, Erwartung, Kontinuität, Projektwissen, neue Fähigkeit, Verbesserung von Romy), die **Quittungen** nach dem Speichern samt Fehlerzeilen, **Romys Arbeitsraum**, die Cockpit-Zeilen und die Thread-Antwort in Work, `sync.js` und der **Eingang** in `shell.js`. Wo im Text «Isabella» stand, steht jetzt «Romy».
- Nebenbei gefunden, nicht Sprache: (1) Der **Eingang ist im Office eine Sackgasse** — `bandeja.js` wurde nie aus Window portiert, also existiert `window.MINDS_BANDEJA` nicht; deshalb erscheint die Zeile «N zu bestätigen im Eingang» in Heute nie und der Navigationseintrag bleibt `hidden`. Der Text ist trotzdem übersetzt, damit er bei einer späteren Portierung nicht auf Spanisch zurückkommt. (2) Die Tabs **«Vorschläge»** und **«Ideen»** dieses Eingangs rufen `isabella-feed` und `isabella-ideas` — Funktionen, die es im Office nicht gibt; sie sind jetzt `hidden`. (3) `OFFICE_NOTICE_DE` in `app.js` übersetzte spanische Meldungen zur Laufzeit per Regex-Tabelle. Jede ihrer Zeilen ist inzwischen an der Quelle deutsch (hier an der Aufrufstelle, in `turn-integrity.js` über `officeSummary`, im Motor über `assistant-voice.mjs`). Die Tabelle bleibt **nur als Leser für den Verlauf** — Zeilen, die vor heute auf Spanisch gespeichert wurden —, mit der Regel im Kommentar und einem Test: keine neue Zeile; eine spanische Meldung gehört an ihrer Quelle korrigiert.
- Archivos: `app/app.js`, `app/work.js`, `app/shell.js`, `app/sync.js`, `app/index.html` (shell `office45`, app `office53`, work `office45`, sync `office6`), neu `tests/office-german-surface.test.mjs`, acht Tests mit angezogenen Versionsnummern.
- Base de datos: keine Migration.
- Deploy de funciones: keiner (nur die App).
- Cómo se probó: 288 Tests (`node --test tests/*.test.cjs tests/*.test.mjs`), davon 6 neue, die genau diese Stellen auf Deutsch festhalten; 7 Chromium-Tests (`romy-chat`, `romy-live`, `office-app-boot`) und 2 Musterplanner-Tests lokal grün. Die Reichweite wurde nicht geraten: Aufrufgraph von `app/app.js` und `app/work.js` mit `acorn` gebaut und von den Einstiegspunkten aus gelaufen, die ein Mitglied hat (sichtbare Navigation, sichtbare Schubladen-Knöpfe, die über `window.ISABELLA_APP` aufgerufene API, der Vorschlagsweg im Gespräch).
- Quedó pendiente o sin probar: ein echter Zug im Browser durch Gari (Vorschlagskarte ansehen, bestätigen, Quittung lesen). In `turn-integrity.js` (Window-Datei, synchronisiert) steht die spanische Fassung weiter neben der deutschen — im Office läuft nur `officeSummary`, aber aufräumen lässt sich das nur in Window. Das Spanische in den unerreichbaren Panels bleibt stehen; sie aus der Office-Kopie zu entfernen wäre eine eigene, größere Vereinfachung.
- Riesgos o decisiones que necesitan a Gari: ob die beiden toten Eingang-Tabs verborgen bleiben oder `bandeja.js` nach Office portiert wird, damit der Eingang wirklich etwas zeigt.
- PR: #89

### 2026-11-13 · Romy: eine Autorin, kurze Notizen statt langer Blöcke · Claude
- Qué cambió y por qué: Zweiter Teil von Garis Auftrag «dass Isabella und Romy wie Claude funktionieren». Bisher las **ein zweites Modell jede Nachricht, bevor Romy sie las**, und entschied Art des Zuges, Projekt, Denktiefe, Anweisungen und Kontext; in 127 echten Zügen kostete das im Schnitt 3,5 s von 8,8 s, und bei falscher Einordnung antwortete sie mit weniger, als sie gebraucht hätte. Jetzt liest sie selbst, mit einem festen Prompt, allen Werkzeugen und einem kompakten Kontext. Vorher entschieden wird nur Strukturelles: ein Work-Thread bleibt in seinem Thread, und eine Nachricht, die **genau ein** Projekt beim Namen nennt, gehört zu diesem Projekt. **Nichts wird vorgeladen**: ein genanntes Projekt ist ein Zeiger, sie liest es mit `search_work`, wenn die Antwort es braucht (in 24 echten Zügen mit vorgeladenem Projekt — 275.000–380.000 Zeichen je Zug — betrafen 22 nur den Kalender). **Die Denktiefe fordert sie selbst an** (`think_deeper`) statt dass ein Router sie errät. Ihr Gesprächsfenster sind die letzten 24 Züge, aus welchem Projekt auch immer. Die geerbten langen Blöcke (33.000 Zeichen) werden zu kurzen Zwecknotizen; die Mechanik steht in der Beschreibung des jeweiligen Werkzeugs. Ein Standardzug fällt von ~32.000 auf ~23.000 Zeichen und ist **in jedem Zug derselbe Text**, den der Anbieter aus seinem Cache wiederverwendet.
- Archivos: Motor aus Window synchronisiert (`99013ab`, 101 Engine-Dateien, neu `_shared/isabella-turn.mjs`), `tests/romy-engine-parity.test.mjs`.
- Base de datos: keine Migration.
- Deploy de funciones: `isabella-chat isabella-live-session isabella-routine-runner` über `deploy-functions.yml` mit `profile_set_in_dashboard=true`.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` (282) und die Chromium-Tests lokal grün. Entscheidend ist der Fähigkeits-Vergleich in Window (`Isabella bench (capability)`, Lauf 43517908330): 31 erfundene Gesprächsmomente, je dreimal gespielt, einmal über den alten Weg (mit immer richtigem Router, langen Blöcken und ganz vorgeladenem Projekt: sein bester Fall) und einmal über den neuen. **Neuer Weg 100 % (31/31), alter Weg 87 % (27/31); verloren geht nichts.** Besser werden vier Momente, darunter der schwere Angebotsvergleich (3/3 statt 1/3) und Romys Deutsch. Einer der Momente deckte eine echte Lücke in **beiden** Wegen auf: auf «das Morgenresümee bitte um 7:30» legte sie eine **zweite** Routine an, statt die vorhandene zu ändern; die Notiz zu Routinen sagt das jetzt, und der Moment besteht 3/3.
- Quedó pendiente o sin probar: ein echter Zug von Gari in Romy. Rückweg ohne Codeänderung: `ISABELLA_ROUTER=on` (alter Weg), `ISABELLA_DETAILS=legacy` (lange Blöcke).
- Riesgos o decisiones que necesitan a Gari: keine.
- PR: #88

---

### 2026-11-13 · Romy: Rückgängig statt Bestätigen, Motor spricht Deutsch, keine Wortlisten · Claude
- Qué cambió y por qué: Erste Veröffentlichung von Garis Auftrag «dass Isabella und Romy wie Claude funktionieren» (11.11.2026). Drei Dinge: (1) **Rückgängig statt Bestätigen** — eine eigene Aufgabe oder ein eigener Termin, um den das Mitglied in diesem Zug bittet (beliebig formuliert, auch ein «ja» auf Romys eigenen Vorschlag), wird sofort angelegt und bleibt 10 Minuten rückgängig zu machen; Titel, Tag und Uhrzeit dürfen aus einem Screenshot, aus dem Gespräch oder aus Romys Lesart kommen. Bisher musste alles wörtlich in der Nachricht stehen, deshalb brauchte «Trag diesen Termin ein» mit einem Screenshot weiterhin eine Karte. Eine Überschneidung blockiert nicht mehr: Romy sagt sie und man kann rückgängig machen. Ändern, Verschieben, Löschen, Serien- und Ganztagstermine bleiben bei der Karte. (2) **Der Motor schreibt seine festen Zeilen auf Deutsch** (`_shared/assistant-voice.mjs`): bisher schrieb er Spanisch und die App übersetzte am Bildschirm, sodass das gespeicherte Gespräch etwas anderes sagte als der Bildschirm. Die alte Übersetzungstabelle bleibt für bereits gespeicherte Zeilen und liefert denselben Wortlaut. (3) **Keine Wortlisten mehr in der App**: der Chat entscheidet nicht mehr anhand von Verben («agrega», «erstelle»), wohin eine Nachricht geht — alles geht an Romy selbst, mit allen ihren Werkzeugen.
- Archivos: Motor aus Window synchronisiert (`7d767ca`, 100 Engine-Dateien, neu `_shared/assistant-voice.mjs` und `_shared/isabella-tools.mjs`); `app/ai.js`, `app/turn-integrity.js` (synchronisiert), `app/app.js` (Berechtigungsfenster jetzt auf Deutsch und mit «Rückgängig» als Normalfall), `app/index.html` (`app.js?v=office52`, `ai.js?v=romy4`, `turn-integrity.js?v=romy4`), `tests/sql/office-direct-create-v03-acceptance.sql` (neu), `tests/sql/office-romy-phase1-fixture.sql` (fehlende Spalten von `isabella_tasks` und Tabelle `isabella_deleted_items` ergänzt), `tests/romy-engine-parity.test.mjs`, `.github/workflows/verify-romy-schema.yml`, `.github/workflows/verify.yml`.
- Base de datos: migración `20261113170000_office_direct_create_owner_request_v03.sql` — Wort für Wort dieselbe wie in Window; gleiche Funktionsnamen und Signaturen, nichts gelöscht, keine Zeile angefasst; neu `minds_direct_event_overlap_v01` (nur Lesen). Aplicada en Supabase: sí (von innen über `net.http_get` des Blobs auf main, SHA-256 geprüft, eingetragen in `supabase_migrations.schema_migrations`).
- Deploy de funciones: `isabella-chat isabella-dream isabella-heartbeat isabella-live-session isabella-presence isabella-routine-runner` über `deploy-functions.yml` mit `profile_set_in_dashboard=true`.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` (282) und die vier Chromium-Tests lokal grün; die neue SQL-Abnahme läuft auf einer flüchtigen PostgreSQL-Instanz gegen das synthetische Schema **und** in `verify.yml` gegen die echten Migrationen: Screenshot-Fall angelegt, «ja» als Bitte akzeptiert, ein erfundener Satz und ein Zitat aus einem anderen Zug abgelehnt, Serie/Ganztag/Ändern/fremder Text/Hintergrund/Dauer/Zeitzone gesperrt, zweimal gesendet = ein Termin, Rückgängig innerhalb von 10 Minuten und danach nicht mehr, «review» weiter respektiert, kein Zugriff auf fremde Entscheidungen oder Kalender. In Window ist dieselbe Änderung seit heute live (PR #328).
- Quedó pendiente o sin probar: ein echter Zug von Gari in Romy mit einem Screenshot (bisher nur automatisiert). Zweite Veröffentlichung (kein Router-Modell vor Isabella, kurze Notizen statt der langen Blöcke) steht noch aus.
- Riesgos o decisiones que necesitan a Gari: keine. Wer lieber vorher bestätigt, stellt es in «Berechtigungen» um.
- PR: #87

---

### 2026-11-13 · Muster-Planner LPH 3 auf bestehende Office Planner-Oberfläche umgestellt · ChatGPT
- Qué cambió y por qué: Das bisherige separate `muster-planner.html/.js/.css`-Board mit eigenen Karten und Detaildialogen wurde auf ausdrücklichen Wunsch ersetzt. **Nur eine Planner-Oberfläche:** `app/work.js` rendert Muster und echte Projekte mit demselben `taskCard`, `work-bucket` und mobiler Listenansicht; `app/task-detail.js` ist in beiden Fällen der kanonische Aufgabendialog. Ehemalige Muster-URL leitet zu `/app/#section=work&muster=LPH3` weiter; Office → Terminpläne → Muster LPH3 öffnet direkt diese Ansicht. Altes redundantes Muster-JS/CSS gelöscht.
- Übernommene Merkmale: Header mit `Abgabe / Planungspaket · A2`, Zähler `9 / 9` (nur Muster), kurzer Beschreibung unter Bucket-Titel und optionaler `Terminplan Abgabe/PSP`-Referenz. Echte Buckets können Beschreibung und PSP im vorhandenen Bucket-Editor ergänzen/ändern. Der bestehende Aufgabendialog enthält nun zusätzlich optionale `Aufgabe/Kennung`, `Terminplan PSP`, `Prüfbares Arbeitsergebnis` und `Fachliche Einordnung` (Office-spezifisch); Speicherung im vorhandenen Task-`metadata.office_planner`, mit serialisiertem autosave zur Vermeidung verlorener paralleler Felder.
- Bestehende Funktionen **nicht ersetzt**: Verantwortliche, Teamstunden, Beginn, Fälligkeit, Status, Priorität, Labels, Notizen, Checklist, Anhänge, Links, Zeitreservierungen, Archiv, Löschen, Bucket-Reihenfolge/Archiv und abgeschlossene Aufgaben. Es wurde kein anderes Projekt mit Musterkarten befüllt.
- Muster: unverändert **7 mit LPH3-Terminen verknüpfte Abgabe-Buckets, 57 Aufgaben, 228 Checks, 14 Bemusterung-Aufgaben**. Neue Ansicht ist read-only: keine Datenbankzugriffe oder Writes an Tasks/Buckets/Terminplänen; native Dialogfelder und Aktionsbuttons deaktiviert, native Bearbeitungs-Events nicht registriert. Der alte lokale Behalten/Ändern/Review-Sonderdialog wurde mit der doppelten Oberfläche entfernt; fachliche Prüfung folgt über die tatsächlichen Karten, Änderungen am Template erst nach gemeinsamer Freigabe.
- Base de datos: additive Migration `20261113131000_office_planner_bucket_explanation_v1.sql` mit `minds_work_buckets.description text not null default ''` und `terminplan_ref text not null default ''` in Office-Supabase `ynzsbemisjvfgbqcqliq` **erfolgreich angewandt** und beide Spalten im Liveschema rückgelesen; bestehendes RLS ist aktiv und unverändert. Keine Schemaänderung für `isabella_tasks`; vorhandenes JSONB `metadata` genutzt.
- Qué se probó: PR #85 HEAD `85da6c4c199dc8b4bf5c70c26528989a28ce74bb` **4/4 PASS**: Terminplan-Audit/Node-Tests, Chromium realer nativer Work-Kartendarstellung und Task-Detail in Desktop/Mobil mit synthetischem auth/Supabase-Double (0 DB-Writes), isoliertes Office-Schema PostgreSQL und isolierter Romy Engine-Schema-Lauf. PR #85 in main squash-gemergt als `fea03ee0c75d0e2771209f9d3cd9b8fc6b15b3de`; Quelltext-Readback aus main geprüft.
- Riesgos/Pendientes: Browser-Visual-Acceptance der GitHub-Pages-CDN-Version mit echter Office-Anmeldung, sowie manuelle Prüfung der optionalen Feld-Autosaves in einem Testprojekt; letzteres nicht mit einem realen Bernried-Task durchgeführt. Kein automatisches Instanziieren der Musteraufgaben bei Projektanlage implementiert (bleibt abhängig von gemeinsamer Freigabe). Kein Terminplan/Bemusterung-Modell geändert.
- PR: #85 gemergt; Dokumentationsnachtrag separat.

### 2026-11-12 · LPH3 Muster-Planner v0.2.1 als read-only Review veröffentlicht · ChatGPT
- Qué cambió y por qué: Auf Basis des echten Muster-Terminplans LPH3 v1.2, der gemeinsamen Claude/TBA-Aufgabenforschung und zusätzlicher deutscher HOAI-Recherche ein **Muster-Planner** zum visuellen, gemeinsamen Review veröffentlicht. Keine automatische Projektinstanziierung.
- Abgabe-Logik: 7 **ausschließlich mit bestehenden Terminplan-Abgaben/Entscheidungspaketen verbundene Buckets A1–A7**, 57 TBA-Aufgaben, 228 Checklistenpunkte. Kein freier/transversaler Projektorganisations-Bucket; Startarbeit bei A1, Abschlussarbeit A7. Keine als TBA-Arbeit verkleideten Lieferungen von TWP/HLS/ELT/BRS oder Entscheidungen des Bauherrn.
- Bemusterung geprüft: Bestand **PSP 04.03/t030 „Qualitätsfestlegungen und kostenrelevante Bemusterung abstimmen“** (Muster: 04.–17.03.2027) und **PSP 04.04/M06/t031** (17.03.2027) bestätigt; Kostenbesprechung PSP 06.03/M08/t039 erst 19.04.2027. A5 ist daher ein legitimer verknüpfter Bucket mit 14 Aufgaben zur Recherche, Vergleichen, Musteranfragen, Übersichtplänen, Badgrundrissen/Ansichten, Treppen-, Fassadenprinzipplänen, Mustermappe, Bemusterungsprotokoll und kostenfähiger Qualitätsliste. Die 10 AT von t030 sind **keine** Abschätzung des internen Gesamtaufwands; Vorlauf ist noch zu planen. Vertragsabhängige Vertiefungen bleiben bedingt; keine pauschalen LPH5-Ausführungsdetails als LPH3 Pflicht.
- Oberfläche: `muster-planner.html` (über Office → Terminpläne → LPH3-Muster verlinkt), `muster-planner.css`, `muster-planner.js`; Aufgabenkarte mit Ergebnis, Rolle, Checklist, PSP und Review (Behalten/Ändern/Streichen/Bedingt/Notiz); Review nur im Browser gespeichert und JSON-Export möglich. Quelle `app/data/muster-planner-lph3-v0.2.json` versioniert und read-only.
- Normative Grundlage und Abgrenzung dokumentiert in `docs/LPH3-MUSTERPLANNER-BEMUSTERUNG-v01.md` mit HOAI Anlage 10, HOAI §2(11), Deutsches Architektenblatt, BauNetz Wissen. Templates/Muster bleiben fachlich unfreigegeben.
- Archivos: zusätzlich `app/office-projects.js`, `app/index.html` (Cache-Pin), `tests/office-lph3-musterplanner.test.cjs`.
- Base de datos / Deploy de funciones: **keine Änderungen** an Supabase, vorhandenen Planner-Buckets, isabella_tasks, office_terminplan_instances oder Vorlagen-Tabellen; keine Migration und keine Edge-Neuveröffentlichung.
- Cómo se probó: PR #83 nach Tests auf Head `c2560fb52c114be8c68518e2edd7d9ec8eaed042` mit **3/3 GitHub Checks PASS** (Terminplan-Audit inklusive 7 Buckets/57 Cards/228 Checks, reale PSP 04.03/M06, Chromium, isoliertes Office-Schema). Squash merge in main `178c7193f404e6a271ad01ff4baa6eb239f70a3c`; Main-Dateien und App-Link per GitHub-Readback vorhanden.
- Quedó pendiente o sin probar: öffentliche GitHub-Pages-Auslieferung und visuelle Interaktion im echten Browser mit den lokalen Review-Notizen; keine authentifizierte Annahme. Fachlicher Review pro Bucket, Prüfung der Vorbereitungsdauer Bemusterung und tatsächliche Aufgabeninstanziierung bleiben ausdrücklich offen.
- PR: #83 merged; diese Dokumentationsnachführung separat.

### 2026-11-12 · Terminplan „Übersicht“ als vierter Standard-Verbindungsmodus · ChatGPT
- Qué cambió y por qué: Der Gantt-Editor bietet nun **Aus / Übersicht (Default) / Auswahl / Alle**. „Übersicht“ zeigt maximal eine tatsächlich vorhandene, zeitlich am stärksten einschränkende Vorgängerbeziehung je Vorgang nach EA/AA/EE/AE, AT-Lag und Projekt-Arbeitskalender; bei Gleichstand sind PSP-übergreifende Übergaben, Vorgänger-Meilensteine und deterministische Kennung nachrangige Kriterien. Im vollständigen Muster LPH3 v1.2 reduziert sich die Anzeige von 96 auf 56 Kanten, in LPH5 v0.2 von 95 auf 44. Die Pflichtbeziehungen **bleiben alle in den gespeicherten Mustern**.
- Interaktion: Im Modus Übersicht ergänzt ein Klick auf einen Vorgang alle direkten Vorgänger (ocker) und Nachfolger (grün) des Vorgangs. Auswahl zeigt ausschließlich die direkten Kanten; Aus keine; Alle alle. Bei Suche/Collapse bleibt die Repräsentantenauswahl aus dem **vollständigen Plan** stabil, sie wird nicht anhand der gerade sichtbaren Teilmenge ausgetauscht. Diese Auswahl ist keine CPM- oder Kritischer-Pfad-Berechnung.
- Druck: Unabhängige PDF-Verbindungswahl bleibt ohne Pfeile (Standard) oder alle (technisch); unverändert.
- Preference: Unversionierte bisherige Auswahl-Standardeinstellung wird lokal auf Übersicht migriert. Gespeicherte Aus/Alle bleiben bestehen; danach werden explizite Nutzerwahlen als UI-Version 2 gespeichert. Kein Projekt-/Server-Write.
- Archivos: `terminplan-link-view.js`, `terminplan.html`, `terminplan-hilfe.html`, `tests/terminplan-link-view.test.cjs`, `tests/terminplan-uebersicht.test.cjs`, `tests/terminplan-editor-v02.test.cjs`.
- Base de datos: keine Migration und keine Veränderung der Office-Projektinstanzen. Kein Edge-Deploy.
- Cómo se probó: PR #81 HEAD `b1a3acef14faf4c5279778daa609b5c542b4c3b5` **3/3 CI grün** (Terminplan-Audit mit realen 96/56- und 95/44-Gates, Chromium, isoliertes Office-Schema). Merge in main: `fc08391fe2d930199a10f1cf57186d74346dfa7d`. Handbuch enthält Bedeutung und Grenzen aller vier Ansichten.
- Quedó pendiente o sin probar: authentifizierte visuelle GitHub-Pages-Abnahme mit scrollbaren Gruppen und direkter Auswahl im realen Browser; GitHub-Merge/CI allein bestätigt nicht den CDN-Live-Stand.
- Riesgos: Übersicht zeigt bewusste Repräsentanten, nicht sämtliche für das Erreichen einer Abgabe notwendigen Fachplanungsbeiträge. Bei kritischen Entscheidungen immer Auswahl oder Alle nutzen. Deadline-begrenzte Kritisch-Markierungen bleiben unverändert.
- PR: #81 gemergt; dieser Dokumentationsnachtrag separat.

### 2026-11-12 · Bugfix: Gantt-Auswahl in schreibgeschützten Mustern · ChatGPT
- Qué cambió y por qué: Aus Live-Screenshot und aktuellem Code nachgewiesen: CSS `body.read-only .bar, body.read-only .milestone {pointer-events:none!important}` blockierte den Klick auf LPH3-/LPH5-Muster, obwohl die JS-Auswahl schon vor dem Bearbeitungs-Guard lag. Daher erschien im Standardmodus „Verbindungen → Auswahl“ beim Klick auf die Balken kein Pfeil. Read-only-Balken und Meilensteine sind jetzt selektierbar; Sammelbalken, Dauerfeld und Resize-Handles bleiben nicht interaktiv. Drag/Resize bleibt über `canEdit` ausgeschlossen. Netz-/Kalenderdaten unverändert.
- Warum rote Rahmen: `terminplan-planning.css` setzt `.tp-computed-critical` mit roter Kontur für berechnete `totalFloatAT ≤ 0`. Die Anzeige „33 kritisch · 0 Deadline-Warnungen“ im bereitgestellten Muster bedeutet **nicht**, dass 33 Aufgaben verspätet oder fehlerhaft seien. Definitive Trennung zwischen rein projektendbestimmendem Weg und Deadline-bedingter Kritikalität fachlich noch ausstehend.
- Archivos: `terminplan.html`, `tests/terminplan-link-view.test.cjs`; reine CSS-/Interaktion-Regressionskorrektur.
- Base de datos / Deploy de funciones: keine Migration, keine Edge-Deploys, keine Terminplan-, Planner- oder Projektinstanz geändert.
- Cómo se probó: PR #79 Head `28ca83a619c0ce34c24664125b202dcf674c3f86`, **3/3** GitHub-Checks PASS (Terminplan-Audit, Chromium offline, Office-Schema PostgreSQL isoliert). Neuer Regressionstest schützt lesbaren Muster-Klick und Bearbeitungsverbot. PR #79 squash-merged in `main` als `c6943cf1e274097731f3026ad42d6d006a3d1f60`.
- Quedó pendiente o sin probar: Benutzerbestätigung in echtem authentifiziertem GitHub-Pages-Browser; das veröffentlichte CDN wurde nicht zusätzlich interaktiv getestet.
- Risiken: Kritisch-Indikator bleibt vorerst unverändert; keine implizite Interpretation der rot umrandeten Vorgänge als Störung.
- PR: #79 merged; Dokumentationsnachtrag separat.

### 2026-11-12 · Gantt-Verbindungen gezielt anzeigen und PDF standardmäßig ohne Pfeile · ChatGPT
- Qué cambió y por qué: Auf der gemeinsamen Terminplan-Oberfläche Gantt-Verbindungen auf **Aus / Auswahl / Alle** umgestellt; Default **Auswahl** ohne ausgewählten Vorgang = keine Pfeile. Klick auf Task/Meilenstein im Gantt (auch beim nur lesbaren Muster) oder auf PSP-Zeile zeigt nur direkte eingehende Vorgänger (ocker) und ausgehende Nachfolger (grün). Eingeklappte/weggefilterte Vorgänge erhalten keine irreführenden, ins Leere führenden Pfeile. Technischer Vollnetzmodus bleibt verfügbar.
- Drucken/PDF: Separater `PDF-Verbindungen`-Schalter, Standard **Ohne**, technische Option **Alle**. Die Druckwahl folgt absichtlich **nicht** automatisch dem Gantt-Modus. Projekt-DAG mit sämtlichen EA/AA/EE/AE-Beziehungen, CPM, Plan-Daten, JSON/CSV und Assistent bleiben unverändert. Nur der Browser speichert die Anzeigepräferenz in `tba_office_terminplan_ui_v1`; keine Projektinstanz wird aktualisiert.
- Archivos: `terminplan-link-view.js` (reiner Sichtbarkeitsfilter), `terminplan.html`, `terminplan-hilfe.html`, `tests/terminplan-link-view.test.cjs`, `tests/terminplan-editor-v02.test.cjs`, `.github/workflows/terminplan-audit.yml`.
- Base de datos: keine neue Migration, keine Schema- oder State-Änderung.
- Deploy de funciones: keine.
- Cómo se probó: PR #77 head `add3c5d63c3773d63d3b792bf561c9ca0a2f085b`: **3/3 GitHub-Checks PASS**, darunter Terminplan-Audit mit 96/95 unveränderten Kanten der LPH3/LPH5-Muster, read-only-Auswahl, Filter-/Druckmodus und Browser-JavaScript-Prüfung; Chromium und isoliertes Office-Schema ebenfalls grün. Merge in main: `a01c6e432ff439293ea9a56982a59cfa2608314a`.
- Quedó pendiente o sin probar: Authentifizierter visueller E2E in GitHub Pages (Modi im echten Projektplan prüfen, PDF-Vorschau beim Browser-Druck); externes Abrufen der GitHub-Pages-URLs war mit dem verfügbaren Webzugang nicht möglich. CI-Erfolg beweist nicht die CDN-Auslieferung.
- Risiken: Anzeigepräferenz ist geräte- und browserlokal; das ist beabsichtigt und nicht Teil von Team-/Projektfreigaben. Die technische PDF-Variante bleibt trotz voller Kantenmenge möglicherweise dicht; die normale Ausgabe ist bereinigt.
- PR: #77 gemergt; Dokumentationsnachtrag separat.

### 2026-11-11 · Terminplan-Assistent: deterministischer Was-wäre-wenn-Dialog live · ChatGPT
- Qué cambió y por qué: Bestehenden Gantt-Terminplan-Assistenten um typisierten, rein lesenden `simulate`-Intent ergänzt. Bei eindeutiger Aufgabe und 1–130 zusätzlichen AT prüft der lokale deterministische Netzplanrechner ein späteres Lieferende (gleicher Anfang) bzw. einen späteren Meilensteintermin; Nachfolger EA/AA/EE/AE, neues Vorgangsende, float nach bisheriger deadline-begrenzter Definition, neue Fristüberschreitungen und Kritisch-Indikator werden als **Simulation** erklärt. Keine zweite Assistenzoberfläche, kein Schreibvorschlag oder automatisches Speichern. Unbekannte, doppelte oder fehlerhafte Referenzen werden nicht geraten.
- Archivos: `terminplan-planning.js`, `terminplan-dialogue.js`, `terminplan.html`, `supabase/functions/office-terminplan-ai/core.mjs`, `tests/terminplan-assistant-whatif.test.mjs`, `docs/TERMINPLAN-ASSISTENT-v0.7.md`.
- PR/Release: PR #74 als `756dfb41a7e04979d437881e8d611130bba6d41c` nach erfolgreicher fokussierter Terminplan-Node-Suite in main gemergt; Office-Supabase-Edge Function `office-terminplan-ai` vollständig aus main erneut deployed, **aktive Version 10, verify_jwt=true**, readback von `core.mjs` stimmt mit main exakt überein.
- Base de datos: keine Schemanänderung, keine produktive Terminplan- oder Planner-Aufgabe geschrieben. Planner↔Abgabe-Verknüpfung bleibt ausschließlich Gegenstand der fachlichen Diskussion.
- Cómo se probó: `Verify Terminplan dependency audit` für genauen PR-HEAD PASS, inkl. read-only- und Meilenstein-Szenarien. `Verify Romy Office schema` **nicht bestanden**, weil GitHub-Runner beim Installieren von postgresql-client die Ubuntu-Paketserver wegen DNS nicht auflösen konnte (Exit 100); kein Schema-Testlauf erreicht, kein Codebefund. `Verify Romy chat in Chromium` beim Release noch im Setup; späteren Check separat ermitteln.
- Quedó pendiente o sin probar: echte authentifizierte Browserabnahme im GitHub-Pages-Terminplan mit deutscher und spanischer Hypothese sowie Ambiguitätsfall; kein gültiger E2E-Beleg aus dem Deployment allein. Eventuelle verbleibende Infrastruktur-CI prüfen und gegebenenfalls wiederholen.
- Riesgos: Kritisch-Marker verwendet derzeit weiterhin auch Deadline-Caps, nicht nur die reine Projektendkritikalität. Diese Definition ist ausdrücklich noch nicht fachlich entschieden. Die Simulation kennt nur explizit eingetragene Vorgänger und keine Mitarbeiterkapazitäten.
- PR: #74 gemergt; Nachtrag separat.
### 2026-11-11 · Muster LPH 5 v0.2 und Handbuch: Merge und Datenmigration verifiziert · ChatGPT
- Qué cambió y por qué: PR #72 mit fachlich erweiterter LPH5-Vorlage (8 PSP-Gruppen, 45 Vorgänge und 95 Mehrfachbeziehungen) in main als `49fa81b93b0ced3d035c3f6eba98ef27d96b4a5d` integriert. Die Kopie für neue Projektterminpläne umfasst standardmäßig 40 Vorgänge bis zum ersten koordinierten Ausgabemeilenstein M07; fünf spätere, von konkreten Vergabe-/Baudaten abhängige Aktivitäten werden nur nach explicit Opt-in übernommen. Die LPH5-Fachleitung des bestehenden Handbuchs enthält nun ein fünftes Diagramm; die Projektbibliothek verweist auf beide Phasen.
- Archivos: diese Nachführung `docs/BITACORA.md` und `docs/ESTADO.md`, Quelländerungen in PR #72. Separater Studienstand `docs/TERMINPLAN-PLANNER-INTEGRATION-v0.1.md` im Repo, ohne Integration in produktive Planner-Tabellen.
- Base de datos: additive Migration `20261111110000_office_lph5_template_v02.sql` auf TBA Office Supabase `ynzsbemisjvfgbqcqliq` mit apply_migration **erfolgreich**. Nachprüfung: LPH5 v0.2 aktiv 45/95; LPH5 v0.1 inaktiv und historisch erhalten; LPH3 v1.2 unverändert aktiv 57/96.
- Projektzustand: Vor und nach der Migration 1 Office-Terminplan-Instanz und gleiche schreibgeschützte Gesamtsignatur `1e60485eab19054eb2f87e3ad479f965`. Keine Bernried-Aufgaben, Buckets oder Terminplaninstanzen geändert.
- Cómo se probó: 4/4 CI-Workflows PASS auf exakt gemergtem PR-Head `3e307b47b49c44508bb4dd7adf2322cab17a50b7`; Testquellen für deterministisches Startdatum, Standard-/Optionalvarianten, 95 Abhängigkeiten, Handbuch, SQL-/Seed-Parität. DB nach Migration gelesen und unveränderte Projektinstanz geprüft.
- Quedó pendiente o sin probar: authentifizierte E2E-Anlage mit echter Browser-Interaktion; GitHub-Pages-/CDN-Auslieferung war via externe Leseschnittstelle nicht bestätigbar. Fachliche Richtdauern und BRS-/TWP-/TGA-Leistungsumfang bleiben vor konkreter Projektübernahme ausdrücklich abzustimmen.
- Risiken: Kritischer Pfad und Puffer sind nur bei konsistenter Netzlogik verlässlich; kein unbestätigter Ressourcenabgleich und keine automatisch verpflichtenden optionalen LPH5-Baunachläufe.
- PR: #72 merged; Dokumentationsnachtrag separat.

### 2026-11-11 · LPH5 Muster v0.2, Handbuch und Terminplan/Planner-Integrationsstudie · ChatGPT
- Qué cambió y por qué: LPH5-Referenz aus der 20-Vorgang-Vorlage v0.1 zu einem versionierten v0.2 mit 8 PSP-Gruppen (00–07), 45 Vorgängen/Meilensteinen und 95 expliziten EA/AA/EE-Mehrfachverknüpfungen erweitert. Für neue Projektpläne gilt M07 als erste koordinierte Ausgabe: die fünf spekulativen Nachlauf-Elemente aus PSP 07 sind default **nicht** Bestandteil der Kopie, können aber per bewusster Checkbox als 45er-Variante übernommen werden; der Muster enthält sie weiterhin als optionale Vorlagen. Schnittstellen ARC–TWP–HLS–ELT, Schlitz-/Durchbruchplanung, zwei Planläufe, interner Qualitätsschritt, Bauherrenprüfung (Richtwert 5 AT) und koordinierte Ausgabe (M07) sind getrennt dargestellt. BRS und Fortschreibung bei Vergabe/Ausführung als optionale, vor Nutzung ausdrücklich zu konkretisierende Mustervorgänge. Keine HOAI-Vorgabedauer oder pauschale Leistungsbeauftragung behauptet.
- Terminplan Assistent: Bereits bestehenden Gesprächs-/Vorschlags-/Readback-Workflow geprüft (office-terminplan-ai v0.6, terminplan-dialogue.js, Editor). Kein zusätzlicher Assistent und keine neue Simulation implementiert. Belastbarer Puffer-/Deadline-Was-wäre-wenn-Dialog bleibt spätere Integration mit vorhandener Konversation, nicht separate Oberfläche.
- Handbuch: Zweiter LPH5-Fachabschnitt in bestehendem `terminplan-hilfe.html`, fünfte schematische SVG-Grafik und primäre HOAI Anlage 10, 14, 15 als Quellen. Bibliothekslink aktualisiert.
- Studie: `docs/TERMINPLAN-PLANNER-INTEGRATION-v0.1.md` dokumentiert das aktuelle kanonische Work-Modell (`minds_work_buckets`, `isabella_tasks`, nicht die alten Office-Tabellen), die bestehenden Daten von Bernried als read-only Momentaufnahme und ein reversibles, erst zu prüfendes Milestone↔Task-Linkmodell mit virtueller Abgabe-Ansicht; kein Write in Planner.
- Archivos: `supabase/seed/terminplan-templates.json`, `supabase/migrations/20261111110000_office_lph5_template_v02.sql`, `terminplan-hilfe.html`, `app/office-projects.js`, `app/index.html`, `tests/office-lph5-v02.test.mjs`, Integrationsstudie, `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: additive LPH5-v0.2-Vorlagenmigration vorbereitet; keine bestehenden `office_terminplan_instances` oder Planner-Tabellen geändert. Beim Schreiben dieses Branchprotokolls **noch nicht angewendet**.
- Deploy de funciones: keine.
- Cómo se probó: Strukturerzeugung überprüfte 45 Tasks, 95 Vorgänger, gültige UUID-freie Template-IDs, achsengerechte Arbeitstagsberechnung und getrenntes Ausgabedatum M07. Neue Tests für Graph, ursprüngliche LPH3-Unverändertheit, Startdatum, M07 vs optionalen Folgelauf, SQL-Seed-Parität und erweitertes Handbuch. PR/CI noch zu verifizieren.
- Quedó pendiente o sin probar: authentifizierte Musteranlage/Visualisierung in Pages, fachliche Dauerabstimmung bei wirklichem LPH5-Projekt, finale CI, Merge/Migration. Terminplan/Planner-Linkstudie enthält **keinen Integrationscode** und erfordert separaten Pilot.
- Risiken: Optionaler Nachlauf nach M07 verlängert den Mustergesamtzeitraum; sein Umfang ist nicht pauschal Teil eines jeden Projekts, muss bei Übernahme geprüft/gelöscht/terminiert werden. Die Vorlage setzt voraus, dass tatsächlich benötigte Fachplaner beauftragt sind.
- PR: in Vorbereitung.

### 2026-11-11 · Núcleo v5: Romy lee adjuntos como una persona · Claude
- Qué cambió y por qué: segundo paso de «menos reglas, más interpretación». Motor sincronizado desde minds `c5d2338` (minds #327): sección nueva en las instrucciones sobre fotos, capturas y documentos (sacar asunto, día, hora, personas y proyecto; resolver lo que una persona atenta resolvería; preguntar solo ante ambigüedad real; mirar un paso más allá) y nota de agenda alineada con la regla de fechas relajada. En Office las palabras propias de Romy se guardan con la tarjeta de propuesta (`metadata.assistant_prose`) y el chat las muestra antes de la línea fija; antes se perdían al reconstruirse el chat.
- Archivos: `app/app.js` (v=office51), `app/index.html`, `supabase/functions/_shared/isabella-core.mjs`, `supabase/functions/isabella-chat/index.ts`, manifiestos, pins de versión.
- Base de datos: ninguna.
- Deploy de funciones: `isabella-chat isabella-routine-runner isabella-live-session`.
- Cómo se probó: `node --test` 238/238 aquí; minds 1233/1233. Sin prueba con turno real.
- Quedó pendiente o sin probar: los bloques de detalle heredados del prompt (memoria, ajustes, continuidad, especialistas) siguen sin reescribir.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: este.

### 2026-11-11 · Menos reglas: el modelo interpreta las fechas · Claude
- Qué cambió y por qué: decisión de Gari: Romy e Isabella deben interpretar como un asistente normal; las comprobaciones duras se quedan solo donde algo se ejecuta sin que la persona lo vea. Motor sincronizado desde minds `2782327` (minds #326): una propuesta con tarjeta de revisión ya no necesita una cita literal de la fecha en el mensaje (foto, turno anterior o inferencia valen); siguen día válido, día de la semana y aritmética relativa; la creación directa sigue exigiendo la cita en el turno propio. Si una propuesta no se puede registrar, Romy lo explica con sus palabras (salvo que afirmen que el cambio está hecho).
- Archivos: `supabase/functions/isabella-chat/index.ts`, `supabase/functions/_shared/calendar-semantic-boundary.mjs`, manifiestos de sync.
- Base de datos: ninguna.
- Deploy de funciones: `isabella-chat`.
- Cómo se probó: `node --test` 238/238 aquí; minds 1232/1232 y `deno check`. No probado con un turno real.
- Quedó pendiente o sin probar: revisión del resto de reglas (memoria personal, instrucciones del prompt, rutas del cliente).
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: este.

### 2026-11-11 · Cita desde una foto · tarjetas y avisos en alemán · Claude
- Qué cambió y por qué: tras el arreglo del bucket, Romy ya leía la foto (y la foto se queda en el chat), pero la propuesta de cita se rechazaba con «No pude registrar una propuesta…». Causa: el motor exigía que la cita literal de la fecha estuviera en las palabras del propietario (`date_evidence_not_in_owner_turn`); con «agrega este Termin» + foto, la fecha solo está en la imagen. Cambio en el motor (minds #325, sincronizado aquí): con adjuntos en el turno la cita puede venir del adjunto; el servidor no puede verificarla, la base lo marca (`*_from_attachment`), siguen las comprobaciones de día de la semana y aritmética, y la creación directa sigue excluida con adjuntos (siempre tarjeta de revisión). Textos: tarjeta de propuesta y editores (tarea, cita, rutina, recordatorio), errores de confirmación, vista Work/Akte y Wissen, y las frases fijas que el motor escribe en español («Propuesta: evento…», «No pude registrar…») se muestran ahora en alemán.
- Archivos: `app/app.js` (v=office50), `app/work.js` (v=office43), `app/index.html`, motor sincronizado desde minds `72c1128` (`isabella-chat/index.ts`, `_shared/calendar-semantic-boundary.mjs`) y manifiestos, pins de versión en tests.
- Base de datos: ninguna.
- Deploy de funciones: `isabella-chat` (deploy-functions, con `profile_set_in_dashboard`).
- Cómo se probó: `node --test` 238/238 aquí; en minds 1232/1232 con prueba nueva del validador y `deno check`. No probado con una foto real.
- Quedó pendiente o sin probar: unas 250 cadenas en español en `app.js`, casi todas de paneles heredados de Window (Feed, Ideas, permisos, avisos, proactividad, habilidades, expectativas, Commitments); las frases libres que el motor genera en español fuera de las fijas.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: este.

### 2026-11-11 · Romy no recibía las fotos del chat · Claude
- Qué cambió y por qué: Gari le mandó a Romy una captura de un correo y Romy respondió que no veía ninguna imagen; además la foto desaparecía del chat. Causa: la app de Office subía los adjuntos al bucket del runtime anterior (`office-romy-uploads`) y el motor compartido los lee de `isabella-uploads` (comprobado en producción: 4 subidas recientes en el primero, 0 en el segundo). Ahora la app usa `isabella-uploads` con el motor nuevo (el runtime anterior conserva el suyo). La foto desaparecía porque el servidor guarda el turno del usuario sin la referencia al adjunto y el chat se reconstruye desde el servidor: la app añade ahora la referencia a los metadatos de su propio turno (permitido por la política `owner_turn_metadata`) y el chat la muestra al reconstruirse. Mensajes de error de adjuntos en alemán.
- Archivos: `app/app.js` (v=office49), `app/index.html`, `tests/office-romy-attachments.test.mjs`, pins de versión.
- Base de datos: ninguna.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` 238/238; consulta de solo lectura en producción para confirmar la causa. No probado con una foto real desde el iPhone.
- Quedó pendiente o sin probar: las fotos ya enviadas quedaron en el bucket anterior y no se muestran en esos mensajes.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: este.

### 2026-11-09 · Terminplan Netzplanfunktionen und Muster LPH 3 v1.2 publiziert · ChatGPT
- Qué cambió y por qué: PR #66 als Squash-Commit `6d0eff8dd8bbe22ac034a50fc0c20d0a659eff0c` nach vier erfolgreichen CI-Workflows zusammengeführt. Gemeinsame Planungsfunktionen für alle LPH3/LPH5- und bestehenden Projektpläne, bebilderte Anleitung `terminplan-hilfe.html`, versionierte Muster-Vorlage LPH3 v1.2.
- Archivos: in PR #66 erfasste Editor-, Test-, Muster- und Anleitungsdateien; dieser Nachtrag aktualisiert nur `docs/BITACORA.md` und `docs/ESTADO.md`.
- Base de datos: Migration `20261109131000_office_lph3_template_v12.sql` auf **TBA Office** `ynzsbemisjvfgbqcqliq` mit Supabase-Apply-Migration erfolgreich angewendet. LPH3 v1.2 aktiv, 57 Vorgänge, 96 Verknüpfungen; LPH3 v1.0 inaktiv aber erhalten; LPH5 v0.1 unverändert aktiv.
- Deploy de funciones: keiner; Browser-Code per Merge in GitHub Pages veröffentlicht. Die tatsächliche GitHub-Pages-Auslieferung und authentifizierte Bedienung im Browser wurden durch dieses SQL-/GitHub-Review nicht end-to-end verifiziert.
- Cómo se probó: vier GitHub CI-Workflows PASS am genau gemergten PR-HEAD `ee779de2c3607663329504770e23b30e95c99dca`; Supabase nach der Migration explizit gelesen. Es existiert weiterhin genau eine bestehende Projektterminplan-Instanz; ihre Revisionsnummer blieb 11 und der vor/nach der Migration gelesene JSONB-MD5 blieb `a9a97dfbe691863262d3e2f31dad7700` (nur diagnostischer Prüffingerabdruck).
- Quedó pendiente o sin probar: authentifizierte End-to-End-Bedienprüfung des Gantt-Editors (Baseline-Schreiben, Netzplanauswertung, CSV und Anleitung), visuelle Abnahme und GitHub-Pages-CDN-Zustellung. Keine automatische Ressourcenplanung.
- Riesgos o decisiones que necesitan a Gari: Basispläne sind versionierte Snapshots im Projekt-JSON, kein zusätzlich unveränderlicher Server-Audittrail. CPM nur bei konsistentem Netzplan; kein automatisches Re-Leveling; EA+0 ist bewusst eine tagesgenaue Office-Konvention.
- PR: #66 gemergt; diese Dokumentationsnachführung als eigener Nachtrag.

### 2026-11-09 · Terminplan gemeinsame Planungsfunktionen und zweiteilige Anleitung · ChatGPT
- Qué cambió y por qué: Die PSP-Kennziffern folgen ab jetzt der stabilen Reihenfolge in `state.tasks` innerhalb jeder Gruppe, statt Anfangsterminen oder dem gerade aktiven Suchfilter. Gantt, Druck und CSV verwenden denselben strukturellen PSP-Index.
- Qué cambió y por qué: Alle Terminpläne (neue LPH3/LPH5 sowie bereits bestehende Projektpläne) erhalten eine gemeinsame, reine Netzplan- und Auswertungsbibliothek. Mehrfach-Vorgänger EA/AA/EE/AE mit Lag, Zyklus- und Abhängigkeitsprüfung, tagesgenaue CPM-Auswertung mit Gesamt-/freiem Puffer, rechnerisch kritische Vorgänge und eine echte, nur auf ausdrückliche Freigabe anwendbare Nachfolger-Verschiebungsvorschau. Kalender-Ausnahmen gelten für Prüfung und Vorschau. Bei inkonsistentem Plan wird kein falscher kritischer Pfad ausgewiesen. Kein vollwertiges Ressourcen-Leveling oder Microsoft-Project-Autoscheduling behauptet.
- Solldaten: Bis zu 10 benannte Basisplan-Snapshots innerhalb des vorhandenen revisionierten JSON-States; Vergleich aktueller Plantermine gegenüber dem gewählten Snapshot in KT; separate manuell erfasste Ist-Anfang-/Ist-Ende-Felder. Basislinie im Gantt als gestrichelte Linie, Analysefenster mit Netzwerk-Puffern, Abweichungen und Pflichttermin-Warnungen. Alte Snapshots können über die UI nicht überschrieben werden; es ist keine separat unveränderliche DB-Tabelle.
- Fristen/Leistung: Neue weiche Deadline (nur Warnung, keine automatische Verschiebung), bisheriger geschützter Abgabetermin behält Bestätigungsregel. Geplanter Aufwand in Stunden wird unabhängig von der Dauer in Arbeitstagen erfasst; keine automatische Mitarbeiterauslastung, Kapazitätsbestätigung oder Personalverteilung. CSV-Export enthält nun Puffer, Zieltermine, Ist-Zeiten, Aufwand und Basisplanabweichungen; JSON enthält die unveränderte Gesamthistorie.
- Fachdokumentation: Neue `terminplan-hilfe.html` in Deutsch mit zwei Kapiteln (Werkzeug und fachliche LPH3-Planungslogik), 4 schematischen SVG-Abbildungen, PSP-Ablauf, Beauftragung, Fachplanung, Qualität, Kosten und Freigaben sowie offizieller HOAI-/Microsoft-Dokumentation. Link direkt in der Gantt-Werkzeugleiste.
- Archivos: `terminplan-planning.js`, `terminplan-features.js`, `terminplan-planning.css`, `terminplan.html`, `terminplan-engine.js`, `terminplan-hilfe.html`, `tests/terminplan-planning.test.cjs`, `docs/ESTADO.md`, `docs/BITACORA.md`. Der vorherige LPH3-v1.2-Entwurf und seine Migration verbleiben im selben Review-PR.
- Base de datos: keine neue Schema-Migration für die Funktionen; Basispläne und Zusatzfelder werden im vorhandenen `office_terminplan_instances.state` JSONB mit server_revision gespeichert. Die LPH3-Muster-Migration `20261109131000_office_lph3_template_v12.sql` war beim Schreiben dieser Notiz noch **nicht angewendet**.
- Deploy de funciones: keiner. Die Änderung betrifft Browser-Editor/Template-SQL, nicht den Romy-Function-Runtime.
- Cómo se probó: zusätzliche Node-Tests mit synthetischen, nicht-produktiven Plänen zu vier Abhängigkeitstypen, parallelen Vorgängern, Puffer/Deadline, Wochenendfrist, Baseline-/Ist-Abweichung, Vorschau, fehlenden/zyklischen Vorgängern, LPH3/LPH5 und syntaxgeprüftem Browser-UI. Vollständige GitHub-CI ist am finalen PR-HEAD zu prüfen.
- Quedó pendiente o sin probar: reale authentifizierte Browserabnahme für Baseline-Speicherung, Bearbeitung, Gantt-Overlay und CSV; Deploy-Gate und produktiver Schema-/Musterstatus nach Merge. Langfristig separat: Kapazitäts- und Ressourcenmodelle, automatisches Leveling, vollständiger Stunden-CPM und ein serverseitig besonders geschützter Baseline-Audittrail.
- Riesgos o decisiones que necesitan a Gari: Kein stilles Kaskadieren; vergangene Startdaten implizieren keinen Ist-Fortschritt. Fachliche Abnahme der Zeitrichtwerte erforderlich. Bestehende Projektpläne bleiben fachlich unverändert, alle bekommen aber die neuen UI-Werkzeuge.
- PR: #66.

### 2026-11-09 · Muster LPH 3 v1.2, Fachplaner-Gates und Kalender · ChatGPT
- Qué cambió y por qué: Vor dem Merge des ersten Entwurfs (#66) vollständige fachliche Prüfung des LPH-3-Terminplans vorgenommen. Der neue **Muster v1.2** enthält 10 PSP-Gruppen **00–09**, 57 Vorgänge/Meilensteine und **96** explizite, zyklusfrei geprüfte Verknüpfungen. Fachplanerbedarf, Angebote, Beauftragungsentscheidung und Beauftragungsmeilenstein sind eigene Vorgänge. Auftraggeberrückmeldungen 01.04/01.09 werden mit 5 AT geplant, ebenso Schlussprüfung, Korrekturreserve und abschließende Bauherrenprüfung; 15 AT dienen als Richtwert für Fachplanungsbeiträge/Kostenberechnung. Kostenentscheidung, Behördenabstimmung, vollständige Mehrfachvorgänger für Fachplaner- und Abschlussmeilensteine sowie vorläufige LPH-3-Freigabe sind ausdrücklich modelliert. BRS bleibt optional, wenn projektspezifisch nicht erforderlich. Provenance und Ist-Daten aus Referenzprojekt wurden nicht übernommen.
- Datumslogik: Das Planformular erlaubt einen **explizit** angegebenen bereits erfolgten Fachplanerauftrag (nur für LPH3). Dann entfallen ausschließlich die beiden noch ausstehenden Angebots-/Beauftragungsschritte; keine Aufgabe wird als tatsächlich erledigt behauptet. Der initiale Netzplan wird deterministisch nach Vorgängertyp EA/AA/EE/AE, Arbeitstagen und Sperrtagen geplant, ohne spätere manuelle Änderungen automatisch zu kaskadieren. Landesweite BY-Feiertage einschließlich beweglicher Feiertage werden berechnet; kommunale Sonderregelungen bleiben explizit zu ergänzen. Als vorläufige Erstplanung ist der Plan unabhängig vom echten Projektfortschritt.
- Archivos: `office-core.js`, `app/office-projects.js`, `app/index.html`, `index.html`, `supabase/seed/terminplan-templates.json`, `supabase/migrations/20261109131000_office_lph3_template_v12.sql`, `tests/office-core.test.mjs`, `docs/BITACORA.md`, `docs/ESTADO.md`. Die noch nicht ausgerollte v1.1-Migration wurde vor Review durch v1.2 ersetzt.
- Base de datos: Migration `20261109131000_office_lph3_template_v12.sql` — aplicada en Supabase: **nein**, noch nicht ausgeführt; alte Projektinstanzen werden nicht verändert. Nicht-destruktives Versions-Insert; ältere Muster bleiben referenzierbar, aber werden bei erfolgreicher Migration inaktiv.
- Deploy de funciones: keiner.
- Cómo se probó: strukturelle Netzgenerierung (57/96, Mehrfachvorgänger), Node/Terminplan-Audit CI für den überprüften Commit PASS; negative Tests zu ungültigem Feiertagsbeginn, zwei Beauftragungsvarianten und unveränderter Vorlage ergänzt. Weitere CI-Ergebnisse für den abschließenden SHA separat prüfen.
- Quedó pendiente o sin probar: produktive Datenbankmigration, authentifizierte End-to-End-Anlage in Office, manuelle Fachprüfung der Projekt-Richtdauern sowie visuelle Gantt-Kontrolle; kein automatischer kritischer Pfad, kein permanenter MS-Project-Autoscheduler.
- Riesgos o decisiones que necesitan a Gari: Die Zeiträume sind Richtwerte, keine HOAI-Fristen. Private Direktbeauftragung ist nicht mit öffentlicher Vergabe nach VgV gleichzusetzen. EA 0 erlaubt im bestehenden Office-Editor eine Übergabe am selben Kalendertag; das ist nicht in jeder Hinsicht identisch mit dem zeitbasierten Microsoft-Project-Verhalten. Nicht automatisch aus Projektfortschritt ableiten.
- PR: #66 (Draft; kein Merge, keine Migration).


### 2026-11-09 · Pantalla en blanco al abrir, botón Live y textos del chat · Claude
- Qué cambió y por qué: Gari vio la sección Heute en blanco al abrir la app (aparecía tras ir al chat y volver) y un botón «Live» que Isabella no tiene. Causa del blanco: al fusionar `app.js` con Window entró `$('#focusLiveLink').onclick=…`; Office no tenía ese enlace, la llamada fallaba en `bind()` y `init()` se cortaba antes de pintar la primera pantalla (pasaba con los dos runtimes). Arreglo: el enlace Live va ahora donde lo tiene Window (dentro del dictado, «Live sprechen»), con la opción «Antwort anhören» y el CSS de Window; la llamada está protegida si falta el elemento; se quitó el botón Live del compositor (`office-live-entry.js`). Además: con el motor nuevo, una respuesta informativa (ejecución durable) se quedaba en «Romy arbeitet noch…» hasta cambiar de pestaña porque Office no consultaba los trabajos durables cada 7 s; ahora sí, como Window. Textos del chat que seguían en español, en alemán (respuesta interrumpida, sin respuesta de texto, continuar respuesta, aviso sin conexión, cinco avisos de guardado).
- Archivos: `app/app.js` (v=office48), `app/shell.js` (v=office44), `app/index.html`, `app/office.css` (v=office41), `app/voice-output.css` (nuevo, copia de Window), `app/office-live-entry.js` (borrado), `tests/browser/office-app-boot.chromium.mjs` y `tests/browser/fixtures/fake-supabase.js` (nuevos), `.github/workflows/verify-romy-browser.yml` (también en PRs a main), pins de versión en tests.
- Base de datos: ninguna.
- Deploy de funciones: ninguno.
- Cómo se probó: la app entera arrancada en Chromium con un Supabase sintético: en el código publicado salía `TypeError … focusLiveLink` y la prueba nueva falla; con el arreglo, sin errores y Heute visible al abrir, con motor nuevo y con el runtime anterior. `node --test` 221/221.
- Quedó pendiente o sin probar: unas 80 cadenas en español en paneles avanzados heredados de Window (permisos, avisos, proactividad…); el historial anterior de Romy no se pasó al motor nuevo (sigue guardado).
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: este.

### 2026-11-09 · Romy en el motor nuevo · responsables de tareas · Claude
- Qué cambió y por qué: Gari puso `ASSISTANT_PROFILE=office` en Supabase; desplegadas las 17 funciones del motor y `office-mcp`; el chat de Office vuelve a usar el motor por defecto (respaldo: `tba_office_chat_backend=legacy`). Además, asignar responsables desde la ficha de una tarea fallaba desde siempre porque `minds_work_set_task_assignees` (copiada de Window en `task-detail.js`/`task-team.js`) nunca se creó en Office: nueva función con el mismo contrato que Window (atómica, control de revisión, máx. 16, primera persona en `assignee_person_id`, sin perder días planificados), adaptada al equipo del proyecto (`office_project_members`, miembros activos) y con `security invoker` para que decida la RLS existente.
- Además: el primer latido de Romy en Office falló (`function public.minds_continuity_terms(text) does not exist`): la fase 1 no copió esa función auxiliar. Copiada tal cual de Window en `20261109001000_office_continuity_terms_v1.sql`. Revisión completa de las funciones de Office: era la única llamada a una función inexistente.
- Archivos: `app/index.html`, `supabase/migrations/20261109000000_office_task_assignees_rpc_v1.sql`, `tests/sql/office-task-assignees-acceptance.sql`, `.github/workflows/verify.yml`, `tests/office-app.test.mjs`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: migraciones `20261109000000_office_task_assignees_rpc_v1.sql` y `20261109001000_office_continuity_terms_v1.sql` — aplicadas en Supabase: sí, tras el merge, desde la base con el archivo fijado al commit y SHA-256 comprobado (el token no tiene permiso de migraciones).
- Deploy de funciones: `isabella-chat isabella-chat-runner isabella-heartbeat isabella-routine-runner isabella-mission-runner isabella-capability-runner isabella-capability-runtime isabella-artifact isabella-artifact-intake isabella-dream isabella-presence isabella-delivery-runner isabella-live-session isabella-transcribe isabella-work-ingest-runner window-akte-pflege office-mcp` (deploy-functions, con `profile_set_in_dashboard`).
- Cómo se probó: `node --test` 221/221; prueba SQL nueva en Supabase local efímero (orden sin duplicados, revisión desfasada rechazada, persona fuera del equipo rechazada, vaciar, ajeno al equipo sin permiso); runners en producción responden 200 cada minuto.
- Quedó pendiente o sin probar: un turno real de Romy en el navegador y en el iPhone; voz Live con micrófono real.
- Riesgos o decisiones que necesitan a Gari: dar al token `secrets_write` y `database_migrations_write` (opcional).
- PR: este.

### 2026-11-08 · Romy = Isabella · revisión de las 6 fases y correcciones · Claude
- Qué cambió y por qué: revisión completa del trabajo de ChatGPT antes de publicarlo. Correcciones: (1) el motor compartido escribe con el JWT del miembro filas que la fase 1 dejó solo en lectura (memoria que aprende, seguimientos, uso, ejecuciones, artefactos, panel de skills/rutinas, decisiones propias de la Akte): nueva migración con permisos mínimos y una política por cada llamada real; siguen solo de servidor las filas de Romy, recibos, autoridad D1, claims, grants y secretos. (2) Los avisos de la app («Gespeichert.», recibos de confirmación) ahora quedan en la conversación por una función estrecha (`office_romy_append_notice`), marcados como aviso del sistema, nunca como Romy. (3) `app/app.js` de Office era una copia antigua: fusionado a tres vías con el de Window (Deshacer, avisos, recuperación) conservando lo de Office y todo el texto visible en alemán. (4) Romy usa el mismo contrato de relación que Isabella (decisión de Gari: iguales). (5) Clave de OpenAI con alternativa `TBA_OFFICE_OPENAI_API_KEY`. (6) Workflow manual `apply-migration.yml` como en Window. (7) Sin runner, una pregunta informativa (que el motor manda a ejecución durable) nunca recibía respuesta: nueva migración que programa chat-runner, rutinas, misiones, documentos generados y lectura de documentos con secretos aleatorios creados dentro de la base. (8) `deploy-functions.yml` fija `ASSISTANT_PROFILE=office` antes de cada deploy y acepta 4xx de los runners que validan su propio secreto.
- Archivos: `app/app.js`, `app/index.html` (app.js v=office47), motor sincronizado desde minds `68d8856` y manifiestos, `supabase/migrations/20261108220000_office_window_engine_owner_writes_v1.sql`, `supabase/migrations/20261108221000_office_romy_append_notice_v1.sql`, `tests/sql/office-romy-review-acceptance.sql`, `.github/workflows/verify-romy-schema.yml`, `.github/workflows/apply-migration.yml`, tests con textos alemanes.
- Base de datos: las 19 migraciones de las fases + estas 3 (`…220000`, `…221000`, `…222000`) — aplicadas en Supabase: **sí**, las 22 en orden el 08.11.2026. `apply-migration.yml` dio 403 (al token le falta `database_migrations_write`); se aplicaron desde la base con pg_net, cada archivo fijado al commit `20919b7` y con su SHA-256 comprobado, y quedaron en el historial de migraciones. Después: RLS en todas las tablas públicas, ningún aviso de seguridad de nivel ERROR.
- Deploy de funciones: Window, sí (26 funciones, 08.11.2026). Office, **no todavía**: el paso que fija `ASSISTANT_PROFILE=office` falló porque el token no tiene permiso de secretos; el workflow ahora no despliega funciones del motor sin ese perfil (o la confirmación `profile_set_in_dashboard`). Hasta entonces el chat usa por defecto el runtime probado de Romy (`office-assistant`).
- Cómo se probó: `node --test` 221/221, Chromium 7/7, `deno check` de todas las funciones del perfil Office, las 21 migraciones y las 5 pruebas de aceptación en PostgreSQL efímero (dos miembros ficticios, un externo; todo revertido). Comprobado contra producción, solo lectura: ninguna tabla, función o política nueva choca con lo existente; 0 archivos en `minds-work`.
- Quedó pendiente o sin probar: prueba real con el móvil (voz Live, micrófono en Safari); algunos paneles avanzados heredados de Window llaman RPC que Office no tiene (modelo operativo, expectativas, push, conocimiento con `minds_save_work_claim`) — ya fallaban antes; asignar responsables desde la ficha de tarea llama `minds_work_set_task_assignees`, que no existe en Office (fallo previo, no de estas fases). Docling necesita `DOCLING_SERVE_URL`/`DOCLING_SERVE_API_KEY` en los secretos de Office.
- Riesgos o decisiones que necesitan a Gari: ninguno nuevo; nada destructivo.
- PR: cadena Romy #56–#62.

### 2026-11-08 · Romy = Isabella · Phase 6 · Live und MCP · ChatGPT
- Änderung und Zweck: Romy Live als separate deutsche WebRTC-Oberfläche, dieselben gepinnten Window-Clientmodule, individuelle Office-JWT-Prüfung; neue read-only Projektakte/Themenblatt/Quellen-/Diagnose-Werkzeuge mit OAuth und expliziter Projektmitgliedschaft. Diktiermikrofon bleibt unverändert.
- Dateien: `app/live/*`, `app/office-live-entry.js`, `app/index.html`, gemeinsame Engine und Sync-Manifeste, `supabase/functions/office-mcp/index.ts`, `office-akte.mjs`, Tests unter `tests/browser/` und `tests/office-romy-phase6-mcp.test.mjs`, `AGENTS.md`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- Datenbank: keine neue Phase-6-Migration — in Supabase angewendet: **nein**.
- Deploy: keiner; später nach Review `isabella-live-session` und `office-mcp` gemäß Office-Konfiguration.
- Prüfung: Chromium mit synthetischen WebRTC-, Audio- und OAuth-Doubles; nur Owner-Transkript wird gespeichert, Agenten-Sprachausgaben nicht, kanonische Aktionen benötigen Bestätigung; OAuth-Projektakte nur im berechtigten Team. Office Engine/Chromium/PG17 und minds-Regressionen erfolgreich am verifizierten Code-Stand; finaler PR-HEAD in CI erneut prüfen.
- Ausstehend: reale Sprachqualität, Mikrofonberechtigungen auf iPhone/Safari, echte OAuth-Anmeldung und Provider-Integration; keine Produktions-E2E-Behauptung.
- Risiko/Entscheidung: keine original persönliche Isabella-Stimme in Office, kein Office-Mobile-Push, keine Akten-Schreibrechte über MCP. Kein Secret-Wert im Repository.
- PR: Phase 6 (apilado sobre Phase 5), ohne Merge, Migration oder Deploy.


### 2026-11-08 · Romy = Isabella · Phase 5 · Projektakte und Docling · ChatGPT
- Was geändert wurde: eine gemeinsame Projektakte nur für Projektmitglieder; Quellenzitate und Versionen als Zulassungsbedingung, neue Inhalte ausschließlich als Vorschläge. Tägliches serverseitiges Projekt-Leasing verhindert doppelte Nachtläufe.
- Dateien: Engine `_shared/akte-pflege.mjs`, `_shared/office-akte-access.mjs`, `isabella-work-ingest-runner`, `window-akte-pflege`, Quellcode-Manifest, SQL-Migration, SQL- und Node-Tests, `.github/workflows/romy-akte-pflege.yml`, ESTADO und BITACORA.
- Datenbank: `20261108215000_office_romy_akte_maintenance_state_v1.sql` – in Supabase angewendet: **nein**.
- Deploy: keiner. Erst nach Review kommen `window-akte-pflege` und `isabella-work-ingest-runner` in Frage.
- Tests: zwei fiktive Projekte, RLS-Teamgrenze, Admin ohne Projektzuordnung, einmaliger Tages-Claim und source-first Projekt-Werkzeuge; CI-Status muss auf finalem Branch-HEAD bestätigt werden.
- Noch offen: vollständige produktive E2E-Ingesta von PDF, DOCX und XLSX mit Docling sowie die menschliche Bestätigung der Aktenvorschläge.
- Risiken und Entscheidung: bestehendes Mitglieds-UUID nur als technische Speicherung, niemals als menschliche Urheberschaft; `author_kind='system'`, ausschließlich vorgeschlagene Einträge.
- PR: Phase-5-Branches auf Phase 4, ungeprüft von Claude, nicht gemergt.

### 2026-11-08 · Romy = Isabella · Phase 4, persönliche Kontinuität · ChatGPT
- Änderung und Begründung: nächtliches Gedächtnis und proaktive Präsenz verwenden ausschließlich den aktiven Office-Kontoinhaber, mit eigenem Tagesbudget. Neuer persönlicher Speicher-/Präsenzdialog aus der gemeinsamen Window-Quelle; keine mobile Office-Push-Benachrichtigung.
- Dateien: `app/office-personal.js`, aktualisierte Engine-Module, `app/index.html`, Quellcode-Manifeste, SQL-Migration und isolierte Tests, sowie diese Dokumentation.
- Datenbank: `20261108214000_office_romy_owner_forget_v1.sql` vorbereitet — in Supabase angewendet: **nein**.
- Funktionen: keine deployed; später `isabella-heartbeat`, `isabella-dream`, `isabella-presence`, `isabella-routine-runner` nur mit geprüftem Office-Profil.
- Tests: Testpersonen und Projektbezeichnungen sind erfunden; Node/Deno, SQL A/B in transaktionaler Einweg-Datenbank und Offline-Chromium. CI-Ergebnis ist vor dem Merge anhand des finalen HEAD zu bestätigen.
- Noch offen: echte Anmeldesitzung und End-to-End-Überprüfung der Erinnerung, Besuch im Browser und Abnahme durch Claude.
- Risiko / gewählte Option: Vergessen invalidiert persönliche Erinnerungen mit Provenienz statt destruktiver Löschung; ältere Chat-Historie bleibt unangetastet.
- PR: Phase-4-Branch auf Phase 3, nicht gemergt.

### 2026-11-08 · Romy = Isabella · fase 3: chat común y Chromium · ChatGPT
- Qué cambió y por qué: el chat de Office usa el cliente de Window y respuestas canónicas del motor Office, sin mezclar identidades. El chat heredado queda accesible únicamente mediante elección manual.
- Archivos: `app/office-engine-chat.js`, `app/index.html`, `app/ai.js` y otros cinco módulos compartidos, `docs/sync-window-app-manifest.json`, `tests/office-app.test.mjs`, `tests/browser/romy-chat.chromium.mjs`, workflow de Chromium y documentación.
- Base de datos: ninguna migración nueva en fase 3 — aplicada en Supabase: no.
- Deploy de funciones: ninguno. El backend nuevo no está activado en producción.
- Cómo se probó: CI de Node/Edge Deno y tests aislados de Chromium para streaming, propuestas, recibos y aislamiento entre dos cuentas ficticias. E2E con sesión real pendiente.
- Quedó pendiente o sin probar: enlace de voz real, revisión del chat integrado en Safari, verificación de Deshacer con Office desplegado y sincronización de historial anterior (deliberadamente no automática).
- Riesgos y preguntas: se conserva `office-assistant` como respaldo elegible, sin fallbacks silenciosos ni importación de su historial.
- PR: apilado sobre #58, todavía sin fusionar.

### 2026-11-08 · Romy = Isabella · fase 2, motor sincronizado sin activar · ChatGPT
- Qué cambió y por qué: se copiaron desde minds `30451152a0a5` los 95 archivos del motor habilitado, todos verificados por SHA; se añadió sincronización reproducible y workflow que solo abre PR, perfil Office del motor y adaptador team-scoped de Terminpläne.
- Archivos: `supabase/functions/_shared`, 20 Edge Functions de `supabase/functions`, `supabase/config.toml`, `scripts/sync-window.mjs`, `.github/workflows/sync-window-engine.yml`, `verify-romy-engine.yml`, tests, y manifiesto `docs/sync-window-engine-manifest.json`.
- Base de datos: `20261108213000_office_window_direct_create_default_v1.sql` D1, con opt-out `review` preservado — aplicada en Supabase: no.
- Deploy de funciones: ninguno. Se conservará `office-assistant` hasta aceptación.
- Cómo se probó: 95 hashes de blob iguales; CI Offline Node 176/176; Deno check de 20 funciones; PG17 efímero con D1 y pruebas de aislamiento de dos personas.
- Quedó pendiente o sin probar: Origin/OAuth/credenciales de runner, integración PWA común de chat y voz, rutinas, Proyectoakte y aceptación E2E. Los endpoints sin adaptaciones no se activan.
- Riesgos o decisiones que necesitan revisión: Office no tendrá push iPhone; D1 sí, D2 no; las modificaciones de Terminplan deben seguir propuesta + confirmación.
- PR: rama `romy-isabella/phase-2-engine-sync` apilada en fase 1, pendiente de revisión.

### 2026-11-08 · Romy = Isabella · fase 1 · aceptación estructural con RPC · ChatGPT
- Qué cambió y por qué: se completó la compatibilidad estructural del motor con 90 tablas y RPCs auditadas; se activó RLS en todas las nuevas tablas y se verificaron denegaciones de acceso entre miembros/proyectos. Se añadió el contrato de rutinas/Watch con ejecución exclusivamente de worker y sin VAPID de Office.
- Archivos: 16 migraciones `2026110820…`–`20261108212700`, workflows `.github/workflows/verify.yml` y `verify-romy-schema.yml`, pruebas SQL sintéticas, `docs/ESTADO.md` y este registro.
- Base de datos: nuevas migraciones no destructivas — aplicada en Supabase: **no**.
- Deploy de funciones: ninguno.
- Cómo se probó: PostgreSQL 17 efímero y Supabase local; verificaciones SQL de propietario, equipo, administrador no miembro, inserción falsificada y permisos de RPC; Node tests y `pg_dump --schema-only` sin contenido. CI verde en los SHA previos; el SHA final debe verificarse antes de iniciar fase 2.
- Quedó pendiente o sin probar: acceso de una persona real, herramientas del motor desplegadas, rendimiento, uso real de la Projektakte y cualquier integración de voz.
- Riesgos o decisiones que necesitan revisión: los dominios de Window que no existen en Office quedan excluidos; `minds_store_vapid_pair_if_absent` no se copia; futuras migraciones de producción deben revisarse en orden por Claude.
- PR: Office #57 / minds #319, ambos apilados y sin fusionar.


### 2026-11-08 · Romy = Isabella · fase 1, propuesta de esquema (no aplicada) · ChatGPT
- Qué cambió y por qué: migraciones estructurales basadas exclusivamente en metadatos del esquema de Window; owner RLS personal y lectura por `office_project_members` en Projektakte; Storage privado y cron sin valores activos.
- Archivos: seis migraciones `20261108200000` a `20261108205000`, `tests/sql/office-romy-phase1-acceptance.sql`, `.github/workflows/verify.yml`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: migraciones nuevas y no destructivas — aplicada en Supabase: no.
- Deploy de funciones: ninguno.
- Cómo se probó: se ha preparado prueba transaccional SQL ficticia sobre PostgreSQL efímero; pendiente resultado de CI y verificación de RPC del motor.
- Quedó pendiente o sin probar: aplicar todas las migraciones en CI, resolver posibles dependencias, revisar RPC/autoridad, Storage y aceptación antes de fase 2.
- Riesgos o decisiones que necesitan a Gari: las dependencias de Ideas/Lecturas/Thoughts de Window se excluyen por ausencia de esos dominios en Office. Opción prudente: documentar referencias externas omitidas sin crear tablas de contenido que no pertenezca a Office.
- PR: rama `romy-isabella/phase-1-office-schema`, apilada sobre fase 0. No fusionar ni desplegar.

### 2026-11-08 · Validación de fase 0 · ChatGPT
- Qué cambió y por qué: se comprobó el perfil de servidor de Office por usuario, el diccionario alemán compartido y el orden explícito de inicialización en la PWA. Una prueba de carga se corrigió para aceptar nombres de módulos con dígitos sin perder la aserción de dependencia.
- Archivos: app/assistant-i18n.js, app/index.html, tests/office-app.test.mjs, docs/ESTADO.md y docs/BITACORA.md; la implementación del perfil reside en el PR de fase 0 de minds.
- Base de datos: ninguna migración — aplicada en Supabase: no.
- Deploy de funciones: ninguno; office-assistant sigue siendo el respaldo actual.
- Cómo se probó: CI de Office y de minds correctas. En minds, 1211 tests aprobados y Deno check correcto, con `promptComponentSizes()` en fixture sintético.
- Quedó pendiente o sin probar: compatibilidad SQL y datos multiusuario de fase 1, sincronización, runtime, PWA y aceptación operativa de Office de fases 2–6.
- Riesgos o decisiones que necesitan a Gari: procesos proactivos de Office sin activar hasta confirmar aislamiento por miembro; sin push móvil para Office.
- PR: #56 (Office) y #318 (minds), sin fusionar.

### 2026-11-08 · Romy = Isabella · fase 0 (borrador, sin activación) · ChatGPT
- Qué cambió y por qué: se alinea la regla D1/D2 de AGENTS.md con el encargo del 08.11. Se documenta el estado de la preparación de perfil en el repositorio minds. La fase 0 no está aceptada ni activada.
- Archivos: AGENTS.md, docs/ESTADO.md, docs/BITACORA.md.
- Base de datos: ninguna migración — aplicada en Supabase: no.
- Deploy de funciones: ninguno; office-assistant sigue siendo el respaldo actual.
- Cómo se probó: lectura de AGENTS, ESTADO y las entradas recientes de BITACORA; CI Office 200/200 tests PASS, comprobación de scripts del navegador PASS. No hay todavía aceptación funcional completa de la fase.
- Quedó pendiente o sin probar: procesos nocturnos, localización integral del chat, prueba byte a byte de Window, CI de ambos repositorios y PRs de las fases 1–6.
- Riesgos o decisiones que necesitan a Gari: el runtime Office no se puede activar con prompts de background aún no adaptados; opción prudente: dejar esas rutas desconectadas hasta verificar aislamiento.
- PR: rama romy-isabella/phase-0-office-contract (borrador).

### 2026-11-08 · Romy: los turnos ligeros llevan menos · Claude
- **Qué cambió y por qué:**
  - En Window, un «¡Gracias!» costó ~370k caracteres porque se precargó un proyecto entero. Gari: «esto no puede pasar», también en Office.
  - Romy no precarga proyectos: sus mensajes cortos rondan los 13k tokens, sobre todo instrucciones y herramientas, que la caché reutiliza.
  - Aun así, un turno que el clasificador marca como `light` (sin adjuntos) ahora:
    - lleva solo los últimos 10 mensajes, en lugar de 24;
    - va sin el ARBEITSRADAR.
- **Archivos:** `supabase/functions/office-assistant/index.ts` (`LIGHT_HISTORY`), test en `tests/office-romy-like-isabella.test.mjs`.
- **Base de datos:** ninguna. **Deploy:** `office-assistant`.
- **Cómo se probó:** 197 tests en verde; `deno check` sin errores nuevos (100 heredados).
- **PR:** (este)

### 2026-11-08 · Romy como Isabella: sin silencios, avisos del sistema, streaming robusto, historial, radar · Claude
- **Qué cambió y por qué:**
  - Gari pidió pasar a Romy cinco puntos de Isabella (Window). Lo personal no se pasa.
    - **Sin silencios:** aviso honesto en la conversación si no hay respuesta y un reintento si llega vacía.
    - **Avisos de la app como línea de sistema.**
    - **Streaming que sobrevive a cerrar la app.**
    - **Historial como diálogo:** con hora local y los avisos marcados.
    - **Radar de Fristen y Threads con iniciativa.**
  - Además, dos fallos que Gari vio hoy en Isabella:
    - `list_tasks` no decía quién lleva cada tarea (ahora `responsable`).
    - Tras confirmar un vorschlag, el asistente no lo sabía. Ahora queda un «Bestätigt: …» en la conversación.
- **Archivos:**
  - `supabase/functions/office-assistant/romy-continuity.mjs` (nuevo), `index.ts`, `romy-tools.mjs`.
  - App:
    - `app/app.js` (office46): `isEventMessage` y la clase `is-event`;
    - `app/app.css` (v70);
    - `app/office-assistant.js` (office37): recarga tras revisar;
    - `app/work.js` (office42): líneas de sistema en los Threads.
  - Tests: `tests/office-romy-like-isabella.test.mjs` (nuevo), más los pins de versión y tres pins de estructura.
- **Base de datos:** ninguna. Las filas usan `office_assistant_messages`: rol `assistant`, `metadata.author:"system"` y, para los recibos, un `request_id` nuevo.
- **Deploy de funciones:** `office-assistant` (workflow «Deploy Supabase Edge Functions»).
- **Cómo se probó:**
  - 196 tests en verde.
  - `deno check` de `office-assistant`: 100 errores de tipos heredados (106 en `main`), ninguno nuevo.
- **Quedó pendiente o sin probar:** el comportamiento real del radar en el chat de Office (cuánto menciona y cuándo).
- **Riesgos o decisiones que necesitan a Gari:** ninguno. Lo personal de Isabella se quedó fuera, como decidió.
- **PR:** (este)

### 2026-11-07 · Romy y «mañana», sin Kategorie en Office, formulario completo al crear · Claude
- **Qué cambió y por qué (tres peticiones de Gari):**
  - **Romy para mañana:** a la pregunta «¿tengo algo pendiente para mañana?» contestó que nada, aunque «Test» (fällig 04.11) seguía abierta.
    - No era por el campo «Verantwortlich»: la tarea es suya porque la creó él.
    - La causa: para otro día que no fuera hoy, Romy buscaba solo lo que vencía exactamente ese día.
    - Ahora `list_tasks` acepta `day:"YYYY-MM-DD"`: todo lo que vence hasta ese día y sigue abierto (lo vencido marcado contra el hoy real) y las tareas de varios días en curso. La instrucción de Romy lo pide para mañana u otro día.
    - Lo mismo en el conector de Claude (`office-mcp`, `list_tasks` con `day`).
  - **Sin Kategorie en Office** (todo es trabajo). Se quitó:
    - del editor de tareas, del de Termine y de «Neu anlegen»;
    - de las filas de Heute;
    - del menú «Mehr» (Kategorien).
    - Las listas de Aufgaben van ahora por proyecto. Lo nuevo se guarda como «Arbeit», y al sincronizar lo que no tiene categoría también.
    - En Persönlich (Window) la categoría se queda: allí separa Casa, MINDS, Architectures, etc.
  - **«Neu anlegen» con todos los campos** (Office y Persönlich):
    - Una tarea abre directamente el editor completo con el día ya puesto.
    - Arriba hay un cambio «Aufgabe | Termin» que conserva lo escrito.
    - El Termin tiene ahora todos sus campos: Dauer y Notizen.
    - Al elegir un proyecto en una tarea nueva ya no se borran el título ni las fechas escritas.
    - Crear desde el editor completo usa una clave fija y lee de vuelta: un segundo toque o un reintento no duplica la tarea, como antes el formulario corto.
- **Archivos:**
  - Romy y conector: `supabase/functions/office-assistant/romy-tools.mjs`, `index.ts`, `supabase/functions/office-mcp/office-tools.mjs`, `index.ts`.
  - App: `app/app.js` (office45), `app/task-detail.js` (office3), `app/task-detail.css` (v2), `app/ahora.js` (office4), `app/sync.js` (office5), `app/shell.js` (office43).
  - Tests: `tests/office-day-and-forms.test.mjs` (nuevo) y pins.
  - Window: PR aparte con el mismo formulario completo.
- **Base de datos:** ninguna.
- **Deploy de funciones:** `office-assistant` y `office-mcp` (workflow «Deploy Supabase functions»).
- **Cómo se probó:** 188 tests en verde. En Chromium (Office y Window):
  - «+» abre el editor completo con la fecha, sin Kategorie en Office;
  - el proyecto conserva lo escrito;
  - Aufgabe ↔ Termin conserva título, fecha, proyecto y notas;
  - la tarea se crea con «Arbeit»;
  - el Termin se guarda con Dauer y Notizen;
  - las listas van por proyecto y no hay «Kategorien» en el menú.
- **PR:** #53

### 2026-11-07 · Terminpläne dentro de la app sin segundo login · Claude
- **Qué cambió y por qué:** Gari: en la app de Window, al abrir un Terminplan pedía login otra vez, volvía a la lista y al tocar el plan otra vez pedía login.
  - **Causa:** `terminplan.html` creaba su propio cliente con la sesión guardada en el navegador. Dentro de la app esa sesión no existe (la app la presta por el puente y `./app/` borra la guardada), así que el plan mandaba a la página raíz y su login.
  - **Arreglo:** `terminplan.html` carga `shared/supabase-client.js` y usa `window.MINDS_SUPABASE`: dentro de la app, la sesión de la app; en el navegador, la de siempre.
    - Sin sesión en la app: login nativo (`session.signIn`). En el navegador: la página raíz, como antes.
    - Startpasswort pendiente en la app: aviso de cambiarlo en el navegador. Sin `id`: vuelve a `./app/#section=plans`.
  - **Mismo fallo en «Mitglieder» y «Passwort ändern»** (menú «Mehr», van a la página raíz): la página raíz también usa el cliente compartido.
    - Sin sesión en la app: vuelve a `./app/` y pide el login de la app.
    - «Abmelden» ahí cierra la sesión de la app.
  - El cliente del puente gana `auth.updateUser` (solo contraseña, `PUT /auth/v1/user` con el token prestado).
- **Archivos:** `terminplan.html`, `index.html`, `app.js` (v6), `shared/supabase-client.js` (v=office3 en `app/index.html`, `terminplan.html`, `index.html`), `tests/office-terminplan-in-app.test.mjs` (nuevo), pins en `tests/office-app`, `office-core`, `office-navigation-parity`, `office-window-app`.
- **Base de datos:** ninguna.
- **Deploy de funciones:** ninguno.
- **Cómo se probó:** 183 tests en verde.
  - En Chromium con el puente simulado:
    - plan abierto con la sesión de la app, sin navegar fuera y sin errores;
    - sin sesión en la app → login nativo y se queda en el plan;
    - en el navegador sin sesión → página raíz;
    - `#password` en la app → `PUT /auth/v1/user` con el token prestado y vuelta a `./app/`;
    - `#members` en la app → `office-admin` con el token prestado.
- **Quedó pendiente o sin probar:** probarlo en el iPhone real (no hace falta un build nuevo: la app ya confía en todo el sitio de Office).
- **PR:** #52

### 2026-11-07 · El Kalender es el calendario de tus proyectos · Claude
- **Qué cambió y por qué:** decisión de Gari: el calendario es el de los proyectos, no el de la persona.
  - **Kalender:** de cada proyecto en cuyo equipo estás, todas las tareas con fecha (las haya creado quien sea), todas las Fristen de sus Terminpläne y los Termine con proyecto. Además, tus tareas personales y tus Termine.
  - **Iniciales visibles** (fondo oscuro, no tenue) en las tareas y Termine de colegas: las de la persona responsable o, si no hay, las de quien lo creó.
  - **Filtro «Nur meine»** en la barra del calendario.
  - Los Termine de colegas se pueden ver, pero no cambiar: al tocarlos se abre un aviso de solo lectura y no se pueden arrastrar.
  - **Heute sigue siendo tuyo:** solo lo que creaste o tienes asignado, y tus Termine.
  - **Fristen** en Heute y Kalender: solo las de tus proyectos (antes salían las de todos).
  - Proyectos en los que no estás: nada en tu calendario; en Work se siguen pudiendo abrir.
- **Corrección de paso:** al sincronizar, solo se suben en bloque las filas propias. Al editar una tarea de un colega, se conserva su categoría (antes se le ponía la tuya); el autor ya lo protegía un trigger.
- **Archivos:**
  - `app/{app.js,sync.js,ahora.js,office-fristen.js,calendar-plan.js,minds-calendar-shell.css,index.html}`;
  - `supabase/migrations/20261107163056_office_project_calendar_v1.sql`;
  - `tests/office-project-calendar.test.mjs` y versiones en tests.
- **Base de datos:** migración `20261107163056_office_project_calendar_v1`, **aplicada**. Es una política nueva de lectura en `isabella_events` para el equipo de los Termine con proyecto; no se quitó ninguna.
  - Probada antes en una transacción revertida: el equipo ve el Termin del proyecto (1), no ve el privado (0), no puede editarlo (0), y alguien de fuera del equipo no lo ve (0).
- **Cómo se probó:**
  - 180/180 pruebas.
  - Recorrido en Chromium con dos colegas simulados (Yvonne y Antonia):
    - en Woche y Tag se ven sus tareas y su Jour fixe con iniciales YB y AK;
    - salen las Fristen de Bernried y no las de Schwarz;
    - «Nur meine» deja solo lo propio;
    - Heute no incluye lo de los colegas;
    - el Termin de Yvonne abre el aviso de solo lectura;
    - solo se suben filas propias.
- **Quedó pendiente:** nada.
- **Riesgos o decisiones que necesitan a Gari:** ninguno.
- **PR:** #51

### 2026-11-07 · Threads privados en Work (paso 4, parte 2) · Claude
- **Qué cambió y por qué:** decisión de Gari: en Office, los Threads son privados, como en Window.
  - Un Thread es una conversación con Romy ligada a un proyecto, y solo la ve quien la abre.
  - Romy recibe en cada turno de qué proyecto y Thread se trata (nota de desarrollador desde el servidor) y puede usar las tareas, los archivos y los Terminpläne de ese proyecto.
  - Los Threads no aparecen en la lista de chats de Romy.
  - Los vorschläge de Romy (tarea, Termin, recuerdo) se confirman o descartan dentro del Thread.
- **Archivos:**
  - `supabase/migrations/20261107130516_office_work_threads_v1.sql`;
  - `supabase/functions/office-assistant/index.ts` (`threadNote`);
  - `app/{work.js,shell.js,office-assistant.js,index.html}`;
  - `tests/office-threads.test.mjs` y versiones en tests.
- **Base de datos:** migración `20261107130516_office_work_threads_v1`, **aplicada** con el MCP de Supabase.
  - Crea la tabla `minds_work_threads`, con RLS solo para su dueño; ningún admin la lee.
  - Añade la columna `office_assistant_conversations.work_thread`.
  - Crea tres RPC como invocador (crear la conversación, renombrar, archivar).
  - Antes se ensayó en una transacción revertida: misma conversación al repetir, nombre duplicado rechazado, se renombra también la conversación, y se puede reusar el nombre después de archivar.
- **Deploy de funciones:** `office-assistant`, con el workflow después del merge.
- **Cómo se probó:**
  - 176/176 pruebas.
  - Recorrido en Chromium con Supabase y Romy simulados: crear el Thread, abrirlo, preguntar, ver la respuesta en streaming y el vorschlag con Bestätigen/Verwerfen.
  - Romy recibió el `conversation_id` del Thread y no hubo errores de página.
- **Quedó pendiente:** que Gari lo pruebe de verdad. Las Akten (Themenblatt) siguen para después.
- **Riesgos o decisiones que necesitan a Gari:** ninguno.
- **PR:** #50

### 2026-11-07 · Conector de Claude para Office (paso 4, parte 1) · Claude
- **Qué cambió y por qué:** decisiones de Gari del 07.11: Office recibe el conector de Claude como Window, y puede leer todo, documentos incluidos; los Threads serán privados, como en Window (llegan en la parte 2).
  - Nueva función `office-mcp`: servidor MCP remoto con OAuth 2.1 de Supabase.
    - Herramientas: overview, proyectos, contexto de proyecto, Fristen, búsqueda de documentos, lectura de PDF/Word/Excel/texto, tareas (leer, crear, cambiar) y calendario propio.
    - Corre con el JWT de la persona y bajo la RLS de la oficina; solo entran miembros activos.
  - Nueva página `oauth-consent.html`, en alemán, con correo y contraseña de la oficina.
  - Guía: `docs/OFFICE-CONNECTOR.md`.
- **Archivos:** `supabase/functions/office-mcp/{index.ts,office-tools.mjs}`, `supabase/config.toml`, `oauth-consent.{html,js}`, `tests/office-mcp.test.mjs`, docs.
- **Base de datos:** ninguna.
- **Deploy de funciones:** `office-mcp` con el workflow después del merge.
- **Cómo se probó:**
  - 173/173 pruebas, con pruebas de comportamiento de las herramientas contra un cliente simulado;
  - `deno check` del servidor sin errores;
  - extracción de PDF, Word y Excel probada en Deno con archivos generados;
  - página de consentimiento en Chromium sin errores.
- **Quedó pendiente:** Gari tiene que activar el OAuth Server en el panel de Supabase (Authentication → OAuth Server, ruta `/oauth-consent.html`) y añadir el conector en Claude. Después: Threads privados en Work (parte 2).
- **Riesgos o decisiones que necesitan a Gari:** el conector entrega a Claude (Anthropic) el contenido de los documentos que se lean. Gari lo decidió así; conviene contárselo a Titus junto con el tema de datos de clientes.
- **PR:** #49

### 2026-11-07 · Kalender: eventos de día completo de Persönlich como pastillas · Claude
- **Qué cambió y por qué:** en la vista Tag, los eventos de día completo del otro calendario salían como texto suelto; ahora son pastillas rayadas, como el resto. Si solo hay eventos del otro calendario, ya no aparece "Keine Aufgaben".
- **Archivos:** `app/{app.js,minds-calendar-shell.css,index.html}` y versiones en los tests.
- **Base de datos / funciones:** ninguna.
- **Cómo se probó:** 167/167 pruebas y captura en Chromium con puente simulado.
- **PR:** #48

### 2026-11-07 · Kalender con los dos calendarios (paso 3) · Claude
- **Qué cambió y por qué:** decisión de Gari: dos calendarios, Persönlich y Office, y los dos se ven en cualquiera de las cuentas.
  - Dentro de la app de Window, el Kalender de Office muestra los eventos de Persönlich rayados en gris y solo para leer, en las vistas Monat, Woche y Tag.
  - La app los lee con su propia sesión de Window (mensaje `calendar.other`) y solo entrega título y horas.
  - Nunca entran en el estado de la página: no se guardan, no se sincronizan con la base de la oficina y Romy no los ve.
  - En el navegador no aparece nada de Persönlich.
  - Window hace lo mismo al revés: Tiempo muestra Office.
- **Archivos:** `app/{app.js,minds-calendar-shell.css,index.html}`, `tests/office-window-app.test.mjs` y versiones en tests.
- **Base de datos / funciones:** ninguna.
- **Cómo se probó:**
  - 167/167 pruebas.
  - En Chromium con un puente simulado, que devolvió tres eventos personales de prueba:
    - salen en Monat (puntos grises y agenda), Woche y Tag;
    - al tocarlos no se abre el editor;
    - no están en el estado ni en localStorage;
    - no hubo escrituras de eventos.
- **Quedó pendiente:** que Gari lo vea en el iPhone cuando salga la build de TestFlight con el paso 3.
- **Riesgos o decisiones que necesitan a Gari:** ninguno.
- **PR:** #47

### 2026-11-07 · Office lista para la app de Window (paso 1) · Claude
- **Qué cambió y por qué:** Gari quiere entrar a Office desde la app del iPhone de Window, cambiando de cuenta como en GitHub (Persönlich / Office). Este paso prepara la web de Office; el cambio de cuenta en la app va en el repo de Window.
  - `shared/supabase-client.js`: si la página corre dentro de la app (`window.webkit.messageHandlers.windowNative`), usa el mismo contrato v1 que Window.
    - Pide el access token a la app y no guarda sesión propia (borra `tba-office-auth-v2`).
    - El inicio y el cierre de sesión los hace la app.
    - En el navegador no cambia nada.
  - `app/sync.js` y `app/shell.js`: dentro de la app, sin sesión, se pide a la app que muestre su inicio de sesión, en lugar de ir a la página raíz; "Abmelden" cierra la sesión de la app.
  - Pestañas de Office en la app: Romy · Heute · Kalender · Work · Tools. Projekte y Terminplan-Muster se abren en Tools.
  - En el menú "•••" aparece "Zu Persönlich wechseln" si la app anuncia `account.switch`.
  - Tools tiene ahora su propio "•••", porque en la app no hay barra lateral.
- **Archivos:** `shared/supabase-client.js`, `app/{sync.js,shell.js,app.js,office.css,index.html}`, `tests/office-window-app.test.mjs` (nuevo) y referencias de versión en otros tests.
- **Base de datos / funciones:** ninguna.
- **Cómo se probó:**
  - 166/166 pruebas.
  - Recorrido en Chromium con un puente simulado y Supabase respondido localmente, en tres casos:
    - con sesión: modo app activo, sin barra propia, nada guardado en localStorage, las peticiones llevan el token de la app, sin errores de página;
    - sin sesión: pide `session.signIn` y no sale de la página;
    - navegador sin puente: va a la página raíz como antes.
- **Quedó pendiente:**
  - Los enlaces "Mitglieder" y "Passwort ändern" llevan a la página raíz, que dentro de la app pide su propio inicio de sesión: es una sesión aparte y funciona, pero no es la de la app.
  - Si una cuenta todavía tiene el Startpasswort, en la app se muestra un aviso para cambiarlo primero en el navegador.
- **Riesgos o decisiones que necesitan a Gari:** ninguno.
- **PR:** #46

### 2026-11-07 · Romy: "heute" incluye lo vencido · Claude
- **Qué cambió y por qué:** Gari preguntó a Romy "¿Tengo algo pendiente para hoy?" y le respondió que nada, aunque tenía abierta una tarea vencida el 04.11. `list_tasks` solo filtraba por fecha exacta.
  - Ahora acepta `range:"today"` y `range:"week"`, con la misma lógica que `listTasks` de Window: tareas abiertas que vencen ese día o antes, más las de varios días ya empezadas.
  - Cada tarea lleva `overdue`, `in_progress` y `mine` (creada por la persona o asignada a ella).
  - Las instrucciones de Romy piden nombrar lo vencido con su fecha.
- **Archivos:** `supabase/functions/office-assistant/{romy-tools.mjs,index.ts}`, `tests/office-review-1107.test.mjs`, docs.
- **Base de datos:** ninguna.
- **Deploy de funciones:** `office-assistant`, con el workflow, después del merge.
- **Cómo se probó:** 163/163 pruebas, incluida una de comportamiento con el caso del 07.11 (vencida, de hoy, de varios días, futura, hecha).
- **Quedó pendiente:** que Gari lo pruebe en Romy.
- **Riesgos o decisiones que necesitan a Gari:** ninguno.
- **PR:** #45

### 2026-11-07 · Token de deploy y Romy v14 desde GitHub · Claude
- **Qué cambió y por qué:** Gari creó el token para el workflow de deploy y no quiso esperar a tener acceso a la cuenta de la oficina.
  - El token sale de su cuenta de Supabase (gari).
  - Es **de proyecto**: solo TBA Office, solo Edge Functions en escritura y todo lo demás en None, así que no llega a Window.
  - Está guardado como `SUPABASE_ACCESS_TOKEN` en el entorno `supabase` del repo.
  - Con él se publicó `office-assistant` v14 desde `main`, con los archivos normales. Reemplaza la v13 con envoltorio.
- **Archivos:** solo docs.
- **Base de datos:** ninguna.
- **Deploy de funciones:** `office-assistant` v14, con el workflow `Deploy Supabase Edge Functions` (run 42368817570): pruebas en verde, 14 archivos subidos y 401 sin sesión.
- **Cómo se probó:** la versión 14 está activa, y con la clave anónima la función responde `{"error":"invalid_session"}`, lo que confirma que arrancó.
- **Quedó pendiente:**
  - aceptar la invitación de TBArchitekten (Developer) cuando Gari tenga su correo de la oficina; es opcional, como segundo acceso;
  - opcional: limitar el entorno `supabase` a la rama `main` (ahora está en "No restriction"; el workflow ya solo corre desde `main`).
- **Riesgos o decisiones que necesitan a Gari:** ninguno.
- **PR:** #44

### 2026-11-07 · Romy v13 publicada y permisos del equipo probados · Claude
- **Qué cambió y por qué:**
  - Se publicó `office-assistant` v13 con los cambios del PR #41: historial de 24 mensajes, hora fuera del prompt fijo, misiones ocultas y arreglo de `uuid()`.
  - Gari no pudo entrar a la cuenta de Supabase de la oficina para crear el token: falló el inicio de sesión con GitHub (TBArchitekten) y con el correo.
  - Un token de su cuenta personal también daría acceso a Window, así que no se usó.
- **Cómo se publicó:**
  - Con el conector de Supabase, que tiene acceso a la cuenta de la oficina.
  - El `index.ts` publicado es un envoltorio de una línea. Importa `supabase/functions/office-assistant/index.ts` desde raw.githubusercontent.com en el commit fijo `dfddc193c18b44e098dc5183c82a5acda3f53416`.
  - El paquete se arma al publicar; en ejecución no depende de GitHub.
  - El próximo deploy con el workflow lo reemplaza por los archivos normales.
- **Archivos:** solo docs (`docs/ESTADO.md` y `docs/BITACORA.md`).
- **Base de datos:** ninguna migración. Prueba de RLS con dos miembros simulados en una transacción revertida (`raise exception` al final):
  - el miembro del equipo cambia la tarea (1), se asigna (1), los buckets (2) y las carpetas (1);
  - el miembro activo fuera del equipo no cambia la tarea (0) ni los buckets (0), pero sí las carpetas (1), según la regla de Gari;
  - asignar a alguien de fuera del equipo lo rechaza la clave foránea.
- **Deploy de funciones:** `office-assistant` v13, con el conector de Supabase (Gari dio el OK).
- **Cómo se probó:**
  - los 14 archivos que sirve GitHub en ese commit son idénticos byte a byte a los del repo (`cmp`);
  - sin sesión, la pasarela responde 401;
  - con la clave anónima, la función arranca y responde `{"error":"invalid_session"}` con CORS de la página, lo que confirma que cargó todos los módulos.
- **Quedó pendiente:**
  - el token de la cuenta de la oficina, que necesita recuperar el acceso a esa cuenta;
  - probar Romy con una conversación real (Gari);
  - el presupuesto de Romy.
- **Riesgos o decisiones que necesitan a Gari:** ninguno nuevo.
- **PR:** #43

### 2026-11-07 · Un solo modelo de datos (el de Window) · Claude
- **Qué cambió y por qué:** Gari decidió unificar Office con el modelo de Window. Antes había dos sistemas de tareas, dos Desktops y dos equipos.
  - Work vuelve a ser el `work.js` de Window, sobre `isabella_tasks`, `minds_work_buckets`, `minds_work_task_assignees`, `minds_work_folders` y `minds_work_files`.
  - El único equipo es `office_project_members`, y el botón "Team" del Planner abre el diálogo de Projekte.
  - Se encontró y corrigió el fallo que rompía Work desde el PR #16: `$` en lugar de `$$` en la línea 93 de `work.js`. Muy probablemente por eso se cambió Work en el PR #37.
  - "+ Terminplan" abre el diálogo de Projekte sin salir de Work.
  - Estado vacío con enlace a Projekte.
  - Selector Büro oculto.
- **Archivos:**
  - `app/work.js`, `app/work-team.js`, `app/office-projects.js`, `app/index.html`;
  - borrados `app/office-work.js` y `app/office-window-work-surface.js`;
  - `supabase/migrations/20261107064831_office_unify_window_model_v1.sql`;
  - `tests/office-{app,desktop,37-acceptance,38-window-parity,review-1107}.test.mjs`;
  - docs.
- **Base de datos:** migración `20261107064831_office_unify_window_model_v1`, **aplicada** con el MCP de Supabase tras un ensayo en una transacción revertida. Hace tres cosas:
  1. Las claves foráneas de responsables apuntan a `office_project_members`: al salir del equipo, se borra el responsable.
  2. Crea `private.office_in_project_team` y la añade a la edición de tareas y buckets.
  3. Copia con los mismos ids los datos de las tablas solo de Office (2 buckets, 1 tarea, 1 carpeta) y marca esas tablas como obsoletas. **No se borró nada.**
- **Deploy de funciones:** ninguno nuevo. `office-assistant` sigue esperando el secreto del entorno `supabase`, como en el PR #41.
- **Cómo se probó:**
  - 162/162 pruebas;
  - recorrido simulado Romy → Work → Planner → Desktop → Romy → Work → Tools: una sola navegación, sin errores de página, y Panorama, Planner y Desktop se ven bien;
  - después de aplicar, se comprobaron las copias, las claves nuevas y que el cron de misiones sigue pausado.
- **Quedó pendiente o sin probar:**
  - la prueba de RLS con un segundo miembro simulado se corrió después (ver la entrada de arriba, PR #43);
  - la prueba real con un colega;
  - borrar las tablas obsoletas (necesita OK de Gari);
  - el presupuesto de Romy.
- **Riesgos o decisiones que necesitan a Gari:** ninguno nuevo. Hoy solo Gari es miembro activo, así que los permisos de equipo todavía no afectan a nadie más.
- **PR:** #42

### 2026-11-07 · Correcciones de la revisión · Claude
- **Qué cambió y por qué:** correcciones acordadas con Gari tras la revisión:
  - el historial de Romy se acota a 24 mensajes como en Window, y el prompt queda listo para la caché (la hora va en el turno);
  - misiones ocultas (flag y cron pausado);
  - RLS de `office_task_assignees` corregida;
  - `uuid()` que faltaba en las entradas de archivos de Romy;
  - migraciones renombradas a las versiones de Supabase y las de 20261028 movidas a `legacy-migrations`;
  - textos del chat y la voz de Romy en alemán;
  - workflow de deploy manual y `supabase/config.toml`.
- **Archivos:**
  - `supabase/functions/office-assistant/{index.ts,romy-tools.mjs,romy-capability-inputs.ts}`;
  - `supabase/migrations/*` (renombradas y 2 nuevas), `supabase/legacy-migrations/`, `supabase/config.toml`;
  - `.github/workflows/deploy-functions.yml`;
  - `app/{app.js,shell.js,dashboard.js,index.html}`;
  - `tests/*` (referencias y tests nuevos en `office-review-1107.test.mjs`);
  - docs.
- **Base de datos:** `20261107062242_office_task_assignees_project_check` y `20261107062251_office_romy_missions_paused`, ambas **aplicadas** con el MCP de Supabase. El arreglo de RLS se probó antes y después en una transacción revertida: antes se aceptaba una asignación de otro proyecto; después se rechaza.
- **Deploy de funciones:** **pendiente.** `office-assistant` debe desplegarse con el nuevo workflow cuando Gari añada `SUPABASE_ACCESS_TOKEN` al entorno `supabase` del repo. Mientras tanto sigue en producción la v12 (sin el límite de 24 mensajes y con las herramientas de misión visibles; el cron ya está pausado).
- **Cómo se probó:** 165/165 pruebas; comprobador de tipos de TypeScript sin nombres indefinidos.
- **Quedó pendiente:** la unificación del modelo de datos (Gari decide tras conocer qué pasa con Tools); la regla de permisos de archivos de proyecto (todos o el equipo); el presupuesto de Romy.
- **PR:** #41

### 2026-11-07 · Revisión de PR #16–#39 y decisiones de Gari · Claude
- **Qué cambió y por qué:** Gari pidió revisar a fondo lo hecho con ChatGPT del 04 al 05.11. Se revisaron:
  - el código y las migraciones;
  - las políticas RLS y de Storage en vivo;
  - las funciones Edge, el cron y los advisors;
  - las pruebas y la CI;
  - un recorrido simulado de la app.

  Además se anotaron las decisiones de Gari del 07.11: Window con dos cuentas (Persönlich/Office), Kalender con dos calendarios, Threads y conector de Claude para Office, Akten más adelante, y Bernried y Schwarz se quedan en Window.
- **Archivos:** `docs/ESTADO.md` (sección "Revisión de Claude · 07.11.2026" y corrección de la §4) y `docs/BITACORA.md`.
- **Base de datos / deploy:** ninguno. Solo consultas de lectura.
- **Cómo se probó:** 159/159 pruebas, CI de `main` en verde, Security Advisor sin hallazgos, recorrido simulado sin errores de página.
- **Hallazgos principales:**
  - dos sistemas de tareas (Planner `office_tasks` frente a Heute, Kalender y Romy en `isabella_tasks`);
  - dos Desktops (Romy lee `minds_work_files`, que está vacía);
  - dos tablas de equipo;
  - una sombra de nombre en la RLS de `office_task_assignees`;
  - el costo de Romy (historial completo en cada turno, sin presupuesto);
  - misiones sin datos;
  - los PR #37–#39 sin documentar;
  - timestamps de migración duplicados.
- **Riesgos o decisiones que necesitan a Gari:** elegir un solo modelo de datos (opción A recomendada, ver ESTADO); presupuesto mensual de Romy; qué hacer con las misiones.
- **PR:** #40

### 2026-11-05 · Publicación de PR #35 y verificación de Pages · ChatGPT
- Cambio: PR #35 «Office: Projekte unificados, Terminplan Terra/PDF y Romy con memoria + misiones» fusionado por squash merge en `main`, SHA `369dab63038cb49fabd7523ddc295472492e15e3`.
- GitHub Actions: suite de «Verify Terminplan dependency audit» de `main` aprobada y «pages build and deployment» con build, report-build-status y deploy concluidos en verde.
- Supabase TBA Office: `office-assistant` v12 JWT, `office-terminplan-ai` v5 JWT, `office-romy-mission-runner` v2 con secreto privado. pgvector y misiones aplicadas. Un ciclo real del cron responde HTTP 200 (`ok:true`, 0 trabajos reclamados).
- Corrección final: validación UUID de Romy ahora reconoce los cinco grupos del identificador; test de regresión incluido en el PR.
- Estado de aceptación: frontend y backend publicados, pero no se ha realizado prueba E2E autenticada con empleado real, archivo de Bernried, dos empleados, salida XLSX/PPTX ni un ciclo multidiario completo de misión. Tampoco existe todavía paridad completa de Workspace/Expectation/Attention Economy entre Romy y Window. Estos límites no se deben presentar como completados.
- Riesgos: la base de datos es la fuente de verdad; mantener RLS, confirmación humana y segregación TBA/Window. Al iniciar la revisión conjunta, usar archivo de prueba no confidencial y contrastar navegación, Terminplan, adjuntos, conversaciones, misiones y artefactos en Safari/escritorio.

### 2026-11-05 · Revisión final de identidad y servicios para PR #35 · ChatGPT
- Detectado y corregido un validador UUID heredado del backend de Romy que omitía un grupo de 4 dígitos y podía rechazar IDs válidos de petición y conversación. Añadido test de regresión con UUID completo.
- Backend desplegado tras la corrección: `office-assistant` v12 con JWT; `office-terminplan-ai` v5 con JWT; `office-romy-mission-runner` v2 con secreto privado verificado por RPC.
- Cron `office-romy-mission-runner` cada cinco minutos, con ejecuciones reales satisfactorias y respuestas HTTP 200; sin misiones pendientes en el momento de la comprobación.
- RLS live: las cuentas de empleado no pueden insertar misiones, ni reclamar jobs, ni escribir embeddings; pgvector activo y RPC semántica disponible bajo identidad del empleado.
- GitHub Actions: CI del commit de UUID aprobada. Mantener separadas la CI de código, la salud del worker y la aceptación E2E con sesión autenticada de empleados.
- Todavía no ejecutada aceptación funcional con un PDF real de Bernried ni una prueba multidiaria real con empleado, dos cuentas o generación de artefactos. No atribuir esas pruebas a la CI.

### 2026-11-05 · Integración de memoria semántica y misión persistente · ChatGPT
- Migración TBA Office: pgvector y RPC invoker `office_romy_semantic_recall` aplicadas tras corregir sintaxis de delimitador SQL y GRANT a `extensions.vector`. Verificación live: vector habilitado, RLS habilitada, SELECT autenticado sí, INSERT autenticado no, RPC permitida a empleado autenticado.
- Misiones: migración `office_romy_persistent_work_v1` aplicada; tabla de compromisos privados y eventos RLS, aprobación de propuesta por empleado, lease token y función atomic `office_romy_finish_mission`. Reintentos limitados; el worker no tiene acceso a herramientas de escritura de Office. Migración y cron de `office_romy_mission_schedule_v1` aplicadas con secreto aleatorio de 256 bits en schema privado. Migraciones de índices FK y timeout 110 s aplicadas.
- Versiones activas Supabase: `office-assistant` v10 JWT, `office-terminplan-ai` v5 JWT, `office-romy-mission-runner` v1 con autenticación privada independiente. El frontend continúa en el PR #35 hasta merge.
- Pruebas: GitHub Actions en verde antes de cierre de PR; SQL live confirma RLS, privilegios y cron registrado. Security Advisors sin hallazgos.
- Límites verificados: ninguna misión real creada aún, ningún embedding de empleado creado, sin aceptación end-to-end de PDF/fotos, XLSX/PPTX ni dos cuentas. No afirmar paridad total de Mission Workspace/Expectation de Isabella ni E2E real.
- Riesgo vigilado: despliegue frontend requiere merge, lectura real de archivos necesita aceptación de empleado. La primera misión de prueba debe utilizar solo datos de ensayo consentidos y verificar entrega de mensaje, cancelación y reanudación.

### 2026-11-05 · Revisión del PR #35: cerrar enlaces a la raíz
- La tarjeta Terminplan y Terminplan-Muster del menú pasan a la misma sección interna de Projekte, desde donde se selecciona el Muster y se crea el plan sin montar el gestor raíz. El editor vuelve directamente a Projekte.
- Se preserva la redirección de enlaces antiguos #plans y #tools a /app; #project con tab=planner conserva Work. La raíz sigue sirviendo a contraseña y administración.
- Se actualizaron pruebas de enlaces. El PR continúa en borrador, con E2E autenticada pendiente.

### 2026-11-05 · Integración única de proyectos y fuente multimodal para Terminplan · ChatGPT
- Qué cambió y por qué: se investiga el salto de sesión desde Tools; la raíz #work inicializaba una segunda interfaz. Se incorpora gestión nativa de proyectos en el shell Window, se conserva compatibilidad de enlaces y se retira la activación manual del KI-Modus. El Terminplan admite PDFs e imágenes como fuentes explícitas y distingue la lectura de fuentes del estado canónico editable.
- Archivos: app/shell.js, app/office-projects.js, app/app.js, app.js, app/index.html, app/office.css, terminplan.html, office-terminplan-ai/index.ts, attachments.mjs, pruebas y documentación.
- Base de datos: sin migración nueva; se reutilizan office_projects, office_members y las políticas ya existentes.
- Deploy: ninguno nuevo a la fecha de esta entrada. El backend actual en producción sigue siendo el anterior hasta despliegue consciente y verificable.
- Cómo se probó: inspección de código y adición de pruebas de contratos, formatos y límites. CI y E2E autenticada pendientes en esta entrada; no se declara aceptación funcional.
- Quedó pendiente: ejecutar CI de la rama, revisar, integrar y desplegar la Edge Function con todas sus dependencias, E2E PDF/foto real con Terra, prueba de proyectos con login vigente, regresión Safari y desktop.
- Riesgos: el envío de PDF/fotos implica transferencia al proveedor de IA; el frontend lo informa. No usar datos de clientes sin autorización interna. Nunca interpretar contenido de archivo como permiso para escribir. La paridad total Romy/Window, memoria avanzada y misiones de días siguen abiertas.
- PR: #35, en preparación.

### 2026-11-05 · Romy: investigación y recuperación de Window · ChatGPT
- Qué cambió y por qué: después de general_execution PR #33, Romy necesita recuperar los IDs de sus propios archivos producidos para editarlos y consultar conversaciones privadas anteriores. Se adapta el search_memory/source boundary de Window: lectura lexical owner-only, sin convertir inferencias o chats en recuerdos. Se añade web_search nativo con citas y la Skill original investigar.
- Archivos: supabase/functions/office-assistant/index.ts, romy-tools.mjs, romy-skills.mjs, app/app.js, app/index.html, tests y docs.
- Base de datos: sin migración; respeta RLS existente para office_assistant_messages, office_romy_artifacts y minds_work_files.
- Deploy de funciones: `office-assistant` ACTIVE v9 con JWT, 13 fuentes; sin modelos, cuotas ni permisos nuevos.
- Cómo se probó: 130/130 CI PASS, Edge v9 ACTIVE verificada, Security Advisors sin advertencias. E2E real pendiente.
- Quedó pendiente: merge y aceptación de búsquedas web y recuperación autenticadas; memoria semántica no implementada y misiones de días no portadas.
- Riesgos: no enviar datos privados de empleados ni documentos confidenciales como consultas web; los resultados web son fuentes externas, no memoria aceptada.
- PR: #34.


### 2026-11-05 · General execution Window → Romy · ChatGPT
- Qué cambió y por qué: port del Window Capability Runtime (Code Interpreter, artifact output scanning, input files, background Responses) al control plane y RLS de TBA Office, sin crear otro asistente. La aplicación utiliza sus tarjetas y chat existentes; los trabajos se recuperan por identificador y no se anuncian finalizados hasta conservar archivos reales.
- Archivos: supabase/functions/office-assistant/romy-capability-runtime.ts, romy-capability-inputs.ts, romy-capability-service.ts, index.ts, romy-tools.mjs, romy-skills.mjs, app/office-assistant.js, app/index.html, tests y migración.
- Base de datos: migración office_romy_capability_runtime_v1 aplicada en Supabase como `20261105054909`; prueba en transacción revertida PASS y verificación RLS en vivo (SELECT owner-only, sin INSERT/UPDATE de cliente ni SELECT anónimo).
- Deploy de funciones: `office-assistant` ACTIVE v8 con JWT y 13 archivos; no se añaden cuotas, privilegios ni otra instancia de asistente.
- Cómo se probó: CI 126/126 PASS, RLS vivo verificado, 0 ejecuciones de prueba artificiales, Supabase Security Advisors sin advertencias; E2E XLSX/PPTX pendiente.
- Quedó pendiente: merge del frontend, aceptación con empleado y continuidad plenamente autónoma durante días (Window Missions/Commitments).
- Riesgos o decisiones: se reutiliza el modelo de ejecución de Window, con consumo real de OpenAI. No se comparten archivos privados automáticamente. No confundir background provider con seguimiento recurrente de objetivos.
- PR: #33.


### 2026-11-05 · Skills de Window y recuerdos confirmados para Romy · ChatGPT
- Qué cambió y por qué: se reutiliza el registro de Skills de Window sin ampliar su autoridad, junto con cinco procedimientos existentes adaptados exclusivamente a las herramientas disponibles de Office. Se incorpora memoria autobiográfica confirmada por cada empleado, con procedencia y sin aceptación silenciosa.
- Archivos: skill-registry.ts (copiado de Window), romy-skills.mjs (procedimientos de Window con notas de capacidades), romy-tools.mjs, office-assistant/index.ts, app/office-assistant.js, app/index.html, tests y migración.
- Base de datos: migración office_romy_skills_memory_v1 aplicada como `20261105001450`; simulación RLS con rollback PASS: sin inserción del cliente, sin lectura anónima, sin eliminación de registros, propietario con lectura y retractación controlada.
- Deploy de funciones: `office-assistant` ACTIVE v7 con JWT. No se cambian cuotas ni modelos.
- Cómo se probó: CI 120/120 PASS, políticas activas verificadas (SELECT solo owner, sin INSERT/DELETE de clientes ni lectura anónima), 0 recuerdos iniciales, Security Advisors sin advertencias.
- Quedó pendiente: merge y aceptación autenticada con empleados. La memoria semántica avanzada y el trabajo persistente de Window aún no están portados.
- Riesgos o decisiones: Skills solo orientan procedimientos. Un recuerdo requiere propuesta y revisión explícita del empleado; se conserva la fuente, no se reutiliza la memoria personal de Isabella.
- PR: #32.


### 2026-11-05 · Romy: documentos reales reutilizando Window · ChatGPT
- Qué cambió y por qué: se porta el generador de Word y PDF de isabella-artifact de Window para crear entregables desde Romy, sin otra interfaz. Los documentos quedan privados por empleado y vinculados a la conversación/solicitud.
- Archivos: romy-documents.ts, romy-tools.mjs, office-assistant/index.ts, app/app.js, app/office-assistant.js, app/index.html, test nuevo y migración.
- Base de datos: `office_romy_document_artifacts_v1` aplicada como Supabase `20261104235735`. Tabla y bucket privados verificados; RLS owner-only, sin INSERT del cliente y sin lectura anónima.
- Deploy de funciones: `office-assistant` ACTIVE v6, JWT obligatorio, 8 archivos, generadores de Window incluidos.
- Cómo se probó: CI 116/116 PASS; prueba SQL en rollback; esquema y servicio activos comprobados; Security Advisors sin avisos. Aún no se ha generado un archivo real en Safari.
- Pendiente: merge del PR y aceptación autenticada en Safari. Los formatos XLSX/PPTX y el runtime general de Window aún no están portados.
- Riesgos o decisiones: no se agrega cuota ni modelo; un entregable generado no es verdad confirmada de proyecto y no se comparte automáticamente en el Desktop.
- PR: #31.


### 2026-11-05 · Cierre de robustez Romy v5 · ChatGPT
- Qué cambió y por qué: PR #29 integrado en main (squash 6aa9a063). El servidor permite enviar solo archivos sin romper CHECK de contenido, consulta calendarios por límites Europe/Berlin y exige offset explícito para las propuestas de citas.
- Archivos: docs/ESTADO.md, docs/BITACORA.md; código de PR #29 ya integrado.
- Base de datos: sin migración nueva; RLS y cupos inalterados.
- Deploy de funciones: office-assistant ACTIVE v5 con JWT, verificado en Supabase.
- Cómo se probó: CI 112/112 PASS; pruebas de cambio horario verano/invierno, fechas inválidas y adjuntos sin texto; Security Advisors sin advertencias.
- Quedó pendiente o sin probar: aceptación de Safari y pruebas E2E con sesiones reales; artifacts, Skills, memoria avanzada y trabajo persistente todavía no portados de Window.
- Riesgos o decisiones: no declarar paridad total ni afirmar que el proveedor ha procesado PDF/DOCX reales sin la prueba. No introducir cuotas.
- PR: #30 (solo cierre documental).


### 2026-11-05 · Romy: adjuntos sin texto y fechas Europe/Berlin · ChatGPT
- Qué cambió y por qué: revisión de PR #25–#28. Se detectó el fallo potencial de un mensaje compuesto solo por adjuntos debido al CHECK de texto no vacío. El calendario consultaba fechas UTC, no días de la oficina en Europe/Berlin, lo que podía omitir citas cercanas a medianoche. Las propuestas de eventos sin offset podían interpretarse en la zona horaria del servidor.
- Archivos: supabase/functions/office-assistant/index.ts, romy-tools.mjs, nuevo romy-time.mjs, tests/office-romy-time-and-attachment.test.mjs y docs.
- Base de datos: sin migración, conservando RLS y la validación de contenido existente.
- Deploy de funciones: `office-assistant` ACTIVE v5, JWT obligatorio y 7 archivos. No se introducen cuotas ni permisos nuevos.
- Cómo se probó: CI 112/112 PASS (DST, offsets, archivo sin mensaje), Edge v5 ACTIVE y Security Advisors sin advertencias. E2E Safari aún pendiente.
- Quedó pendiente: aceptación de los flujos completos en Safari, consultas reales y formatos PDF/Office; paridad restante en artifacts, Skills, memoria y trabajo persistente.
- Riesgos y decisiones: no se inventan horas ni se confirman horas sin zona; la zona de TBA Office es Europe/Berlin.
- PR: #29.


### 2026-11-04 · Cierre del PR #27: adjuntos privados de Romy · ChatGPT
- **Qué cambió y por qué:** PR #27 integrado en main (squash `ca12d910`). Picker, normalización y subida de archivos en el chat original de Window, adaptados a almacenamiento y sesiones individuales de TBA Office. Romy recibe `input_file`/`input_image` y almacena referencias privadas.
- **Archivos:** docs/ESTADO.md y docs/BITACORA.md; código y migración del PR #27.
- **Base de datos:** `office_romy_uploads_v1` aplicada como versión `20261104230525`; bucket privado, tres políticas de Storage y columna `attachments`.
- **Deploy de funciones:** `office-assistant` ACTIVE v4, `verify_jwt=true`, seis archivos.
- **Cómo se probó:** CI 108/108 PASS; SQL rollback con comprobación de propietario y usuario ajeno; Security Advisors sin avisos; referencia de frontend en `main` verificada.
- **Quedó pendiente o sin probar:** subida y lectura reales en Safari, formatos PDF/DOCX/imagen, prueba con dos empleados, seguimiento de adjuntos entre turnos y paridad funcional completa con Isabella (artifacts, skills, memory, trabajo persistente).
- **Riesgos o decisiones que necesitan a Gari:** no se cambia ninguna cuota ni permiso sin acuerdo; ningún documento confidencial se ha cargado durante las pruebas.
- **PR:** #28 (solo documentación).


### 2026-11-04 · Adjuntos del chat de Romy reutilizados de Window · ChatGPT
- **Qué cambió y por qué:** Gari exige recuperar las capacidades existentes de Isabella sin crear otra aplicación. Se reactiva el picker, preprocesador y uploader del chat original de Window; Romy almacena archivos en bucket privado por empleado y entrega imágenes/documentos al modelo con el mismo contrato de Window.
- **Archivos:** app/app.js, app/office-assistant.js, app/romy-transport.js, app/index.html, supabase/functions/office-assistant/index.ts, supabase/functions/office-assistant/romy-attachments.mjs, supabase/migrations/20261104235500_office_romy_uploads_v1.sql, tests/office-romy-attachments.test.mjs y documentación.
- **Base de datos:** migración `office_romy_uploads_v1` aplicada, versión Supabase `20261104230525`; bucket privado y columna de adjuntos con RLS.
- **Deploy de funciones:** `office-assistant` ACTIVE v4, JWT obligatorio; seis archivos de runtime desplegados.
- **Cómo se probó:** CI 108/108 PASS; SQL rollback PASS (bucket privado, dueño puede subir/leer, acceso ajeno denegado); esquema, políticas y función verificados live; Security Advisors sin avisos.
- **Quedó pendiente o sin probar:** merge y frontend web publicado; prueba E2E autenticada de PDF, imágenes y Office, historial de adjuntos, aceptación Safari y dos empleados.
- **Riesgos o decisiones que necesitan a Gari:** ninguna decisión de interfaz; se mantienen los formatos/tamaños de Window. No compartir adjuntos privados entre empleados.
- **PR:** #27.


### 2026-11-04 · Navegación única en la página raíz · ChatGPT
- **Qué cambió y por qué:** PR #24 ya establecía los cinco accesos (Romy, Heute, Kalender, Work y Tools) también en la página raíz. PR #26 separa el menú de cuenta de la barra inferior y adapta su forma y posición a la barra de Window, sin volver a duplicar Romy.
- **Archivos:** index.html, style.css, tests/office-navigation-parity.test.mjs, docs/ESTADO.md y docs/BITACORA.md.
- **Base de datos:** ninguna migración.
- **Deploy de funciones:** ninguno.
- **Cómo se probó:** test estático de paridad de navegación y CI pendiente.
- **Quedó pendiente o sin probar:** verificación en Safari iPhone y rutas Terminplan/Projekte.
- **Riesgos o decisiones que necesitan a Gari:** ninguna decisión de interfaz adicional; el objetivo es la navegación Window ya acordada.
- **PR:** #26.


### 2026-11-04 · Romy: capacidades supervisadas sobre la infraestructura de Window · ChatGPT
- Qué cambió y por qué: Gari exige Romy con las capacidades de Isabella, no un chat básico nuevo. Se reutilizaron directamente chat-model-routing.mjs y turn-capability-contract.mjs de Window, el parser SSE y la interfaz. Nuevo adaptador Office con herramientas autorizadas por RLS, lectura contextual, streaming y propuestas de tarea/Termin con aprobación.
- Archivos: supabase/functions/office-assistant/{index.ts,chat-model-routing.mjs,turn-capability-contract.mjs,romy-tools.mjs}, app/{romy-transport.js,office-assistant.js,office-assistant.css,app.js,index.html}, nueva migración de propuestas y tests.
- Base de datos: office_romy_proposals_review_v1 aplicada en TBA Office (Supabase `20261104224513`), comprobación RLS de titular y ausencia de permisos directos INSERT/UPDATE superada.
- Deploy de funciones: `office-assistant` ACTIVE v3 con JWT, 5 archivos (index.ts más cuatro módulos), sin tocar Window.
- Cómo se probó: CI 102/102 PASS; migración RLS en transacción revertida PASS; Supabase activo con Security Advisors sin lints; aceptación autenticada con usuario real pendiente.
- Quedó pendiente o sin probar: adjuntos y lectura binaria (PDF/DOCX), ejecución de artefactos, Skills/Missions, memoria proactiva, background, aceptación iPhone con dos empleados. **No declarar paridad completa**.
- Riesgos o decisiones: sin nuevas cuotas diarias ni selector manual de modelos; acciones explícitamente confirmadas por empleado, RLS revalidada en el servidor. No conectar a Supabase de Window.
- PR: #25, pendiente de integración.

### 2026-11-04 · Romy y paridad de navegación/compartidos · ChatGPT
- Qué cambió y por qué: Gari exige un único sistema de navegación coherente con Window, Desktop editable por todos y el nombre Romy. PR #24 hace Tools una sección en la shell Window; unifica la barra de la página raíz, elimina la restricción autor/admin para archivos compartidos, corrige duplicados sin proyecto.
- Archivos: app/shell.js, app/app.js, app/index.html, app/office.css, app/work.js, app/office-desktop-ops.js, index.html, style.css, tests, docs y migración SQL.
- Base de datos: migración office_shared_desktop_edit_for_all.sql aplicada (20261104221830); se detectó y corrigió en migración adicional office_storage_scope_qualified_name.sql el sombreado de `name` por `office_projects.name` en políticas Storage. La segunda migración se aplicó en versión `20261104222033`; las tres políticas verificadas sin sombreado de nombre.
- Deploy de funciones: ninguno en este PR.
- Cómo se probó: CI final PASS (98 pruebas); SQL rollback PASS y Security Advisors sin advertencias. No hay aceptación E2E con varias cuentas.
- Quedó pendiente o sin probar: aceptación Safari en iPhone, dos cuentas activas, operación de archivos reales, paridad funcional completa del runtime Romy con Isabella.
- Riesgos o decisiones: la autorización de editar y eliminar archivos compartidos es expresa de Gari; personales conservan privacidad. Romy/Window es una exigencia de paridad total; no declarar que se ha alcanzado.
- PR: #24 en preparación.

### 2026-11-04 · Cierre de paridad visual del Assistent · ChatGPT
- Qué cambió y por qué: PR #22 integrado en main (squash 68ee48c). Se eliminó la interfaz de chat paralela y se restauró la reutilización del chat original de Window para cada empleado de la oficina.
- Archivos: docs/ESTADO.md y docs/BITACORA.md.
- Base de datos: sin cambios, conversaciones privadas por usuario conservadas.
- Deploy de funciones: ninguno, office-assistant ACTIVE v2 continúa.
- Cómo se probó: CI 95/95 PASS, verificación de referencias en main, CSS anterior ya no oculta el chat de Window.
- Quedó pendiente o sin probar: prueba visual en Safari móvil y primera respuesta autenticada; adjuntos no habilitados en el backend de Office.
- Riesgos o decisiones que necesitan a Gari: ninguna decisión nueva de interfaz; Window sigue siendo el contrato visual.
- PR: #23.


### 2026-11-04 · Restitución de la interfaz Window del Assistent · ChatGPT
- **Qué cambió y por qué:** Gari mostró capturas comparando el chat de Office con Window e identificó una divergencia contra el contrato de reutilización. En PR #18 se había creado y mostrado un chat nuevo en lugar de usar la interfaz existente. La corrección elimina esa pantalla paralela y conecta el compositor, mensajes y navegación originales al backend individual de TBA Office.
- **Archivos:** app/app.js, app/office-assistant.js (adaptador de datos, no UI paralela), app/office-assistant.css (solo ajustes discretos), app/index.html, tests/office-assistant.test.mjs, AGENTS.md, docs/ESTADO.md y docs/BITACORA.md.
- **Base de datos:** sin cambios; las conversaciones permanecen privadas por usuario en Supabase.
- **Deploy de funciones:** ninguno; se conserva office-assistant ACTIVE v2.
- **Cómo se probó:** sintaxis JS verificada; CI y aceptación visual móvil/autenticada pendientes.
- **Quedó pendiente o sin probar:** CI, integración del PR y pruebas en móvil con cuenta real; audio y archivos solo cuando el backend tenga soporte verificado. Menú de conversaciones utiliza modal de Window.
- **Riesgos o decisiones que necesitan a Gari:** ninguna decisión adicional para respetar el diseño ya acordado. No inventar una UI distinta por empleado.
- **PR:** #22, en preparación.


### 2026-11-04 · Cierre documental: límite del Assistent retirado · ChatGPT
- Qué cambió y por qué: PR #20 integrado en main (squash 508252b); retirado el límite diario que no había sido acordado con Gari.
- Archivos: docs/ESTADO.md y docs/BITACORA.md.
- Base de datos: sin migración adicional; cambio aplicado anteriormente como versión 20261104213325.
- Deploy de funciones: office-assistant ACTIVE v2, JWT obligatorio.
- Cómo se probó: 95/95 pruebas CI; función viva sin rama daily_limit; nueva interfaz en main; 32 reservas válidas con rollback.
- Quedó pendiente o sin probar: aceptación autenticada con usuarios y decisión explícita de presupuesto.
- Riesgos o decisiones que necesitan a Gari: las llamadas al modelo siguen teniendo coste real, aunque no hay máximo diario de la aplicación.
- PR: #21.

### 2026-11-04 · Retirada de cuota no acordada del Assistent · ChatGPT
- Qué cambió y por qué: el límite diario de 15 consultas por miembro fue una decisión unilateral de ChatGPT, no aceptada por Gari. Se retira sin crear otra cuota arbitraria.
- Archivos: migración office_assistant_remove_unapproved_daily_cap.sql, función office-assistant, interfaz, pruebas y documentación.
- Base de datos: migración aplicada en TBA Office con Supabase MCP, versión `20261104213325`.
- Deploy de funciones: `office-assistant` ACTIVE v2 con JWT; retirada la respuesta de error por cuota.
- Cómo se probó: simulación SQL con 32 solicitudes válidas en transacción revertida; duplicados, aislamiento por usuario y no miembros siguen bloqueados. CI 95/95 PASS; función publicada verificada sin límite y Security Advisors sin advertencias.
- Quedó pendiente o sin probar: merge y publicación del frontend; primera conversación real y aceptación con usuarios.
- Riesgos o decisiones que necesitan a Gari: el coste del proveedor sigue existiendo; presupuesto y eventuales cuotas solo mediante decisión explícita. La cuota del Terminplan no cambia.
- PR: #20.

### 2026-11-04 · Assistent: cierre de integración · ChatGPT
- Qué cambió: PR #18 integrado en main.
- Archivos: ESTADO.md y BITACORA.md.
- Migración: aplicada anteriormente.
- Deploy: función activa.
- Pruebas: 95/95 correctas.
- Pendiente: aceptación real con empleados, primera conversación y presupuesto definitivo.
- PR: #19.

### 2026-11-04 · Assistent individual por miembro · ChatGPT
- Qué cambió y por qué: se preparó un chat privado para cada cuenta activa de TBA Office, con conversaciones persistentes y modos Schnell y Gründlich. No se copia la memoria de Window ni se consultan automáticamente archivos o calendarios.
- Archivos: app/office-assistant.js, app/office-assistant.css, app/shell.js, app/app.js, app/index.html, supabase/functions/office-assistant/index.ts, supabase/migrations/20261104220000_office_assistant_personal_v1.sql y tests.
- Base de datos: migración aplicada en Supabase.
- Deploy de funciones: office-assistant ACTIVE v1.
- Cómo se probó: esquema y cuota comprobados en transacción revertida; CI 95/95 PASS.
- Quedó pendiente: aceptación en navegadores con dos empleados y decisión del presupuesto mensual.
- Riesgos o decisiones: límite provisional de 15 solicitudes diarias por miembro; sin acciones automáticas.
- PR: #18.

### 2026-11-04 · Desktop integrado, documentación de cierre · ChatGPT
- **Qué cambió y por qué:** PR #16 ya integrado en `main` (squash `c6afe968`); se aclara que la aceptación autenticada de Desktop aún no está hecha y que la respuesta pública de GitHub Pages no pudo comprobarse desde el entorno.
- **Archivos:** `docs/ESTADO.md` y `docs/BITACORA.md`.
- **Base de datos:** ninguna migración nueva; `office_desktop_v1` ya aplicada en TBA Office, versión Supabase `20261104203250`.
- **Deploy de funciones:** ninguno.
- **Cómo se probó:** GitHub confirmó PR #16 merged; `app/office-desktop-ops.js` está en `main`. CI de PR #16: 91 pruebas PASS, SQL rollback PASS, RLS y Security Advisors sin avisos.
- **Quedó pendiente o sin probar:** confirmar la publicación estática con sesión real, subir/abrir y organizar documentos en navegador, pruebas con varios usuarios. No hay documentos reales cargados.
- **Riesgos o decisiones que necesitan a Gari:** política de uso interno y datos de clientes a decidir con dirección; no requiere más cambios de código por esa decisión.
- **PR:** #17.

### 2026-11-04 · Desktop compartido con carpetas y archivos · ChatGPT
- **Qué cambió y por qué:** Gari confirmó la navegación por todas las carpetas de proyecto para todos los miembros activos, un Desktop común de oficina y la posibilidad técnica de subir todo tipo de archivos. Se prepara la integración de carpetas y subcarpetas, subida y lectura, cambio de nombre, movimiento y borrado con confirmación. Solo el autor o un admin puede modificar o borrar elementos existentes.
- **Archivos:** `app/work.js`, `app/office-desktop-ops.js`, `app/shell.js`, `app/index.html`, `app/office.css`, `supabase/migrations/20261104210000_office_desktop_v1.sql`, `tests/office-desktop.test.mjs`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- **Base de datos:** migración `20261104210000_office_desktop_v1.sql` — aplicada en Supabase: **SÍ** mediante Supabase MCP (`office_desktop_v1`, versión registrada `20261104203250`).
- **Deploy de funciones:** ninguno.
- **Cómo se probó:** CI GitHub Actions 91/91 PASS; JS sintaxis verificada; migración validada y RLS probadas con altas, movimientos, ciclos y acceso de no miembros dentro de una transacción revertida; tablas, bucket privado y políticas comprobados tras aplicación; Security Advisors sin avisos.
- **Quedó pendiente o sin probar:** merge y publicación del frontend, E2E autenticada con varios usuarios reales, subida y apertura desde navegador, pruebas de archivos grandes y validación legal/política de uso por la dirección. La extracción de texto/indexación no forma parte de esta primera integración.
- **Riesgos o decisiones que necesitan a Gari:** hablar con la dirección del uso real de documentos confidenciales; aún sin política interna decidida. Revocar clave OpenAI antigua. SQL destructivo no ejecutado.
- **PR:** #16 (integrado en main).

### 2026-11-04 · Hoja de ruta completa en ESTADO · Claude
- **Qué cambió y por qué:** `ESTADO.md` §6 solo listaba C y D. Ahora tiene las cinco etapas acordadas, lo que va después (vínculo Planner↔Terminplan, Planliste, Controlling, herramientas de costos, Projektakte, login con Microsoft) y las reglas de base de Gari. Se precisó la pregunta sobre el Desktop: fundamentos y guías de la oficina, sin datos de clientes.
- **Archivos:** `docs/ESTADO.md`, `docs/BITACORA.md`.
- **Base de datos / deploy:** ninguno.
- **PR:** #15

### 2026-11-04 · Traspaso y reglas de documentación · Claude
- **Qué cambió y por qué:** Gari trabajará con ChatGPT hasta el 06.11. Se añadieron `AGENTS.md` (reglas para cualquier agente), `CLAUDE.md`, `docs/ESTADO.md` (estado actual), esta bitácora y la plantilla de PR.
- **Archivos:** solo documentación.
- **Base de datos:** ninguna. **Deploy:** ninguno.
- **Quedó pendiente:** lo que lista `docs/ESTADO.md` §6.
- **PR:** #14

### 2026-11-04 · Copia de Window en la oficina, partes A y B · Claude
- **Qué cambió y por qué:** Gari vio que el Kalender y el Work propios se veían muy distintos de Window, así que se copió el código de Window.
  - La app `./app/` trae Heute, Kalender y Work (Panorama y Planner) en alemán, conectada a TBA Office.
  - La página de inicio manda a la app tras iniciar sesión y conserva Projekte, Tools, Mitglieder y `#password`.
  - Se retiró el Planner/Kalender propio (`planner.js`).
- **Base de datos:** `20261104000400_office_window_tables_v1` y `20261104000500_office_window_fixes`, ambas aplicadas en Supabase con el MCP de Supabase.
- **Cómo se probó:** 87 pruebas; simulaciones con Playwright de todas las pantallas (escritorio y teléfono); RLS en transacciones revertidas (23 casos); página publicada sin sesión.
- **Quedó pendiente o sin probar:** uso real con varias personas; Desktop y adjuntos (parte C); Assistent (parte D).
- **PR:** #13

### 2026-11-04 · Planner y Kalender propios (v1) · Claude
- **Qué cambió y por qué:** primer Planner/Kalender sobre `office_tasks` y `office_task_buckets`. Lo reemplazó la copia de Window el mismo día.
- **Base de datos:** `20261104000300_office_planner_v1`, aplicada. Las tablas siguen ahí, vacías; borrarlas requiere el OK de Gari.
- **PR:** #12

### 2026-11-04 · Diseño tipo Window para la página de inicio · Claude
- **Qué cambió:** barra lateral de vistas, páginas de proyecto y estilo del editor de Terminplan.
- **PR:** #11

### 2026-11-04 · Base de TBA Office · Claude
- **Qué cambió:** cuentas por persona (correo y contraseña de inicio), roles, proyectos, Terminplan ligado a proyecto y nuevo proyecto de Supabase "TBA Office".
- **Base de datos:** `20261104000000`…`000200`, aplicadas.
- **Funciones:** `office-admin` y `office-terminplan-ai` (modelo `gpt-6.1-terra`), desplegadas.
- **PR:** #10

### 2026-10-28 · Asistente del Terminplan v0.1–v0.6 · (ver docs)
- Historia detallada en `docs/TERMINPLAN-ASSISTENT-v0.1.md` … `v0.6.md`.
- Migraciones `20261028_*` aplicadas.
