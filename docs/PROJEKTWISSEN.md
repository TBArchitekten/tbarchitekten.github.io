# Projektwissen

Stand 26.11.2026. Ein gemeinsamer Wissenspool je Projekt: Was im Projekt erarbeitet wird (in einem Chat mit Claude, in einer Recherche, in einem Gespräch), gehört dem Projekt und nicht der Person, die es erarbeitet hat. Die KI schreibt und pflegt die Seiten; das Projektteam liest, fragt und korrigiert. Niemand muss etwas ordnen.

Was es nicht ist: Der **Desktop** bleibt der Dateiserver des Büros (PDFs und Pläne legt jede Person selbst ab). Die **Threads** bleiben private Gespräche mit Romy.

## So wird es benutzt

**Mit Claude** (Connector «TBA Office», siehe `OFFICE-CONNECTOR.md`): In einem Chat zu einem Projekt genügt «pásalo al Office» oder «Ins Office übernehmen», nicht erst am Ende: immer dann, wenn ein Ergebnis da ist (eine Recherche oder ein Vergleich abgeschlossen, etwas entschieden, oder bevor der Chat ein paar Tage liegt), auch mehrmals im selben Chat. Beim zweiten Mal teilt Claude nur, was seitdem neu ist oder sich geändert hat. Claude

1. öffnet das Projekt (`open_project`: Seiten, Entscheidungen, offene Beiträge, Neues),
2. teilt das Wissen aus dem Chat als **Beitrag** (`share_knowledge`): vollständig, auf Deutsch, mit Herkunft; der Beitrag bleibt unverändert,
3. arbeitet es in die **Seiten** ein (`read_page`, dann `write_page`): jede betroffene Seite wird als aktueller Stand neu geschrieben, Zusammengehöriges zusammengeführt, Verwandtes mit `[[Titel]]` verknüpft, Widersprüche benannt,
4. hält **Entscheidungen** fest (`record_decision`),
5. sagt in drei bis fünf Zeilen, was sich geändert hat.

Auf Wunsch («Wissen pflegen») liest Claude alle Seiten, führt Doppeltes zusammen, ersetzt Überholtes und arbeitet offene Hinweise ein.

**Nachts von selbst** (seit dem 26.11.2026, geplante Aufgabe in Claude): Montag bis Freitag gegen 23 Uhr arbeitet Claude die offenen Beiträge und Hinweise des Teams in die Seiten ein; im Verlauf steht als Grund «Nächtliche Pflege: …». Freitags kommen alle Seiten dazu: ein vergangener Termin ohne bekanntes Ergebnis wird zur offenen Frage, eindeutig Doppeltes wird zusammengeführt, Widersprüche zwischen Seiten werden benannt. Die nächtliche Pflege schlägt Entscheidungen nur vor; bestätigen tut die Projektleitung. Sie läuft über den Connector mit Garis Konto, also nur in Projekten, in deren Team er ist, und meldet ihm, was sich geändert hat.

**Im Office:** Work → Reiter **Wissen** (gleich neben Panorama).

- Links die Seiten (die zuletzt geänderte oben), dazu «Neu» (was auf die KI wartet und was sich zuletzt geändert hat) und «Entscheidungen».
- Jede Seite zeigt ihren Stand, ihre Herkunft (die Beiträge, aus denen sie entstand), offene Hinweise, Verweise hierher und die früheren Fassungen.
- «Hinweis geben» auf einer Seite und «Notiz teilen» oben: das Team schreibt nicht in die Seiten, sondern gibt der KI Beiträge, die sie beim nächsten Mal einarbeitet. So bleibt jede Seite ein Text aus einem Guss, und nichts geht verloren.
- Vorgeschlagene Entscheidungen bestätigt oder verwirft die Projektleitung (oder ein Admin im Team).
- Die Suche findet Seiten und Beiträge.
- **Im Panorama** die Karte «Neu im Projektwissen» (seit dem 26.11.2026, nur für das Projektteam): Zahl der Seiten, Entscheidungen zur Bestätigung, Beiträge, die auf die KI warten, und die letzten drei Änderungen; ein Klick öffnet das Wissen an dieser Stelle.

## Vorbilder (Recherche vom 26.11.2026)

| Vorbild | Was wir übernehmen |
| - | - |
| Das von einer KI gepflegte Wiki (Karpathy, «LLM Wiki»): Rohquellen bleiben unverändert, die KI schreibt daraus ein Wiki, ein Regelwerk sagt wie | Beiträge (unverändert) → Seiten (von der KI gepflegt) → Regeln (`office_wissen_regeln`) |
| Garten statt Strom (Caulfield, 2015) | Seiten werden fortgeschrieben, nicht als Chronik angehängt; der Strom ist das Protokoll («Neu») |
| Evergreen Notes (Matuschak) | Seiten nach Sachen («Bodenbelag Flure»), nicht nach Datum oder Person; verknüpft statt in Ordnern |
| Gemeinsame Datenumgebung nach ISO 19650 (in Arbeit, geteilt, veröffentlicht, archiviert) | Beitrag (geteilt) → Seite (gültiger Stand) → frühere Fassungen (Archiv) |
| Architecture Decision Records (Nygard, 2011) | Eine Entscheidung wird ersetzt, nie gelöscht; die alte bleibt sichtbar |

## Modell

| Teil | Wo | Wer schreibt | Wer liest |
| - | - | - | - |
| Beiträge | `office_wissen_beitraege` | jedes Mitglied des Projektteams (Claude, «Notiz teilen», «Hinweis geben») | Projektteam |
| Seiten | `minds_work_memory`, `memory_type 'document_state'`, `metadata.kind 'wissensseite'` | die KI über `write_page` | Projektteam |
| Frühere Fassungen | `office_wissen_versionen` | von selbst bei jedem Schreiben | Projektteam |
| Entscheidungen | `minds_work_memory`, `memory_type 'decision'` | die KI (vorgeschlagen); beschlossen nur die Projektleitung | Projektteam |
| Protokoll | `office_wissen_protokoll` | von selbst | Projektteam |
| Regeln | `office_wissen_regeln` (eine Zeile) | Admins | alle Mitglieder |

Je Projekt gilt eine Seite je Titel (Groß- und Kleinschreibung egal). Eine zusammengeführte Seite wird «ersetzt» und leitet auf die Seite weiter, in der sie aufging; wer später an sie schreibt, landet dort. Eine ersetzte Entscheidung zeigt, wodurch sie ersetzt wurde; eine Arbeitsregel, die zuerst als Entscheidung festgehalten war, steht als «ersetzt» mit Verweis auf ihre Seite (`metadata.auf_seite`).

## Regeln für die KI (Kurzfassung)

Der volle Text steht in `office_wissen_regeln` und geht bei jedem Teilen an Claude.

- Eine Seite je Sache, die man im Projekt nachschlägt; lieber wenige gehaltvolle Seiten. Titel kurz, sachlich, ohne Datum und ohne Personen.
- Aufbau: zuerst in zwei bis vier Sätzen, wo die Sache steht; dann die Einzelheiten; am Ende die offenen Fragen.
- Nichts erfinden; Unsicheres kennzeichnen; Zahlen mit Einheit und Stand; Herkunft in Klammern.
- Stand der Quellen (seit 27.11.2026): es zählt das Datum des Inhalts (Protokoll, E-Mail, Planindex), nicht das des Hochladens; eine ältere Quelle überschreibt nie eine neuere; ist das Datum nicht zu erkennen, steht die Aussage mit «Stand unklar» bei den offenen Fragen, und es wird nachgefragt (Migration `…_office_wissen_regeln_stand.sql`).
- Neues wird eingearbeitet, nicht angehängt. Ungeklärte Widersprüche werden mit beiden Herkünften benannt.
- Als Entscheidung gilt nur, was das Projekt bindet (was geplant oder gebaut wird, Umfang, Kosten, Termine, Vorgaben der Bauherrschaft). Arbeitsregeln des Teams (wie wir mit Herstellern arbeiten, wie wir E-Mails und Unterlagen formulieren) stehen auf den Seiten.
- «beschlossen» nur, wenn ausdrücklich entschieden hat, wer es zu entscheiden hat: die Bauherrschaft, was ihr zusteht; die Projektleitung, was die eigene Planung betrifft. Eine Empfehlung an die Bauherrschaft bleibt «vorgeschlagen», bis sie zustimmt (seit dem 26.11.2026 nach dem ersten Einsatz, Migration `20261126215655_office_projektwissen_entscheidungen.sql`).
- Was nicht hineingehört, regelt der Leitfaden «Was darf ins TBA Office?» (keine Gehälter, Personal-, Ausweis-, Bank- oder Gesundheitsdaten, Passwörter, Normtexte; was die Bauherrschaft nur auf Papier will).

## Sicherheit

- Lesen darf nur das **Projektteam** (ausdrückliche Mitgliedschaft, `private.office_project_team_has_access`, wie die Projektakte). Ein Admin außerhalb des Teams liest nichts. Wer nicht im Team ist, sieht im Reiter eine Erklärung statt leerer Seiten.
- Geschrieben wird nur über vier Funktionen (`security definer`, Teamprüfung): `office_wissen_beitrag_teilen`, `office_wissen_seite_schreiben`, `office_wissen_entscheidung`, `office_wissen_entscheidung_pruefen` (nur Projektleitung oder Admin). Auf die neuen Tabellen gibt es keine Schreibrechte.
- Gleichzeitiges Schreiben: `write_page` nimmt den gelesenen Stand (`basis`) mit; hat inzwischen jemand anderes geschrieben, lehnt die Funktion ab (40001), und Claude liest neu.
- Gelöscht wird nichts: jede frühere Fassung bleibt; `minds_work_memory` hat ohnehin kein Löschrecht. Direkt in `minds_work_memory` gelten deren bisherige Regeln (eigene Zeilen); die Oberfläche und der Connector schreiben nur über die Funktionen.
- Die Oberfläche zeigt Markdown sicher: erst escapen, dann wenige Formen (Überschriften, Listen, Tabellen, Zitate, Code, Links nur `https`/`mailto`).

## Romy

- **Im Chat mit Romy** (Windows Motor, `isabella-chat`) findet die Projektsuche `search_work` die Seiten und Entscheidungen schon, denn sie liest die Projektakte (`minds_work_memory`) mit Titel, Text und Status. Der Motor ist byte-gleich mit Window (`docs/sync-window-engine-manifest.json`); Änderungen daran gehen über Window.
- **In den Threads** (Work → Threads, `office-assistant`) seit dem 26.11.2026 zwei lesende Werkzeuge: `search_project_knowledge` (Seiten mit Kurzfassung und Stand, Entscheidungen «beschlossen» oder «vorgeschlagen», mit Suchbegriff ein Auszug) und `read_project_knowledge_page` (eine Seite ganz, mit Verweisen und ihren Entscheidungen; eine zusammengeführte Seite führt zur neuen). Beide mit dem JWT der Person: nur das Projektteam sieht etwas. Romy schreibt nicht ins Projektwissen.

## Dateien

- Datenbank: `supabase/migrations/20261126193119_office_projektwissen.sql`; Abnahme `tests/sql/office-projektwissen-acceptance.sql` (in CI gegen eine leere Supabase).
- Connector: `supabase/functions/office-mcp/office-wissen.mjs`, Werkzeuge und Ablauf in `index.ts`.
- Oberfläche: `app/office-wissen.js`, `app/office-wissen.css`; Reiter in `app/shell.js`, Aufruf in `app/work.js`.
- Tests: `tests/office-projektwissen.test.mjs`, `tests/browser/office-wissen.chromium.mjs`.

## Nächste Schritte (offen)

- Nächtliche Pflege auch für Projekte, in deren Team Gari nicht ist (heute läuft sie mit seinem Konto), zum Beispiel durch Romy im Office selbst.
- Dasselbe für Window (Garis eigene Projekte).
