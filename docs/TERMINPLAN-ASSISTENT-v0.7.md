# TBA Office · Terminplan Assistent v0.7 · Was-wäre-wenn-Auswirkungen
Datum: 11.11.2026. Scope: derselbe Terminplan Assistent im bestehenden Gantt-Editor, kein zusätzliches Fenster.

## Problem und Grenze des alten Verhaltens
Der bestehende Assistent kann Vorgänger, Nachfolger, Fehlverknüpfungen und Eingabefehler erklären sowie bestätigte Änderungen über Vorschau → CAS-Write → Readback vorschlagen. Eine Frage wie „Was passiert, wenn TWP fünf AT später liefert?“ sollte jedoch keine bearbeitbare Verschiebungsproposal erzeugen und auch nicht nur spekulative Auswirkungen aus einem KI-Text nennen.

## Umsetzung
\`kind=simulate\` ist eine neue, schreibfreie, strikt typisierte Interpretation in derselben Office-AI-Konversation. Das Modell darf ausschließlich eine bekannte, eindeutige Terminplan-Vorgangs-ID und eine positive ganze Anzahl 1–130 zusätzlicher Arbeitstage bestimmen. Bei Mehrdeutigkeit muss es nachfragen. Die Modellantwort enthält selbst **keine** für Termine oder Kritikalität maßgeblichen Zahlen.

\`TBATerminplanPlanning.simulateFinishDelay(state,taskId,extraAT)\` nimmt eine tiefe Kopie, lässt den Anfang des gewählten Vorgangs unverändert, verlängert nur sein Ende und verschiebt ausschließlich diejenigen dokumentierten Nachfolger, die zur Einhaltung der vorhandenen EA/AA/EE/AE-Beziehungen umgeplant werden müssten. Daraus entstehen die rein hypothetischen Kennzahlen: Zahl verschobener Vorgänge; rechnerischer Endtermin aller erfassten Vorgänge; Unterschied in Arbeitstagen; Gesamtpuffer (unter **der aktuellen** auch von Deadlines begrenzten Semantik); neu überschrittene Deadlines und geschützte Termine. Quelle bleibt bitgenau unverändert. Bei fehlerhafter oder unvollständiger Netzlogik keine scheinbar genaue Simulation.

Im Chat ist das Ergebnis immer \`kind=answer\`, nie \`proposal\`, und es wird kein Schreibpfad ausgelöst. Eine spätere tatsächliche Terminänderung verlangt wie bisher einen **separaten**, bestätigten Bearbeitungsvorschlag mit Schreibrechten und Serverrevisionsprüfung.

## Nicht behauptete Fähigkeiten
Die Simulation ist keine Personal-/Kapazitätsprognose. Sie berücksichtigt ausschließlich registrierte Abhängigkeiten und den hinterlegten Projektkalender. „5 AT später liefern“ wird transparent als **Endtermin +5 AT bei gleichem Anfang**, nicht als Verschieben des ganzen Vorgangs gedeutet. Die aktuelle Rechnung für den Gesamtpuffer berücksichtigt Deadline-Caps; sie ist **noch keine** vom Auftraggeber genehmigte Definition des rein projektendbestimmenden kritischen Pfads. Vorläufig bleibt dieser Unterschied explizit in den Antworten. Ein einzelnes Modell darf ihn nicht stillschweigend umdefinieren.

## Fallback / internationale Formulierungen
Auch ohne KI-Verfügbarkeit kann der bestehende deterministische Dialog eine ausdrücklich genannte, eindeutige Vorgangs-ID / exakten Namen erkennen und die gleiche Simulation berechnen (z. B. Frage mit „5 AT“, „5 Arbeitstage“ oder „5 días laborables“). Mehrdeutiges „TWP“ ohne identifizierbare Aufgabe wird nicht geraten.

## Prüfung
Automatisierte Tests für eine synthetische parallele Fachplanung: eindeutige task_id; 3 AT späteres Ende; zwei Nachfolger; +2 AT Änderung des Planendtermins; neu überschrittene Deadline; unveränderte Quelle und read-only-Dialog; Mehrdeutigkeit, negative/ungültige Werte, Netzplanfehler, Stale-Revision, Parser. Alte Vorschläge, Historienlogik und Schreibberechtigungstests bleiben erhalten.

## Deployment / Acceptance
Vor Produktivdeployment vollständige GitHub CI und Abgleich aller Live-Edge-Function-Dateien mit dem Repository. \`office-terminplan-ai\` per vollständigem Deployment aller fünf Dateien mit \`verify_jwt=true\` neu veröffentlichen. Danach authentifizierter Test mit einem echten Terminplan und ein anderer User mit read-only-Rechten, falls verfügbar. Falls E2E nicht durchgeführt wurde, nur als offenen Punkt dokumentieren.
