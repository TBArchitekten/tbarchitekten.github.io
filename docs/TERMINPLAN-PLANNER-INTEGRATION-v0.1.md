# TBA Office · Terminplan und Planner verbinden · Studie v0.1
Stand 11.11.2026. Status: Architekturvorschlag; keine Datenmigration oder funktionale Integration autorisiert.

## Ausgangslage (GitHub main und Office-Datenbank gelesen)

Das Work-/Planner-Frontend verwendet **minds_work_buckets** als Spalten und **isabella_tasks** als kanonische Aufgaben (Feld work_bucket_id). Die Tabellen office_task_buckets und office_tasks sind ältere Office-Strukturen und dürfen nicht mit dem aktuell sichtbaren Planner verwechselt werden. Das Projekt Bernried besitzt 2 aktive Test-Buckets, 13 nicht archivierte Aufgaben, davon derzeit 1 in einem aktiven Bucket, und 1 Terminplan-Instanz. In app/work.js liest das Projekt-Cockpit Aufgaben und Terminplan-Meilensteine bereits nebeneinander. Es gibt noch keine vertrauenswürdige Zuordnung Aufgabe → Meilenstein.

## Drei klar verschiedene Verantwortungen

**Terminplan und Meilenstein** sind Quelle für zeitliche Abfolge, Abgabe-Datum, Vorgängerlogik und Baselines. Die Identität einer Abgabe muss (Planinstanz-ID, Vorgangs-ID) sein, nicht eine möglicherweise veränderliche PSP-Nummer oder der sichtbare Titel.

**Planner-Aufgabe** ist die existierende kanonische isabella_tasks-Aufgabe mit Zuständigkeit, Fälligkeit, Work Status, Checkliste und Dokumenten. Ein Arbeitsschritt kann mehr als eine Abgabe unterstützen; die Aufgabe darf nicht für jede Abgabe kopiert werden.

**Bucket** ist eine Präsentationsspalte. Ein fixer Bucket pro Abgabe sieht einfach aus, aber eine Aufgabe kann im aktuellen Datenmodell nur einen work_bucket_id-Wert haben. Eine solche Zuordnung würde Aufgaben aus bestehenden Team- oder Fachbereichs-Buckets entfernen.

Empfohlen ist daher **eine zusätzliche virtuelle Planner-Ansicht „Abgaben“**, deren Spalten aus verknüpften Terminplan-Meilensteinen abgeleitet werden. Die bestehenden frei benannten Buckets bleiben unverändert. Die gleichen echten Aufgaben dürfen in mehr als einer Abgaben-Spalte dargestellt werden, ohne Duplikate in der Datenbank.

## Beispiel Bernried (Plan-Meilenstein echt, darunter stehende Aufgaben nur vorgeschlagen)

Abgabe: M09 · Interne Abgabe und Abschlussprüfung LPH 3.

Mögliche Unteraufgaben für diese Abgabeansicht: Grundrisse intern prüfen; Koordination HLS/TWP nachvollziehen; Planliste/Index finalisieren; vollständige Kostenunterlagen prüfen; Freigabevermerk vorbereiten. Diese Beispiele wurden **nicht** als bestehende Bernried-Aufgaben in der Datenbank verifiziert und sind nicht automatisch anzulegen.

## Daten- und Berechtigungsvertrag vor jeder Umsetzung

Vorgeschlagene schmale Join-Tabelle: office_terminplan_work_links mit UUID id, project_id, plan_id, schedule_task_id (Text-Vorgangs-ID), work_task_id (UUID → isabella_tasks), relation (required / contributes / reviews), created_by, created_at, updated_at und eindeutiger Kombination der Identitäten.

Vor dem Eintragen muss geprüft werden, dass Planinstanz, Vorgang, Projekt und Arbeitstask tatsächlich zusammengehören; der Terminplan-Vorgang muss im aktuellen JSON-State existieren, als Abgabe ausgewählt und für den konkreten Anwender änderbar sein. Sicherheit: echte Team-Autorität und RLS, keine Client-geglaubte Projektzuordnung. Wird ein Vorgang beim Rebuild ersetzt, darf ein Link nicht anhand ähnlichen Namens still repariert werden: er erscheint als „Zuordnung prüfen“. Aufgaben, Termine und Baselines bleiben jeweils in ihrer bestehenden Source of Truth.

Ein Bucket- oder Aufgabenabschluss bedeutet **nicht** automatisch eine freigegebene Abgabe. Die Abgabe wird erst nach überprüfter Lieferung ausdrücklich durch die Projektleitung bestätigt. Ein Terminverzug im Planner kann als Warnung und als Vorschlag an den bereits existierenden Terminplan Assistenten gehen; kein automatisches Verschieben von Projekt- oder Task-Terminen. Lesende Projektionen sind zuerst umzusetzen, bevor bidirektionale Writes erwogen werden.

## Drei Lösungsvarianten

Variante A: Für jede Abgabe einen physischen Planner-Bucket. Nachteile: Jede Aufgabe passt nur in einen Bucket; vorhandene Fachbereichs-Buckets würden konkurrieren. Nicht als alleinige Lösung empfohlen.

Variante B: Für jede Abgabe neue Kopien von Tasks erzeugen oder die Einzeltasks im Gantt separat duplizieren. Nachteile: doppelte Zuständigkeiten und divergierende Fortschritte. Nicht empfohlen.

Variante C: Projektweit eindeutige Aufgaben mit expliziten Abgabe-Links verbinden; neue virtuelle Ansicht nach Abgabe. Mehrfachzuordnung, kein Duplikat, kontrollierbare Datenrechte. **Empfohlen.**

## Vergleichbare Produkte und methodische Referenzen

**Procore Lookahead Schedule:** Ein 1- bis 6-Wochen-Fenster aus dem Master Schedule; operative Subtasks und Fortschritt im Lookahead schreiben nicht automatisch den Master Schedule zurück. https://support.procore.com/products/online/user-guide/project-level/schedule/tutorials/create-a-lookahead-schedule

**Autodesk Construction Cloud – Schedule & Workplan:** Schedule-Aktivitäten können mit anderen Objekten verbunden werden, Workplan zeigt operative Aufgabensequenzen. https://help.autodesk.com/cloudhelp/ENU/Build-Schedule/files/About_Schedule.html

**Lean Construction Institute – Last Planner System for Design:** Milestone Planning → Phase Pull Planning → Design Cycle Planning → Weekly Work Planning. Die operative Tätigkeit wird von benötigten Lieferungen und Übergaben her geplant. https://leanconstruction.org/lean-topics/last-planner-system-for-design/

**Microsoft Planner Premium:** gemeinsame Aufgaben, Milestones, Abhängigkeiten, Timeline und kritischer Pfad. Ein Vergleich, keine Eins-zu-eins-Integration in TBA Office. https://support.microsoft.com/de-de/planner/teams/advanced-capabilities-with-premium-plans-in-planner

## Sicherer Pilot vor einer breiten Integration

Im Projekt Bernried eine von der Projektleitung bestätigte Abgabe auswählen und einige tatsächlich vorhandene kanonische Aufgaben mit ihr verknüpfen. Erster Schritt: nur Lesen und im Planner als neue Abgabeansicht anzeigen; dabei keine der 13 Aufgaben verändern und die zwei Test-Buckets nicht migrieren. Danach Datenvertrag und Autorität an echten Accounts und fremden Projekten testen, Aufgabenumbenennung/-archivierung, Plan-Neuimport, Revisionswechsel, RLS und Readback prüfen. Erst nach diesem Pilot Schreibhandlungen erwägen.

Noch offen: Wer darf die Zuordnung bestätigen? Wie erfolgt die dokumentierte Freigabe des Abgabepakets? Welche konkrete Abgabe soll zuerst getestet werden? Ohne diese Entscheidungen bleibt das Schema eine dokumentierte Empfehlung.
