# Muster-Terminplan LPH 3 · Planungshinweise

Stand 15.11.2026 · gehört zum Muster-Terminplan LPH 3 (Vorlage `supabase/seed/terminplan-templates.json`).

**Ein Terminplan enthält keine Notizen** (Entscheidung Gari, 15.11.2026): Er zeigt Vorgänge, Termine, Verantwortliche und Abhängigkeiten. Begründungen und Annahmen stehen hier, Arbeitsanweisungen im Planner (Aufgabenbibliothek), Entscheidungen und Änderungsgründe in Protokoll und Projektakte. Bis v1.5 standen die folgenden Hinweise als Notizen in der Vorlage; seit v1.6 nur noch hier. Wer die Vorlage für ein Projekt anpasst, prüft sie.

## Allgemein

- Richtwerte für einen privaten Auftrag mit bekannten Fachplanern. BRS optional, Fachplanerbeauftragung und lokale Feiertage prüfen.

## Je Vorgang

| PSP | ID | Vorgang | Hinweis |
|---|---|---|---|
| 00.02 | `t001` | Erforderliche Fachplaner, Leistungsbilder und Ansprechpartner klären | Leistungsbedarf, Disziplinen und Zuständigkeiten festhalten. Bei bereits beauftragten Fachplanern Angebots- und Beauftragungsphase überspringbar. |
| 00.05 | `t051` | Angebote und Leistungsumfänge der Fachplaner anfordern und klären | Orientierungswert für private Direktbeauftragung bei bereits bekannten Fachplanern, kein VgV- oder gesetzlicher Mindestzeitraum. |
| 00.06 | `t052` | Fachplanerauswahl, Konditionen und Beauftragung entscheiden | Auftraggeber entscheidet und beauftragt. Bei öffentlicher Vergabe eigenes Verfahren mit gesetzlichen Fristen planen. |
| 01.01 | `t006` | Planpaket · Arbeitsstand 01 (Grundrisse, Ansichten, Schnitte) erarbeiten | Lieferumfang dokumentieren: Grundrisse, Ansichten, Schnitte, Erläuterungen und geeignete Arbeitsstände für Fachplaner. |
| 01.02 | `t007` | Interne Vollständigkeits- und Konsistenzprüfung · Arbeitsstand 01 | Interne Vollständigkeits-/Konsistenzprüfung überlappt die letzten Arbeitstage der Planpaketerarbeitung (AA + EE). |
| 01.04 | `t009` | Prüf- und Rückmeldephase Auftraggeber · Arbeitsstand 01 | Regelfrist 5 AT nur bei vollständigen Unterlagen, abgestimmter Prüffrist und entscheidungsfähigem Auftraggeber. |
| 01.06 | `t011` | Planpaket · Vorabzug 02 nach Rückmeldung fortschreiben | Planungsaufwand orientierend 15 AT; für erhebliche Entwurfsänderungen projektspezifisch verlängern. |
| 01.07 | `t012` | M01 · Vorläufige Planungsgrundlagen an beauftragte Fachplaner übermittelt | Teilstand an die beauftragten Fachplaner, keine Freigabe des vollständigen Entwurfs. |
| 01.09 | `t014` | Prüf- und Rückmeldephase Auftraggeber · Vorabzug 02 | Regelfrist 5 AT. Rückmeldung und formale Entwurfsfreigabe sind separate Entscheidungen. |
| 02.03 | `t018` | BRS · Fachplanungsbeitrag Arbeitsstand 01 (sofern beauftragt) | Optional, nur bei erforderlicher bzw. beauftragter Brandschutzplanung. Bei Pflichtbeitrag zusätzlich als Vorgänger zu M03 verknüpfen. |
| 02.04 | `t019` | ELT · Fachplanungsbeitrag Arbeitsstand 01 (sofern beauftragt) | Elektrofachplanung als vereinbarter Regelumfang; projektspezifisch prüfen. |
| 02.06 | `t021` | TWP · Fachplanungsbeitrag Arbeitsstand 01 erarbeiten | Tragwerksplanung als vereinbarter Regelumfang; projektspezifisch prüfen. |
| 02.07 | `t060` | BPH · Fachplanungsbeitrag Arbeitsstand 01 · Bauteilkatalog (sofern beauftragt) | Bauphysik (Wärme-, Schall- und Feuchteschutz): Bemessen der Bauteile und Bauteilkatalog auf Grundlage der Aufbauvorgaben der Architektur (M01). |
| 02.08 | `t022` | M03 · Zieltermin Fachplanungsbeiträge Arbeitsstand 01 | Sammelt ELT, HLS, TWP und BPH. Falls BRS erforderlich ist, BRS als zusätzlichen Vorgänger aufnehmen. |
| 03.01 | `t023` | Planungskoordination 01 · Schnittstellen und Abstimmungsbedarf | Überlappung bewusst: Koordination darf mit vorläufigen Fachplanungsständen beginnen. |
| 03.03 | `t025` | Entwurfsplanung Architektur · integrierten Arbeitsstand 02 erarbeiten | Integrierter Entwurf darf nicht vor dem Fachplanungs-Zwischenstand abgeschlossen sein (EE). |
| 04.03 | `t058` | Bemusterungsunterlagen vorbereiten · Qualitäten, Materialien und Themenpläne | Orientierungswert: Dauer nach Umfang der Bemusterung und Zahl der Themenpakete anpassen. Lieferzeiten für Muster sind Wartezeit. |
| 04.04 | `t059` | Bemusterungsunterlagen an Auftraggeber übergeben | Ausgabe der Bemusterungsunterlagen. Die Abstimmung mit dem Auftraggeber folgt im nächsten Vorgang. |
| 04.05 | `t030` | Qualitätsfestlegungen und kostenrelevante Bemusterung abstimmen | Abstimmung auf Grundlage der übergebenen Bemusterungsunterlagen. |
| 04.06 | `t031` | M06 · Abstimmung Entwurfsstand LPH 3 mit Auftraggeber abgeschlossen | Bauherrenabstimmung, Koordination, Rückmeldung und genehmigungsrelevante Punkte müssen vorliegen. |
| 05.01 | `t032` | BRS · abgestimmter Fachplanungsbeitrag (sofern beauftragt) | Optionaler Brandschutz-Finalbeitrag. Bei verpflichtendem Umfang zusätzlich mit M07 verknüpfen. |
| 05.05 | `t061` | BPH · abgestimmter Fachplanungsbeitrag · Bauteilkatalog Endstand (sofern beauftragt) | Bauteilkatalog mit den Entscheidungen der Bemusterung (M06) und den abgestimmten Beiträgen fortschreiben. |
| 05.06 | `t036` | M07 · abgestimmte Beiträge der beauftragten Fachplaner bereitgestellt | Sammelmeilenstein nur nach allen verpflichtenden Beiträgen (ELT, HLS, TWP, BPH). BRS ergänzen, soweit erforderlich. |
| 06.01 | `t037` | Mengenermittlung und Kostenbeiträge zusammenführen | Kostenbeiträge und Mengen können parallel zum Schlusslauf der Fachplanung zusammengeführt werden. |
| 06.02 | `t038` | Kostenberechnung DIN 276 und Vergleich mit Kostenschätzung erstellen | Kostenberechnung nach DIN 276 inkl. Vergleich zur Kostenschätzung; Abschluss erst nach benötigten Fachkostenbeiträgen. |
| 06.03 | `t039` | M08 · Kostenbesprechung · Kostenberechnung mit Kostenschätzung vergleichen | Vorlage der Kostenberechnung ist nicht identisch mit Auftraggeberentscheidung über Kosten-/Budgetfolgen. |
| 06.04 | `t057` | Kostenberechnung und Abweichungen durch Auftraggeber prüfen | Prüffrist für Kostenentscheidung, nicht als normative oder vertraglich garantierte Frist verstehen. |
| 07.01 | `t041` | Genehmigungsfähigkeit und Behördenanforderungen vorabstimmen | Genehmigungsfähigkeit mit erforderlichen Stellen vorabstimmen, soweit anwendbar; nicht Genehmigungsantrag LPH 4. |
| 07.03 | `t043` | Objektbeschreibung mit Fachplanungsbeiträgen fortschreiben | Objektbeschreibung fortschreiben, während Fachplanung läuft, aber erst nach vollständiger Integration abschließen. |
| 07.04 | `t044` | Offene genehmigungsrelevante Anforderungen abstimmen | Externe Behördenantworten nicht mit internen Bearbeitungstagen gleichsetzen; ggf. eigene Wartefrist ergänzen. |
| 08.01 | `t045` | Abschlussunterlagen zusammenstellen und Ergebnisse dokumentieren | Dokumentation kann fortlaufend beginnen; endgültiger Stand hängt von Kostenkorrekturen und Fachplanung ab. |
| 08.03 | `t047` | Vollständigkeits- und Konsistenzprüfung der Abschlussunterlagen | Abschlussprüfung der vollständigen Objekt- und Fachplanungsunterlagen einschließlich Kostenentscheidung. |
| 09.04 | `t055` | M11 · Freigabe LPH 3 durch Auftraggeber (vorläufig) | Projektseitige vorläufige Freigabe; nicht als zivilrechtliche Abnahme des Architektenvertrags auslegen. |

PSP nach Vorlage v1.6. Termine, Dauern und Abhängigkeiten sind Orientierungswerte für ein Beispielprojekt, keine Vertragsfristen.
