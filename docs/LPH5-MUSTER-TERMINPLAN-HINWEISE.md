# Muster-Terminplan LPH 5 · Planungshinweise

Stand 15.11.2026 · gehört zum Muster-Terminplan LPH 5 (Vorlage `supabase/seed/terminplan-templates.json`).

**Ein Terminplan enthält keine Notizen** (Entscheidung Gari, 15.11.2026). Bis v0.2 standen die folgenden Hinweise als Notizen in der Vorlage; seit v0.3 nur noch hier. Wer die Vorlage für ein Projekt anpasst, prüft sie.

## Allgemein

- Orientierungsdauern für ein Beispielprojekt, keine HOAI-Fristen. M07 bezeichnet erste koordinierte Ausgabe; optionales baubegleitendes Fortschreiben (PSP 07) ist nur als Platzhalter enthalten und muss an reale Termine angepasst oder entfernt werden. Pflicht-Fachplanungen projektspezifisch bestätigen.

## Je Vorgang

| PSP | ID | Vorgang | Hinweis |
|---|---|---|---|
| 00.01 | `m00` | M00 · LPH 5 Projektstart / abgestimmter Bearbeitungsrahmen | Startpunkt, keine automatische Behauptung, dass LPH 3/4 und alle Fachbeauftragungen abgeschlossen sind. |
| 00.02 | `t001` | Ergebnisse LPH 3/4, Auflagen und Planungsgrundlagen prüfen | Zugrunde liegende freigegebene Entwurfs- und Genehmigungsstände prüfen; Genehmigungsauflagen nur bei tatsächlichem Vorliegen. |
| 00.03 | `t002` | Fachplanerleistungen, Liefertermine und Schnittstellen bestätigen | Voraussetzung: benötigte Fachplaner sind beauftragt; andernfalls separates Beauftragungspaket planen. |
| 00.04 | `t003` | Planliste, Planläufe, Prüfregeln und Abgaben definieren | Plansystem mit Ausgabestatus und Verantwortlichen, nicht automatisch eine vertragliche Freigabe. |
| 01.01 | `t010` | Ausführungspläne Architektur 1:50 · Arbeitsstand 01 | Richtwert für ein Beispielprojekt; Maßstab und Arbeitstiefe nach Art und Größe des Objekts. |
| 01.02 | `t011` | Leitdetails und Bauteilaufbauten entwickeln | Konstruktionsprinzipien inklusive Anschlüssen und Materialschichten; keine pauschalen Baudetails vorschreiben. |
| 01.04 | `t013` | Interne Planprüfung · Arbeitsstand 01 | Überlappende QS ist möglich; Abschluss erst, wenn erforderliche Arbeitsstände vollständig sind. |
| 02.02 | `t021` | TWP · Tragwerks-/Ausführungsgrundlagen und Schalplanung | Konkreter Umfang je Auftrag: Schalpläne, Bewehrungs-, Stahl- oder Holzbaupläne etc. sind nicht pauschal gleichzusetzen. |
| 02.05 | `t024` | Brandschutzplanung · Ausführungsrelevante Detailangaben (sofern erforderlich) | Optional und projektspezifisch. Bei verpflichtender Leistung als zusätzlicher Vorgänger von M03/M05 definieren. |
| 02.06 | `t025` | Schlitz-, Durchbruchs- und Öffnungsplanung koordinieren | In HOAI Anlage 15 LPH 5 für Technische Ausrüstung ausdrücklich genannt; Abstimmung mit Tragwerk erforderlich. |
| 02.07 | `m20` | M03 · Erforderliche Fachbeiträge Arbeitsstand 01 vorliegend | Falls BRS erforderlich, seine Lieferung ausdrücklich ergänzen; die Disziplinen laufen parallel. |
| 03.01 | `t030` | Planlauf 01 · Koordination und Kollisionsklärung | Koordination darf mit ersten belastbaren Planständen starten. |
| 04.02 | `t041` | Detailpaket Hülle, Fugen und Abdichtungen ausarbeiten | Nur für tatsächlich vorhandene Konstruktionen; Detailbedarf projektspezifisch prüfen. |
| 04.03 | `t042` | Detailpaket Innenausbau und technische Schnittstellen ausarbeiten | Anwendungsabhängig; Umfang mit Projektanforderungen abgleichen. |
| 05.04 | `t053` | BRS · Abgestimmten Fachbeitrag fertigstellen (sofern erforderlich) | Optional; bei Erfordernis als zusätzlicher Abschlussvorgänger aufnehmen. |
| 05.05 | `t054` | Planlauf 02 · Schlusskoordination aller Fachplanungsbeiträge | Parallel mit den letzten Fachbeiträgen, Abschluss erst nach den benötigten Planständen. |
| 05.07 | `m50` | M06 · Abgestimmte Pflicht-Fachbeiträge vollständig | TWP/HLS/ELT als Beispielumfang; weitere Pflichtdisziplinen bei Bedarf ergänzen. |
| 06.01 | `t060` | Bauherrenprüfung · koordinierter Ausführungsstand | 5 AT sind eine interne Regelfrist, keine HOAI- oder Vertragsvorgabe; nur bei prüffähigen Unterlagen und Abstimmung. |
| 06.06 | `m60` | M07 · Koordinierte Ausführungsplanung zur Ausgabe bereit | Erste koordinierte Ausgabe, nicht zwingend das Ende aller LPH-5-Fortschreibungen oder eine rechtliche Abnahme. |
| 07.01 | `t070` | Ausführungsplanung an Ausschreibungsergebnisse anpassen (falls erforderlich) | Optionaler Orientierungsblock; nur nach tatsächlich vorliegenden Ausschreibungsergebnissen und geklärtem Leistungsumfang. |
| 07.02 | `m71` | M08 · Fortschriebenen Ausführungsstand an Unternehmen übergeben | Nur sofern diese Übergabe als gesondertes Ereignis erforderlich ist. |
| 07.03 | `t072` | Erforderliche Montage-/Werkstattpläne fachlich prüfen | Optional; Umfang nach jeweiligem HOAI-Leistungsbild und Vertrag. Werkstattzeichnungen erstellen ist nicht gleich prüfen. |
| 07.04 | `t073` | Relevante Rückläufe aus Ausführung koordinieren und einarbeiten | Optionaler einmaliger Platzhalter. Reale, wiederkehrende Planläufe aus Ausführung müssen separat erfasst werden. |
| 07.05 | `m70` | M09 · Optionaler Folgeplanlauf dokumentiert | Dieser Musterevent ist keine pauschale LPH-5-Schlussfreigabe. |

PSP nach Vorlage v0.3. Termine, Dauern und Abhängigkeiten sind Orientierungswerte für ein Beispielprojekt, keine Vertragsfristen.
