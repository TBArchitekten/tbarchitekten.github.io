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
- PR: #92
```

---

### 2026-11-27 · Mustermappe: «Mit Romy kürzen» beim Übersatz · Claude
- Qué cambió y por qué: Letzter Teil des Übersatz-Hinweises aus dem Entwurf B2. Unter «Passt nicht ganz in den Rahmen» steht jetzt je Rahmen, wie viel zu viel ist («Kopf · Der Text passt nicht: etwa zwei Zeilen zu viel.», bei Kennwerten wie bisher, wie viele nicht auf der Seite stehen), darunter «Rahmen vergrößern» (statt ««Name» vergrößern») und, wenn Romy erreichbar ist und der Rahmen einen längeren Text hat (ab 40 Zeichen), «Mit Romy kürzen». Der Client misst am Rahmen Zeilenhöhe, Höhe des Texts und Überstand und rechnet, wie viele Zeichen passen (mit 8 % Luft); ist das weniger als 20, rät er zum Vergrößern. Romy (`office-dokumente-ai`, neue Aktion `kuerzen`) kürzt auf diese Länge, Inhalt, Zahlen, Maße und Namen bleiben; der Vorschlag erscheint in einem Dialog («Mit Romy kürzen · «Kopf»»: wie viele Zeichen passen, der Vorschlag zum Ändern mit Zähler, Romys Begründung, «Bisher» zum Vergleich), «Übernehmen» setzt ihn wie getippt (ein Schritt im Verlauf, «Text «Kopf» gekürzt»), «Verwerfen» lässt alles. Die Funktion liest dafür nur die eine Mappe (ohne Inhalt) unter RLS bei den Entscheidungsvorlagen, zählt die Anfrage wie jede andere und schreibt nur den Verbrauch (ohne Person); nur ein kürzerer Text zählt; steht im Vorschlag eine Zahl, die im bisherigen Text nicht steht, sagt es ein Hinweis im Dialog; länger als verlangt heißt «Noch etwas zu lang für den Rahmen».
- Archivos: `supabase/functions/office-dokumente-ai/core.mjs` (`KUERZEN`, Anweisung `kuerzen`, `pruefeKuerzung`, Version `office-dokumente-ai-v3`), `supabase/functions/office-dokumente-ai/index.ts` (Aktion `kuerzen`), `projektdokumente.js` (`?v=office15`: `uebersatzPruefen`, `kuerzText`, `kuerzMass`, `mitRomyKuerzen`, `kuerzDialog`, `kuerzUebernehmen`, zwei Fehlermeldungen), `projektdokumente.css` (`?v=office15`), `projektdokumente.html`, `tests/office-dokumente-ai.test.mjs`, `tests/office-mustermappe.test.mjs`, `tests/browser/office-mustermappe.chromium.mjs` (neu: vorschlagen, verwerfen, übernehmen, rückgängig), `tests/browser/fixtures/fake-supabase-dokumente.js`.
- Base de datos: ninguna migración.
- Deploy de funciones: `office-dokumente-ai` über den Workflow nach dem Merge.
- Cómo se probó: `node --test` grün (558); Browserprüfungen Mustermappe lokal mit Chrome grün; Übersatz-Hinweis und Dialog als Bildschirmfoto angesehen.
- Quedó pendiente o sin probar: mit dem echten Modell erst nach dem Deploy.
- Riesgos o decisiones que necesitan a Gari: die neuen Texte (siehe oben).
- PR: (wird ergänzt)

---

### 2026-11-27 · Mustermappe: «Rahmen vergrößern» beim Übersatz · Claude
- Qué cambió y por qué: Wie im Entwurf (B2, Reiter «Seite»): Passt ein Text nicht in seinen Rahmen, steht unter «Passt nicht ganz in den Rahmen» je Rahmen ««Name» vergrößern». Der Rahmen wächst um so viele Felder nach unten, wie der Text braucht (ein Feld und sein Abstand sind 32 mm), höchstens bis zum Ende des Rasters; ein Schritt im Verlauf (Rückgängig). Ist darunter kein Platz, sagt eine Meldung, dass der Rahmen verschoben oder der Text gekürzt werden muss. «Mit Romy kürzen» aus dem Entwurf folgt später (braucht eine Aufgabe in der Funktion der Dokumente).
- Archivos: `projektdokumente.js` (`?v=office14`), `projektdokumente.html`, `tests/office-mustermappe.test.mjs`, `tests/browser/office-mustermappe.chromium.mjs` (neu: vergrößern und rückgängig; im Reiter: kein Platz am Ende des Rasters).
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` grün; Browserprüfungen Mustermappe (10) lokal mit Chrome grün.
- Quedó pendiente o sin probar: «Mit Romy kürzen».
- Riesgos o decisiones que necesitan a Gari: keine.
- PR: #202

---

### 2026-11-27 · Abläufe: «Besprechung nachbereiten» · Claude
- Qué cambió y por qué: Gari (27.11.2026) zu den «Abläufen»: so umsetzen, wie vorgeschlagen. Ein Ablauf führt durch wiederkehrende Arbeit des Büros und benutzt die vorhandenen Werkzeuge. Erster Ablauf im Projektstart (Abschnitt «Abläufe», im Panorama unter «Abläufe» verlinkt): Romy liest das Protokoll einer Besprechung einmal für die Klärungsliste und einmal für die Entscheidungsliste (`office-dokumente-ai`, Aktion `vorschlaege`, wie «Romy fragen»). Danach zeigt der Projektstart den Ablauf in vier Schritten: 1. Vorschläge prüfen (offene je Liste; nichts ohne «Übernehmen»), 2. Aufgaben im Planner für neue Klärungen mit Verantwortlichem und Frist, 3. Fristen gegen den Terminplan (Romy, `fristen_terminplan`, nur die Klärungen dieser Besprechung, auch die, deren Frist sie geändert hat), 4. Ins Projektwissen (eine Notiz mit Romys Zusammenfassung und den übernommenen Zeilen über `office_wissen_beitrag_teilen`; die KI arbeitet sie in die Seiten ein). Was zur Besprechung gehört, merkt sich der Ablauf beim «Übernehmen» (auch wenn die Zeile danach von Hand weiter bearbeitet wird). Der Stand bleibt in diesem Fenster, je Projekt; «Ablauf beenden» schließt ihn. `?ablauf=besprechung` öffnet den Dialog einmal (wartet, bis Romy bereit ist).
- Archivos: `projektdokumente.js` (`?v=office13`), `projektdokumente.css` (`?v=office14`), `projektdokumente.html`, `app/work.js` (`?v=office65`, Panorama «Abläufe»), `app/office.css` (`?v=office47`), `app/index.html`, Versionsangaben in zehn Tests, `tests/office-projektwissen.test.mjs`, `tests/browser/office-projektdokumente.chromium.mjs` (neu: der ganze Ablauf), `tests/browser/fixtures/fake-supabase-dokumente.js` (merkt sich Aufrufe von Funktionen der Datenbank).
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` grün; Browserprüfungen Projektstart (9), Wissen (10), Seitenleiste (6), Mustermappe (9) lokal mit Chrome grün; Bildschirmfotos von Karte, Dialog und Ablauf.
- Quedó pendiente o sin probar: der zweite Ablauf «Phasenwechsel» (Schritte an Gari vorgeschlagen, wartet auf sein OK); mit einem echten Protokoll in Produktion noch nicht gelaufen.
- Riesgos o decisiones que necesitan a Gari: die Schritte des Phasenwechsels.
- PR: #201

---

### 2026-11-27 · Work B2, Schritt 5: Panorama mit «Für dich», Themen, Entscheidungen und «Neu im Desktop» · Claude
- Qué cambió y por qué: Das Panorama im Office zeigte nur Kopf, die nächsten 14 Tage, Terminpläne und «Neu im Projektwissen». Jetzt, wie in Window, aber mit den Daten des Office und in «Sie»: «Für dich» (der Projektleitung die Entscheidungen des Wissens zur Bestätigung, mit «Warum», «Bestätigen» und «Verwerfen» über die Funktion des Wissens `office_wissen_entscheidung_pruefen`; dazu die überfälligen Aufgaben des Projekts mit «Aufgabe öffnen» und «Erledigt»), «Themen» (die Threads des Projekts mit Themenblatt, «In Claude fortsetzen»), «Entscheidungen» (die beschlossenen, mit Datum und Herkunft; «Alle im Wissen») und «Neu im Desktop» (die letzten fünf Dokumente des Projekts). Ein Teammitglied ohne Projektleitung sieht keine Knöpfe zum Bestätigen. `TBA_OFFICE_WISSEN.panorama` meldet dafür, ob die Person bestätigen darf; die Datenbank prüft es noch einmal.
- Archivos: `app/work.js` (`?v=office63`), `app/office-wissen.js` (`?v=office5`, `entscheiden`), `app/index.html`, Versionsangaben in neun Tests, `tests/browser/office-wissen.chromium.mjs` (neu: Panorama «Für dich», mit und ohne Projektleitung).
- Base de datos: ninguna migración (liest `minds_work_files`, `minds_work_memory` und `minds_work_threads` mit den bestehenden Regeln des Teams).
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` grün; Browserprüfungen Wissen (10) lokal mit Chrome grün; Bildschirmfoto des Panoramas mit Beispieldaten.
- Quedó pendiente o sin probar: die Abläufe «Besprechung nachbereiten» und «Phasenwechsel».
- Riesgos o decisiones que necesitan a Gari: keine.
- PR: #200

---

### 2026-11-27 · Work B2, Schritt 4: Wissen mit Kontextspalte, die Seiten in der Leiste · Claude
- Qué cambió y por qué: Wie im Entwurf (Variante B: «Text 680 · Kontext 300, die Seitenliste wandert in die Leiste links»). Oben eine Werkzeugzeile statt Überschrift und Einleitung: Suche, «zuletzt eingearbeitet heute, 07:12» (aus dem Verlauf), «Hinweis zu dieser Seite», «Notiz teilen» und «?» mit der Erklärung, die vorher über dem Wissen stand. Der Text der Seite bleibt höchstens 760 px breit; daneben (300 px) was zu ihr gehört: «Auf dieser Seite» (die Überschriften, ab zwei; Knöpfe statt Anker, die Adresse gehört der App), die Entscheidungen der Seite mit «Beschlossen» oder «Wartet auf Bestätigung», offene Hinweise, Herkunft, Verweise hierher, frühere Fassungen und «Hinweis geben». Reicht die Breite des Wissens nicht (gemessen am Wissen, nicht am Fenster), steht der Kontext unter dem Text. «Neu» zeigt die Zahl der Beiträge, die auf die KI warten. Am Desktop mit offener Leiste stehen Neu, Entscheidungen und die Seiten unter «Wissen» in der Seitenleiste (gespiegelt wie die Fassungen) und die Liste im Wissen entfällt; reduziert steht sie wieder im Wissen.
- Archivos: `app/office-wissen.js` (`?v=office4`), `app/office-wissen.css` (`?v=office2`, Container-Abfrage), `app/work-lens.js` und `.css` (`?v=3`), `app/index.html`, `tests/office-projektwissen.test.mjs`, `tests/browser/office-wissen.chromium.mjs` (Kontext, Zeile, schmal und breit), `tests/browser/office-work-seitenleiste.chromium.mjs` (neu: Seiten in der Leiste, reduziert im Wissen).
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` grün; Browserprüfungen Wissen (9) und Seitenleiste (6) lokal mit Chrome grün; Bildschirmfotos mit offener und reduzierter Leiste.
- Quedó pendiente o sin probar: Panorama vervollständigen (Für dich, Register, Themen, Neu im Desktop).
- Riesgos o decisiones que necesitan a Gari: keine.
- PR: #199

---

### 2026-11-27 · Work B2, Schritt 3: Mustermappe mit Seiten als Bildern und Eigenschaften in Reitern · Claude
- Qué cambió y por qué: Wie im Entwurf (Variante B, «Seiten als Bilder, Eigenschaften in Reitern»; die Seite wird größer). Links ein Streifen mit kleinen Seiten (wie im PDF gesetzt, ohne Eingabefelder; Bilder laden erst beim Hinsehen) statt der Liste in Worten; «Seiten · n» mit «+» (Position hinzufügen …, Freie Seite, Übersicht, Deckblatt, Vergleich und Material je Position); «neuer Stand» auf Seiten, deren Produkt in der Bibliothek neuer ist. Die kleine offene Seite folgt der Bühne nach jedem Schritt. Rechts die Eigenschaften in drei Reitern: «Seite» (Hinweise, Übersatz, Rahmen, die Seite), «Position» (die Position der Seite; sonst ein Satz, wo die Positionen stehen) und «Mappe» (Positionen, Angaben, Termin, Stände); gemerkt je Gerät wie Zoom und Raster. Ein angeklickter Rahmen und der Hinweis «Übersatz» zeigen «Seite», eine neue Position zeigt «Position»; Schreiben im Text wechselt nichts. Spalten 168 | Bühne | 300 px (bis 1180 px 148 | Bühne | 280), unter 760 px läuft der Streifen quer. Im Reiter schweben Meldungen oben über der Bühne und gehen nach 6 s (Warnungen nach 12 s), statt die Mappe zu verschieben.
- Archivos: `projektdokumente.js` (`?v=office12`), `projektdokumente.css` (`?v=office13`), `projektdokumente.html`, `tests/office-mustermappe.test.mjs`, `tests/browser/office-mustermappe.chromium.mjs` (Streifen, Reiter, «+», Marke «neuer Stand»; Hilfen `teil` und `hinzufuegen`).
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` grün; Browserprüfungen Mustermappe (9) lokal mit Chrome grün; Bildschirmfotos im Reiter bei 1180 und 1376 px.
- Quedó pendiente o sin probar: «Rahmen vergrößern» und «Mit Romy kürzen» beim Übersatz; die Wahl der Mappe in der Zeile, wenn die Leiste von Work eingeklappt ist (heute eine eigene Zeile darüber).
- Riesgos o decisiones que necesitan a Gari: keine.
- PR: #198

---

### 2026-11-27 · Work B2, Schritt 2: eine Werkzeugzeile in Terminplan, Kostenberechnung, Controlling, Produkten, Herstellern und Mustermappe · Claude
- Qué cambió y por qué: Im Entwurf vereinbart: «Eine Werkzeugzeile je Reiter. Überschrift, Einleitung und zweite Leiste der Werkzeugseiten entfallen im Reiter. Erklärungen stehen hinter «?», seltene Befehle unter «•••».» Neu `shared/werkzeugleiste.js` und `.css`: im Reiter von Work (`html.im-reiter`) verschiebt die Werkzeugzeile seltene Befehle in ein Menü «•••» (verschoben, nicht kopiert: Kennungen und Ereignisse bleiben), rückt Modus und Speicherstand an das Ende der Leiste und macht die Statuszeile zur knappen Info in derselben Zeile (voller Text im Tooltip); was die Seite später einfügt, wandert nach. Erstes Werkzeug: der Terminplan. In der Leiste bleiben «+ Aufgabe», «◆ Meilenstein», Tag/Woche/Monat/Heute, die Suche und die Info (Projektzeitraum, Vorgänge, Netzprüfung zuerst); unter «•••»: Sammelvorgang, Wochenenden ausblenden, Verbindungen, Auswertung · Netzplan, Basisplan sichern, CSV, JSON exportieren/importieren, Drucken / PDF, PDF-Verbindungen, Jetzt speichern, Legende; die Anleitung steht als «?» vor «•••» (Option `hilfe` der Werkzeugzeile). Die Kopfzeile entfällt im Reiter. Der Gantt beginnt so gut 170 px höher. Kostenberechnung: weil die Seite sich bei jeder Änderung neu zeichnet, baut sie die Zeile selbst: Ansichten (Übersicht, Positionen, Quellen, Vergleich, Bericht), knappe Angaben (LPH, Norm, Kostenstand; voll im Tooltip), Speicherstand, «Mengen aus Archicad» und «?» für die Anleitung; Kopfzeile und Knopf «Bericht für die Kostenbesprechung» entfallen im Reiter (der Bericht hat seinen Reiter). Produkte und Hersteller im Projekt: Suche, Filter, Kategorien, kurze Zahl («1 Eintrag», der volle Satz im Tooltip), «… öffnen» und «?» in einer Zeile (CSS-Raster, die Gruppen der Filterkarte fließen in die Zeile); Einleitung und Hinweis zur Herkunft der Preise stehen hinter «?». Controlling im Projekt: Projektname, Einleitung und Kicker entfallen; Honorarpakete, «Neues Honorarpaket» und «?» (die Erklärung) in einer Zeile. Mustermappe: eine Zeile über der ganzen Mappe statt Überschrift, Unterzeile und Leiste über der Bühne (welche Mappe offen ist, zeigt die Leiste von Work): Seiten, Rückgängig/Wiederholen, Seite oder gewählter Rahmen (voll im Tooltip), Zoom, Eigenschaften, «gespeichert» (Entwurf oder vorgelegt im Tooltip), «Präsentieren», «PDF», «Vorlegen» und «•••» mit dem Raster; ab 1000 px bricht die Zeile nicht um, unter 1100 px entfallen «−» und «+» (Zoom über die Auswahl). Neu auch auf der eigenen Seite: der Hinweis «1 Übersatz» in der Leiste, sobald ein Text nicht in seinen Rahmen passt (ein Klick zeigt die Eigenschaften und wählt den Rahmen), und Seiten, Bühne und Eigenschaften stehen schon ab 1000 px nebeneinander (bis 1180 px mit schmaleren Spalten; vorher rutschten die Eigenschaften unter die Bühne). Sonst bleibt außerhalb von Work (eigene Seite) alles wie bisher.
- Archivos: `produktbibliothek.js` (`?v=office10`), `herstellerkatalog.js` (`?v=office3`), `produktbibliothek.css` (`?v=office6`, auch in `herstellerkatalog.html` und `controlling.html`), `controlling.js` (`?v=office9`), `controlling.css` (`?v=office8`), `tests/browser/office-controlling.chromium.mjs`, `shared/werkzeugleiste.js` (neu, `?v=2`), `shared/werkzeugleiste.css` (neu, nur Tokens, `?v=2`), `terminplan.html`, `kostenberechnung.js` (`?v=office14`), `kostenberechnung.css` (`?v=office12`), `kostenberechnung.html`, `tests/browser/office-kostenberechnung.chromium.mjs`, Versionsangaben in zwei Tests, `tests/office-werkzeugleiste.test.mjs` (neu), `tests/browser/office-terminplan-reiter.chromium.mjs` (Kopfzeile ausgeblendet; neue Prüfung: eine Zeile, Befehle im Menü, Schalter wirken, Escape schließt), `projektdokumente.js` (`?v=office11`), `projektdokumente.css` (`?v=office12`), `projektdokumente.html`, `tests/office-mustermappe.test.mjs`, `tests/browser/office-mustermappe.chromium.mjs` (Reiter ohne Überschrift; neue Prüfung bei 1040 px: eine Zeile, «•••», Übersatz).
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` grün; Browserprüfungen Terminplan im Reiter, Muster-Planner, Planner–Terminplan und Mustermappe (9 Prüfungen) lokal mit Chrome grün.
- Quedó pendiente o sin probar: in der Mustermappe Filmstreifen, Inspektor mit Reitern und «Mit Romy kürzen». Lokal schlug «Datenblatt: Romy liest …» fehl, weil das Chrome hier kein PDF im Popup öffnet (nicht durch diese Änderung).
- Riesgos o decisiones que necesitan a Gari: keine.
- PR: #197

---

### 2026-11-27 · Work B2, Schritt 1: Projekt und Abschnitte in der Seitenleiste, Planner in einer Leiste · Claude
- Qué cambió y por qué: Gari hat am 27.11. die Variante B des Entwurfs gewählt, «con la barra reducida a iconos»: am Desktop stehen Projektwahl und Abschnitte des Projekts (Panorama, Wissen, Desktop, Planner, Terminplan, Kostenberechnung, Controlling, Mustermappe, Produkte, Hersteller, Threads, «+ Abschnitt») unter «Work» in den Ansichten links; die Projektzeile und die Reiterzeile oben entfallen, das Werkzeug beginnt gut 150 px höher. Auf Symbole reduziert (wie bisher beim Start) zeigt die Leiste das Kürzel des Projekts (z. B. «WL») und die Symbole der Abschnitte, die Namen im Tooltip. Die Projektwahl öffnet ein Menü neben der Leiste; «+ Abschnitt» öffnet das bekannte Menü der Abschnitte neben der Leiste. Hat ein Werkzeug mehrere Fassungen (Terminpläne LPH 3 und 5, mehrere Mappen, Kostenberechnungen), steht die Wahl unter dem Abschnitt in der Seitenleiste und die Leiste über dem Werkzeug entfällt; reduziert bleibt sie über dem Werkzeug. Die Logik bleibt in `work.js`: `work-lens.js` spiegelt Reiter und Projektwahl und klickt sie an (MutationObserver). Planner: Titel, Filter und Knöpfe stehen in einer Leiste (bricht um, wenn es eng wird). Auf dem iPhone (unter 950 px) bleibt alles wie bisher.
- Archivos: `app/work-lens.js` (neu), `app/work-lens.css` (neu, nur Tokens), `app/work.js` (`TBA_WORK_ABSCHNITTE`, Menü der Abschnitte neben der Seitenleiste, Filter in der Leiste des Boards), `app/index.html` (`work.js?v=office62`, neue Dateien), `tests/office-work-seitenleiste.test.mjs` (neu), `tests/browser/office-work-seitenleiste.chromium.mjs` (neu), `.github/workflows/verify-romy-browser.yml`, Versionsangaben in neun Tests.
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` grün; in Chromium (Attrappe der Tests): Abschnitte und Reiter gleich, Klick wählt den Abschnitt, Projektwahl, «+»-Menü neben der Leiste, im Kalender keine Abschnitte, reduziert nur Kürzel und Symbole, Planner in einer Zeile, iPhone unverändert; die bestehenden Browserprüfungen für Planner, Start und Terminplan-Reiter grün.
- Quedó pendiente o sin probar: die nächsten Schritte von B2: eine Leiste auch in Terminplan, Kostenberechnung, Mustermappe und den übrigen Werkzeugen im Reiter; Mustermappe (Filmstreifen, Inspektor); Kontextspalte im Wissen; Panorama vervollständigen.
- Riesgos o decisiones que necesitan a Gari: keine.
- PR: #196

---

### 2026-11-27 · Administration: KI-Nutzung mit Guthaben und Systemstatus · Claude
- Qué cambió y por qué: Gari will das OpenAI-Guthaben täglich im Office kontrollieren und auf einen Blick sehen, ob im Hintergrund alles läuft (wie «Uso IA» und «Estado» in Window, aber für das Büro und nur für Administratoren). Zwei neue Seiten in der Administration (Kontomenü und «Mehr» der App, nur für Administratoren): **KI-Nutzung**: geschätztes Guthaben (Betrag, den eine Administratorin oder ein Administrator bei OpenAI abliest, minus geschätzter Verbrauch seitdem), Stufe «Reicht / Wird knapp / Fast aufgebraucht / Aufgebraucht» mit «warnen ab» (Tage), Kosten heute, Ø der sieben vollen Tage, 30 Tage; Balken pro Tag (Tooltip, Tabelle); Tabellen «Nach Funktion» und «Nach Projekt». Geschätzt nach den Listenpreisen von OpenAI (Stand 27.11.2026: `gpt-6.1-terra` 1 / 0,05 / 5 $ je 1 Mio., die Modelle des Motors wie in `credit-model.mjs`, per Test gleich), mit langen Anfragen (über 272 000 Eingabe-Tokens), Websuchen (0,01 $) und Containern (0,03 $). Nie je Person: `office_ki_verbrauch` hat keine Person, und aus `minds_ai_usage` gehen nur Summen hinaus. **Systemstatus**: Romys Heartbeat, nächtliche Pflege, Zeitpläne der Datenbank (Cron), Aufrufe der Datenbank (`pg_net`), Mitteilungen aufs iPhone, Fehler im Browser (nur Meldung, Seite, Ort, Zahlen), KI-Verbrauch gegen den Median, Guthaben.
- Archivos: `supabase/migrations/20261127102635_office_admin_uebersicht.sql` (Tabelle `office_ki_guthaben`, Funktionen `office_ki_guthaben_eintragen`, `office_ki_nutzung`, `office_systemstatus`, alle nur für Administratoren), `office-uebersicht.js` (neu), `index.html` (zwei Seiten, Kontomenü, Skript; `style.css?v=office28`, `office-core.js?v=6`, `app.js?v=8`), `app.js` (`ADMIN_VIEWS`), `office-core.js` (`VIEWS`), `style.css` (nur Tokens), `app/shell.js` (zwei Links in «Mehr», `?v=office61`), `app/index.html` (`office-core.js?v=office38`), `tests/office-uebersicht.test.mjs` (neu), `tests/sql/office-admin-uebersicht-acceptance.sql` (neu), `.github/workflows/verify.yml`, Versionsangaben in sechs Tests.
- Base de datos: migración `20261127102635_office_admin_uebersicht` — aplicada en Supabase: sí (angekündigt, `apply_migration` am 27.11.2026, Datei auf die registrierte Version umbenannt). Geprüft mit Garis Sitzung (nur lesend): alle Prüfungen des Systemstatus liefern Werte, die KI-Nutzung 49 Summenzeilen.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` grün; SQL-Abnahme in der flüchtigen Datenbank der CI (Mitarbeiter und nicht mehr aktive Administratoren abgewiesen, Guthaben geprüft und gerundet, vor/nach dem Guthaben getrennt, keine Person in der Antwort); beide Seiten in Chrome mit Testdaten angesehen (Desktop und 390 px, Tooltip, kein Überlauf).
- Quedó pendiente o sin probar: Office und Window nutzen dasselbe OpenAI-Konto (Gari, 27.11.); die Seite sieht nur den Verbrauch des Office, deshalb soll das Guthaben regelmäßig neu eingetragen werden. Genaue Kosten für das ganze Konto gäbe es über die Costs API von OpenAI mit einem Admin-Schlüssel nur zum Lesen (Vorschlag an Gari). Der Preis von `gpt-5.6-sol` ist bis 30.11.2026 ein Aktionspreis.
- Riesgos o decisiones que necesitan a Gari: ob ein Admin-Schlüssel (nur lesen) für genaue Kosten angelegt werden soll.
- PR: #195

---

### 2026-11-27 · KI-Verbrauch der Office-Funktionen, ohne Person · Claude
- Qué cambió y por qué: Gari will das OpenAI-Guthaben täglich im Office im Blick haben, auch wenn das Team die Werkzeuge nutzt. Bisher schrieb nur Romys Motor (`minds_ai_usage`) seinen Verbrauch; die eigenen KI-Funktionen des Office nicht. Jetzt schreibt jeder Aufruf an OpenAI seinen Verbrauch (Modell, Tokens, davon zwischengespeichert, Websuchen) in die neue Tabelle `office_ki_verbrauch`, je Funktion und Projekt, **ohne Person** (die Tabelle hat keine Spalte dafür): `kosten` (Kostenberechnung), `dokumente`, `produkte`, `terminplan` (Einordnen und Antwort), `romy_chat` (Romy in Threads und im Assistenten, jeder Modellaufruf einzeln mit seinem Modell), `romy_faehigkeit` (Dokumente erzeugen, einmal je Lauf), `romy_gedaechtnis` (Embeddings), `romy_auftrag` (Aufträge). Gemeinsamer Helfer `supabase/functions/_office/ki-verbrauch.mjs` (eigener Ordner, weil `_shared` die Dateien des Motors aus Window enthält); er schreibt mit dem Dienst und hält nie eine Antwort auf.
- Archivos: `supabase/migrations/20261127101547_office_ki_verbrauch.sql`, `supabase/functions/_office/ki-verbrauch.mjs` (neu), `office-kosten-ai`, `office-dokumente-ai`, `office-produkt-ai`, `office-terminplan-ai`, `office-romy-mission-runner` (`index.ts`), `office-assistant` (`index.ts`, `romy-router.mjs`, `romy-capability-runtime.ts`, `romy-semantic-memory.mjs`); `tests/office-ki-verbrauch.test.mjs` (neu, auch: jede Office-Datei, die OpenAI ruft, zählt), `tests/sql/office-ki-verbrauch-acceptance.sql` (neu), `.github/workflows/verify.yml`, Muster in `tests/office-threads.test.mjs` und `tests/office-romy-like-isabella.test.mjs`.
- Base de datos: migración `20261127101547_office_ki_verbrauch` — aplicada en Supabase: sí (angekündigt, `apply_migration` am 27.11.2026, Datei auf die registrierte Version umbenannt). Geprüft: RLS an, keine Policy, `authenticated` und `anon` dürfen weder lesen noch schreiben, der Dienst schreibt.
- Deploy de funciones: `office-kosten-ai office-dokumente-ai office-produkt-ai office-terminplan-ai office-assistant office-romy-mission-runner` über den Workflow nach dem Merge.
- Cómo se probó: `node --test` grün; SQL-Abnahme in der flüchtigen Datenbank der CI.
- Quedó pendiente o sin probar: die Übersicht für Administratoren (Guthaben, Verbrauch je Tag, Funktion und Projekt) folgt im nächsten PR. Die vier Werkzeuge speichern außerdem seit ihrem Anfang jede Anfrage mit der Person (`office_*_ai_requests`, gedacht für ein Tageslimit, das es nicht mehr gibt); Vorschlag an Gari, das zu beenden.
- Riesgos o decisiones que necesitan a Gari: ob die Zähler der Anfragen je Person (`office_*_ai_requests`) entfallen sollen (löscht Daten, braucht sein OK).
- PR: #194

---

### 2026-11-27 · Fehler aus dem Browser: 30 Tage Aufbewahrung; Push in Betrieb · Claude
- Qué cambió y por qué: Gari hat die Aufbewahrungsfrist bestätigt (30 Tage). `private.office_client_fehler_aufraeumen()` löscht Zeilen, deren letztes Auftreten mehr als 30 Tage zurückliegt; Cron `office_client_fehler_aufraeumen_v1` täglich 03:17 UTC (04:17 Winterzeit). Jede Zeile gilt für einen Tag, ein Fehler, der weiter auftritt, bleibt also sichtbar. Aufrufen darf die Funktion nur die Datenbank selbst. Außerdem Push in Betrieb: Gari hat `APNS_KEY_P8` und `APNS_KEY_ID` angelegt; ein Aufruf von `office-push` hat das Anbieter-Token signiert, eine Testmitteilung (`office_push_test`) ging um 11:00 an Garis iPhone (APNs 200, «zugestellt»).
- Archivos: `supabase/migrations/20261127100440_office_client_fehler_aufbewahrung.sql`, `tests/sql/office-client-fehler-acceptance.sql` (zweiter Block: löscht nur Älteres als 30 Tage, die App darf nicht aufrufen, Cron-Job einmal), `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: migración `20261127100440_office_client_fehler_aufbewahrung` — aplicada en Supabase: sí (angekündigt, `apply_migration` am 27.11.2026, Datei auf die registrierte Version umbenannt). Geprüft: Cron-Job aktiv, weder `authenticated` noch `anon` noch der Dienst dürfen die Funktion aufrufen.
- Deploy de funciones: ninguno.
- Cómo se probó: SQL-Abnahme in der flüchtigen Datenbank der CI; Push: Antwort von APNs in `office_push_nachrichten.ergebnis` (200, mit `apns-id`).
- Quedó pendiente o sin probar: ob die Testmitteilung den entschlüsselten Text zeigte oder nur «Neue Mitteilung» (sieht nur Gari auf dem iPhone).
- Riesgos o decisiones que necesitan a Gari: keine.
- PR: #193

---

### 2026-11-27 · Geplante Aufgaben: Codeprüfung, Radar, Office-Prüfung erweitert · Claude
- Qué cambió y por qué: Gari wollte, dass Claude den Code täglich prüft (zuerst alles Bestehende, bevor Window weiter wächst) und zweimal pro Woche nach Neuem sucht, das Office und Window hilft. Neu in Claude: **Codeprüfung** (Mo–Fr 04:47): erster Durchgang über 20 Bereiche beider Repos, nach Risiko geordnet (Sicherheit zuerst), danach täglich die Änderungen der letzten 24 Stunden plus ein Bereich im Wechsel; liest die Fehler aus dem Browser (`office_client_fehler`); meldet nur Belegtes (Test, Reproduktion oder Spur mit Datei:Zeile); kleine Korrekturen als Entwurfs-PR nach den Regeln des Repos, nie mergen; Sicherheitsfunde nie öffentlich (beide Repos sind öffentlich), nur an Gari. **Radar** (Mo und Do 06:52): Neuigkeiten von Anthropic, OpenAI, Apple, Supabase, GitHub und ähnlichen Werkzeugen mit konkretem Nutzen, dazu Fristen und Abkündigungen der nächsten sechs Monate. **Office-Prüfung** (täglich) prüft zusätzlich Spitzen im KI-Verbrauch (`minds_ai_usage`, nur Summen je Funktion, nie wer) und Fehler aus dem Browser, die zwei oder mehr Personen treffen oder 20-mal auftreten; `office_client_fehler` steht in der Liste der akzeptierten Hinweise (Tabelle nur für den Dienst).
- Archivos: `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: die neuen Abfragen der Office-Prüfung von Hand gelaufen (KI-Verbrauch je Funktion mit Median, Fehler aus dem Browser: noch leer).
- Quedó pendiente o sin probar: der erste Lauf (Codeprüfung und Radar am 30.11.); die KI-Funktionen des Office (Kosten, Produkte, Terminplan, Dokumente, Assistent) schreiben noch nicht in `minds_ai_usage`, die Prüfung sieht nur Romys Motor.
- Riesgos o decisiones que necesitan a Gari: keine.
- PR: #192

---

### 2026-11-27 · Fehler aus dem Browser für die Codeprüfung · Claude
- Qué cambió y por qué: Gari wollte eine tägliche Codeprüfung durch Claude; damit sie mit echten Fehlern arbeitet statt mit Vermutungen, melden die Seiten des Office jetzt, was im Browser schiefgeht. `shared/fehler-melden.js` hört auf Skriptfehler und abgelehnte Versprechen und schickt sie an `office_client_fehler_melden`: Meldung, Ort im Code (mit Version), Seite ohne Parameter, Browser in Kurzform. Nicht gemeldet: Rauschen (fremde Skripte, Erweiterungen, ResizeObserver, abgebrochene Anfragen), Wiederholungen, mehr als acht je Seitenaufruf. E-Mail-Adressen, Tokens und Parameter in fremden Adressen entfernt schon das Skript, die Datenbank noch einmal. In der Datenbank: nur aktive Mitglieder, höchstens 50 verschiedene Fehler je Person und Tag, derselbe Fehler zählt hoch. Lesen kann über die App niemand (keine Policy); die geplanten Prüfungen fragen die Tabelle direkt ab.
- Archivos: `supabase/migrations/20261127093042_office_client_fehler.sql` (Tabelle `office_client_fehler`, `private.office_fehler_saeubern`, `office_client_fehler_melden`), `shared/fehler-melden.js` (neu), eingebunden direkt nach dem Supabase-Client in `index.html`, `app/index.html`, `terminplan.html`, `kostenberechnung.html`, `controlling.html`, `projektdokumente.html`, `produktbibliothek.html`, `herstellerkatalog.html`; `tests/office-client-fehler.test.mjs`, `tests/sql/office-client-fehler-acceptance.sql`, Schritt in `.github/workflows/verify.yml`.
- Base de datos: migración `20261127093042_office_client_fehler` — aplicada en Supabase: sí (angekündigt, `apply_migration` am 27.11.2026, Datei auf die registrierte Version umbenannt). Geprüft: RLS an, keine Policy, `authenticated` darf nicht lesen, aber melden; `anon` darf nicht melden; Bereinigung entfernt Parameter, E-Mail und Token.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` grün (Skript in einer VM: bereinigt, meldet mit Ort und Version, lässt Rauschen weg, höchstens acht); SQL-Abnahme in der flüchtigen Datenbank der CI.
- Quedó pendiente o sin probar: Aufbewahrung (Vorschlag: Zeilen älter als 30 Tage löschen, als Cron) braucht Garis OK, weil sie löscht.
- Riesgos o decisiones que necesitan a Gari: die Aufbewahrungsfrist.
- PR: #191

---

### 2026-11-27 · Kalender öffnet auf heute, «+» der Reiter mittig · Claude
- Qué cambió y por qué: Gari: der Kalender zeigte nach jedem Öffnen den zuletzt angesehenen Tag; er soll immer auf heute stehen. Und das «+» am Ende der Reiter saß nicht in der Mitte des blauen Kreises. Kalender: der Schreibtisch (`dashboard.js`) und der Kalender der App (`app.js`) bringen den gespeicherten Tag nicht mehr mit, jeder Start beginnt mit heute; innerhalb der Sitzung bleibt der gewählte Tag. Bleibt die Seite über Mitternacht offen und stand sie auf «heute», rückt sie beim nächsten Hinsehen auf den neuen Tag; ein bewusst gewählter anderer Tag bleibt. «+»: statt des Schriftzeichens (sitzt je nach Schrift tiefer) ein gezeichnetes Kreuz; der Kreis wird ausdrücklich mittig gesetzt (`inset:0;margin:auto`), statt sich auf die statische Lage im Grid zu verlassen.
- Archivos: `app/dashboard.js`, `app/app.js`, `app/shell.js`, `app/work-polish.css`, `app/index.html` (Versionen), `tests/office-kalender-heute.test.mjs` (neu), `tests/office-work-reiter.test.mjs`, `tests/browser/office-planner-karten.chromium.mjs` (misst, dass Kreuz und Kreis dieselbe Mitte haben), Versionsangaben in vier weiteren Tests.
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` grün (532); die Browserprüfung läuft in CI.
- Quedó pendiente o sin probar: dieselbe Kalenderänderung in Window (eigener PR im Window-Repo).
- Riesgos o decisiones que necesitan a Gari: keine.
- PR: #190

---

### 2026-11-27 · Romys Mitteilungen auf das iPhone (Push über APNs, verschlüsselt) · Claude
- Qué cambió y por qué: Gari wollte, dass Romy ihm aufs iPhone schreiben kann, wenn sie ihm etwas zu sagen hat (in Window ging das über Web-Push der Web-App auf dem Home-Bildschirm; in der Window-App kann die Web-Ansicht kein Push empfangen, und im Office war Push im Motor bewusst aus). Umgesetzt wie am 25.11. entschieden: natives Push über APNs, und Apple sieht nur «Romy · Neue Mitteilung». Die Window-App erzeugt je iPhone einen Schlüssel (32 Byte) und meldet ihn mit dem APNs-Token an; der Versand verschlüsselt den Text mit AES-256-GCM, die Mitteilungserweiterung der App entschlüsselt ihn auf dem iPhone. In die Warteschlange kommt, was Romy von sich aus in den Chat schreibt (eigene Nachricht, nicht beim Öffnen der App) und dringende Hinweise (Route «interrupt»; Ruhezeiten und Budget wendet die Aufmerksamkeitssteuerung schon an), nur mit angemeldetem Gerät. Der Motor bleibt unverändert (byte-gleich mit Window).
- Archivos: `supabase/migrations/20261127064446_office_push.sql` (Tabellen `office_push_geraete`, `office_push_nachrichten`, Funktionen `office_push_geraet_anmelden`, `_abmelden`, `office_push_test`, `office_push_holen` (nur Dienst), Auslöser auf `conversation_messages`, Geheimnis und Cron `office_push_v1`), `supabase/functions/office-push/` (`core.mjs`, `index.ts`), `supabase/config.toml`, `tests/office-push.test.mjs`, `tests/sql/office-push-acceptance.sql`, `.github/workflows/verify.yml`, `tests/office-romy-vorschlaege.test.mjs` (Begründung bei Web-Push angepasst), `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: migración `20261127064446_office_push` — aplicada en Supabase: sí (angekündigt, `apply_migration` am 27.11.2026; Datei auf die registrierte Version umbenannt). Tabellen mit RLS, Auslöser, fünf Funktionen, Cron `office_push_v1` und Geheimnis geprüft; Security Advisor ohne neuen Befund außer dem bekannten für `office_*`-Funktionen. Team ID und Bundle ID in `isabella_runtime_secrets` eingetragen.
- Deploy de funciones: `office-push` über den Workflow nach dem Merge. `APNS_KEY_P8` und `APNS_KEY_ID` legt Gari selbst als Secrets an (Push-Schlüssel von Apple), nie im Chat; Team ID und Bundle ID (öffentlich) trägt Claude in `isabella_runtime_secrets` ein, nicht ins Repo.
- Cómo se probó: `node --test` grün; Anbieter-Token gegen einen erzeugten P-256-Schlüssel geprüft, Verschlüsselung mit WebCrypto wieder geöffnet (Format wie CryptoKit «combined»), kein Klartext in der Anfrage an Apple, Antworten von APNs eingeordnet; `deno check` der Funktion ohne Fehler; Abnahme der Rechte in CI gegen eine leere Supabase.
- Quedó pendiente o sin probar: die App-Seite (Window-Repo: Registrierung, Mitteilungserweiterung, Tippen öffnet Romy, vierter Target in der Signatur) und der erste echte Versand an Garis iPhone.
- Riesgos o decisiones que necesitan a Gari: den Push-Schlüssel bei Apple anlegen und in Supabase speichern.
- PR: #189

---

### 2026-11-26 · Geplante Aufgaben: Office-Prüfung, Projektwissen-Pflege, Projektübersicht, Quellen-Wächter · Claude
- Qué cambió y por qué: Gari wählte vier geplante Aufgaben in Claude, zusätzlich zum Baupreisindex. **Office-Prüfung** (diaria 06:23): Heartbeat, Akte-Pflege, Cron-Jobs, `pg_net`, Edge Functions mit 5xx, Sicherheitshinweise gegen eine Liste der bekannten, Workflows auf `main`, Seite erreichbar; nur lesen, bei einem Fehler einmal neu prüfen, sonst still (Anlass: der Heartbeat fiel vom 14. bis 23.11.2026 aus, ohne dass es jemand merkte). **Projektwissen pflegen** (Mo–Fr 22:54): offene Beiträge einarbeiten, freitags alle Seiten (vergangene Termine, Doppeltes, Widersprüche); Entscheidungen nur «vorgeschlagen». **Projektübersicht** (Mo 07:21): Woche, nächste Woche (Fristen), Überfälliges, was auf Gari wartet, Widersprüche. **Quellen-Wächter** (am 3. jedes Monats 08:50): HOAI, BayBO, DIN 276, Graphisoft-Richtlinie gegen einen Stand, den die Aufgabe selbst fortschreibt.
- Archivos: `docs/PROJEKTWISSEN.md` (nächtliche Pflege; nächster Schritt: Projekte ohne Gari im Team), `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: die Abfragen der Office-Prüfung von Hand gelaufen (Heartbeat 96/0 in 24 h, alle sechs aktiven Cron-Jobs alle 1, 5 oder 15 Minuten ohne Fehler, Workflows auf `main` grün, Seite 200, GitHub-API auch ohne Anmeldung erreichbar); Werkzeuge und Felder des Connectors im Code geprüft (`write_page` mit `grund`; ein vorgeschlagener Ersatz löst eine Entscheidung erst ab, wenn er bestätigt ist).
- Quedó pendiente o sin probar: der erste echte Lauf jeder Aufgabe (Office-Prüfung 27.11. früh, Pflege 27.11. abends, Übersicht 30.11., Quellen 03.12.).
- Riesgos o decisiones que necesitan a Gari: die Pflege schreibt mit seinem Konto (Verlauf zeigt ihn als Autor, Grund «Nächtliche Pflege»).
- PR: #188

---

### 2026-11-26 · Panorama-Karte «Neu im Projektwissen» · Claude
- Qué cambió y por qué: Gari wollte eine Karte «Neu im Projektwissen» im Panorama. Sie steht in der rechten Spalte unter den Terminplänen und zeigt nur dem Projektteam (Mitgliedschaft über `office_project_members`; sonst keine Karte): die Zahl der Seiten, die Entscheidungen zur Bestätigung, die Beiträge, die auf die KI warten, und die letzten drei Änderungen mit Titel, Art und Tag (heute, gestern oder Datum). Ohne Projektwissen ein Satz, wie es entsteht. Ein Klick merkt die Ansicht oder die Seite vor (`TBA_OFFICE_WISSEN.vormerken`) und öffnet den Reiter «Wissen» dort. Die erste Fassung schnitt in der schmalen Spalte die Zeilen ab; nach dem Bildschirmfoto: Titel zuerst, Art und Tag klein, «Öffnen» statt «Wissen öffnen».
- Archivos: `app/office-wissen.js` (`panorama`, `panoramaHtml`, `vormerken`; `office3`), `app/work.js` (`office61`), `app/index.html`, `tests/office-projektwissen.test.mjs`, `tests/browser/office-wissen.chromium.mjs` (Panorama mit Team, ohne Team, leer), Versionsstände in den Tests, `docs/PROJEKTWISSEN.md`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (518); Chromium `office-wissen` (9) und die Work-Tests (21) grün; Bildschirmfotos angesehen.
- Quedó pendiente o sin probar: nichts Bekanntes.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #187

---

### 2026-11-26 · Romy liest das Projektwissen (Threads) · Claude
- Qué cambió y por qué: Gari wollte, dass Romy die Seiten in ihrem Chat suchen und lesen kann. Beim Prüfen: Der Chat mit Romy läuft im Office über Windows Motor (`isabella-chat`), und dessen `search_work` liest die Projektakte mit Titel, Text und Status, findet also Seiten und Entscheidungen schon; meine frühere Aussage (#183), Romy lese die Projektakte nicht, stimmte nur für die Threads (`office-assistant`). Dort jetzt zwei lesende Werkzeuge: `search_project_knowledge` (Seiten mit Kurzfassung und Stand, Entscheidungen als «beschlossen»/«vorgeschlagen», mit Suchbegriff ein Auszug; Filterzeichen neutralisiert) und `read_project_knowledge_page` (Seite ganz bis 60.000 Zeichen, Verweise, Entscheidungen der Seite; eine zusammengeführte Seite führt zur neuen; ohne Treffer die Liste der Seiten). Beide mit dem JWT der Person, also RLS: nur das Projektteam. Anweisung und Thread-Hinweis ergänzt. Den Motor selbst nicht angefasst: er ist byte-gleich mit Window (`docs/sync-window-engine-manifest.json`, Test `romy-engine-parity`); eine Kennzeichnung der Seiten in `search_work` ginge nur über Window.
- Archivos: `supabase/functions/office-assistant/romy-tools.mjs`, `supabase/functions/office-assistant/index.ts`, `tests/office-romy-projektwissen.test.mjs` (neu), `docs/PROJEKTWISSEN.md`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: ninguna migración.
- Deploy de funciones: `office-assistant` über den Workflow nach dem Merge.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (517); `deno check` von `office-assistant` mit denselben 100 alten Typfehlern wie auf `main` (keiner neu; die Funktion war so schon deployt).
- Quedó pendiente o sin probar: ein echter Thread mit einer Frage zum Projektwissen.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #186

---

### 2026-11-26 · Projektwissen: schärfere Regel für Entscheidungen · Claude
- Qué cambió y por qué: Erster echter Einsatz am Abend des 26.11.2026 (drei Beiträge, 8 Seiten, 17 Entscheidungen). Das Register füllte sich mit Arbeitsregeln des Teams (wie mit Herstellern gearbeitet und formuliert wird), und eine Empfehlung an die Bauherrschaft stand als «beschlossen», obwohl ihr eigener Text sagt, dass die Bauherrschaft sie erst noch bestätigt. Mit Garis OK: Regel geschärft (nur, was das Projekt bindet; «beschlossen» nur, wenn entschieden hat, wer es zu entscheiden hat; Empfehlungen bleiben vorgeschlagen; Arbeitsregeln auf die Seite) und die drei Einträge korrigiert.
- Archivos: `supabase/migrations/20261126215655_office_projektwissen_entscheidungen.sql`, `supabase/functions/office-mcp/index.ts` (Anweisungen, `record_decision`), `app/office-wissen.js` (`office2`: «Ersetzt durch …», «Keine Projektentscheidung, sondern Arbeitsweise des Teams: steht auf der Seite …», Korrekturvermerk), `app/index.html`, `tests/office-projektwissen.test.mjs`, `tests/browser/office-wissen.chromium.mjs`, `docs/PROJEKTWISSEN.md`, `docs/OFFICE-CONNECTOR.md`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: migración `20261126215655_office_projektwissen_entscheidungen.sql` (ändert nur den Abschnitt «Entscheidungen» der Regeln und bricht ab, wenn der Text nicht mehr der ursprüngliche ist) — aplicada en Supabase: sí (26.11.2026, `apply_migration` nach grünem CI und vor dem Merge; Regeltext danach per md5 gleich dem der Datei). Datenkorrektur in einem Projekt (nicht im Repo, mit Garis OK, per SQL, nichts gelöscht): eine Empfehlung von «beschlossen» auf «vorgeschlagen» (`confirmed_at` leer, Vermerk `korrektur`), zwei Arbeitsregeln auf «ersetzt» mit Verweis auf die Seite, auf der sie schon standen (`auf_seite`, `grund`); je ein Eintrag im Protokoll.
- Deploy de funciones: `office-mcp` über den Workflow nach dem Merge.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün; `deno check` grün; Chromium `tests/browser/office-wissen.chromium.mjs` grün (alte Entscheidungen mit «Ersetzt durch» und Verweis auf die Seite, Link führt zur Seite); Migration in PGlite nach der ersten (neuer Text, zweiter Lauf bricht ab, Abnahme weiter grün).
- Quedó pendiente o sin probar: Grenzfall im selben Projekt gelassen, wie er ist (Entscheidung zur Lichtabgabe mit eingebetteten Formulierungsregeln); ein Werkzeug, mit dem die KI bei der Pflege falsch eingeordnete Entscheidungen selbst umstellt, erst wenn es wieder vorkommt.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #185

---

### 2026-11-26 · Projektwissen: «pásalo al Office» auch mitten im Chat und mehrmals · Claude
- Qué cambió y por qué: Gari (26.11.2026, nach #183): Er schreibt in seinen Chats weiter; «am Ende eines Chats» passt nicht. Jetzt ausdrücklich: jederzeit und mehrmals im selben Chat; ab dem zweiten Mal teilt Claude nur, was seitdem neu ist oder sich geändert hat (als Fortsetzung, dieselbe Herkunft), nie den ganzen Chat noch einmal. Bisher stand das nirgends; ein zweites Teilen hätte einen fast gleichen Beitrag erzeugt.
- Archivos: `supabase/functions/office-mcp/index.ts` (Anweisungen, Beschreibung von `share_knowledge`), `tests/office-projektwissen.test.mjs`, `docs/PROJEKTWISSEN.md`, `docs/OFFICE-CONNECTOR.md`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: ninguna migración.
- Deploy de funciones: `office-mcp` über den Workflow nach dem Merge.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün; `deno check supabase/functions/office-mcp/index.ts` grün.
- Quedó pendiente o sin probar: der erste echte Durchgang mit einem Chat von Gari.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #184

---

### 2026-11-26 · Projektwissen: gemeinsamer Wissenspool je Projekt (Reiter «Wissen», Connector) · Claude
- Qué cambió y por qué: Gari (26.11.2026): Was er mit Claude zu einem Projekt erarbeitet, ist Wissen des Projekts und soll für das Team gemeinsam sein, ohne starre Struktur und ohne den Desktop. Nach einer Recherche (von einer KI gepflegtes Wiki, Garten statt Strom, Evergreen Notes, ISO 19650, Entscheidungsprotokolle) ein Pool je Projekt: Beiträge (unverändert, mit Herkunft) → Seiten, die die KI anlegt, zusammenführt, fortschreibt, verknüpft und bei Widersprüchen benennt → Entscheidungen (vorgeschlagen, bis die Projektleitung bestätigt). «Pásalo al Office» genügt; das Team liest, fragt und korrigiert (Notiz, Hinweis). Konzept: `docs/PROJEKTWISSEN.md`.
- Archivos: `supabase/migrations/20261126193119_office_projektwissen.sql`, `tests/sql/office-projektwissen-acceptance.sql`, `.github/workflows/verify.yml` (Abnahme), `supabase/functions/office-mcp/office-wissen.mjs` (neu), `supabase/functions/office-mcp/index.ts` (Werkzeuge `share_knowledge`, `read_page`, `write_page`, `record_decision`, `search_knowledge`, `read_contribution`; `open_project` mit Projektwissen; Ablauf in den Anweisungen), `app/office-wissen.js` und `app/office-wissen.css` (neu), `app/work.js`, `app/shell.js`, `app/index.html`, `tests/office-projektwissen.test.mjs`, `tests/browser/office-wissen.chromium.mjs`, `.github/workflows/verify-romy-browser.yml`, angepasste Versionsstände in den Tests, `docs/PROJEKTWISSEN.md`, `docs/OFFICE-CONNECTOR.md`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: migración `20261126193119_office_projektwissen.sql` — aplicada en Supabase: sí (26.11.2026, `apply_migration` nach grünem CI und vor dem Merge; Funktionstexte und Regeltext per md5 gleich der Datei; RLS an, `authenticated` nur `select` und auf die Regeln `update` einzelner Spalten, `execute` nur `authenticated`; Security Advisor: nur der erwartete Hinweis zu `security definer`-Funktionen, wie bei den übrigen Office-Funktionen).
- Deploy de funciones: `office-mcp` über den Workflow nach dem Merge.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (512); `deno check supabase/functions/office-mcp/index.ts` grün; Migration und Abnahme lokal gegen PGlite; Chromium `tests/browser/office-wissen.chromium.mjs` (7 Fälle: Seite mit sicherem Markdown, Herkunft, Fassungen, Verweisen und Hinweisen; Hinweis, Notiz und Bestätigen nur über die Funktionen; Suche; Teammitglied ohne Leitung; außerhalb des Teams; leer; iPhone) und die Work-Tests in Chromium grün; Bildschirmfotos angesehen.
- Quedó pendiente o sin probar: der erste echte «pásalo al Office» aus einem Chat von Gari; Romy liest das Projektwissen noch nicht (ein Werkzeug dafür wäre der nächste Schritt); Karte im Panorama; regelmäßige Pflege.
- Riesgos o decisiones que necesitan a Gari: Wer zum Team eines Projekts gehört, sieht dessen Projektwissen; wer nicht dazugehört (auch Admins), nicht. Direkt in `minds_work_memory` darf die Person, die eine Seite angelegt hat, sie weiterhin ändern (bestehende Regel der Projektakte, nicht angetastet); Löschen kann niemand.
- PR: #183

---

### 2026-11-26 · Office-Connector: Ablage im Desktop wieder entfernt · Claude
- Qué cambió y por qué: Gari (26.11.2026): Das Wissen aus seinen Claude-Chats soll gemeinsames Wissen des Projektteams werden, aber nicht im Desktop: der Desktop bleibt wie der Server eines Büros, auf dem alle sehen, was drin ist; PDFs legt jede Person selbst ab. Stattdessen ein Wissenspool je Projekt, den die KI schreibt und pflegt (das Team liest, fragt und korrigiert). Bis der Pool steht, sind `close_session` und `file_document` (#180) aus dem Connector entfernt; benutzt wurden sie nicht (der Desktop von Bernried hat keine Dateien von Claude).
- Archivos: `supabase/functions/office-mcp/index.ts` (Stand vor #180), `supabase/functions/office-mcp/office-ablage.mjs` und `tests/office-mcp-ablage.test.mjs` entfernt; `docs/OFFICE-CONNECTOR.md`, `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración.
- Deploy de funciones: `office-mcp` über den Workflow nach dem Merge.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün; `deno check supabase/functions/office-mcp/index.ts` grün.
- Quedó pendiente o sin probar: das Projektwissen (nächster Schritt).
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #182

---

### 2026-11-26 · Office-Connector verbunden: OAuth-Server an · Claude
- Qué cambió y por qué: Gari hat im Supabase-Dashboard des Office (Authentication → OAuth Server) den OAuth-Server eingeschaltet, den Authorization Path `/oauth-consent.html` gesetzt und «Allow Dynamic OAuth Apps» erlaubt; danach in Claude den benutzerdefinierten Connector «TBA Office» hinzugefügt (vom Handy). Damit gilt «pásalo al Office» aus seinen Claude-Chats (#180).
- Archivos: `docs/OFFICE-CONNECTOR.md` (Stand der Einrichtung), `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: ninguna migración; nur die Einstellung im Dashboard (keine Änderung über Code).
- Deploy de funciones: ninguno.
- Cómo se probó: Discovery `/.well-known/oauth-authorization-server/auth/v1` antwortet mit `registration_endpoint`; die Einwilligungsseite lädt auch unter `…github.io//oauth-consent.html` (die Site URL endet mit «/»); `open_project` «Bernried» über den Connector mit Garis Login: Projekt 2401, noch keine Themen im Desktop.
- Quedó pendiente o sin probar: der erste echte Ablagevorgang (`close_session`, `file_document`) aus einem Chat von Gari.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #181

---

### 2026-11-26 · Office-Connector: aus Claude-Chats ins Projekt ablegen (Thema festhalten, Dokument ablegen) · Claude
- Qué cambió y por qué: Gari (26.11.2026): Mit dem Window-Connector sagt er einem Claude-Chat «pásalo a Window». Dasselbe will er fürs Office, um das, was er mit Claude zu einem Projekt erarbeitet hat, ins Projekt zu bringen, sichtbar für das Projektteam (seine Wahl). Der Office-Connector (`office-mcp`, #49) konnte bisher nur lesen und Aufgaben anlegen.
  - **Wohin:** Das Panorama des Office zeigt die Projektakte noch nicht (siehe Hoja de ruta: erst nach der rechtlichen Klärung); deshalb in den gemeinsamen Desktop des Projekts, den das Team nutzt und die KI des Office liest.
  - **`close_session` (Thema festhalten):** je Thema ein Ordner (ein vorhandener Ordner gleichen Namens wird genutzt, gleich wer ihn angelegt hat), darin datierte Stände «JJMMTT Stand <Thema>.md» mit Stand, Entscheidungen (fortgeschrieben; nicht ausdrücklich Entschiedenes «vorgeschlagen»), Offene Fragen, Nächste Schritte, Fristen und Quellen; die Felder stehen zusätzlich in `metadata.themenblatt`, damit der nächste Stand darauf aufbaut. Ein neues Thema nur mit `neues_thema`; ähnliche Namen («Lichtplanung 3. BA») gehen zum bekannten Thema (`matchTopic` wie in Window). Ein gleicher Stand wird nicht noch einmal abgelegt; am selben Tag bekommt der Name die Uhrzeit.
  - **`file_document` (Dokument ablegen):** Markdown mit Kopf (Art, Datum, bei E-Mails Von, An, Betreff); Ordner: der angegebene, der des Themas oder nach Art (Dokumente, Recherchen, Notizen, Protokolle, Briefe, E-Mails); gleicher Inhalt im Projekt nur einmal, gleich wer ihn abgelegt hat.
  - **Lesen:** `open_project` nennt die Themen im Desktop mit dem jüngsten Stand, `open_topic` gibt den letzten Stand zurück (zum Weiterarbeiten in einem neuen Chat).
  - **Grenzen:** nur mit Mitgliedschaft im Projektteam (dieselbe Prüfung wie die Projektakte; Storage und RLS verlangen sie ebenfalls); nichts wird überschrieben oder gelöscht (`upsert:false`, keine Änderungen an vorhandenen Dateien). In den Anweisungen: alles deutsch, die Regeln des Leitfadens «Was darf ins TBA Office?», Fristen nur auf Wunsch als Aufgaben, danach in 3–5 Zeilen sagen, was wo liegt.
- Archivos: `supabase/functions/office-mcp/office-ablage.mjs` (neu), `supabase/functions/office-mcp/index.ts`; Tests `tests/office-mcp-ablage.test.mjs` (neu, 6); `docs/OFFICE-CONNECTOR.md`, `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración (vorhandene Tabellen `minds_work_folders`, `minds_work_files` und Bucket `minds-work` mit ihrer RLS).
- Deploy de funciones: `office-mcp` über den Workflow nach dem Merge.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (504); `deno check supabase/functions/office-mcp/index.ts` grün. Mit einer Datenbank im Speicher: Pfad und Zeile wie beim Hochladen im Desktop (Person / Projekt / Ordner), ein neues Thema erst nach Rückfrage, der zweite Stand baut auf dem ersten auf, nichts doppelt, ohne Mitgliedschaft wird nichts geschrieben.
- Quedó pendiente o sin probar: **Der OAuth-Server des Supabase-Projekts ist aus** («OAuth server is disabled»): bis er eingeschaltet ist (Authentication → OAuth Server, Authorization Path `/oauth-consent.html`, dynamische Registrierung erlauben), kann Claude den Connector nicht verbinden; danach in Claude als benutzerdefinierten Connector hinzufügen. Mit echter Anmeldung noch nicht geprobt. Das Panorama zeigt die Themen nicht (nur der Desktop).
- Riesgos o decisiones que necesitan a Gari: den OAuth-Server einschalten (nur im Dashboard).
- PR: #180

---

### 2026-11-26 · Controlling: der Gewinn vorn, fürs Team als Stufe; «Ergebnis» heißt «Gegenüber Kalkulation» · Claude
- Qué cambió y por qué: Gari (26.11.2026): «Ergebnis am Ende netto» auf der Karte liest sich wie das Ergebnis des Projekts, vergleicht aber nur die Stunden zum Kalkulationssatz mit dem Honorar; was zählt, ist der Gewinn nach Gehältern und Bürokosten. Wer im Projekt arbeitet, soll wissen, ob es Geld verdient oder verliert, ohne daraus Gehälter ausrechnen zu können.
  - **Karte:** oben unverändert (Nummer, Name, LPH, Chips, Balken für Stunden und Honorar). Die Zahlenzeile: **Gewinn (am Ende)**, mit vollem Zugang als Betrag mit «vertraulich» (oder der Grund, warum er fehlt, etwa «Gehälter unvollständig»), für das Team als Stufe «im Plus» / «knapp» / «im Minus» mit Zeichen und ohne Betrag; **Gegenüber Kalkulation (am Ende) netto** (der bisherige Wert «Ergebnis», nur umbenannt); **Erarbeitet, nicht bezahlt netto**. «Honorar je Stunde netto» steht nur noch im Projektblatt. Die drei Zahlen stehen auf einer Höhe (Subgrid).
  - **Stufe:** über +5 % des Honorars im Plus, unter −5 % im Minus, dazwischen knapp (`gewinnStufe`, `GEWINN_GRENZE = 0.05` im Kern). «vorläufig», solange unter «Annahmen» kein «Bestätigt am» steht.
  - **Projektblatt:** erste Kachel der Gewinn (voll: Betrag; Team: Stufe mit «nach Gehältern und Bürokosten; der Betrag ist vertraulich»), dann «Gegenüber Kalkulation am Ende netto»; Einleitung, Kennzahlen, Tabelle der Stände und «So wird gerechnet» (neue Zeile «Gewinn» mit den Grenzen) mit denselben Begriffen; Bericht und Übersicht als PDF ebenso (Team: Stufe statt Betrag). «Die Lage» bleibt der Vergleich mit der Kalkulation.
  - **Datenbank:** neue Funktion `office_controlling_gewinn_stufen(p_project)` (security definer; lesen darf, wer das Projekt im Controlling sieht, `private.office_controlling_lesen`). Sie rechnet wie das Projektblatt (Personalkosten je Stand wie `office_controlling_summen`, Selbstkosten = Personalkosten × Faktor ÷ (1 + Arbeitgeberanteil), Gewinn am Ende = Honorar − Selbstkosten ÷ Leistungsstand) und gibt nur `paket_id`, `stufe` und `vorlaeufig` zurück: keine Beträge, keine Gehälter, keine Stunden je Person. Die Seite fragt sie nur ohne vollen Zugang ab; fehlt sie, bleibt die Stufe leer.
- Archivos: `controlling.js` (`?v=office8`), `controlling-kern.js` (`office7`), `controlling.css` (`office7`), `controlling.html`; `supabase/migrations/20261126162036_office_controlling_gewinn_stufen.sql` (neu); Tests `tests/office-controlling.test.mjs` (Stufe und Grenzen, derselbe Fall wie in der Abnahme, Migration, Versionen), `tests/sql/office-controlling-acceptance.sql` (für B ohne Gehalt leer, dann plus, knapp, minus; C nichts, anon abgewiesen), `tests/browser/office-controlling.chromium.mjs`, `tests/browser/fixtures/fake-supabase-controlling.js`; `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: migración `20261126162036_office_controlling_gewinn_stufen` aplicada (antes avisado): eine neue Funktion, nichts entfernt oder geändert. Vorher nur lesend mit den echten Daten geprüft: ein laufendes Paket mit vollständigen Gehältern ergibt denselben Gewinn wie das Projektblatt (Stufe «plus», vorläufig). Danach als Teammitglied ohne vollen Zugang: dieselbe Stufe; ohne Anmeldung keine Zeile; `anon` darf sie nicht ausführen.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (498); Chromium Controlling grün (9: Karte mit vollem Zugang mit Betrag und «vertraulich», Karte des Teams mit «im Plus» und ohne €, Zahlen auf einer Höhe, Kacheln in der neuen Reihenfolge, «So wird gerechnet», Bericht des Teams ohne Beträge); Bildschirmfotos angesehen. Die Abnahme der Datenbank läuft im isolierten Supabase der CI.
- Quedó pendiente o sin probar: Fürs Team bleibt die Stufe «vorläufig», bis die Annahmen bestätigt sind, und leer («—»), solange in einem Paket Gehälter fehlen oder Stunden nur fürs Team stehen.
- Riesgos o decisiones que necesitan a Gari: ninguno; die Grenze von ±5 % steht im Kern und in der Funktion (bei einer Änderung beide).
- PR: #179

---

### 2026-11-26 · Mustermappe Etappe 2: Rahmen auf dem Raster, Zuschneiden auf der Seite, Fotos ziehen, Rückgängig · Claude
- Qué cambió y por qué: Gari (26.11.2026): nach der Arbeitsfläche (Etappe 1) die Etappe 2 des Editors: Rahmen Feld für Feld verschieben und in der Größe ändern, mit Doppelklick zuschneiden, Fotos aus der Bibliothek auf die Seite ziehen und rückgängig machen. Die Vorlagen bleiben das Layout zum Anfangen.
  - **Layout der Seite (Kern):** Jeder Rahmen einer Vorlage hat einen Schlüssel (`kopf`, `zonen`, `foto-1`, `text-1` …, `beschreibung`, `kennwerte`, `bild`, `tabelle` …). Was abweicht, steht in `seite.layout`, getrennt nach der Form der Seite (`layoutBasis`: `vergleich-1/2/3`, `material`, `deckblatt`, `uebersicht`, `frei`): mit einer anderen Zahl Varianten gilt wieder die Vorlage, das Angepasste kommt zurück, wenn die Zahl zurückgeht. `{c,r,w,h}` in ganzen Feldern (12 × 8, geprüft), `{aus:true}` blendet aus. Rahmen dürfen sich überlappen, Texte liegen über Fotos. Gilt auch im PDF, beim Präsentieren und in den Ständen. Die Spalten der Übersicht sind jetzt Anteile der Breite (in einem schmaleren Rahmen bleiben die Verhältnisse). `rahmenMass` nennt Felder, Millimeter und Seitenverhältnis (3:2, 4:3, A-Format, 16:9 …).
  - **Rahmen bearbeiten:** Unter dem Zeiger Umriss und Griff mit dem Namen; Klick wählt (acht Anfasser, in der Leiste z. B. «Foto A · 6 × 4 Felder · 188 × 124 mm · 3:2», rechts die Karte «Layout» mit Stelle, Überlappung, «Wie die Vorlage», «Ausblenden», ausgeblendete Rahmen und «Ganze Seite wie die Vorlage»). Ziehen am Griff verschiebt, an den Anfassern ändert die Größe; ein Foto lässt sich an sich selbst ziehen (ab 4 px). Es rastet am nächsten Feld ein (32 mm je Feld), beim Ziehen erscheinen die Felder. Pfeiltasten verschieben um ein Feld, mit Umschalt ändern sie die Größe. Texte bleiben mit einem Klick zu schreiben; solange man in einem Rahmen schreibt, hat er keine Anfasser (dort beginnt der Text), Esc verlässt den Text und zeigt sie.
  - **Zuschneiden auf der Seite:** Doppelklick auf ein Foto einer Variante: Ziehen verschiebt das Bild (es folgt dem Zeiger), Rad oder Regler vergrößert bis dreifach, hell um den Rahmen das ganze Bild; die Leiste schwebt unten über der Bühne (die Seite springt nicht). Enter oder «Fertig» übernimmt, ein Klick daneben auch, Esc bricht ab. Gespeichert wie im Dialog (`ausschnitt` am Foto, gilt auf allen Seiten).
  - **Fotos auf die Seite ziehen:** die Vorschaubilder rechts auf ein Foto derselben Variante (ersetzt) oder auf der Materialseite auf den Platz für Bild 2 und 3 (erscheint nur beim Ziehen); eigene Bilder oder ein PDF vom Schreibtisch auf jedes Foto, das Bild einer freien Seite oder das Titelbild (bleiben in der Mappe). Eine Datei neben die Fotos öffnet der Browser nicht.
  - **Rückgängig und Wiederholen:** Knöpfe in der Leiste, Strg+Z / Strg+Y (Mac ⌘Z / ⇧⌘Z) außerhalb der Textfelder; im Textfeld gilt das Rückgängig des Browsers, nach dem Verlassen ist die Eingabe ein Schritt. Ein Schritt hält nur die geänderten Felder (Seiten und Varianten je id), so bleibt, was inzwischen anderswo geändert wurde; Rückgängig zeigt die Seite, auf der es geschah. Im Verlauf: Rahmen, Fotos, Ausschnitt, Bilder der Seiten, Texte, Seiten hinzufügen, verschieben und entfernen, Anzeige und Kandidaten der Seite, Angaben der Position, Kandidaten hinzufügen und entfernen, Positionen. Mehrere Pfeiltasten kurz hintereinander sind ein Schritt. Der Verlauf gilt bis zum Neuladen.
- Archivos: `mustermappe-kern.js` (`?v=office5`), `projektdokumente.js` (`office10`), `projektdokumente.css` (`office11`), `projektdokumente.html`; Tests `tests/office-mustermappe.test.mjs` (neuer Test zum Layout, Spalten der Übersicht, Versionen), `tests/browser/office-mustermappe.chromium.mjs` (neuer Test Etappe 2); `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración (`seite.layout` steht in `daten` der Mappe).
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (496); Chromium Mustermappe grün (8, darunter: Anfasser eine Zeile tiefer, Foto eine Spalte weiter, Pfeiltasten, PDF mit dem Layout, Rückgängig und Wiederholen mit Tasten und Knopf, Griff, «Wie die Vorlage», ausblenden und einblenden auch im PDF, Text als Schritt, Zuschneiden mit Enter und Esc ohne Sprung der Seite, eigenes Bild und Foto der Bibliothek auf die Materialseite gezogen), Projektdokumente (8), Zahlen (1), Musterplaner (5). Bildschirmfotos angesehen, das helle Bild beim Zuschneiden mit einem gestreiften Testbild geprüft (läuft genau weiter).
- Quedó pendiente o sin probar: Auf iPad und iPhone wählt ein Tippen den Rahmen, danach lässt er sich ziehen; Ziehen aus der Bibliothek geht dort nicht (dafür «Bild ändern»), am echten Gerät nicht geprobt. Bilder freier Seiten und das Titelbild werden ganz gezeigt und nicht zugeschnitten. Aus Etappe 2 noch offen: die Ansicht aller Seiten als Raster und ein Foto bewusst bis zum Blattrand. Etappe 3 (eigene Layouts speichern, Stile des Büros) und 4 (Pläne mit Positionen) folgen.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #178

---

### 2026-11-26 · Leitfaden «Was darf ins TBA Office?» statt «Was darf auf den Desktop?» · Claude
- Qué cambió y por qué: Gari (26.11.2026): Hochladen und Teilen geht nicht nur auf dem Desktop, sondern auch in Threads und im Gespräch mit den Assistenten; die KI liest, was ins Office kommt. Der Leitfaden gilt deshalb allgemein, ohne jeden Ort aufzuzählen. Titel «Was darf ins TBA Office?»; «Kurz gesagt»: «Was wir ins TBA Office hochladen oder dort schreiben, kann eine KI lesen …», «Die Daten liegen auf einem Server in Frankfurt. Was zu einem Projekt gehört, sieht nur dessen Team.», «Was ins Office kommt, kann die KI lesen, Dateien automatisch nach wenigen Minuten.»; Grün und Gelb «ins Office» statt «auf den Desktop»; Rot «… auch nicht kurz oder in einer Nachricht: Die KI würde sie lesen, und der Text ginge an OpenAI.» Dazu, wie in der Fassung für die Büroleitung: den Vertrag nach Art. 28 DSGVO muss niemand aushandeln, OpenAI und Supabase haben ihn fest in ihren Bedingungen, er gilt mit dem Konto des Büros (Quelle Supabase ergänzt). Neuer Stand 2026-11-26 (der alte Text ist entfernt: niemand hatte ihn bestätigt, der Leitfaden ist noch ausgeschaltet). Der Link im Desktop jedes Projekts und die Überschrift in «Mitglieder» heißen jetzt auch so; der interne Schlüssel `desktop` bleibt.
- Archivos: `app/office-leitfaden.js` (`?v=office2`), `app/work.js` (`office59`), `app/index.html`, `index.html`; `supabase/migrations/20261126133400_office_leitfaden_ins_office.sql` (neu); Tests `tests/office-leitfaden.test.mjs` (Stand, Titel, kein «Desktop» im Text, die neue Migration), `tests/browser/office-leitfaden.chromium.mjs` (Stand, Titel) und die Versionen von `work.js` in sieben weiteren Tests; `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: migración `20261126133400_office_leitfaden_ins_office` aplicada (antes avisado): `office_leitfaeden.version` von `2026-11-25` auf `2026-11-26`; nada borrado, `aktiv` sigue `false`.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (495); Chromium `office-leitfaden` grün (6).
- Quedó pendiente o sin probar: Freischalten bleibt bei Gari, wenn die Büroleitung unterschrieben hat und das OpenAI-Konto auf das Büro läuft. Die Fassungen für die Büroleitung (Leitfaden mit Namen, «Freigabe und Vollmacht») liegen außerhalb des Repositorys.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #177

---

### 2026-11-26 · Controlling: drei offene Fragen, Sätze korrigieren statt neu anlegen, offene Seiten rechnen neu · Claude
- Qué cambió y por qué: Gari hat die Fragen unter «Zu klären» mit der Buchhaltung durchgesprochen (26.11.2026, vor dem Gespräch mit der Büroleitung). Gestrichen, weil geklärt: der Faktor gilt auf das Bruttogehalt allein; 21 % Arbeitgeberanteil vorerst für alle; die Jahresstunden sind hergeleitet; Wochenstunden und Urlaub stehen je Person bei den Sätzen; Sonderzahlungen (13. Gehalt, Urlaubsgeld, Boni, Jobticket) gibt es keine. Offen für die Büroleitung bleiben drei: was der Faktor deckt, woher er stammt, was der Kalkulationssatz deckt.
  - **Was die beiden gesehen haben:** Nach einer Änderung (Urlaubstage laut Vertrag) änderten sich die Sätze der Person, das Ergebnis im vertraulichen Teil des Projektblatts aber nicht. Grund: Der Dialog kannte nur «Neuer Eintrag» mit «gültig ab» heute; die Stunden bis zum letzten Stand (Stichtag davor) bewertet weiter der alte Eintrag. Dazu rechnete ein schon offener Reiter erst nach dem Neuladen.
  - **Sätze:** Wer schon Einträge hat, wählt beim Eintragen ausdrücklich «Korrektur des Eintrags ab …» (ändert ihn, die Stunden ab diesem Tag werden neu bewertet) oder «Neu ab einem Datum» (etwa eine Gehaltserhöhung; Stunden davor behalten den bisherigen Satz). Ohne Wahl wird nichts gespeichert. Vorbelegt mit dem Eintrag, der heute gilt; «Ändern» in der Liste wählt einen anderen und markiert ihn. Ein Datum, für das es schon einen Eintrag gibt, verweist auf «Korrektur». Die Liste passt in die Breite des Dialogs (Überschriften mit weichen Trennstrichen).
  - **Projektblatt:** Gilt ein neuerer Eintrag erst nach dem letzten Stand, nennt der vertrauliche Teil Person und Datum und rät, eine Angabe, die schon vorher galt, als Korrektur einzutragen (auch bei zugeklapptem «So gerechnet»).
  - **Offene Seiten:** Nach jeder Änderung meldet die Seite das über `BroadcastChannel('tba-office-controlling')`; Übersicht und Projektblatt (auch der Reiter in Work) laden dann neu, mit offenem Formular erst nach dem Schließen. «Sätze und Gehälter» selbst lädt so nicht neu, damit ein halb ausgefülltes Formular der Annahmen bleibt.
- Archivos: `controlling.js` (`?v=office7`), `controlling.css` (`office6`), `controlling-kern.js` (`office6`, nur ein Kommentar), `controlling.html`; Tests `tests/office-controlling.test.mjs` (Versionen), `tests/browser/office-controlling.chromium.mjs` (drei Fragen; neuer Test: Korrektur oder neu ab Datum, Hinweis im Blatt, ein zweiter Rahmen rechnet von selbst neu), `tests/browser/fixtures/fake-supabase-controlling.js` (jede Abfrage liest den Stand aus dem sessionStorage, damit zwei Rahmen im selben Tab dieselben Daten sehen); `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración (ändern in `office_controlling_saetze` erlaubt die Policy für vollen Zugang schon).
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (494); Chromium `office-controlling` grün (9). Bildschirmfotos des Dialogs und der zwei Rahmen angesehen.
- Quedó pendiente o sin probar: Einträge, die eine Korrektur hätten sein sollen, ändert Gari selbst unter «Sätze und Gehälter» (Korrektur am bisherigen Eintrag, den neuen entfernen). `BroadcastChannel` im Rahmen der iPhone-App ungetestet. Die Hochrechnung «am Ende» rechnet die bisherigen Kosten je Stunde weiter, auch wenn für die restlichen Stunden schon ein neuer Satz gilt.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #176

### 2026-11-26 · Mustermappe: Arbeitsfläche und TBA-Raster (Text auf der Seite, Kopf- und Fußzeile wie im Archicad-Master) · Claude
- Qué cambió y por qué: Gari (26.11.2026, 09:10, 10:01 und 11:59): zu viel verschenkter Platz, die Seiten in der Ansicht zu klein zum Bearbeiten; wird das Werkzeug gut, macht das Büro die Mappen nicht mehr in Archicad. Dazu ein Raster nach den Rastersystemen des Grafikdesigns statt des einfachen Rasters aus Archicad, damit Teile immer im selben Raster stehen. Recherche (Programa, Claude Design, Canva, Figma Slides, Beautiful.ai, Pitch; Raster in InDesign, Figma und Affinity; Müller-Brockmann, Gerstner, Samara), Vorschlag im Chat, Gari: «sí, me convence así … adelante con los cambios».
  - **Arbeitsfläche:** die Mappe nutzt die ganze Breite: links «Seiten», in der Mitte die Bühne, rechts «Eigenschaften» (zuerst «Nur im Büro sichtbar» und der Übersatz, dann Seite, Position, Angaben); beide Leisten lassen sich ausblenden. Am Rechner (ab 1181 px) füllt die Mappe die Höhe des Fensters, die Leisten rollen für sich. Zoom: «Einpassen» (Standard), «Seitenbreite», 25 bis 300 % der Originalgröße A3, − und +, Strg/⌘ + Mausrad am Zeiger (auch Zusammenziehen auf dem Trackpad); das Gerät merkt sich Zoom, Raster und Leisten.
  - **Text auf der Seite:** Titel, Frage, Name, «Hersteller · Serie», Beschreibung, Begründung, Deckblatt-Text sowie Titel und Text der freien Seite werden direkt auf der Seite geschrieben (`contenteditable="plaintext-only"`, dieselbe Schrift an derselben Stelle wie im PDF; Einfügen nur als Text). Kennwerte als Tabelle mit Feld und Wert je Zeile, «+ Kennwert», Enter springt zum Wert und zur nächsten Zeile. Geändertes ist innen blau umrandet. Was nicht in seinen Rahmen passt, ist rot markiert und rechts unter «Passt nicht ganz in den Rahmen» genannt (wie der Übersatz in InDesign); im PDF endet der Rahmen an der letzten ganzen Zeile. Das ersetzt die gestrichelten Felder auf der Bühne (#174) und den Umschalter «Lesegröße».
  - **TBA-Raster A3 quer:** Ränder 20 / 24 / 21 mm, Satzspiegel 380 × 252 mm, 12 × 8 quadratische Felder von 28 mm, Abstand 4 mm = Grundlinie, großes Raster 6 × 4. Rahmen aus 6 × 4 Feldern sind 3:2, aus 4 × 3 4:3, aus 7 × 5 fast A-Format (220 × 156 mm, 0,4 mm daneben). Schrift Arial: 9 pt auf 4 mm, klein 7,5 pt, Titel 20 pt auf 8 mm, mittel 14 pt, Deckblatt 40 pt auf 16 mm; jede Zeile ein Vielfaches von 4 mm. Das Blatt rechnet in seinen Millimetern (`--mm` aus der Breite, Container-Einheiten): Bühne, Präsentieren, Stand und PDF sehen gleich aus. «Raster» blendet Felder, großes Raster und Grundlinien ein (nur beim Bearbeiten).
  - **Vorlagen auf dem Raster:** Deckblatt (Titelbild 12 × 5, optional; Titel 8 × 2; Text 4 × 3), Übersicht (Tabelle 12 × 7, Spalten auf den Feldern), Vergleich (je Variante 6 oder 4 Felder breit, eine Variante 8 + 4; die Zonen über der Spalte der letzten Variante; unten Empfehlung, Kosten, Zu beachten), Material (Foto 6 × 8; rechts Kopf, kleine Fotos 3 × 2, Beschreibung, Kennwerte, Kosten, Zu beachten), freie Seite (Bild 10 × 8, Titel und Text 2 × 8).
  - **Kopf- und Fußzeile wie im Archicad-Master:** oben «Projekt | Phase | Untertitel», das Datum des Stands und «Titus Bernhard **Architekten** BDA» auf der Grundlinie 16 mm; unten «Seite/Seiten» und der Name der Seite auf 284 mm. Projekt, Phase und Untertitel stehen rechts unter Angaben › Kopfzeile (`kopf_projekt`, `kopf_phase`, `kopf_untertitel`; leer: Projektnummer und Name, keine Phase, Titel der Mappe). Ein Stand von vor dem Raster bekommt die Kopfzeile aus Projekt und Titel.
  - **Titelbild des Deckblatts** (optional, etwa ein Rendering), hochgeladen wie das Bild der freien Seite (Bild oder PDF-Seite, Speicher der Mappe).
  - Die Überschriften und Absätze der App (`.pd h2`, `.pd h3`, `.pd-druck p`) gelten nicht mehr auf dem Blatt (sonst Titel mit 19 px statt 20 pt und 6 pt Abstand unter jedem Absatz im Druck).
- Archivos: `mustermappe-kern.js` (`?v=office4`), `projektdokumente.js` (`office9`), `projektdokumente.css` (`office10`), `projektdokumente.html`; Tests `tests/office-mustermappe.test.mjs` (TBA-Raster, Rahmen je Vorlage, Kopf- und Fußzeile, Titelbild, Arbeitsfläche), `tests/browser/office-mustermappe.chromium.mjs` (Texte und Kennwerte auf der Seite, «+ Kennwert», Schrift in Millimetern auf der Bühne und im Druck, Absätze ohne Abstand); `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración (Kopfzeile und Titelbild in `daten` der Mappe).
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (494); Chromium `office-mustermappe` (7), `office-projektdokumente` (8), `office-projektdokumente-zahlen` (1) und `office-planner-karten` (7) grün. Bildschirmfotos angesehen: 2560 × 1400 (Einpassen 97 %; alle Vorlagen, Raster, ohne Leisten, 100 %), 1440 × 1000 (47 %), iPhone, Präsentieren; das PDF A3 quer (Titel 20 pt, Deckblatt 40 pt, alles auf der Grundlinie).
- Quedó pendiente o sin probar: Etapa 2 (Rahmen auf dem Raster verschieben und in der Größe ändern, Ausschnitt per Doppelklick, Bilder aus der Bibliothek auf die Seite ziehen, Rückgängig), Etapa 3 (Master und Erscheinungsbild des Büros), Etapa 4 (Pläne mit Markierungen). Die Versalhöhe an der Oberkante des Rahmens (`text-box`) setzen Chrome und Safari; Firefox setzt den Titel etwa 1 mm tiefer. Am Laptop mit beiden Leisten erscheint die Seite mit etwa 47 %; zum Schreiben die Leisten ausblenden oder zoomen.
- Riesgos o decisiones que necesitan a Gari: Ältere Stände erscheinen im neuen Raster (die Inhalte bleiben, die Anordnung ist neu). Die Kopfzeile je Mappe ausfüllen (Adresse und Phase wie im Archicad-Master); sie steht nur in der Datenbank, nicht im Repository.
- PR: #175

### 2026-11-26 · Mustermappe: Seiten nach dem Erzeugen anpassen (Texte für diese Mappe, Bild ändern, Ausschnitt) · Claude
- Qué cambió y por qué: Gari (25.11.2026, 23:53 und 23:57): Die Seiten entstehen aus der Produktbibliothek; danach will er sie anpassen, Texte ändern und Bilder austauschen, ohne freies Verschieben (das Raster der Seitenvorlagen bleibt fest).
  - **Texte für diese Mappe:** Name, «Hersteller · Serie» und Kennwerte einer Variante stehen auf der Bühne jetzt als gestrichelte Felder (bisher fest), die Beschreibung wie bisher. Was man ändert, gilt nur für diese Mappe und steht in der Variante (`muster_name`, `muster_herkunft`, `muster_merkmale`, `muster_text`); die Produktbibliothek und der übernommene Auszug (`muster_produkt`) bleiben, wie sie sind. Ein geändertes Feld ist durchgezogen umrandet (`--m-information`, Titel «In dieser Mappe geändert»); unter der Seite steht «A: in dieser Mappe geändert. Die Produktbibliothek bleibt, wie sie ist.» mit «… zurücksetzen» je Text, den die Seite zeigt (der Vergleich zeigt keine Beschreibung). Gleich wie in der Bibliothek heißt nicht geändert; ein leerer Name auch; «Hersteller · Serie» darf leer sein (dann fehlt die Zeile im PDF). Kennwerte als Text, je Zeile «Feld: Wert»; die Seite zeigt wie bisher die ersten 5 (Vergleich) bzw. 10 (Material), das Feld sagt es, wenn es mehr sind. «Übernehmen» eines neuen Stands der Bibliothek lässt Geändertes stehen. Im PDF und im Präsentieren steht der Text ohne Felder.
  - **Bild ändern:** auf jedem Foto einer Variante (Vergleich: das Foto; Material: das große und die kleinen) beim Darüberfahren «Bild ändern», auf dem großen Foto «+ Bild», solange die Variante weniger als drei hat, auf einem leeren Platz «Bild wählen»; ohne Maus (Telefon, Tablet) stehen die Knöpfe immer da. Rechts unter «Fotos A» zusätzlich «Eigenes Bild oder Ausschnitt …». Der Dialog: links «Ausschnitt, wie im PDF» (ziehen, Pfeiltasten, + und −, Regler «Vergrößern» bis dreifach, «Ausschnitt zurücksetzen», «Als großes Bild», «Bild entfernen»), rechts die anderen Fotos aus der Produktbibliothek und «Eigenes Bild hochladen» (JPG, PNG, WebP bis 15 MB oder eine Seite aus einem PDF). Ein eigenes Bild liegt im Speicher der Mappe (`office-projektdokumente`, Pfad Dokument/Person/Datei wie bei der freien Seite), nie in der Bibliothek; es landet an seiner Stelle, auch wenn der Dialog beim Hochladen schon zu ist.
  - **Ausschnitt** je Foto `ausschnitt {x, y, z}` (Punkt in Prozent, der stehen bleibt, und Vergrößerung 1 bis 3): `object-position` und `transform: scale()` in einem Rahmen fester Größe, gleich auf der Bühne, im Präsentieren und im PDF. Die Vorschau im Dialog hat das Seitenverhältnis des Rahmens im PDF: die Seite wird dazu einmal unsichtbar wie im Druck gesetzt und gemessen (auf der Bühne sind die Felder etwas höher als der gedruckte Text, die Fotos dort flacher). Der Ausschnitt gehört zum Bild und gilt auf allen Seiten der Mappe; ein anderes Bild beginnt ohne.
  - Ohne gewähltes Foto zeigt eine Variante wie bisher das erste der Bibliothek; das lässt sich ersetzen, nicht entfernen (der Dialog sagt es). Wird das letzte gewählte Bild entfernt, steht wieder das erste der Bibliothek da, und die Meldung sagt es.
- Archivos: `mustermappe-kern.js` (`?v=office3`), `projektdokumente.js` (`office8`), `projektdokumente.css` (`office9`), `projektdokumente.html`; Tests: `tests/office-mustermappe.test.mjs` (Texte anpassen und zurücksetzen, Darstellung in Druck und Bühne, Fotos und Ausschnitt, was eine Seite zum Zurücksetzen zeigt, Seite), `tests/browser/office-mustermappe.chromium.mjs` (neuer Durchlauf «Bearbeiten nach dem Erzeugen»; Name und Kennwerte in den bestehenden Durchläufen jetzt als Felder geprüft); `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración (alles in `daten` der Zeilen; eigene Bilder im vorhandenen Bucket mit der Policy von `20261124223855`).
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (490); Chromium `office-mustermappe` (7, darunter der neue Durchlauf: Name und Kennwerte ändern, PDF ohne Felder, zurücksetzen, eigenes Bild hochladen in den Speicher der Mappe, Vorschau im Seitenverhältnis des PDF, vergrößern und ziehen, Foto der Bibliothek, «+ Bild», entfernen bis zum Foto der Bibliothek, Bibliothek unverändert), `office-projektdokumente` (8), `office-projektdokumente-zahlen` und `office-planner-karten` grün. Bildschirmfotos angesehen (Vergleich mit geändertem Namen und Kennwerten, Dialog mit Ausschnitt am Rechner und am Telefon, Materialseite, Präsentieren) und das PDF mit Ausschnitt.
- Quedó pendiente o sin probar: eine PDF-Seite als eigenes Bild einer Variante läuft über denselben Weg wie bei der freien Seite (pdf.js; lokal ohne pdf.js, in der CI mit); Ziehen mit dem Finger auf einem echten iPhone. Die Entscheidungsliste zeigt weiter den Namen aus der Bibliothek (die Anpassung gilt nur für die Mappe).
- Riesgos o decisiones que necesitan a Gari: Der Ausschnitt gilt je Bild auf allen Seiten (Vergleich und Material haben verschieden geformte Rahmen; der gewählte Punkt bleibt in beiden stehen). Ersetzte oder entfernte eigene Bilder bleiben im Speicher der Mappe, wie bei der freien Seite; ein vorgelegter Stand zeigt sie weiter.
- PR: #174

### 2026-11-25 · Leitfaden «Was darf auf den Desktop?» mit «Gelesen» · Claude
- Qué cambió y por qué: Gari (25.11.2026, 23:20): Wer ins Office kommt, bekommt den Leitfaden beim ersten Öffnen und bestätigt mit «Gelesen»; so steht fest, dass alle im Büro die Regeln kennen, ohne eigene Einweisung (das Büro ist klein, Gari bespricht ihn mit allen, die er aufnimmt).
  - **Beim ersten Öffnen** (`app/office-leitfaden.js`): nach der Mitgliedsprüfung (`office:member`) liest das Office `office_leitfaeden`; ist der Leitfaden freigeschaltet und sein Stand noch nicht bestätigt, öffnet er sich als Dialog. «Weiter» erst nach «Gelesen», Escape schließt ihn nicht; gespeichert werden nur Person, Leitfaden und Stand, die Zeit setzt die Datenbank; schon bestätigt (23505) gilt; bei einem Fehler erscheint «Später». Am Telefon über die ganze Fläche, die Tabellen als Karten.
  - **Text** je Stand im Modul (Stand 25.11.2026 = die Fassung, die die Büroleitung bekommt): Kurz gesagt, Grün, Gelb, Rot, Gut zu wissen, Im Zweifel, Quellen. Ohne Namen, weil das Repository öffentlich ist («Die Konten bei OpenAI und Supabase laufen auf das Büro»; die Fassung für die Büroleitung nennt die Person). Unbekannter Stand oder fehlende Tabelle: nichts erscheint, nichts sperrt.
  - **Im Desktop** jedes Projekts der Link «Was darf auf den Desktop?» (nur wenn freigeschaltet), zum Nachlesen mit «Schließen» und «Gelesen am …».
  - **Mitglieder** (nur Admins): Abschnitt «Leitfaden «Was darf auf den Desktop?»» mit Stand und «Freischalten» / «Ausschalten»; bei jedem aktiven Zugang «Leitfaden gelesen am …» oder «Leitfaden noch nicht bestätigt».
  - Er beginnt **ausgeschaltet**: Gari schaltet ihn frei, wenn die Büroleitung zugestimmt hat und die Konten auf das Büro laufen (vorher stimmte der Satz über die Konten noch nicht).
- Archivos: `app/office-leitfaden.js` (neu, `?v=office1`), `app/office.css` (`office46`), `app/work.js` (`office58`), `app/index.html`; `index.html`, `app.js` (`?v=7`), `style.css` (`office27`); Migration `supabase/migrations/20261125223754_office_leitfaden.sql`; Tests: `tests/office-leitfaden.test.mjs` (neu), `tests/sql/office-leitfaden-acceptance.sql` (neu, in `verify.yml`), `tests/browser/office-leitfaden.chromium.mjs` (neu, in `verify-romy-browser.yml`), `tests/browser/fixtures/fake-supabase.js` (zusätzliche Tabellen über `window.__fakeRows`), Versionen in zehn Tests; `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: migración `office_leitfaden` (zwei neue Tabellen `office_leitfaeden` und `office_leitfaden_bestaetigungen` mit RLS; Spaltenrechte: Admins ändern nur `aktiv`, eine Bestätigung trägt nur Person, Leitfaden und Stand; Triggerfunktion `private.office_leitfaeden_geaendert` setzt Zeit und Person; eine Zeile «desktop», Stand 2026-11-25, ausgeschaltet; nichts Destruktives) — aplicada en Supabase: sí, 25.11.2026 über den Supabase-Connector (`apply_migration`, Version `20261125223754`, nach Ankündigung an Gari). In Produktion geprüft: RLS an, vier Policies, Schreibrechte nur `UPDATE(aktiv)` und `INSERT(user_id, leitfaden, version)`; Rechte in einer zurückgerollten Transaktion mit dem Admin-Konto (lesen ja; bestätigen vor dem Freischalten nein; freischalten ja, die Person setzt die Datenbank; bestätigen ja, ein zweites Mal nein; Stand ändern nein; löschen nein; anon nein); danach unverändert ausgeschaltet und ohne Bestätigung. Security-Advisor: keine neuen Befunde.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (486); Chromium `office-leitfaden` (6), `office-app-boot`, `office-planner-board` und `office-planner-karten` grün; Bildschirmfotos angesehen (Dialog am Rechner und am Telefon, Desktop mit Link, Mitglieder ein- und ausgeschaltet).
- Quedó pendiente o sin probar: Freischalten in «Mitglieder», sobald die Büroleitung zugestimmt hat und das OpenAI-Konto auf das Büro läuft; der erste echte Durchlauf mit einer Kollegin oder einem Kollegen. Die Abnahme im isolierten Supabase (`office-leitfaden-acceptance.sql`) läuft in der CI.
- Riesgos o decisiones que necesitan a Gari: Ein geänderter Text braucht einen neuen Stand (Migration und Text im Modul); dann bestätigen alle noch einmal.
- PR: #173

### 2026-11-25 · Controlling: Urlaub je Person, Übersicht nach Projektnummer; Desktop des Projektteams · Claude
- Qué cambió y por qué: Rückmeldung von Gari (25.11.2026, 16:40).
  - **Urlaub je Person** (Gari: nicht alle im Büro haben gleich viele Urlaubstage): an den Sätzen zwei neue Angaben, «Urlaubstage im Jahr laut Vertrag» und «Arbeitstage je Woche» (leer: wie das Büro, anteilig, und 5 Tage). Jahresstunden der Person = Jahresstunden × Wochenstunden ÷ Vollzeit-Wochenstunden + (Urlaubstage des Büros × Wochenstunden ÷ 5 − eigene Urlaubstage × Wochenstunden ÷ Arbeitstage je Woche) × Projektanteil. Das wirkt erst, wenn unter «Annahmen» die Urlaubstage des Büros (Vollzeit) stehen; bis dahin rechnet alles wie bisher, und ein Hinweis unter der Tabelle sagt es. Gleiche Rechnung im Kern (`jahresstundenPerson`, `gehaltSatz`, `selbstkostenSatz`, `bewertung`) und in `office_controlling_summen`. Sätze-Tabelle mit den Spalten «Urlaub (Tage im Jahr)» und «Jahresstunden (der Person)»; der Dialog «Sätze» nimmt beide Angaben auf (Urlaub 0–60, Arbeitstage über 0 bis 6), übernimmt sie aus dem letzten Satz und zeigt die Jahresstunden der Person vorab. In der Herleitung heißt das Feld jetzt «Urlaubstage des Büros (Vollzeit)».
  - **Übersicht nach Projektnummer** (Gari): aufsteigend und natürlich sortiert (T-9 vor T-10), im selben Projekt nach Bezeichnung (LPH 3 vor LPH 4), dann nach Anlage; Pakete ohne Nummer am Ende. Gilt auch für die Übersicht als PDF.
  - **Desktop des Projektteams** (Gari: es wirkt, als hätte jede Person ihren eigenen Desktop): geprüft, der Desktop ist schon gemeinsam. Dateien und Ordner hängen am Projekt, lesen dürfen alle im Projektteam (RLS auf `minds_work_files` und `minds_work_folders`, Speicher `minds-work`), das sichert der Abnahmetest «project teammate must read P files regardless of uploader»; in Produktion liegt noch keine Datei. Neu: über den Kacheln «Gemeinsamer Desktop des Projektteams: …» mit den Namen des Teams, auf jeder Datei eine Zeile «von …» (wenn das Team mehr als eine Person hat). Wirklich je Person war nur das Löschen: der Speicher lässt nur die Person löschen, die hochgeladen hat (erstes Pfadstück); löschte jemand anderes, verschwand der Eintrag, die Datei blieb im Speicher liegen. Jetzt bietet der Desktop «Löschen» nur für eigene Dateien an (Ordner weiter für alle), die Duplikat-Prüfung löscht nur eigene Kopien; umbenennen und verschieben weiter alle im Team. Rot ist nur noch «Löschen» (vorher der jeweils letzte Knopf, ohne «Löschen» also «Verschieben»).
- Archivos: `controlling-kern.js` (`?v=office5`), `controlling.js` (`office6`), `controlling.html`; `app/work.js` (`office57`), `app/office-desktop-ops.js` (`office39`), `app/office.css` (`office45`), `app/index.html`; Migration `supabase/migrations/20261125160013_office_controlling_urlaub.sql`; Tests: `tests/office-controlling.test.mjs` (Reihenfolge, Urlaub je Person, Migration), `tests/office-desktop.test.mjs` (Team, «von …», Löschen), Versionsprüfungen in acht Tests, `tests/sql/office-controlling-acceptance.sql` (Urlaub je Person in `office_controlling_summen`), `tests/browser/office-controlling.chromium.mjs` und `fixtures/fake-supabase-controlling.js`; `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: migración `office_controlling_urlaub` (zwei leere Spalten `urlaubstage` und `arbeitstage_woche` an `office_controlling_saetze`, begrenzt, ohne Standard; `office_controlling_summen` mit gleicher Signatur neu; nichts entfernt) — aplicada en Supabase: sí, 25.11.2026 über den Supabase-Connector (`apply_migration`, Version `20261125160013`, nach Ankündigung an Gari); in Produktion geprüft: zwei Spalten, leer, ohne Standard; `office_controlling_summen` mit der Korrektur, Rechte unverändert (authenticated).
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (478); Chromium `office-controlling`, `office-app-boot`, `office-planner-board`, `office-planner-karten`, `office-terminplan-reiter` grün (24); Desktop mit zwei Personen gerendert und angesehen (Team-Zeile, «von …» auf eigener Zeile, «Löschen» nur an der eigenen Datei, keine Fehler).
- Quedó pendiente o sin probar: Urlaubstage des Büros unter «Annahmen» und je Person an den Sätzen eintragen (Büroleitung, Buchhaltung). Desktop mit echten Personen und Dateien nicht geprüft (noch keine Datei in Produktion).
- Riesgos o decisiones que necesitan a Gari: Sollen alle im Team auch Dateien anderer löschen dürfen? Das bräuchte eine geänderte Speicher-Policy und damit Garis ausdrückliches OK; bis dahin bleibt es beim Löschen der eigenen Dateien.
- PR: #172

### 2026-11-25 · Controlling: «So gerechnet» auf Knopfdruck, Stunden grün/orange/rot, Jahresstunden aus dem Kalender, PDF · Claude
- Qué cambió y por qué: Rückmeldung von Gari (25.11.2026, 15:53) in vier Punkten.
  - **«So gerechnet» auf Knopfdruck** (Gari: braucht so zu viel Platz): im vertraulichen Teil eine Taste «So gerechnet» (blau, `aria-expanded`); zu ist die Tabelle schmal (nur bis jetzt und am Ende), offen kommt die Rechnung je Wert dazu und ein Satz, dass alles beim Öffnen der Seite aus den aktuellen Stunden, Sätzen und Annahmen gerechnet wird und nach jeder Änderung neu (gespeichert wird nur, was eingetragen ist). Der Zustand bleibt beim Neuzeichnen.
  - **Stunden grün, orange, rot** (Gari: das Braun gegen Orange, grün, wenn es gut läuft): drei neue Füllfarben in `shared/minds-design-tokens.css` (`--m-success-fill`, `--m-attention-fill`, `--m-error-fill`), nur für Balken; auf Weiß und auf der Spur mindestens 3:1 und für Farbenschwache unterscheidbar (mit dem Palettenprüfer des Dataviz-Skills gerechnet; Orange und das bisherige Rot lagen zu nah beieinander, daher ein kühleres Rot). Im Projektblatt und auf den Karten folgen die Stunden der Lage; Leistung und Bezahltes bleiben grau; das Zeichen in der Lage trägt dieselbe Farbe, die Schrift bleibt in den Statusfarben. Token-Datei überall auf `?v=3`.
  - **Jahresstunden aus dem Kalender** (Gari: zählen die 1.600 h die Feiertage 2026? braucht es den Urlaub je Person?): die 1.600 h sind eine Annahme und zählten nichts. Unter «Annahmen» jetzt «Jahresstunden aus dem Kalender herleiten»: Werktage des Jahres minus die Feiertage am Sitz des Büros (Augsburg: 14 gesetzliche, mit Mariä Himmelfahrt und dem Friedensfest; 2026 fallen 9 auf Werktage, 2025 waren es 13, 2027 sind es 8) minus Urlaub, Krankheit und weitere Tage, mal Wochenstunden ÷ 5, mal Projektanteil; «In Jahresstunden übernehmen» setzt das Ergebnis, «Speichern» hält die Angaben fest. Urlaub je Person nicht: in Teilzeit ist er anteilig, und das decken die Wochenstunden schon ab; nur wer mehr oder weniger Urlaub hat als anteilig, bräuchte einen eigenen Wert. Ostern, Feiertage, Werktage und die Herleitung rechnet der Kern (`ostern`, `feiertage`, `werktage`, `jahresstundenAusKalender`). Die Fragen «Zu klären» zu Jahresstunden und Wochenstunden nennen das jetzt.
  - **PDF** (Gari: die Zahlungen als PDF, und was sonst?): wie in Projektdokumente und Kostenberechnung über den Druckdialog («Als PDF sichern»), der Titel wird zum Dateinamen. Drei Ausgaben: **Zahlungsübersicht** (Reiter Zahlungen, «Als PDF»: Tabelle wie auf der Rechnung mit Summe, dazu Honorar, erarbeitet, bezahlt, gestellt und erarbeitet, nicht bezahlt), **Controlling-Bericht** je Paket (wählbar: Lage und Kennzahlen, Stände, Zahlungen und – nur mit vollem Zugang und nur auf Wunsch – «Zum Gehalt und Gewinn», dann als vertraulich markiert) und **Übersicht** aller Pakete quer (mit vollem Zugang auf Wunsch mit dem Gewinn).
- Archivos: `controlling.js` (`?v=office5`), `controlling-kern.js` (`office4`), `controlling.css` (`office5`), `controlling.html`, `shared/minds-design-tokens.css` (drei Füllfarben) und `?v=3` in allen Seiten, die sie laden; Migration `supabase/migrations/20261125150907_office_controlling_jahresstunden.sql`; Tests: `tests/office-controlling.test.mjs` (vier neue), `tests/office-herstellerkatalog.test.mjs` (Token-Version), `tests/sql/office-controlling-acceptance.sql` (Angaben der Herleitung, Grenze), `tests/browser/office-controlling.chromium.mjs` (Farben, Knopf, PDF, Herleitung) und `fixtures/fake-supabase-controlling.js`; `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: migración `office_controlling_jahresstunden` (vier leere Spalten in `office_controlling_einstellungen`, begrenzt, ohne Standard; nichts entfernt) — aplicada en Supabase: sí, 25.11.2026 über den Supabase-Connector (`apply_migration`, Version `20261125150907`, nach Ankündigung an Gari); in Produktion geprüft: vier Spalten, leer, ohne Standard.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (475); Chromium `office-controlling` grün (8); Bildschirmfotos (Lage grün, Tabelle zu, Herleitung) und die drei Druckfassungen als PDF gerendert und angesehen.
- Quedó pendiente o sin probar: Urlaub, Krankheit, weitere Tage und Projektanteil mit der Büroleitung festlegen; ob der Druckdialog in der Window-App am iPhone aufgeht, ist nicht geprüft (im Browser ja).
- Riesgos o decisiones que necesitan a Gari: drei neue Füllfarben im gemeinsamen Gestaltungssystem (nur für Balken); kein Urlaub je Person.
- PR: #171

### 2026-11-25 · Controlling: Lage auf einen Blick, Wochenstunden, Selbstkosten und Gewinn, Annahmen mit «Zu klären» · Claude
- Qué cambió y por qué: Rückmeldung von Gari (25.11.2026, 14:58) in sechs Punkten.
  - **Lage auf einen Blick** (Gari: das Projektblatt öffnen und sofort sehen, wie das Projekt läuft): oben im Projektblatt eine Stufe aus der Hochrechnung gegenüber der Kalkulation, gemessen am Honorar – im Budget (am Ende nicht im Minus), leicht über Budget (bis 10 % des Honorars im Minus), deutlich über Budget, noch offen (ohne Leistungsstand) –, immer mit Zeichen und Wort, nie nur als Farbe; ein Satz dazu; Leistung, Stunden (vom Budget) und Bezahltes (vom Honorar) als Balken auf derselben Skala, der Leistungsstand als Strich; Kacheln: Ergebnis am Ende, Stunden für den Rest (mit dem, was im bisherigen Takt nötig ist), Erarbeitet, nicht bezahlt, und – vertraulich – Gewinn am Ende. Auf den Karten der Übersicht dieselbe Stufe als erster Chip, der Stundenbalken rot, wenn sie deutlich über Budget ist. Die zwei Balken im Projektblatt ersetzt die Lage.
  - **Neben jedem vertraulichen Wert, wie er gerechnet ist** (Gari): «Zum Gehalt» ist eine Tabelle mit «bis jetzt», «am Ende» und «So gerechnet» (je Person Stunden × Satz; Erarbeitet − Kosten; am Ende ÷ Leistungsstand), darunter die Annahmen und ob sie bestätigt sind.
  - **Wochenstunden je Person** (Gari: sonst stimmt der Stundensatz aus dem Gehalt für Teilzeit nicht): Spalte `wochenstunden` an den Sätzen (leer = Vollzeit). Jahresstunden der Person = Jahresstunden × Wochenstunden ÷ Vollzeit-Wochenstunden (neu, Standard 40); `office_controlling_summen` rechnet ebenso. Bisher war der Satz bei 20 von 40 h nur halb so hoch, wie er ist.
  - **Gemeinkostenfaktor auf das Bruttogehalt allein** (Gari): Selbstkosten je Stunde = Bruttogehalt × 12 × Faktor ÷ Jahresstunden der Person; daraus je Paket Selbstkosten und **Gewinn nach Bürokosten**, bis jetzt und hochgerechnet. Der Faktor steht nur in der Datenbank (`gemeinkostenfaktor`, ohne Standardwert), nicht im Repo; ein Test prüft das mit einer Prüfsumme.
  - **Annahmen mit Erklärung und «Zu klären»** unter «Sätze und Gehälter»: was die beiden Sätze rechnen (mit einem Beispiel, das den Eingaben folgt), je Annahme eine Erklärung, «Bestätigt am» und eine Notiz; dazu acht Fragen für das Gespräch mit der Büroleitung – Basis und Inhalt des Faktors, Herkunft und Jahr, Arbeitgeberanteil je Person (Werkstudenten und Übergangsbereich weichen ab), Jahresstunden, Wochenstunden und Überstunden, Sonderzahlungen, was der Kalkulationssatz deckt –, je mit «Warum» und «Jetzt angenommen». Bis «Bestätigt am» gesetzt ist, heißt der Gewinn «Annahmen vorläufig». Sätze-Tabelle mit Wochenstunden und Selbstkostensatz; der Dialog «Sätze» nimmt die Wochenstunden auf.
  - **Gleiche Begriffe** in Übersicht und Projektblatt: «Ergebnis am Ende netto» (statt «Prognose netto» und «Ergebnis netto» in der Prognose), «Erarbeitet, nicht bezahlt netto» (statt «Offen netto»), «Stunden am Ende».
  - **Nebenknöpfe blau** (Gari: «Paket bearbeiten» sollte blau sein): im Controlling alle Knöpfe außer den gedämpften mit blauer Schrift und blauem Rand, wie in den Projektdokumenten.
  - Mit vollem Zugang bewertet die Seite die Stunden je Person selbst (`bewertung()` im Kern, wie die Datenbank: Fortschreibung, Zuwachs zum Satz am Stichtag, nur vollständig), daher Personalkosten, Selbstkosten und die Erklärung je Person aus einer Rechnung.
  - Nachtrag zu #169: der Eintrag nannte den Gemeinkostenfaktor des Büros; jetzt nicht mehr (in der Git-Geschichte steht er noch).
- Archivos: `controlling.js` (`?v=office4`), `controlling-kern.js` (`office3`: `annahmen`, `jahresstundenPerson`, `selbstkostenSatz`, `deckungBisGehalt`, `gehaltAm`, `bewertung`, `lage`), `controlling.css` (`office4`), `controlling.html`; Migration `supabase/migrations/20261125142547_office_controlling_annahmen.sql`; Tests: `tests/office-controlling.test.mjs` (fünf neue, Prüfsumme gegen den Faktor), `tests/sql/office-controlling-acceptance.sql` (Teilzeit, Faktor, Grenzen), `tests/browser/office-controlling.chromium.mjs` und `fixtures/fake-supabase-controlling.js` (Teilzeit, erfundener Faktor); `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: migración `office_controlling_annahmen` (neue Spalten, `office_controlling_summen` mit neuem Körper bei gleicher Signatur; nichts entfernt) — aplicada en Supabase: sí, 25.11.2026 über den Supabase-Connector (`apply_migration`, Version `20261125142547`, nach Ankündigung an Gari). Danach als Daten (angekündigt): die Wochenstunden der drei Einträge mit Gehalt und der Gemeinkostenfaktor des Büros, beide nach Garis Angabe, mit einer Notiz, dass sie noch zu klären sind. In Produktion geprüft: `office_controlling_summen` rechnet die Personalkosten mit den Wochenstunden und stimmt mit der Rechnung je Person überein; «Bestätigt am» bleibt leer.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (471); Chromium `office-controlling` grün (7); Bildschirmfotos von Projektblatt (Rechner und Telefon), Übersicht, abgeschlossenem Paket und «Sätze und Gehälter» angesehen.
- Quedó pendiente o sin probar: die Annahmen mit der Büroleitung klären und «Bestätigt am» setzen; den Chef auf die Liste setzen, sobald er im Office ist; Arbeitgeberkosten je Person, falls die Lohnabrechnung sie hergibt.
- Riesgos o decisiones que necesitan a Gari: die Schwellen der Lage (0 % und −10 % des Honorars) sind ein Vorschlag; die Lage misst gegen die Kalkulation, der Gewinn gegen die Selbstkosten – beide können auseinanderlaufen (etwa: über Budget und trotzdem Gewinn).
- PR: #170

### 2026-11-25 · Controlling: Gehälter nur für die Liste, Zahlungen wie die Rechnung, netto überall, «So wird gerechnet» · Claude
- Qué cambió y por qué: Rückmeldung von Gari nach der ersten Arbeit mit der Buchhaltung (25.11.2026, 13:19).
  - **Sätze und Gehälter nur für die Liste:** Gari: sehen sollen sie nur er und die Buchhaltung, später der Chef. Bisher hatte jeder Admin vollen Zugang (und wer später Admin würde, sähe die Gehälter von selbst). Jetzt zählt nur `office_controlling_zugang`: die heutigen Admins kamen beim Einspielen auf die Liste, `private.office_controlling_voll()` prüft nur noch sie, und **einschränkende** Policies (AND) halten Sätze mit Gehältern, Stunden je Person und die Annahmen auch vor Admins ohne Eintrag zurück. Die Liste ändern nur Admins, die selbst darauf stehen; sich selbst setzt niemand darauf, und in der Seite entfernt sich niemand selbst. Den Chef nimmt Gari (oder Claude auf Garis Wort) auf, sobald er im Office ist.
  - **Zahlung wie die Rechnung des Büros:** Abschlag (AZ, Honorar netto) zzgl. Nebenkosten = Netto, zzgl. 19 % MwSt = Brutto, untereinander wie auf der Rechnung. Eingetragen wird, was zur Hand ist – Abschlag, Netto oder Brutto –, der Rest rechnet sich mit; die MwSt folgt jeder Änderung (vorher musste Gari sie von Hand setzen) und lässt sich danach noch ändern. `rechnung()` in `controlling-kern.js` rundet jeden Schritt auf den Cent und trifft die Rechnung des Büros genau; vom Netto zurück zum Abschlag stimmt der Cent (geprüft über 8.000 Beträge).
  - **Tabelle der Zahlungen** in der Reihenfolge der Rechnung: Abschlag (AZ) · zzgl. 5 % Nebenkosten · Netto inkl. Nebenkosten · MwSt · Brutto. Gari schrieb «Anzahl» für die erste Spalte; auf der Rechnung steht «AZ» (Abschlagszahlung, wie im Vertrag), daher «Abschlag (AZ)».
  - **Netto bei jedem Betrag** (Gari: viele Werte sagten nicht, ob netto oder brutto): jede Kennzahl, die Balken und die Spalten nennen «netto»; ein Satz über den Kennzahlen sagt, dass alles netto ist und das Honorar ohne Nebenkosten; «zum Gehalt» heißt jetzt «Personalkosten».
  - **«So wird gerechnet»** (Gari und die Buchhaltung suchten, woher die Zahlen kommen): Knopf im Projektblatt und in der Übersicht; der Dialog nennt je Wert die Herkunft und rechnet ihn mit den Zahlen des Pakets vor (etwa Honorar × Leistungsstand = Erarbeitet).
  - Kennzahl «bezahlt»: je Zahlung ihr Abschlag, dann die Summe, damit sie auf den Cent mit der Tabelle übereinstimmt.
  - Nachtrag zu #167: der Test gegen Namen in den Dateien des Controllings nannte die Namen selbst; jetzt prüft er gegen Prüfsummen (sha256), die Namen stehen nicht mehr im Repo.
- Archivos: `controlling.js` (`?v=office3`), `controlling-kern.js` (`office2`), `controlling.css` (`office3`), `controlling.html`; Migration `supabase/migrations/20261125123652_office_controlling_nur_liste.sql`; Tests: `tests/office-controlling.test.mjs` (drei neue), `tests/sql/office-controlling-acceptance.sql` (Admin ohne Eintrag), `tests/browser/office-controlling.chromium.mjs` (Rechnung, Rechenweg, Admin ohne Eintrag) und `fixtures/fake-supabase-controlling.js`; `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: migración `office_controlling_nur_liste` (Zeilen nur in `office_controlling_zugang`, `office_controlling_voll()` mit neuem Körper, nur neue, einschränkende Policies; keine entfernt) — aplicada en Supabase: sí, 25.11.2026 über den Supabase-Connector (`apply_migration`, Version `20261125123652`, nach Ankündigung an Gari). In Produktion geprüft: voller Zugang nur für die beiden Konten auf der Liste (Gari, Buchhaltung), die übrigen Mitglieder ohne. Dazu in der Notiz des laufenden Pakets LPH 3 der überholte Satz zum vorläufigen Betrag gestrichen (der Betrag steht inzwischen im Paket).
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (466); Chromium `office-controlling` grün (7); Bildschirmfotos von Projektblatt, Rechenweg, Zahlungsdialog (Rechner und Telefon) und Tabelle angesehen.
- Quedó pendiente o sin probar: den Chef auf die Liste setzen, sobald er im Office ist; der Gemeinkostenfaktor des Büros als dritte Annahme, falls Gari ihn will.
- Riesgos o decisiones que necesitan a Gari: «Abschlag (AZ)» statt «Anzahl».
- PR: #169

### 2026-11-25 · Controlling: ganze Karte, voller Zugang für die Buchhaltung; Work: Abschnitte je Projekt mit «+» · Claude
- Qué cambió y por qué: Rückmeldung von Gari zum ersten Tag mit dem Controlling (25.11.2026).
  - **Karten der Übersicht:** Gari fand nicht, wo man sie öffnet (nur der Titel war ein Link). Jetzt öffnet die ganze Karte das Projektblatt (der Link im Titel spannt sich über die Karte, Hover mit blauem Rand); fett steht das **Projekt**, darüber die Nummer, darunter das Paket.
  - **Voller Zugang zum Controlling** (Gari: die Kollegin, die die Buchhaltung macht, soll alles sehen): neue Tabelle `office_controlling_zugang` und `private.office_controlling_voll()` (Admin oder aktives Mitglied mit Eintrag). Wer dort steht, sieht alle Projekte, Stunden je Person, Sätze, Gehälter und das Ergebnis zum Gehalt und trägt ein, wird aber nicht Admin des Office. Den Zugang vergeben nur Admins, in «Sätze und Gehälter» (Abschnitt «Voller Zugang zum Controlling»). Die Seite sagt «vertraulich» statt «nur Admins».
  - **Work: Abschnitte je Projekt** (Gari: eine Machbarkeitsstudie braucht weder Kostenberechnung noch Mustermappe): Terminplan, Kostenberechnung, Mustermappe, Produkte und Hersteller nimmt jedes Projekt über **«+»** auf; immer da bleiben Panorama, Desktop, Planner, Controlling und Threads. Das «+» steht am Ende der Reiter (wie in Teams; Garis Vorschlag war links von Panorama), am Telefon klebt es am rechten Rand. Das Menü zeigt je Abschnitt «Hinzufügen» oder «Ausblenden»; die Wahl gilt für das ganze Projektteam (`office_project_abschnitte`), Ausblenden löscht nichts, und ein Link auf einen ausgeblendeten Abschnitt (Panorama, «Neuer Terminplan») nimmt ihn wieder auf. Was schon Daten hat, bekommt seine Abschnitte gleich mit. Ohne Tabelle oder bei einem Fehler steht alles da wie bisher.
- Archivos: `controlling.js` (`?v=office2`), `controlling.css` (`office2`), `controlling.html`; `app/work.js` (`?v=office56`), `app/shell.js` (`?v=office58`), `app/work-polish.css` (`?v=7`), `app/index.html`; Migrationen `supabase/migrations/20261125094004_office_controlling_zugang.sql` und `20261125094015_office_project_abschnitte.sql`; Tests: `tests/office-controlling.test.mjs`, `tests/office-work-reiter.test.mjs`, `tests/sql/office-controlling-acceptance.sql` (Buchhaltung D), `tests/browser/office-controlling.chromium.mjs` und `fixtures/fake-supabase-controlling.js` (Rolle «buchhaltung»), `tests/browser/office-planner-karten.chromium.mjs` (neuer Test «+»), Versionen in zehn weiteren Tests; `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: migraciones `office_controlling_zugang` (neue Tabelle, neue Funktion, nur zusätzliche Policies; `office_controlling_lesen` und `office_controlling_summen` mit neuem Körper bei gleicher Signatur) und `office_project_abschnitte` (neue Tabelle mit Policies und Zeilen aus vorhandenen Daten) — aplicadas en Supabase: sí, 25.11.2026 über den Supabase-Connector (`apply_migration`, Versionen `20261125094004` und `20261125094015`, nach Ankündigung an Gari); danach die Buchhaltung in `office_controlling_zugang` eingetragen. In Produktion geprüft: mit ihrem Konto `office_controlling_voll()` wahr und die Summen aller Projekte sichtbar; die Abschnitte wie aus den Daten erwartet (laufendes Projekt mit allen fünf, die neuen Projekte ohne, das Archiv mit Kostenberechnung).
- Datos (nur in der Datenbank, mit Garis OK): im laufenden Paket LPH 3 Leistungsstand 60 % und in der Notiz die Grundlage aus der 2. Ergänzungsvereinbarung (sie nennt keinen festen Betrag, sondern HOAI, Honorarzone und den Anteil wiederholter Grundleistungen); im abgeschlossenen Paket eine Zahlung «Gesamt», bezahlt (Honorar und 5 % Nebenkosten).
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (463); Chromium grün: `office-controlling` (6 Tests, neu: Buchhaltung, Zugang geben und entfernen, Klick auf die Karte), `office-planner-karten` (7, neu: «+», ausblenden, wieder aufnehmen, Escape), `office-app-boot`, `office-planner-board`, `office-musterplanner`, `office-planner-terminplan-sync`; Bildschirmfotos angesehen.
- Quedó pendiente o sin probar: Gari und die Buchhaltung tragen Honorar und Gehälter ein; ob «+» am Ende so gefällt.
- Riesgos o decisiones que necesitan a Gari: —
- PR: #168

### 2026-11-25 · Controlling: Honorar, Stunden, Zahlungen und Prognose je Projekt · Claude
- Qué cambió y por qué: Gari (25.11.2026): Der Chef legt im Vertrag das Honorar fest und kalkuliert mit 85 €/h, je Mitarbeiter änderbar; daraus folgen die vorgesehenen Stunden, und am Ende soll man sehen, was gegenüber der Kalkulation gewonnen wurde. Auf das Honorar kommen 5 % Nebenkosten, die Auftraggeber zahlen in Abschlägen (Netto + MwSt, in einem eigenen Reiter). Gestalt nach Garis Wahl (Vorschläge B und C, Begriffe wie die Projektübersicht von untermStrich):
  - **Werkzeuge › Controlling** (`controlling.html`): je Honorarpaket eine Karte mit zwei Balken: Stunden gegen das Stundenbudget (Honorar ÷ Kalkulationssatz) mit der Marke «Soll beim Leistungsstand», bernsteinfarben, wenn darüber; Honorar mit bezahlt (Honoraranteil) und erarbeitet (Honorar × Leistungsstand). Darunter Prognose am Ende (bzw. Ergebnis), Honorar je Stunde, offen. Laufende Pakete zuerst, die schlechteste Prognose oben.
  - **Projektblatt** (`?projekt=`, auch als Reiter «Controlling» jedes Projekts in Work, nach der Kostenberechnung): Kennzahlen in Gruppen (Vertrag, Stand, Prognose am Ende, Zahlungen; für Admins «Zum Gehalt»), Reiter **Stände und Stunden** (Stichtag, Leistungsstand, Stunden seit Beginn, Wert zum Kalkulationssatz, erarbeitet, Ergebnis; für Admins die Stunden je Person und der Wert zum Gehalt) und **Zahlungen** (Datum, Bezeichnung, netto mit Nebenkosten, davon Honorar und Nebenkosten, MwSt, brutto, bezahlt oder gestellt, vorläufig). Eine Zahlung lässt sich aus dem Bruttobetrag eintragen (teilt zu 19 %).
  - **Sätze und Gehälter** (`?ansicht=saetze`, nur Admins): je Person Kalkulationssatz und Monatsgehalt ab einem Datum, Stundensatz aus dem Gehalt (× 12 × (1 + Arbeitgeberanteil) ÷ Jahresstunden; Annahmen 21 % und 1.600 h änderbar). Ein neuer Satz bewertet frühere Stunden nicht neu.
  - **Sichtbarkeit** (Gari): Alle im Projekt sehen Honorar, Zahlungen, Stunden und Ergebnis; Stunden je Person, Sätze, Gehälter und das Ergebnis zum Gehalt nur Admins. Eintragen und ändern nur Admins.
- Archivos: `controlling.html`, `controlling.js` (`?v=office1`), `controlling-kern.js` (`office1`), `controlling.css` (`office1`); `app/shell.js` (`?v=office57`, Karte und Reiter), `app/work.js` (`?v=office55`), `app/office-projects.js` (`?v=office62`), `app/index.html`; Migration `supabase/migrations/20261125085053_office_controlling_v1.sql`; Tests: `tests/office-controlling.test.mjs` (neu), `tests/sql/office-controlling-acceptance.sql` (neu, in `verify.yml`), `tests/browser/office-controlling.chromium.mjs` und `fixtures/fake-supabase-controlling.js` (neu, in `verify-romy-browser.yml`), `office-planner-karten.chromium.mjs`, `office-work-reiter`, `office-gestaltung`, Versionen in acht weiteren Tests; `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: migración `20261125085053_office_controlling_v1` (nur neue Tabellen `office_controlling_pakete`, `_staende`, `_stunden`, `_zahlungen`, `_saetze`, `_einstellungen`, Trigger, Hilfsfunktionen, Policies und `office_controlling_summen`; nichts Destruktives) — aplicada en Supabase: sí, 25.11.2026 über den Supabase-Connector (`apply_migration`, Version `20261125085053`, nach Ankündigung an Gari).
- Deploy de funciones: ninguno.
- Cómo se probó: Abnahme im isolierten Supabase grün (Rechte von Admin, Team, Nicht-Team und anon; Bewertung des Zuwachses zum Satz am Stichtag; Gehalt nur für Admins und nur vollständig; Schutz von Urheber, Projekt und Paket); `node --test tests/*.test.cjs tests/*.test.mjs` grün (461); Chromium grün: `office-controlling` (Übersicht, Projektblatt, Stand mit Personen, Zahlung aus brutto, Paket ändern, Mitglied ohne Personen und Sätze, Sätze und Gehälter, im Rahmen, iPhone) und `office-planner-karten` (Reiter «Controlling»); Bildschirmfotos angesehen. In Produktion: `office_controlling_summen` als Mitglied eines Teams aufgerufen (Summen wie erwartet, ohne Gehalt); Sicherheits-Advisor ohne neue Befunde außer dem erwarteten Hinweis auf die security-definer-Funktion `office_controlling_summen` (gewollt: sie prüft den Zugang selbst und gibt nur Summen heraus).
- Erste Daten (25.11., nur in der Datenbank, mit Garis OK): drei Honorarpakete in drei Projekten, zwei Projekte dafür neu angelegt (vorläufige Nummern, Team wie im laufenden Projekt); Honorar und Zahlungen teils «vorläufig», Stunden zunächst als «Team» ohne Aufteilung.
- Quedó pendiente o sin probar: echte Zahlen von Gari (Aufteilung der Stunden je Person, genaues Honorar, Bestätigung der Zahlungen, Leistungsstand, Projektnummern); Gehälter trägt Gari selbst ein. Der Chef wird Mitglied und Admin.
- Riesgos o decisiones que necesitan a Gari: 85 €/h ist ein Kalkulationssatz (Preis), kein Gehalt; das Ergebnis «zum Gehalt» ist nur so gut wie die Annahmen (Arbeitgeberanteil, Jahresstunden).
- PR: #167

### 2026-11-25 · Projekte: Nummer und Name bearbeiten · Claude
- Qué cambió y por qué: Gari (25.11.2026): Projektnummer und -name müssen änderbar sein (die neuen Projekte bekommen zuerst eine vorläufige Nummer). In Werkzeuge › Projekte hat jede Projektkarte «Bearbeiten» (Nummer und Name), sichtbar für Admins und die Projektleitung des Projekts, wie es die Datenbank erlaubt (`office_projects_lead_update`). Eine schon vergebene Nummer meldet «Diese Projektnummer ist bereits vergeben.». Work, Planner und die Werkzeuge lesen Nummer und Name aus dem Projekt; Terminpläne und Kostenberechnungen tragen ihre Kopfzeile selbst und behalten sie (Hinweis im Dialog, wenn es Terminpläne gibt).
- Archivos: `app/office-projects.js` (`?v=office61`), `app/index.html`, `tests/browser/office-app-boot.chromium.mjs` (neuer Test), `tests/browser/fixtures/fake-supabase.js` (Projekt und Schreibprotokoll), `tests/office-work-reiter.test.mjs`, Versionen in zwei weiteren Tests, `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (450); Chromium `office-app-boot` grün (Dialog, Werte, gespeicherte Änderung).
- Quedó pendiente o sin probar: —
- Riesgos o decisiones que necesitan a Gari: —
- PR: #166

### 2026-11-25 · Romy: ein direkt angelegter Termin steht nicht mehr doppelt im Kalender · Claude
- Qué cambió y por qué: Gari (25.11.2026): Ein Termin, den Romy angelegt hatte, stand zweimal im Kalender, einmal unter «Arbeit», einmal unter «Persönlich». Ursache: Romy legt Termine und Aufgaben direkt an (Schlüssel «direct:<request_id>»), der Server speichert für die Office aber zusätzlich die Karte desselben Zugs mit den Vorschlägen («Anlage freigegeben, Bestätigung steht noch aus.») und «Vorschlag prüfen». Wer dort bestätigte, legte über den alten lokalen Weg eine zweite Kopie an, und zwar ohne Kategorie, also «Persönlich».
  - Eine Karte, deren Einträge Romy schon angelegt hat, ist erledigt: kein «Vorschlag prüfen», der Text lautet «Eingetragen.»; sie wird gleich nach der direkten Anlage so markiert und auch, wenn sie erst später aus dem Verlauf kommt.
  - Bestätigen legt nie eine zweite Kopie an, auch wenn der Dialog schon offen war («Steht schon im Kalender.»).
  - Was in der Office über eine Karte bestätigt wird, steht unter «Arbeit» (wie von Hand angelegte und synchronisierte Einträge).
  - Die kurzen Quittungen dieses Wegs («Eingetragen.», «Aktualisiert.», «Gelöscht.», «Archiviert.») entstehen deutsch an ihrer Quelle (die Übersetzungstabelle wächst nicht).
- Archivos: `app/app.js` (`?v=office57`), `app/index.html`, `tests/browser/office-app-boot.chromium.mjs` (neuer Test), `tests/office-assistant.test.mjs`, Versionen in sechs weiteren Tests, `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración. Die vorhandene Kopie vom 24.11. (unter «Persönlich») löscht Gari im Kalender selbst, damit es auf allen Geräten ankommt.
- Deploy de funciones: ninguno.
- Cómo se probó: Ursache in den Daten bestätigt (zwei Zeilen im Abstand von 17 s, eine mit Beleg der direkten Anlage, eine ohne, mit Kategorie «Persönlich»). `node --test tests/*.test.cjs tests/*.test.mjs` grün (449); Chromium `office-app-boot` mit neuem Test grün (ohne die Korrektur rot), `romy-chat` und `romy-live` grün.
- Quedó pendiente o sin probar: Der Server könnte die Karte bei direkter Anlage gleich ohne Vorschläge speichern; nicht nötig, solange die App sie als erledigt erkennt.
- Riesgos o decisiones que necesitan a Gari: —
- PR: #165

### 2026-11-25 · Mustermappe als Werkzeug; Reiter Mustermappe, Produkte und Hersteller in Work · Claude
- Qué cambió y por qué: Gari (25.11.2026): Die Mustermappe gehört unter Werkzeuge wie die anderen Werkzeuge und im Projekt als Reiter in Work, wie Terminplan und Kostenberechnung; dazu in Work je Projekt die Produkte, die in der Produktbibliothek dafür ausgewählt sind, und ebenso die Hersteller.
  - **Werkzeuge › Mustermappe** (neue Karte): `projektdokumente.html?werkzeug=mustermappe` – Projekt wählen (oder das zuletzt geöffnete), dann die Mappen des Projekts als Karten mit Positionen, Seiten, Bemusterungstermin und Stand; «Neue Mustermappe». Die Mappe führt mit «‹ Mustermappen» zurück. Die Karte «Mustermappen» im Projektstart entfällt.
  - **Work, Reiter «Mustermappe»:** die Mappen des Projekts (Zeilen der Entscheidungsvorlagen mit `form` «mustermappe») zur Wahl, nach Themenpaket benannt; die Wahl steht schon bei einer Mappe, daneben «Neue Mustermappe» (die offene Mappe speichert vorher; der Dialog bleibt beim Wechsel der Reiter offen; Abbrechen führt zur Mappe zurück). Ohne Mappe: «Mustermappe anlegen». Die Seite meldet Work Revision, Ausstehendes und Speichern (`TBA_OFFICE_TOOL`), Abbrechen per Nachricht; eine neue Mappe öffnet sie über ihre Adresse. «Präsentieren» darf im Rahmen den ganzen Bildschirm nehmen.
  - **Work, Reiter «Produkte» und «Hersteller»:** je Projekt eine Seite, `produktbibliothek.html?projekt=` und `herstellerkatalog.html?projekt=`. Produkte: nur Ausgewähltes (nicht verworfen), nach Code, Karte mit Code und Stand im Projekt, ohne «Zu Projekt»; Kategorien zählen nur das Projekt. Hersteller: Firmen mit Kontakt in diesem Projekt oder Hersteller eines dafür ausgewählten Produkts, mit diesen Produkten auf der Karte. Links zwischen Bibliothek und Katalog behalten das Projekt; ein neuer Kontakt, «Zu Projekt» oder ein Preis haben das Projekt vorbelegt. Im Rahmen: ohne Rücksprung und ohne zweite Überschrift; «Produktbibliothek öffnen» bzw. «Herstellerkatalog öffnen» als ganze Seite.
  - Alle drei Seiten springen im Rahmen nie in die App oder zur Startseite (ohne Anmeldung eine Meldung).
- Archivos: `app/shell.js` (`?v=office56`), `app/work.js` (`?v=office54`), `app/office-projects.js` (`?v=office60`), `app/work-polish.css` (`?v=6`), `app/index.html`, `projektdokumente.js` (`?v=office7`), `projektdokumente.css` (`?v=office8`), `projektdokumente.html`, `produktbibliothek.js` (`?v=office9`), `produktbibliothek.css` (`?v=office5`), `produktbibliothek.html`, `herstellerkatalog.js` (`?v=office2`), `herstellerkatalog.css` (`?v=office2`), `herstellerkatalog.html`; Tests: `tests/office-work-reiter.test.mjs`, `tests/office-mustermappe.test.mjs`, Versionen in zehn weiteren Tests, `tests/browser/office-planner-karten.chromium.mjs`, `office-mustermappe.chromium.mjs`, `office-herstellerkatalog.chromium.mjs`; `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (448); Chromium grün: `office-planner-karten` (neuer Test: Mappen wählen, weitere anlegen, Abbrechen, Produkte und Hersteller je Projekt), `office-mustermappe` (Einstieg über das Werkzeug, Liste der Mappen, Projektstart ohne Mappen, Mappe im Rahmen), `office-herstellerkatalog` (Produkte und Hersteller im Projekt, im Rahmen), `office-produktbibliothek`, `office-projektdokumente`, `-zahlen`, `office-terminplan-reiter`; Bildschirmfotos der Liste, der Mappe im Rahmen, der Reiter und der beiden Seiten im Projekt angesehen.
- Quedó pendiente o sin probar: im echten Work mit echten Daten nach dem Deploy ansehen; Bezeichnung der Reiter («Produkte», «Hersteller») ist ein Vorschlag.
- Riesgos o decisiones que necesitan a Gari: —
- PR: #164

### 2026-11-25 · Mustermappe: Position ohne Produkt im PDF, Fotos gleich hoch · Claude
- Qué cambió y por qué: Beim Anlegen der ersten echten Mappe (Auftrag Gari, 25.11.2026) zeigte sich zweierlei: Eine Position ohne Produkt aus der Bibliothek (etwa geschliffener Zementestrich als Leistung) trug im PDF den Hinweis fürs Büro «Noch kein Kandidat. Rechts einen aus der Bibliothek wählen.»; und auf der Vergleichsseite standen die Fotos ungleich hoch, wenn ein Kandidat einen längeren Namen oder mehr Kennwerte hatte.
  - Ohne Kandidat zeigt die Seite im PDF und im Stand nur Kopf, Frage, Kostenrahmen und Hinweise; der Hinweis zum Wählen bleibt beim Bearbeiten.
  - Foto und Text je Kandidat stehen in zwei Zeilen eines Rasters: die Fotos sind auf einer Seite gleich hoch.
- Archivos: `mustermappe-kern.js` (`?v=office2`), `projektdokumente.css` (`?v=office7`), `projektdokumente.html`, `tests/office-mustermappe.test.mjs`, `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (445); Chromium `office-mustermappe` und `office-projektdokumente` grün; neun Seiten A3 mit langen echten Texten als PDF gesetzt: kein Überlauf, Fotos gleich hoch.
- Quedó pendiente o sin probar: —
- Riesgos o decisiones que necesitan a Gari: —
- PR: #163

### 2026-11-24 · Mustermappe: Präsentieren und Entscheidung im Bemusterungstermin (Schritt 2) · Claude
- Qué cambió y por qué: Gari (24.11.2026): Die Mustermappe wird mit dem Bemusterungstermin vorgestellt und dort entschieden; der Bauherr unterschreibt nicht jedes Blatt. Schritt 2 des Konzepts (OK «Avanza con todos los pasos»).
  - **«Präsentieren»** in der Mappe: die Seiten groß auf dunkler Fläche (Vollbild, wo der Browser es erlaubt), blättern mit Pfeiltasten oder Knöpfen, ohne Eingabefelder auf der Seite; oben «Entschieden: n von m».
  - **«Entscheidung erfassen»** je Position: gewählte Variante (die Empfehlung ist vorgewählt) oder «Vertagt», Entscheider (vorbelegt mit dem Bauherrn der Mappe), Datum (der Termin), Bemerkung. Eingetragen wird in der Entscheidungsliste wie mit «Entscheidung eintragen»: «A: Produkt – Bemerkung», Datum, Entscheider, der Termin als Fundstelle; die Datenbank prüft wie bisher Datum, Entscheider und Entscheidung. «Vertagt» entfernt eine frühere Entscheidung, die Bemerkung wird zur Annahme für die Weiterplanung. Die Seiten zeigen danach «Entschieden am … von …», die Übersicht die gewählte Variante.
  - **Nach dem Termin:** die Karte «Entscheidungen der Bemusterung» listet Entschiedenes und Vertagtes; «In der Produktbibliothek freigeben (n)» setzt die gewählten Produkte im Projekt auf «freigegeben» und die übrigen Kandidaten auf «verworfen» (dieselbe Funktion wie in der Entscheidungsvorlage).
- Archivos: `projektdokumente.js`, `projektdokumente.css`, `projektdokumente.html` (`?v=office6`), `tests/browser/office-mustermappe.chromium.mjs` (Test 5), `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: ninguna migración.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (444); Chromium `office-mustermappe` (5: Termin mit Pfeiltaste, Entscheidung, «Vertagt» und zurück, Freigabe mit «freigegeben» und «verworfen»), `office-projektdokumente`, `-zahlen` grün; Bildschirmfoto des Präsentierens angesehen.
- Quedó pendiente o sin probar: Romy schlägt die Entscheidungen aus dem Protokoll des Termins vor (mit Fundstelle); Schritt 3 (Anforderungen gegen die Merkmale) und 4 (Kostenberechnung aus dem Entschiedenen); mit echten Daten noch nicht benutzt.
- Riesgos o decisiones que necesitan a Gari: —
- PR: #162

### 2026-11-24 · Mustermappe: Seiten A3 aus Positionen und Produktbibliothek (Schritt 1) · Claude
- Qué cambió y por qué: Gari (24.11.2026): für jedes Muster ein bearbeitbares Blatt in einer bearbeitbaren Mustermappe; eine Entscheidung soll mehreren Dokumenten derselben Leistungsphase dienen (Bibliothek → Mappe → Entscheidung → Kostenberechnung), wie Terminplan und Planner. Entscheidungen von Gari: ein Musterblatt je Position, nicht je Produkt; Strategie A und B in einer Mappe; entschieden wird im Bemusterungstermin, nicht auf dem Blatt (keine Unterschrift); eigener Dokumenttyp mit Seitenvorlagen und lebenden Daten wie Programa, die freie Leinwand später. Boceto vom 24.11. mit OK («Avanza con todos los pasos»).
  - **Projektstart › Mustermappen (L3.MAP.1):** eine Mappe je Themenpaket (Bodenbeläge, Bäder, Treppen, Fassade, Licht, weitere). Technisch eine Entscheidungsvorlage in Seitenform (`daten.form = 'mustermappe'`): Stände, Vorlegen, Fundstelle und Beleg wie in der Vorlage; in der Übersicht eine eigene Karte, nicht unter den Entscheidungsvorlagen.
  - **Position** = Entscheidung der Entscheidungsliste mit Feld `muster` (Code aus dem Plan, Bezeichnung, Strategie, Zonen, Fläche, Anforderungen, Zu beachten, Kostenrahmen mit Beleg); Thema «B2 · Holz – Eiche», Herkunft «Mustermappe …». **Kandidaten** = Varianten mit Produkt aus der Produktbibliothek; ohne Verwendung im Projekt entsteht eine «vorgeschlagen» (Musterliste).
  - **Seitenvorlagen A3 quer** (`mustermappe-kern.js`): Deckblatt, Übersicht (bei Strategie A und B getrennt), Vergleich (bis drei Kandidaten mit Foto, Kennwerten, Kosten, Empfehlung), Material (eine Variante groß, bis drei Fotos), freie Seite (Bild, oder eine Seite aus einem PDF, die der Browser mit pdf.js vom CDN zu einem Bild macht). Texte werden gestrichelt auf der Seite bearbeitet; Maße in cqw, damit Bildschirm, PDF und Stand gleich aussehen; «Lesegröße» zum Bearbeiten.
  - **Stand der Bibliothek:** die Seite zeigt den Auszug des Produkts vom «Übernehmen» (Merkmale mit Seite, Stand); ist die Bibliothek neuer, steht daneben «neuer Stand in der Bibliothek · Übernehmen». Aus dem Projekt ändert sich die Bibliothek nie.
  - **PDF** über Drucken, A3 quer nur für die Mappe (die Vorlage bleibt A4): je Zahl nur der Beleg, nie die Fundstelle mit anderen Projekten; keine Unterschrift. **Vorlegen** setzt die Positionen auf «vorgelegt» und hält den Inhalt als Stand fest; ein Stand wird immer aus diesem Inhalt gezeigt (maskiert), nie aus HTML.
  - Nur im Büro sichtbar, neben der Seite: neuer Stand in der Bibliothek, was im Datenblatt fehlt.
- Archivos: `mustermappe-kern.js` (neu), `projektdokumente.js`, `projektdokumente.css`, `projektdokumente.html` (`?v=`), `supabase/migrations/20261124223855_office_projektdokumente_bilder.sql` (neu), `tests/office-mustermappe.test.mjs`, `tests/browser/office-mustermappe.chromium.mjs`, `tests/browser/fixtures/fake-supabase-dokumente.js` (Storage, Fotos, Merkmale), `tests/sql/office-projektdokumente-bilder-acceptance.sql`, `.github/workflows/verify.yml`, `.github/workflows/verify-romy-browser.yml` (pdfjs-dist für den PDF-Teil), `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: migración `20261124223855_office_projektdokumente_bilder` (privater Bucket `office-projektdokumente`, Bilder bis 15 MB; Pfad Dokument/Person/Datei; lesen mit Zugang zum Dokument, hochladen nur unter dem eigenen Pfad, entfernen nur, wer hochgeladen hat, oder ein Admin; keine Update-Policy; nichts Bestehendes geändert) — aplicada en Supabase: sí, nach der grünen Abnahme im CI über den Supabase-Connector (`apply_migration`, Version `20261124223855`, Datei so umbenannt); geprüft: Bucket privat, 15 MB, drei Policies, noch keine Datei.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (444); SQL-Abnahme der Bilder im CI auf der frisch migrierten Datenbank grün; Chromium mit synthetischem Supabase: `office-mustermappe` (4, mit PDF-Seite über pdf.js in der «legacy»-Fassung, die auch das ältere Chromium des CI liest), `office-projektdokumente`, `-zahlen`, `office-produktbibliothek` grün; das PDF der Mappe als A3 quer angesehen (Deckblatt, Übersicht, Vergleich, Material).
- Quedó pendiente o sin probar: Schritt 2 (Präsentieren und Entscheidung im Termin), 3 (Anforderungen gegen die Merkmale prüfen), 4 (Kostenberechnung nimmt nur Entschiedenes); Positionen aus einem anderen Projekt übernehmen; Muster «angefragt/da». Safari nimmt das Papierformat aus dem Druckdialog (dort A3 quer wählen). Mit echten Daten noch nicht benutzt.
- Riesgos o decisiones que necesitan a Gari: —
- PR: #161

### 2026-11-24 · Produktbibliothek: echte Produktfotos, Unterlagen eingeordnet, Migration umbenannt · Claude
- Qué cambió y por qué: Gari (24.11.2026): Die Karten der Produktbibliothek sollen echte Produktfotos zeigen statt der bisherigen Flächen; die Fotos aus den gelieferten Unterlagen nehmen oder im Netz suchen.
  - **Daten (nur in der Datenbank, nicht im Repo):** 30 Fotos als Dokumentart «Bild» an allen 24 Produkten des ersten Pakets; das neueste Foto ist die Musterfläche der Karte. Bilder aus den Datenblättern, wo diese welche enthalten, sonst Produktbilder von Hersteller- oder Händlerseiten (5 Produkte); auf 16:9 zugeschnitten, freigestellte Produkte auf weißem Grund.
  - Wie in #159 angekündigt: zwei Richtpreise als «Angebot», zwei Sicherheitsdatenblätter als «Sicherheitsdatenblatt» (vorher «Sonstiges»; nur die Art geändert, nichts gelöscht).
  - Einem Beschichtungssystem fehlten Brandklasse und Rutschhemmung: eine Seite der Herstellerbroschüre liegt jetzt als zweites Datenblatt dabei, die neuen Merkmale verweisen mit Seite darauf. Bei einer Trennwand steht «Eignung für Nassreinigung» als offener Punkt.
  - Hochgeladen über `office-produkt-import` mit einem einmaligen Schlüssel, danach geschlossen.
  - Migration in `20261124174523_office_produkte_licht_dokumentarten.sql` umbenannt (die Version, die Supabase registriert hat); Test und SQL-Abnahme lesen den neuen Namen.
- Archivos: `supabase/migrations/20261124174523_office_produkte_licht_dokumentarten.sql` (umbenannt), `tests/office-herstellerkatalog.test.mjs`, `tests/sql/office-herstellerkatalog-acceptance.sql`, `docs/BITACORA.md`, `docs/ESTADO.md`.
- Base de datos: keine neue Migration; die umbenannte ist seit #159 angewandt (Version `20261124174523`). Daten wie oben über den Import und den Connector.
- Deploy de funciones: ninguno (`office-produkt-ai` und `office-produkt-import` laufen seit dem Deploy nach #159).
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün; in Produktion: alle 24 Produkte haben ein Foto, 44 Unterlagen, kein offener Import-Schlüssel.
- Quedó pendiente o sin probar: —
- Riesgos o decisiones que necesitan a Gari: Die Fotos von Hersteller- und Händlerseiten sind für die interne Bibliothek gedacht; vor einer Weitergabe nach außen die Rechte prüfen.
- PR: #160

### 2026-11-24 · Produktbibliothek: Kategorie «Licht», Dokumentarten «Angebot» und «Sicherheitsdatenblatt» · Claude
- Qué cambió y por qué: Gari (24.11.2026, OK für genau diese Änderung): Vor dem Paket Licht braucht die Bibliothek die Kategorie «Licht» (der Herstellerkatalog kennt sie seit #157); Angebote und Sicherheitsdatenblätter lagen bisher als «Sonstiges» bei den Produkten.
  - **Datenbank:** die zwei Prüfregeln `office_produkte_kategorie_check` und `office_produkt_dokumente_art_check` werden ersetzt (alte entfernt, erweitert neu angelegt). Keine Zeile wird geändert oder gelöscht; alle bisherigen Werte bleiben gültig.
  - **Seite:** Kategorie «Licht» mit dem Kürzel LI (Codes wie LI-01) und die zwei Dokumentarten in Auswahl und Liste; im Projektstart vergibt «In die Musterliste» für Licht das Kürzel LI.
  - **Romy liest Datenblätter** (`office-produkt-ai`): Kategorie `licht`, Dokumentarten `angebot` und `sicherheitsdatenblatt` in Schema und Anweisung; die Version bleibt `office-produkt-ai-v1` (nur neue Werte, abwärtskompatibel).
  - **Import** (`office-produkt-import`): dieselben zwei Arten.
- Archivos: `supabase/migrations/20261124190000_office_produkte_licht_dokumentarten.sql` (neu), `produktbibliothek.js` (`office8`), `produktbibliothek.html`, `projektdokumente-zahlen.js` (`office2`), `projektdokumente.html`, `supabase/functions/office-produkt-ai/core.mjs`, `supabase/functions/office-produkt-import/core.mjs`; Tests: `tests/office-herstellerkatalog.test.mjs` (neu 1, angepasst 1), `tests/sql/office-herstellerkatalog-acceptance.sql` (Licht, Angebot, Sicherheitsdatenblatt erlaubt, unbekannte Art verweigert), Versionen in `office-produktbibliothek`.
- Base de datos: Migration `20261124190000_office_produkte_licht_dokumentarten.sql` — aplicada en Supabase: nach dem Merge über den Connector; danach die vorhandenen Richtpreise als «Angebot» und die Sicherheitsdatenblätter als «Sicherheitsdatenblatt» (nur die Art geändert, nichts gelöscht).
- Deploy de funciones: `office-produkt-ai` und `office-produkt-import` nach dem Merge über den Workflow.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (434); Chromium lokal grün: Produktbibliothek (6), Herstellerkatalog (5), Zahlen im Projektstart (1); SQL-Abnahme in CI.
- Quedó pendiente o sin probar: —
- Riesgos o decisiones que necesitan a Gari: —
- PR: #159

### 2026-11-24 · Herstellerkatalog und Produktbibliothek: erste Daten, Import geschlossen, Verknüpfung bleibt beim Bearbeiten · Claude
- Qué cambió y por qué: Gari (24.11.2026) gab die Unterlagen einer Kollegin zu Bodenbelägen und Sanitär (Datenblätter, Richtpreise, eine Preisliste) und eine Herstellerrecherche: sichten, ordnen, Produktkarten anlegen, für das laufende Projekt vormerken und daraus den Herstellerkatalog füllen.
  - **Daten (nur in der Datenbank, nicht im Repo):** 58 Firmen mit Typ, Angebot, Kategorien und Kontakt (was die Recherche nicht belegt, steht als «n. v.»; zusammengefasste Einträge einzeln, ohne Kontakt, Notiz «nachrecherchieren»). 65 Kontakte in Projekten: Recherche mit Belag und Marke («Muster zuerst anfordern», «zweite Runde»), Unterlagen der Kollegin, ein Richtpreis. 24 Produkte (11 Bodenbeläge, 13 Sanitär) als «Entwurf», jede Angabe mit Seite und Dokument, Fehlendes als «Nicht im Datenblatt». 43 Unterlagen: Datenblätter, Richtpreise, Preisliste, Verlege- und Pflegehinweise, Sicherheitsdatenblätter (Angebote und Sicherheitsdatenblätter als «Sonstiges»). 3 Preise netto: 2 Richtpreise eingebaut mit Position und Seite, 1 Listenpreis aus der Preisliste (UVP inkl. MwSt. umgerechnet). 24 Verwendungen im laufenden Projekt «vorgeschlagen», ohne Code, mit dem Belag in der Notiz.
  - Nicht übernommen: ein doppeltes Farbblatt; die Recherche selbst (sie steckt im Katalog); die Planunterlagen der Anfrage (Projektdokumente, kein Produkt).
  - **Import:** einmaliger Schlüssel für 90 Minuten, nach dem Hochladen geschlossen (`gueltig_bis` auf jetzt) und lokal gelöscht; ohne Schlüssel antwortet die Funktion 401.
  - **Produktbibliothek:** beim Bearbeiten bleibt die Verknüpfung mit der Firma, solange der Herstellername gleich bleibt, auch wenn kein Name eindeutig passt; vorher wurde sie dann geleert.
  - Migration in `20261124162311_office_herstellerkatalog_v1.sql` umbenannt (die Version, die Supabase registriert hat).
- Archivos: `produktbibliothek.js` (`office7`), `produktbibliothek.html`, `supabase/migrations/20261124162311_office_herstellerkatalog_v1.sql` (umbenannt), `tests/office-herstellerkatalog.test.mjs`, `tests/office-produktbibliothek.test.mjs`, `tests/sql/office-herstellerkatalog-acceptance.sql`, `docs/ESTADO.md`.
- Base de datos: Migration aus #157 angewendet (Connector, Version `20261124162311`): RLS auf allen drei Tabellen, 7 Policies, `office_import_tokens` ohne Rechte für anon und authenticated; der Security Advisor meldet für diese Tabelle «RLS ohne Policy», das ist gewollt. Daten per SQL eingefügt, nichts gelöscht.
- Deploy de funciones: `office-produkt-import` über den Workflow (grün); anonym 401 `import_closed`.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (433); Chromium lokal grün: Herstellerkatalog (5), Produktbibliothek (6); Zählung in Produktion (58 Firmen, 65 Kontakte, 24 Produkte, 43 Unterlagen im Bucket, 3 Preise mit Dokument, 24 Verwendungen; jede Angabe mit Seite hat ihr Dokument); Bildschirmfotos von Katalog, Firmenblatt, Bibliothek und Produktblatt mit diesen Daten in der Attrappe (lokal, nicht im Repo).
- Quedó pendiente o sin probar: mit Garis Sitzung ansehen; Produkte prüfen («Entwurf» → «geprüft»); Codes, wenn die Musterliste entsteht.
- Riesgos o decisiones que necesitan a Gari: Kategorie «Licht» in der Bibliothek (nächstes Paket) und eigene Dokumentarten «Angebot» und «Sicherheitsdatenblatt»: je eine neue Prüfregel (die alte wird ersetzt, keine Daten betroffen), nur mit seinem OK.
- PR: #158

### 2026-11-24 · Herstellerkatalog: Firmen mit Kontakt und Projekten, Kontakt auf den Produktkarten · Claude
- Qué cambió y por qué: Gari (24.11.2026): Das Büro hat keinen Herstellerkatalog, man fragt sich immer gegenseitig nach den Kontakten. Eigene Seite wie die Produktbibliothek, in derselben Gestalt; auf den Produktkarten der Kontakt des Herstellers. Je Firma nur Firma, Produkt, Typ (optional), Kontakt und Projekte: in welchem Projekt wer im Büro Kontakt hatte, damit man zuerst mit der Kollegin oder dem Kollegen spricht.
  - **Werkzeuge · Herstellerkatalog** (`herstellerkatalog.html`, neu): Karte je Firma mit Typ (Hersteller, Systemhersteller, Ausführender, Vertrieb, Verband), Angebot, Kontakt (Telefon und E-Mail anklickbar, Website, Ansprechpartner), «Projekt · Person» und «N Produkte in der Bibliothek». Suche (auch in Angebot und Ansprechpartnern), Filter nach Typ und nach Projekt («Kontakt in»), Kategorien mit Anzahl, Archiv. **Firmenblatt** (`?id=`): Kontakt, Notiz, Angebot, Produkte der Bibliothek, Tabelle «Kontakt in Projekten»; «Kontakt eintragen» (Projekt des Office oder freier Name, Person, Art von Recherche bis Auftrag, Datum, Notiz), «Bearbeiten», «Archivieren». Dieselbe Firma geht nicht zweimal (Schreibweise egal).
  - **Produktbibliothek:** Karte mit Telefon, E-Mail und Link «Kontakt» der Firma; Produktblatt mit dem Kasten «Hersteller» (oder dem Hinweis, dass die Firma nicht verknüpft ist). Beim Anlegen (Datenblatt lesen oder von Hand) wird die Firma aus dem Katalog verknüpft: Auswahlliste der Firmen; gleicher Name ohne Rechtsform oder eindeutiges erstes Wort. `?hersteller=<id>` zeigt die Produkte einer Firma.
  - **Unterlagen ablegen ohne Sitzung** (Edge Function `office-produkt-import`, neu): damit Claude Unterlagen, die Gari ihm gibt, in die Bibliothek legen kann. Ohne JWT, aber nur mit einem einmaligen Schlüssel; in der Datenbank steht nur sein SHA-256 mit Ablaufzeit (`office_import_tokens`, ohne Rechte für anon und authenticated). Geprüft werden Produkt (vorhanden, nicht archiviert), Art (die neun der Bibliothek), Name, Seitenzahl, Typ (PDF, JPEG, PNG, WebP) und die ersten Bytes, höchstens 25 MB. Abgelegt wie aus der Seite (Bucket `office-produkte`, Pfad und Urheber des Produkts); misslingt der Eintrag, wird die Datei entfernt. Kein Protokoll des Inhalts.
  - Kachel «Herstellerkatalog» in den Werkzeugen der App.
- Archivos: neu `herstellerkatalog.html`, `herstellerkatalog.js` (`office1`), `herstellerkatalog.css` (`office1`), `supabase/functions/office-produkt-import/` (`core.mjs`, `index.ts`), Migration `supabase/migrations/20261124180000_office_herstellerkatalog_v1.sql`; geändert `produktbibliothek.js` (`office6`), `produktbibliothek.css` (`office4`), `produktbibliothek.html`, `app/shell.js` (`office55`), `app/office-projects.js` (`office59`), `app/index.html`, `supabase/config.toml` (`verify_jwt=false` für den Import); Tests: neu `tests/office-herstellerkatalog.test.mjs` (4), `tests/browser/office-herstellerkatalog.chromium.mjs` (5), `tests/sql/office-herstellerkatalog-acceptance.sql` (Schritt in `verify.yml`), Attrappe `fake-supabase-produkte.js` mit Firmen und Kontakten, Versionen in `office-gestaltung`, `office-kostenberechnung`, `office-produktbibliothek`, `office-window-app`, `office-work-reiter`; `verify-romy-browser.yml` führt den neuen Browsertest aus.
- Base de datos: Migration `20261124180000_office_herstellerkatalog_v1.sql`: Tabellen `office_hersteller`, `office_hersteller_kontakte`, `office_import_tokens`, Spalte `office_produkte.hersteller_id`; RLS über `private.office_is_member` und `private.office_is_admin`; nichts Destruktives — aplicada en Supabase: nach dem Merge über den Connector.
- Deploy de funciones: `office-produkt-import` nach dem Merge über den Workflow (ohne Schlüssel 401).
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (433); Chromium lokal grün: Herstellerkatalog (5: Katalog mit Filtern und Archiv, Firmenblatt mit Kontakt eintragen und bearbeiten, Firma doppelt, Kontakt auf Karte und Produktblatt der Bibliothek, iPhone ohne Querscrollen) und Produktbibliothek (6); SQL-Abnahme in CI (Mitglieder, Nichtmitglied, anon, Schlüssel nur für den Server).
- Quedó pendiente o sin probar: Die Daten (Firmen, Kontakte, Produkte, Preise, Unterlagen) kommen nach dem Merge direkt in die Datenbank, nicht ins Repo; Bericht im nächsten Eintrag. Produkte der Kategorie «Licht» kennt die Bibliothek noch nicht (Prüfregel der Kategorie); der Katalog schon.
- Riesgos o decisiones que necesitan a Gari: Der Import ist eine Tür ohne Anmeldung, offen nur, solange ein Schlüssel gilt (Ablauf in der Datenbank, nach jedem Import geschlossen). «Licht» in der Bibliothek braucht eine neue Prüfregel der Kategorie (alte Regel ersetzen, keine Daten betroffen): erst mit Garis OK.
- PR: #157

### 2026-11-24 · Gemeinsame Gestaltung: eine Datei für Farben und Schrift, Blau für alles Klickbare · Claude
- Qué cambió y por qué: Gari (24.11.2026): mal schwarze, mal blaue Knöpfe, im Projektstart-Muster sogar Grün. Entscheidung: eine Datei für Farben und Formen, die alle Seiten laden, damit sie nicht wieder auseinanderlaufen; **Option B: Blau für alles, was man anklicken kann.**
  - **Eine Datei:** `shared/minds-design-tokens.css` (v0.2; bisher nur in der App) laden jetzt alle Seiten zuerst: Anmeldung, App, Romy Live, Terminplan, Kostenberechnung, Projektdokumente, Produktbibliothek, Projektstart-Muster, beide Anleitungen, OAuth-Zustimmung. Neu darin: das eine Blau `#0062cc` mit Hover, Tönung, Linie und Ring; Statusfarben mit Tönung (ok, Achtung, Fehler, Entscheidungspunkt); Flächen, Linien, Feldrand; `accent-color` für Häkchen und Optionsfelder. Die Seiten-Variablen (`--kb-*`, `--pd-*`, `--pb-*`, `--a-*`, Terminplan, Assistent) verweisen nur noch darauf; `style.css` legt keine eigenen Farben mehr fest.
  - **Blau = klickbar:** Hauptaktionen in Kostenberechnung, Projektdokumenten und Produktbibliothek, «+ Neues Projekt», Romy Live und die Grundregeln der App (`.primary`, Senden, abgehakte Aufgabe, gewählter Tag, aktive Umschalter) waren schwarz und sind blau; ebenso gewählte Chips und Pillen, der aktive Reiter der Kostenberechnung, Häkchen und die Zurück-Links. Die schwarze Auswahl-Leiste in Projektdokumenten ist hellblau.
  - **Ein Blau statt vier:** `#007aff` (App), `#355d99` (Links der Werkzeuge), `#1769d4`/`#0067d8` (Assistenten) und ihre Tönungen sind `#0062cc`; Hinweise (Quellen, Info-Banner, «In Bearbeitung») tragen ein dunkleres Blau derselben Familie.
  - **Kein Grün als Dekor:** `projektstart.html` ist neutral mit blauen Links und hellblauen Knöpfen zum Herunterladen; Romys Vorschläge in Projektdokumenten sind blau getönt wie in den Assistenten (Hinweistext «blau markiert»). Grün bleibt nur für «erledigt» und für Eingefügtes im Vergleich (Gestrichenes rot).
  - Schrift: überall die Systemschrift aus der Datei (Projektstart, Romy Live und OAuth hatten eigene Listen); der Terminplan druckt weiter in Arial.
  - Romy Live: `app/live/live.css` ist die gepinnte Kopie aus Window und bleibt unverändert; das Office färbt in `app/live/live-office.css` darüber.
  - Regel in `AGENTS.md`; `tests/office-gestaltung.test.mjs` prüft: Tokens zuerst auf jeder Seite, keine eigenen Grundfarben, kein altes Blau, keine schwarze Aktion oder Auswahl, Häkchen blau, Projektstart ohne Grün.
- Archivos: `shared/minds-design-tokens.css` (`v=2`), `style.css` (`office26`), `kostenberechnung.css` (`office11`), `projektdokumente.css` (`office4`), `projektdokumente.js` (`office4`, nur der Hinweistext), `produktbibliothek.css` (`office3`), `anleitung.css` (`office6`), `assistant-surface.css` (`office39`), `window-editor.css` (`v=2`), `terminplan.html`, `projektstart.html`, `oauth-consent.html`, `app/live/index.html`, `app/live/live-office.css` (neu), in `app/`: `app.css` (`71`), `design-system.css` (`9`), `office.css` (`office44`), `work-polish.css` (`5`), `work-apple.css`, `minds-unified-surface.css`, `minds-calendar-shell.css`, `minds-sections-parity.css`, `minds-detail-parity.css`, `chat-apple-finish.css`, `daily-controls.css`, `mobile-refinement.css`, `ahora-bandeja.css`, `task-detail.css`, `time-plan.css`, `voice-output.css` (je eine Version höher), `AGENTS.md`; Tests angepasst (Farben und Versionen) und neu `tests/office-gestaltung.test.mjs`.
- Base de datos: keine Änderung.
- Deploy de funciones: keiner.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (429); Chromium lokal grün (alle 14 Dateien, 61 Tests); Bildschirmfotos aller Seiten mit Attrappen vorher und nachher verglichen (Planner, Kalender, Werkzeuge, Projekte, Kostenberechnung, Projektdokumente mit Auswahl, Produktbibliothek, Projektstart, Anleitungen, Anmeldung).
- Quedó pendiente o sin probar: **Formen nur zum Teil:** die Datei enthält die Radien, viele Bauteile haben ihren Radius aber noch von Hand (8–18 px); sichtbar ist das kaum, eine zweite Runde nur, wenn Gari es will. In der iPhone-App nicht angesehen.
- Riesgos o decisiones que necesitan a Gari: Statusfarben bleiben getönt (grün erledigt, bernstein Achtung, rot Fehler, violett Entscheidungspunkt des Auftraggebers); Zahlenkreise in Anleitungen und Projektstart sind dunkel, weil man sie nicht anklickt.
- PR: #156

### 2026-11-24 · Kostenberechnung: Kostenstand bis heute, Vollständigkeit ohne Vorbelegung, Reiter ohne doppelten Titel · Claude
- Qué cambió y por qué: Garis Rückmeldung zur Kostenberechnung von Bernried (24.11.2026):
  - **Kostenstand:** die Auswahl bot Quartale bis Ende des nächsten Jahres. Jetzt höchstens das laufende Quartal (auch für den Index und den Kostenstand eines Kennwerts); ein schon gespeicherter Wert bleibt wählbar. Das laufende Quartal bleibt, auch wenn Destatis den Index dafür noch nicht veröffentlicht hat: der Kostenstand ist nach DIN 276 der Zeitpunkt der Ermittlung, und die Kostenberechnung schreibt bis zum letzten Wert fort (wie seit #144). In der Liste steht dann «Index noch nicht veröffentlicht», darunter ein Hinweis.
  - **Vollständigkeit:** eine neue Kostenberechnung zeigte 14 % (34 von 239 geklärt), ohne dass etwas geklärt war: das waren die vom Muster als «entfällt» vorbelegten Kostengruppen (KG 100, 800 und acht im Hochbau seltene). Unverändert zählen sie nicht mehr mit, weder geklärt noch zu klären; die Karte sagt, wie viele vorbelegt sind. «Für dieses Projekt bestätigen» (an der Kostengruppe und in «Quellen») oder eine geänderte Begründung macht sie zur Entscheidung des Projekts; dann zählen sie. Marke `vorbelegt` ab dem Anlegen; ältere Kostenberechnungen bekommen sie beim Laden, wo der Eintrag noch genau dem Muster entspricht (nichts in der Datenbank geändert).
  - **Im Reiter von Work:** ohne «Office · Kostenberechnung» und ohne den Projektnamen als zweite Überschrift; die Zeile mit LPH, Norm und Kostenstand bleibt. Der Terminplan nennt im Reiter in seiner Kopfzeile nur die Phase.
  - Formulare: ein Feld neben einem mit Hinweis wurde in die Höhe gezogen; jetzt nicht mehr.
- Archivos: `kosten-rechnen.js` (`office6`) und die Kopie in `supabase/functions/office-kosten-ai/`, `kostenberechnung.js` (`office13`), `kostenberechnung.css` (`office10`), `kostenberechnung.html`, `projektdokumente.html` (Version des Rechenkerns), `kostenberechnung-hilfe.html`, `terminplan.html`; Tests: `tests/office-kostenberechnung.test.mjs` (2 neu), `tests/browser/office-kostenberechnung.chromium.mjs` (neuer Ablauf: 0 %, ältere ohne Marke, Kostenstand, bestätigen), Anpassungen in `office-work-reiter`, `office-terminplan-reiter`; die Attrappe `fake-supabase-kosten.js` liest `alias:spalte->schlüssel` wie PostgREST.
- Base de datos: keine Änderung (nur gelesen: das Muster markiert 10 Kostengruppen, die Kostenberechnung von Bernried entspricht ihm noch, Revision 1).
- Deploy de funciones: `office-kosten-ai` (gleicher Rechenkern wie die Seite; nach dem Merge über den Workflow).
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (425); Chromium lokal grün: Kostenberechnung (13), Terminplan im Rahmen (2), Fenster der Assistenten (3), Kostenarchiv (5), Projektstart-Dokumente (8 + 1); Bildschirmfotos von Übersicht, Quellen und Reiter.
- Quedó pendiente o sin probar: mit Garis Sitzung in Bernried.
- Riesgos o decisiones que necesitan a Gari: —
- PR: #155

### 2026-11-24 · Ein Fenster für alle Assistenten (Terminplan, Kostenberechnung) · Claude
- Qué cambió y por qué: Gari (24.11.2026): «sí a una sola apariencia para los dos y los que vengan. Me gusta más como está en Terminplan … debería de poder moverse también y no estar siempre estable en la esquina».
  - **Gemeinsames Fenster** `assistant-window.js` (neu) mit `assistant-surface.css` v0.8: zu ein Reiter unten rechts, offen ein schwebendes Fenster über der Seite, ⤢ vergrößert. Neu: **offen und zu am Kopf verschiebbar** (erst ab einigen Pixeln, ein Klick öffnet weiter; nach dem Ziehen öffnet der Reiter nicht), **Größe an der freien Ecke** (die gemerkte Ecke bleibt stehen). Gemerkt wird je Werkzeug und Gerät die nächste Bildschirmecke mit Abstand: das Fenster öffnet aus seinem Reiter zur Bildschirmmitte und schließt wieder in den Reiter; passt es nicht ganz, rückt es so wenig wie nötig ein. Am Telefon bleibt es unten über die Breite, ohne Verschieben. Escape schließt wie bisher.
  - **Terminplan:** das eigene Verschieben (nur offen, links oben gemerkt), `resize:both` und `office-plan-assistant-window-v1` entfallen; Inhalt, Gespräch und «↗ eigenes Fenster» bleiben.
  - **Kostenberechnung:** das Gespräch steht im selben Fenster («Kosten Assistent», «Kostenberechnung Gespräch»), in den Farben und Formen des Terminplan-Gesprächs (Blasen, Eingabe, «Senden», Vorschlagskarte); die Tabelle rückt nicht mehr zur Seite. Der Knopf «Assistent» im Kopf entfällt (der Reiter öffnet). Offene Details gehen weiter vor: das Fenster tritt zurück und kommt danach im selben Zustand wieder. Nicht im Muster und nicht im Archiv.
  - Anleitungen: Kostenberechnung (Teil VI) und Terminplan (Kapitel 8) beschreiben das Fenster; die schematische Abbildung des Gesprächs in den neuen Farben.
- Archivos: `assistant-window.js` (neu, `v=1`), `assistant-surface.css` (`office38`), `terminplan.html`, `kosten-assistent.js` (`office4`), `kostenberechnung.js` (`office12`), `kostenberechnung.css` (`office9`), `kostenberechnung.html`, `kostenberechnung-hilfe.html`, `terminplan-hilfe.html`, `anleitung.css` (`office5`); Tests: `tests/office-assistent-fenster.test.mjs` (neu, 3), `tests/browser/office-assistent-fenster.chromium.mjs` (neu, 3: Terminplan verschieben zu und offen, Größe, gemerkt; Kostenberechnung im selben Fenster, je Werkzeug gemerkt, Details gehen vor; iPhone), angepasst: `office-kostenberechnung.chromium.mjs` (Reiter statt Knopf), `office-kosten-assistent`, `office-37-acceptance`, `terminplan-assistant-v06`, `office-kostenberechnung`, `office-work-reiter`; `.github/workflows/verify-romy-browser.yml` führt den neuen Test aus.
- Base de datos: keine Änderung.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (423); Chromium lokal grün: Fenster der Assistenten (3), Kostenberechnung (12), Terminplan im Rahmen (2), Planner-Karten (5), Start, Muster-Planner, Terminplan-Abgleich, Planner-Board, Kostenarchiv; Bildschirmfotos von Reiter und offenem Fenster beider Werkzeuge.
- Quedó pendiente o sin probar: auf dem iPhone und dem iPad in der App (Ziehen mit dem Finger ist nur am Desktop geprüft; am Telefon ist es abgeschaltet). Eine vorher im Terminplan gemerkte Stelle gilt nicht mehr (der Reiter beginnt wieder unten rechts).
- Riesgos o decisiones que necesitan a Gari: —
- PR: #154

### 2026-11-24 · Reiter Terminplan und Kostenberechnung in Work, Status als Etikett, Bucket-Info · Claude
- Qué cambió y por qué: Garis Rückmeldung zu #152 (24.11.2026):
  - **Reiter wie Planner und Desktop:** «Terminplan» und «Kostenberechnung» verließen Work; zurück zum Planner ging es nur über Kostenberechnungen → Werkzeuge → Work. Jetzt sind beide Ansichten von Work (`data-work-view`): die Werkzeugseite läuft in einem Rahmen unter den Reitern (`#workToolHost` neben `#workBody`) und bleibt beim Wechsel offen, samt Stelle und offenem Reiter in der Seite. Mehrere Fassungen (z. B. Terminplan LPH 3 und LPH 5): Wahl über der Seite, je Projekt und Gerät gemerkt. Ohne Kostenberechnung: «Kostenberechnung anlegen» im Reiter (die Seite mit `?neu=`; im Rahmen ohne die Liste aller Projekte dahinter, Abbrechen führt zurück); ohne Terminplan: der Dialog «Neuer Terminplan», danach öffnet der Plan im Reiter (`openNewPlan(id,{onCreated})`). Die Terminpläne im Panorama öffnen ebenfalls den Reiter (mit gedrückter Taste bleibt es ein Link).
  - **Sicher beim Wechsel:** Bevor Work einen Rahmen schließt (anderes Projekt) oder eine andere Fassung lädt, speichert die Seite, was aussteht (`window.TBA_OFFICE_TOOL.flush`, neu in `terminplan.html` und `kostenberechnung.js`, mit `revision` und `pending`). Hat inzwischen jemand anderes gespeichert, lädt der Reiter beim nächsten Öffnen neu, wenn nichts aussteht und niemand in der Seite arbeitet; sonst gilt das bisherige Speichern auf die erwartete Revision.
  - **Im Rahmen:** kein Rücksprung-Link («‹ Terminpläne», «‹ Werkzeuge», «‹ Kostenberechnungen»); ohne Anmeldung oder ohne gewählten Plan eine Meldung statt eines Sprungs zur Startseite oder in die App (sonst stünde die App im Rahmen). In der iPhone-App nimmt die Brücke nur Nachrichten des Hauptrahmens an (`WindowNativeBridge.swift`: `frame.isMainFrame`); die Seite im Rahmen leiht deshalb die Brücke der App (`shared/supabase-client.js`, `office4`); die App bleibt die einzige Besitzerin der Sitzung.
  - **«In Bearbeitung»:** Gari wählt Vorschlag A. Der Status steht als Etikett neben dem Datum (blau «In Bearbeitung», bernsteinfarben «Wartet»); der Kreis ist wieder nur zum Erledigen, ohne Halbfüllung und Pausezeichen.
  - **Beschreibung der Buckets:** nahm unter jedem Titel viel Platz. Jetzt beim Zeigen auf den Titel als schwebender Hinweis (die Karten bleiben stehen) oder über «Info» im Menü «•••» fest unter dem Titel, bis man sie ausblendet (auch nach dem Neuzeichnen; auf dem Telefon ohne Zeiger). Im Muster-Planner bleibt sie sichtbar.
- Archivos: `app/work.js` (`office53`), `app/shell.js` (`office54`), `app/office-projects.js` (`office58`), `app/work-polish.css` (`v=4`), `app/work-buckets.css` (`v=4`), `app/index.html`, `terminplan.html`, `kostenberechnung.js` (`office11`), `kostenberechnung.css` (`office8`), `kostenberechnung.html`, `shared/supabase-client.js` (`office4`, Version in allen sieben Seiten); Tests: `tests/office-work-reiter.test.mjs` (neu, 5), `tests/browser/office-terminplan-reiter.chromium.mjs` (neu, 2: echte Terminplan-Seite im Rahmen, Sitzung über die Brücke der App), `tests/browser/office-kostenberechnung.chromium.mjs` (neuer Ablauf im Rahmen), `tests/browser/office-planner-karten.chromium.mjs` (Etikett, Reiter, Bucket-Info), Texte und Versionen in Node-Tests; `.github/workflows/verify-romy-browser.yml` führt den neuen Terminplan-Test aus.
- Base de datos: keine Änderung.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (420); Chromium lokal grün: Planner-Karten (5: Etikett, Checkliste, Filter, Reiter mit Wechsel, Fassungswahl, Speichern vor dem Wechsel, Neuladen nach fremdem Speichern, Anlegen und Abbrechen; Bucket-Info), Kostenberechnung (12, davon neu: im Rahmen mit geliehener Brücke, ohne Rücksprung, Abbrechen gemeldet, Speichern auf Zuruf), Terminplan im Rahmen (2), Start, Muster-Planner, Terminplan-Abgleich, Planner-Board; Bildschirmfotos am Desktop und in iPhone-Breite.
- Quedó pendiente o sin probar: auf dem iPhone in der App (die geliehene Brücke ist nur mit einer Attrappe geprüft). Die Assistenten bekommen eine gemeinsame Oberfläche (eigener PR).
- Riesgos o decisiones que necesitan a Gari: —
- PR: #153

### 2026-11-24 · Planner-Filter, Reiter Terminplan und Kostenberechnung, kleine Anpassungen · Claude
- Qué cambió y por qué: Garis OK zum Vorschlag (24.11.2026, «sí construye el filtro») und drei Anpassungen aus derselben Nachricht:
  - **Filter im Planner:** über den Buckets «Alle / Nur meine», «Person», «Status», «Fällig» (überfällig, diese Woche, ohne Datum). Persönlich: er ändert nur, was man selbst sieht, je Projekt und Gerät gemerkt, und schreibt nichts. «Nur meine» folgt der Regel von Heute (Gari, 23.11.2026): verantwortlich, oder ohne Verantwortliche und selbst angelegt; dafür lädt der Planner den Ersteller (`user_id`) mit. Nicht passende Karten bleiben ausgeblendet im Bucket, damit Ziehen die Reihenfolge des ganzen Buckets behält; der Bucket zeigt «3 / 5», ein leerer Bucket «Keine passenden Aufgaben», die Leiste «3 von 5 Aufgaben» und «Filter zurücksetzen». Eine gemerkte Person, die nicht mehr im Team ist, fällt auf «Alle» zurück.
  - **Reiter Terminplan und Kostenberechnung** in Work neben Planner (nur bei Projekten): öffnen direkt die des Projekts; bei mehreren eine kurze Wahl (Phase, Stand); ohne Kostenberechnung öffnet sich «Kostenberechnung anlegen» mit dem Projekt vorgewählt (`kostenberechnung.html?neu=<Projekt>`, einmalig), ohne Terminplan der Dialog «+ Terminplan».
  - **«Kostenberechnung anlegen»:** der graue Hinweis, wer sie sieht und fortschreibt, steht nicht mehr im Dialog (die Anleitung erklärt es weiter).
  - **Assistent der Kostenberechnung:** «auf Deutsch oder Spanisch» steht nicht mehr im Einstieg und nicht mehr in der Anleitung; er versteht weiter beide Sprachen.
  - Für das Zeichen «In Bearbeitung» (Gari gefällt der halb gefüllte Kreis nicht) gingen vier Vorschläge an Gari (Etikett, Punkt mit Wort, Farbkante, Ring), nach Jira, Notion, Trello, Linear und GitLab; noch nichts geändert.
- Archivos: `app/work.js` (`office52`), `app/shell.js` (`office53`), `app/work-polish.css` (`v=3`), `app/index.html`, `kostenberechnung.js` (`office10`), `kosten-assistent.js` (`office3`), `kostenberechnung.html`, `kostenberechnung-hilfe.html`; Tests: `tests/browser/office-planner-karten.chromium.mjs` (Filter, Reiter), `tests/browser/office-kostenberechnung.chromium.mjs` (`?neu=`), Texte und Versionen in Node-Tests.
- Base de datos: keine Änderung.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (415); Chromium lokal grün: Planner-Karten mit Filter und Reitern (4), Kostenberechnung mit `?neu=` (11), Start, Muster-Planner, Terminplan-Abgleich, Planner-Board; Bildschirmfotos der Filterleiste am Desktop und in iPhone-Breite.
- Quedó pendiente o sin probar: auf dem iPhone in der App. Zeichen für «In Bearbeitung»: Gari wählt. Die beiden Assistenten (Terminplan, Kostenberechnung) sehen verschieden aus, weil sie getrennt entstanden sind; eine gemeinsame Oberfläche ist als Vorschlag offen.
- Riesgos o decisiones que necesitan a Gari: Zeichen für «In Bearbeitung»; ob die Assistenten eine gemeinsame Oberfläche bekommen.
- PR: #152

### 2026-11-24 · Planner-Karten: alle Verantwortlichen, Status, Checkliste · Claude
- Qué cambió y por qué: Garis Wünsche zu den Karten (24.11.2026), mit Recherche (Microsoft Planner, Avatargruppe im Fluent-Design, Linear, GitLab):
  - **Alle Verantwortlichen:** die Karte bildete die Initialen aus dem ganzen Namensstring, bei zwei Personen also nur den Kreis der ersten. Jetzt ein Kreis je Person, überlappend und farblich unterschieden, die erste vorn; ab fünf Personen drei Kreise und «+N», wie die Avatargruppe von Microsoft. Die Initialen kommen aus dem Namen im Team (ein Name aus einem Wort ergibt einen Buchstaben).
  - **Status auf der Karte:** «In Bearbeitung» als halb gefüllter Kreis wie in Microsoft Planner, «Warten» als Pausezeichen (der vierte Status des Office); Titel und Bildschirmleser nennen den Status. Ein Klick erledigt weiterhin.
  - **Checkliste in den Details:** lange Punkte brechen um, das Feld wächst mit dem Text (vorher einzeilig abgeschnitten); Punkte lassen sich am Griff ziehen (Maus und Finger) oder mit Alt + Pfeil nach oben/unten verschieben; Enter legt den nächsten Schritt darunter an; Zeilenumbrüche werden beim Speichern zu Leerzeichen. Auf der Karte steht der Kreis langer Punkte an der ersten Zeile.
- Archivos: `app/work.js` (`office51`), `app/task-detail.js` (`office5`), `app/task-detail.css` (`v=4`), `app/work-polish.css` (`v=2`), `app/index.html`; Test `tests/browser/office-planner-karten.chromium.mjs` (neu, 2 Abläufe); `.github/workflows/verify-romy-browser.yml` führt jetzt auch `office-planner-board` und `office-planner-karten` aus; Versionen in sieben Tests.
- Base de datos: keine Änderung.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (415); Chromium lokal grün (Start, Muster-Planner, Terminplan-Abgleich, Planner-Board, die neuen Karten-Abläufe, Projektstart: 21); dazu das Ziehen mit dem Finger (emulierter Touch, iPhone-Breite) und Bildschirmfotos von Karten und Checkliste.
- Quedó pendiente o sin probar: auf dem iPhone in der App. Steht eine Person nur mit dem Vornamen im Office, zeigt ihr Kreis einen Buchstaben. Weitere Ansichten des Boards (Filter nach Person und Status, Gruppieren nach Verantwortlich oder Status) sind als Vorschlag an Gari gegangen, nicht gebaut.
- Riesgos o decisiones que necesitan a Gari: welche Ansichten das Board bekommt.
- PR: #151

### 2026-11-24 · Abgleich: Gelöschtes verschwindet für alle · Claude
- Qué cambió y por qué: Garis OK (24.11.2026, «sí, corrígelo») zum Befund aus #149. `mergeRemoteEntities` in `app/sync.js` behielt jeden lokalen Eintrag, den der Server nicht mehr lieferte. Folgen: (1) eine gelöschte Projektaufgabe blieb im Kalender des Teams stehen, denn Grabsteine gelten nur für die eigene Person; (2) löschte man im Planner (direkt auf dem Server, ohne lokalen Grabstein) oder löschte die Projektleitung die Aufgabe einer Kollegin, behielt die lokale Kopie der Autorin sie, und der nächste Push legte sie neu an (ohne Bucket). Jetzt bleibt ein Eintrag, den der Server nicht mehr liefert, nur, wenn er nie auf dem Server war (ohne `ownerId`: hier angelegt, noch nicht übertragen) oder gerade gespeichert wird; für Aufgaben und Termine. Eine Antwort mit 1000 Zeilen oder mehr kann abgeschnitten sein: dann wird nichts verworfen. «Duplizieren» nimmt `ownerId` und `mine` nicht mehr mit: die Kopie ist ein neuer eigener Eintrag (die Kopie einer fremden Aufgabe wurde bisher nie übertragen).
- Archivos: `app/sync.js` (`office8`), `app/app.js` (`office56`, `duplicateItem`), `app/index.html`; Tests: `tests/office-sync-geloeschte-eintraege.test.mjs` (neu, 6: die echten Funktionen aus `sync.js` an Beispielzeilen), `tests/browser/office-app-boot.chromium.mjs` (neuer Ablauf: lokale Kopie mit gelöschter eigener und fremder Aufgabe, fremdem Termin und neuer Aufgabe; nach dem ersten Abgleich bleiben die Aufgabe vom Server und die neue), Versionen in sechs Tests.
- Base de datos: keine Änderung. Nur gelesen: 70 Aufgaben und 9 Termine im Office; ein Planner-Eintrag ohne Bucket ist ein Test, keine zurückgekehrte Karte. Löschen dürfen Autorin und Projektleitung; einen Grabstein schreibt jede Person nur für sich.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün (415); Chromium lokal grün (Start mit dem neuen Ablauf, Muster-Planner, Planner-Board, Terminplan-Abgleich, Romy: 18). Gegenprobe mit dem alten `sync.js`: 5 der 6 neuen Tests und der neue Chromium-Ablauf schlagen fehl.
- Quedó pendiente o sin probar: mit echten Konten (die Projektleitung löscht die Aufgabe einer Kollegin, die Kollegin öffnet danach das Office). Ein Push, der genau während des Löschens im Planner läuft, kann die Aufgabe noch einmal anlegen (selten; dann erneut löschen). Ab 1000 Zeilen je Abruf fehlt ein seitenweiser Abruf.
- Riesgos o decisiones que necesitan a Gari: —
- PR: #150

### 2026-11-24 · Planner des laufenden Projekts: A5 auf v0.3.5 · Claude
- Qué cambió y por qué: Garis Auftrag (24.11.2026), nach der Bibliothek auch den Planner des laufenden Projekts umzustellen; `L3.MAT.1` und `L3.MUS.1` gelöscht mit seinem OK. Neun A5-Karten tragen jetzt Titel, Prüfpunkte und Bibliotheksangaben von v0.3.5 (`template_version` 0.3.5-draft): `L3.QUA.1`, `L3.MAP.1`, die fünf Themenpakete (Bäder, Treppen, Fassade, Licht, Bodenbeläge), `L3.A5.AUS` und `L3.A5.ABS`. «Fertig, wenn» wurde nur ersetzt, wo noch der Text der Vorlage stand; eine im Projekt geänderte Notiz blieb. `L3.WEI.1` wurde nicht angelegt (kein weiteres Entscheidungsfeld im Projekt), Verantwortliche wurden keine gesetzt: die Projektleitung trägt sie in den Karten ein.
- Archivos: nur `docs/BITACORA.md` und `docs/ESTADO.md`. Das Skript enthält Projektdaten und liegt nicht im Repo.
- Base de datos: keine Migration. Datenänderung in einem einzigen Block mit Vorprüfung (11 Karten vorhanden, keine seit dem Lesen bearbeitet oder abgehakt, `L3.MAT.1`/`L3.MUS.1` ohne Verantwortliche), sonst Abbruch ohne Änderung. Für die zwei gelöschten Karten zuerst Grabsteine in `isabella_deleted_items`. Termine, Terminplan-Verknüpfungen (`executes`), Status, Reihenfolge und Bucket unverändert. Vorher ein Probelauf, der sich selbst zurückrollte; beide Läufe hat Gari im Supabase-Konnektor bestätigt.
- Deploy de funciones: ninguno.
- Cómo se probó: Probelauf mit Zusammenfassung (9 Karten, Prüfpunkte 10/5/10/10/10/10/10/7/7, Verknüpfungen gleich, 2 Grabsteine). Nach dem Lauf je Karte Prüfsummen von Titel, Prüfpunkten, Bibliotheksangaben, Arbeitsergebnis, Anwendbarkeit, fachlichem Kontext und Notiz gegen das aus `app/data/muster-planner-lph3-v0.3.json` erzeugte Skript: 9 von 9 gleich; nichts abgehakt, keine Verantwortlichen; `L3.MAT.1`/`L3.MUS.1` weg.
- Quedó pendiente o sin probar: Ein Grabstein gilt nur für die Person, der die Karte gehört. Wer aus dem Team die beiden Karten schon im Kalender hatte, sieht sie dort womöglich weiter: `mergeRemoteEntities` in `app/sync.js` behält lokale Einträge, die der Server nicht mehr liefert, auch fremde (gilt für jede gelöschte Projektaufgabe, nicht nur hier). Der Planner selbst liest vom Server und zeigt den neuen Stand.
- Riesgos o decisiones que necesitan a Gari: ob `sync.js` fremde Einträge, die der Server nicht mehr liefert, lokal verwerfen soll (kleine Korrektur mit Test).
- PR: #149

### 2026-11-24 · Projektstart: Zahlen der Varianten aus Produktbibliothek, Datenpool und Kostenberechnung · Claude
- Qué cambió y por qué: siguiente paso del plan aprobado por Gari (boceto, 24.11. 06:45; «Continúa como lo has propuesto», 08:30): die Varianten der Entscheidungsvorlage mit Produktbibliothek und Kostenberechnung verbinden; Romy holt Mengen und Beträge mit Fundstelle, wie im Entwurf.
  - **«Zahlen aus dem Office …» je Variante** (Dialog): Produkt suchen und wählen (Stand des Datenblatts, Code im Projekt, Preise), Preis als Kennwert (eingebaute vor Materialpreisen; Materialpreis mit Hinweis), Kennwert aus dem Datenpool (Werte einer Einheit, Spanne, Median, «gleich in N Kostenberechnungen») oder aus einer Position der Kostenberechnung des Projekts, Menge aus der Kostenberechnung des Projekts; «Gewählt» zeigt Kennwert × Menge mit Fundstellen. «In die Musterliste des Projekts» legt die Verwendung in der Produktbibliothek an («vorgeschlagen», nächster Code wie BO-01).
  - **Baupreisindex:** fortgeschrieben auf den Kostenstand der Kostenberechnung des Projekts, ohne sie auf das Quartal von heute mit dem Index des Musters; die Fundstelle nennt die Indexwerte («118,9 → 141,7»), ein noch nicht veröffentlichtes Quartal wie im Rechenkern.
  - **Fundstelle und Beleg:** jede Zahl hat beides. Die Fundstelle (Projekt, Zeile, Stand) bleibt im Büro; das Dokument an den Auftraggeber (Word, PDF, Stand) nennt nur den Beleg, zum Beispiel «Kennwert aus Kostenberechnungen des Büros (Kostenstand 3. Quartal 2022, fortgeschrieben auf 4. Quartal 2026)» – nie ein anderes Projekt. Eine von Hand geänderte Zahl verliert ihre Fundstelle; der Kostenbezug wird beim ersten Wert vorgeschlagen, nie überschrieben.
  - **Romy «Zahlen holen»** (`office-dokumente-ai` v2, Aktion `zahlen`): der Client baut Kandidaten (Produkte mit Preisen, Gruppen des Datenpools, Positionen der Kostenberechnung) mit kurzen Verweisen und ohne Namen anderer Projekte; Romy antwortet nur mit Verweisen, nie mit Zahlen; die Funktion verwirft unbekannte Verweise und Mengen, die keine Position sind; die Varianten liest sie aus der Datenbank. Der Client macht daraus einen Vorschlag mit den geänderten Varianten; erst «Übernehmen» ändert die Zeile.
  - **Korrektur:** ein Vorschlag mit Varianten ersetzte bisher alle Varianten der Zeile (Zahlen gingen verloren); jetzt wird je Variante zusammengeführt (`K.optionenZusammen`), und der Text der Änderung nennt die Felder je Variante.
  - **Nach der Entscheidung:** «In der Produktbibliothek freigeben» setzt das Produkt der gewählten Variante im Projekt auf «freigegeben» (legt die Verwendung an, wenn sie fehlt) und auf Wunsch die übrigen auf «verworfen».
  - Vorlage: Stand des Datenblatts am Bildschirm in der Variantentabelle; «Zahlen und Quellen» mit Fundstellen, offenen Vorschlägen und «Romy: Zahlen für E-… holen».
- Archivos: `projektdokumente-zahlen.js` (neu, rein), `projektdokumente-kern.js` (`office3`: Felder der Varianten, `optionenZusammen`, `optionenAenderung`, `belegText`, `fundstellenText`), `projektdokumente.js` (`office3`), `projektdokumente.css` (`office3`), `projektdokumente.html` (lädt `kosten-rechnen.js`, `kosten-pool.js`, `projektdokumente-zahlen.js`), `supabase/functions/office-dokumente-ai/{core.mjs,index.ts}` (v2), `.github/workflows/verify-romy-browser.yml`; Tests: `office-projektdokumente-zahlen` (neu, 9), `office-dokumente-ai` (Zahlen holen), `office-projektdokumente` (Dateien, Versionen), Chromium `office-projektdokumente-zahlen` (neu) mit erweiterter Fixture.
- Base de datos: keine Migration. Gelesen wird unter der vorhandenen RLS (Produktbibliothek und Kostenberechnungen für das ganze Office); Verwendungen schreibt das Projektteam.
- Deploy de funciones: `office-dokumente-ai` v2 über den Workflow nach dem Merge.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` grün; Chromium lokal: neuer Ablauf (Produkt, Preis fortgeschrieben 185,00 → 189,69 €/m², Menge aus der Kostenberechnung, Musterliste BO-01, Romy für B mit einem erfundenen Verweis für A, der wegfällt, Mehrkosten 10.218,60 € netto, Dokument ohne andere Projekte, Freigabe) und die bisherigen 8 Abläufe.
- Quedó pendiente o sin probar: mit echten Daten. Die Produktbibliothek hat 33 Einträge ohne Datenblatt; das laufende Projekt hat noch keine Kostenberechnung, Mengen kommen also erst mit ihr. Dass die Kostenberechnung danach mit der entschiedenen Variante rechnet (Rückschreiben), ist noch nicht gebaut. Briefkopf für Word und PDF (kommt von Gari).
- Riesgos o decisiones que necesitan a Gari: An Romy gehen Bezeichnungen aus alten Kostenberechnungen (ohne Projektnamen) und Produktnamen.
- PR: #148

### 2026-11-24 · Aufgabenbibliothek LPH 3 v0.3.5: Themenpakete von einer Person · Claude
- Qué cambió y por qué: Garis Beobachtung (24.11.2026): Im Büro macht eine Person ein Paket komplett – die Bäder samt «Materialien und Produkte recherchieren und Varianten bewerten» und «Muster beschaffen, prüfen und dokumentieren» für die Bäder, ebenso die Treppen. A5 schnitt dieselbe Matrix zweimal (Themenkarten als Zeilen, `L3.MAT.1` und `L3.MUS.1` als Spalten); jede Zelle stand in zwei Karten, und `L3.MUS.1` wartete auf alle Themen. Vorschlag am 24.11. an Gari, von ihm bestätigt («OK»; «weitere» nach meinem Kriterium):
  - Jedes **Themenpaket gehört einer Person**, vom Plan bis zur Entscheidungsvorlage: Umfang und Grenzen zu den Nachbarpaketen, Pläne des Themas, mindestens zwei Varianten je Entscheidungsfeld, Vergleich mit Empfehlung und Preis mit Quelle und Datum, Muster angefragt, Muster geprüft und mit Referenzcode in der Musterliste, Schnittstellen, Codes und Kostenwirkung, Entscheidungsvorlage des Pakets (je 10 Prüfpunkte; Baustein THEMA erweitert). Titel kurz: «Themenpaket Bäder», «… Treppen», «… Fassade», «… Licht», «… Bodenbeläge».
  - **`L3.MAT.1` und `L3.MUS.1` entfallen** (Codes werden nicht neu vergeben). `L3.QUA.1` ordnet jedes Entscheidungsfeld genau einem Paket zu, je Paket eine Person (von der Projektleitung benannt), und setzt die gemeinsamen Regeln (Referenzcodes und Musterliste, Vergleichskriterien, Preis mit Quelle und Datum, Form der Vorlage, produktneutral bei öffentlichem Auftraggeber). `L3.A5.AUS` gleicht die Pakete untereinander ab und beurteilt die Muster gemeinsam.
  - **Neu `L3.WEI.1` «Themenpaket weitere Entscheidungsfelder»:** ohne `L3.MAT.1` hätten Felder ohne eigenes Thema (Wände und Decken, Türen, Einbauten, Küche) niemanden; die Karte wird im Projekt nach dem Thema benannt (P-THE «weitere»).
  - `L3.MAP.1` führt die Codes der Pakete zusammen (der Boden kommt aus dem Belagsplan) und braucht deshalb die Pakete. Nebenbei: `BOD.1` fehlte im Lieferumfang von A5.
- Archivos: `scripts/lph3-bibliothek/lib.py` (A5, Ergebnisregister ohne MAT/MUS mit WEI, Baustein THEMA, P-THE, P-MUS, P-AGT), `scripts/lph3-bibliothek/build.py` (v0.3.5, Stand 24.11.), `app/data/muster-planner-lph3-v0.3.json` (neu erzeugt: 52 Aufgaben, 366 Prüfpunkte, A5 10), `docs/LPH3-AUFGABENBIBLIOTHEK-v0.3.md`, `app/office-projects.js` (Kartentext v0.3.5 · 52), `app/index.html` (`office-projects.js?v=office57`), `terminplan-hilfe.html` (Teil IV: v0.3.5, 52/366, A5 mit 10, Text zur Bemusterung), `projektstart.html` (v0.3.5); Tests: beide Muster-Planner-Tests (Pakete mit Varianten, Muster, Musterliste, Vorlage und LPH 5; keine MAT/MUS; QUA.1 verteilt, A5.AUS gleicht ab), `office-kostenberechnung`, `office-produktbibliothek` (Version), Chromium `office-musterplanner` (52 Karten, Bäder mit 10 Prüfpunkten).
- Base de datos: keine Migration. Der Planner des laufenden Projekts wird in einem eigenen Schritt umgestellt (neun Karten auf den neuen Text, MAT.1 und MUS.1 gelöscht mit Garis OK, Verknüpfungen und Termine bleiben); der erste Probelauf wartete auf die Bestätigung im Supabase-Konnektor und lief nicht.
- Deploy de funciones: ninguno.
- Cómo se probó: `build.py` alle Prüfungen OK (52 Codes, jeder Stand genau einmal erzeugt, zyklenfrei, zeitlich konsistent, Konkordanz vollständig: BEM-03 bis -06 jetzt in den Paketen); `node --test tests/*.test.cjs tests/*.test.mjs` grün.
- Quedó pendiente o sin probar: Planner des Projekts (siehe oben); Prüfpunkte, die nur unter einem Parameter gelten (Muster bei P-MUS = nein), stehen weiter im Text statt als Bedingung.
- Riesgos o decisiones que necesitan a Gari: Die Zuweisungen der Pakete macht Gari selbst in den Karten.
- PR: #147

### 2026-11-24 · Projektstart: Romy propone en las listas y en la Entscheidungsvorlage · Claude
- Qué cambió y por qué: segunda parte de lo aprobado por Gari (24.11., 06:45): Romy como en los programas de IA investigados (propuestas con Fundstelle, nada cambia sin «Übernehmen», historial de quién propuso y quién aceptó).
  - **«Romy fragen»** en la Klärungsliste y la Entscheidungsliste: lee un protocolo, una mail o un plano (PDF, imagen o texto pegado) y propone filas nuevas y cambios a filas existentes, cada uno con Fundstelle. Quedan en verde en la lista para todo el equipo hasta que alguien pulsa «Übernehmen» o «Verwerfen» (uno a uno o todos). Lo aceptado lleva «R» y el historial dice «Vorschlag von Romy (Fundstelle), übernommen von …».
  - **Sobre filas seleccionadas:** formular la pregunta a los Fachplaner (texto para copiar o abrir como mail), comprobar plazos con el Terminplan (propuestas con Fundstelle «Terminplan: …»), redactar la confirmación en Textform de una decisión, hacer una pregunta.
  - **Entscheidungsvorlage:** Romy reformula un apartado según un encargo; se ve verde lo añadido y rojo lo quitado, con «Übernehmen» o «Verwerfen».
  - **Nunca una decisión:** los esquemas de la función no tienen los campos de decisión, la comprobación los quita, el cliente también y la base de datos rechaza una propuesta con ellos.
  - La migración del PR #145 se renombró a la versión que registró Supabase (`20261124065338`), como pide la convención de `supabase/migrations/`.
- Archivos: `supabase/functions/office-dokumente-ai/index.ts` y `core.mjs` (nuevos), `supabase/config.toml`, `projektdokumente.js`, `projektdokumente-kern.js` (`office2`, comparación por palabras y resumen de cambios), `projektdokumente.css` (`office2`), `projektdokumente.html`, `supabase/migrations/20261124065338_office_projektdokumente_v1.sql` (renombrada), `tests/office-dokumente-ai.test.mjs` (nuevo), `tests/office-projektdokumente.test.mjs`, `tests/sql/office-projektdokumente-rls-acceptance.sql`, `tests/browser/office-projektdokumente.chromium.mjs`, `tests/browser/fixtures/fake-supabase-dokumente.js`, `docs/ESTADO.md`.
- Base de datos: ninguna nueva (las tablas de propuestas y la cuota están desde el #145).
- Deploy de funciones: `office-dokumente-ai` con el workflow «Deploy Supabase Edge Functions» tras el merge (usa el secreto `TBA_OFFICE_OPENAI_API_KEY` que ya existe).
- Cómo se probó: 5 tests nuevos de la función (esquemas estrictos y sin campos de decisión, Fundstelle obligatoria, sin duplicados, solo campos cambiados, fechas y siglas válidas, lee bajo RLS, cuenta cada consulta y no escribe); recorrido en Chromium 8/8 con un Romy sintético (propuestas, aceptar, descartar, historial con Fundstelle, Terminplan, pregunta a los Fachplaner, Entscheidungsliste sin decisión, apartado de la Vorlage en verde y rojo); 399 tests unitarios.
- Quedó pendiente o sin probar: la respuesta del modelo real con un protocolo de verdad (se prueba en producción con el primer protocolo); los importes de la Kostenberechnung y los productos de la Produktbibliothek en las variantes de la Vorlage (siguiente paso); el Briefkopf.
- Riesgos o decisiones que necesitan a Gari: las propuestas de Romy las ve todo el equipo del proyecto (como sugerencias en un documento compartido), no solo quien preguntó.
- PR: #146

### 2026-11-24 · Projektstart: Klärungsliste, Entscheidungsliste y Entscheidungsvorlage como documentos del proyecto · Claude
- Qué cambió y por qué: Gari (24.11., 06:45) aprobó el boceto «Projektstart im Office» y pidió avanzar como se propuso: las Bürovorlagen como documentos del proyecto, editables en la página, a la manera de los programas de IA (columnas con tipo, propuestas con Fundstelle que solo cuentan con «Übernehmen», historial por fila; investigación en el doc del proyecto `claude/tba-office-projektstart-editable.md`). Primer paso:
  - **Listas:** Klärungsliste y Entscheidungsliste con las 16 y 17 columnas de `LPH3_3_Koordination.xlsx`, cada una con su tipo; vista compacta (8) o todas; filtros con contador, disciplina, Runde y búsqueda; edición en la celda (Enter y Tab saltan a la siguiente); panel de detalles con todos los campos, enlaces e historial por campo (lo escribe la base de datos, no el navegador).
  - **Enlaces:** una Klärung pasa a tarea del Planner; un Entscheidungspunkt pasa a la Entscheidungsliste (aviso «wartet» con «Als E-0x übernehmen»); una o varias Entscheidungen forman una Entscheidungsvorlage.
  - **Entscheidungsvorlage:** secciones 1–7 como la plantilla Word, textos editables dentro del documento, variantes con producto, Kennwert × Menge o importe y fuente, Mehrkosten neto y bruto; «Als vorgelegt markieren» pone las Entscheidungen en «vorgelegt» y guarda un Stand inmutable.
  - **Regla:** «entschieden» solo con fecha, quién decide y la decisión (diálogo); la base de datos lo exige y rechaza que una propuesta de Romy toque esos campos.
  - **Salida:** Excel con la estructura de la Bürovorlage (fórmula «überfällig», listas, filtro, A3 apaisado), Word A4 con pie y número de página, PDF imprimiendo; sin librerías.
  - La tarjeta «Projektstart» de Werkzeuge abre ahora los documentos; el Muster con las cinco plantillas sigue en `projektstart.html` («Muster ansehen»), que enlaza a los documentos.
- Archivos: `projektdokumente.html`, `projektdokumente.js`, `projektdokumente.css`, `projektdokumente-kern.js`, `projektdokumente-export.js` (todos `office1`), `projektstart.html`, `app/office-projects.js` (`office56`), `app/shell.js` (`office52`), `app/index.html`, `supabase/migrations/20261124090000_office_projektdokumente_v1.sql`, `tests/office-projektdokumente.test.mjs`, `tests/sql/office-projektdokumente-rls-acceptance.sql`, `tests/browser/office-projektdokumente.chromium.mjs`, `tests/browser/fixtures/fake-supabase-dokumente.js`, `tests/office-projektstart.test.mjs`, `tests/office-window-app.test.mjs`, `tests/office-kostenberechnung.test.mjs`, `tests/office-produktbibliothek.test.mjs` (versiones), `.github/workflows/verify.yml`, `.github/workflows/verify-romy-browser.yml`, `docs/ESTADO.md`.
- Base de datos: migración `20261124065338_office_projektdokumente_v1` (seis tablas nuevas con RLS, triggers de número, historial y reglas; nada destructivo) — aplicada en Supabase: sí, tras el merge con el conector (Supabase registró la versión 20261124065338; el archivo se renombró en el PR siguiente), con la prueba RLS en producción dentro de una transacción revertida: igual al resultado esperado, nada quedó.
- Deploy de funciones: ninguno.
- Cómo se probó: prueba RLS nueva (acceso por equipo, numeración, historial, revisión del servidor, «entschieden», propuestas de Romy, Stände inmutables, cuota) en un Postgres local con las migraciones base y en CI; 11 tests unitarios nuevos (columnas y listas leídas de `build_xlsx.py`, fechas, filtros, fusión de cambios simultáneos, Mehrkosten, estructura de la Vorlage, Excel y Word leídos de vuelta); recorrido en Chromium 7/7 (lista en la celda, conflicto fusionado, Planner, Entscheidungspunkt, «entschieden», Vorlage con Word y Stand, Excel, iPhone sin scroll lateral); el Word pasa la validación XSD y el Excel recalcula sin errores en LibreOffice; 394 tests unitarios.
- Quedó pendiente o sin probar: Romy (función `office-dokumente-ai` e interfaz de propuestas) en el siguiente PR; el Briefkopf de la oficina para Word y PDF; imprimir a PDF dentro de la app de Window no se probó; Planliste, Fachplanerbedarf, Projektstartvermerk y Kick-off después.
- Riesgos o decisiones que necesitan a Gari: los documentos los ven el equipo del proyecto, la dirección del proyecto y los admins (como la Kostenberechnung antes del 23.11.); si toda la oficina debe leerlos, es una política más.
- PR: #145

### 2026-11-24 · Kostenberechnung: Baupreisindex de Destatis en el Muster y valor provisional para el trimestre sin publicar · Claude
- Qué cambió y por qué (Gari, 24.11., 05:43: «Baupreisindex, sí agrégalo»): el pool y la Kostenberechnung dejaban los valores antiguos «ohne Baupreisindex unverändert» porque ninguna Kostenberechnung tenía la serie. Además, una Kostenberechnung nueva tiene como Kostenstand el trimestre actual, y Destatis publica unas seis semanas después del mes de referencia: aunque se cargara la serie, el 4.º trimestre de 2026 seguiría «sin índice» hasta enero.
  - **Datos:** en el Muster, la serie oficial Wohngebäude (Neubau, konventionelle Bauart, inkl. USt, 2021 = 100) del 1.er trimestre de 2021 al 3.er trimestre de 2026, 23 valores (Destatis, Konjunkturindikatoren bpr110, Stand 9.10.2026; meses de referencia febrero, mayo, agosto y noviembre como trimestres 1 a 4), y el nombre de la serie corregido (61261-0002, por trimestres; decía 61261-0001, que es por años).
  - **Cálculo:** si un Kostenstand cae después del último valor de la serie, se usa ese último valor, como se hace en la práctica, y la Herkunftskette lo dice («4. Quartal 2026 noch nicht veröffentlicht: gerechnet mit dem letzten Wert, 3. Quartal 2026 (141,7)»). En «Was noch fehlt» sale una sola vez como aviso (no como punto abierto) y el Bericht dice hasta qué trimestre se actualizó. Un hueco en la serie o un trimestre anterior a su inicio sigue siendo «index_fehlt», sin valor sustituto.
  - El pool dice «(Index bis 3. Quartal 2026)» junto al valor actualizado; la Anleitung lo explica.
- Archivos: `kosten-rechnen.js` (`office5`) y su copia `supabase/functions/office-kosten-ai/kosten-rechnen.js`, `kosten-pool.js` (`office3`), `kostenberechnung.js` (`office9`), `kostenberechnung.html`, `kostenberechnung-hilfe.html`, `tests/office-kostenberechnung.test.mjs`, `tests/office-kosten-pool.test.mjs`, `tests/browser/office-kostenarchiv.chromium.mjs`.
- Base de datos: solo datos, sin migración (conector de Supabase): `state.indizes` e `indexReihe` del Muster.
- Deploy de funciones: `office-kosten-ai` (lleva la misma copia del Rechenkern).
- Cómo se probó: test nuevo del cálculo (trimestre sin publicar, los dos trimestres detrás de la serie, hueco, antes del inicio, valor publicado con prioridad, aviso único como «info»); test del pool; recorrido nuevo en Chromium (pool, Herkunftskette, Übersicht, Bericht); 383 tests unitarios; Chromium Kostenarchiv 5/5, Kostenberechnung 10/10, Produktbibliothek 6/6.
- Quedó pendiente o sin probar: los valores nuevos se añaden a mano cada trimestre (el siguiente, noviembre 2026, a principios de enero de 2027). Antes de 2021 no hay valores en el Muster; si una fuente es más antigua, se añaden desde GENESIS 61261-0002.
- Riesgos o decisiones que necesitan a Gari: ninguna; la serie es la de Wohngebäude (para un Bürobau Destatis tiene otra).
- PR: #144

### 2026-11-23 · Kostenarchiv: «Auffällig» señala la fila que no estaba en la suma · Claude
- Qué cambió y por qué: al revisar los datos reales para el informe, 8 de los 9 casos de «Auffällig, bitte prüfen» comparan con una fila que el original no sumaba. En un par, la que se marcaba dependía del orden de la lista, y así la tarjeta podía señalar el valor bueno (un 110 €/m² que sí cuenta, frente a un 11 €/m² fuera de la suma). Además, dos filas iguales de una misma Kostenberechnung hacían que un par saliera dos veces.
  - En un par se marca la fila que no está en la suma; dos filas iguales de una Kostenberechnung cuentan como un valor.
  - La tarjeta dice cuántos casos son filas fuera de la suma, pone primero los casos en que las dos filas cuentan y añade «(dort nicht in der Summe)» cuando lo que no cuenta es la comparación.
- Archivos: `kosten-pool.js` (`office2`), `kostenberechnung.js` (`office8`), `kostenberechnung.html`, `tests/office-kosten-pool.test.mjs`, `tests/office-kostenberechnung.test.mjs`, `tests/browser/office-kostenarchiv.chromium.mjs`.
- Base de datos: ninguna.
- Deploy de funciones: ninguno (Pages al hacer merge).
- Cómo se probó: test nuevo (par en los dos órdenes, dos filas iguales fuera de la suma); falla con el módulo anterior y pasa con el nuevo; 382 tests unitarios; Chromium Kostenarchiv 4/4 y Kostenberechnung 10/10; en local, con los datos reales: 9 casos, 8 con una fila fuera de la suma.
- Quedó pendiente o sin probar: nada nuevo.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #143

### 2026-11-23 · Kostenberechnung: Kostenarchiv y Datenpool «Kennwert aus eigenen Projekten» · Claude
- Qué cambió y por qué (Gari, 23.11., 21:41: «Tienes mi OK. Antes de hacerlo has de nuevo una investigación…»):
  - **Investigación antes de construir** (AVA con Kennwerte propios, BauKoDat, werk-material/CRB, BCIS, BKI, DESTINI, AACE): todos guardan proyectos terminados y sacan Kennwerte, pero casi ninguno dice de dónde sale cada precio ni si un valor es copia de otro. De ahí las reglas: origen en cada valor; el mismo Ansatz copiado en varias Kostenberechnungen cuenta una vez y su Kostenstand es el más antiguo; Reifegrad del documento (Kostenschätzung, Kostenberechnung, Fortschreibung); valores atípicos marcados, nunca quitados (≥ 2,5× o ≤ 1/2,5 de la mediana desde tres valores); Spanne y mediana, sin cuartiles con tan pocos datos; normalizar con el Baupreisindex de la Kostenberechnung de destino; KG emparentadas; Bestand aparte.
  - **Kostenarchiv** al final de Werkzeuge · Kostenberechnungen (`#kostenarchiv`): una fila por Kostenberechnung antigua con Gebäude, Stand, KG 300 netto, je m² BGF, Positionen («n in der Summe») y una barra con la Herkunft der Preise; tres tarjetas: KG 300 je m² BGF, «Übernommen statt neu ermittelt» (Ansätze copiados de una Kostenberechnung a otra) y «Auffällig, bitte prüfen» (misma Leistung, valores muy distintos).
  - **Archiv nur lesen:** una Kostenberechnung archivada se abre con un aviso (documento original, Stand, Reifegrad, notas de la importación), sin edición ni Assistent; las KG sin valor salen como «ohne Ansatz» y las filas que el original no sumaba como «nicht in der Summe».
  - **Datenpool en el Inspektor de cada posición:** «Kennwert aus eigenen Projekten» busca por título en las demás Kostenberechnungen (archivadas y activas) con filtros misma KG / KG emparentadas / todas, Einheit, solo Angebote y solo Neubau; agrupa los valores iguales como una fuente y enseña Spanne, mediana, Kostenstand y dónde está cada valor (Kostenberechnung, fila, «dort: Angebot»). «Als Kennwert übernehmen» pone el valor como «Eigenes Projekt» con su Fundstelle y el Kostenstand del origen, así la cadena del Baupreisindex sigue funcionando. Enlace a la Produktbibliothek con la búsqueda hecha (`produktbibliothek.html?suche=`). Lo que solo se calcula (Putz, Anstrich, Gipskarton, Abdichtung; #141) ya se encuentra aquí.
  - **App · Projekte:** los proyectos archivados van juntos y plegados en «Archiv · N abgeschlossene Projekte», con enlace al Kostenarchiv en vez de «In Work öffnen».
- Archivos: `kosten-pool.js` (nuevo, `office1`), `kostenberechnung.js` y `kostenberechnung.css` (`office7`), `kostenberechnung.html`, `produktbibliothek.js` (`office5`), `produktbibliothek.html`, `app/office-projects.js` (`office55`), `app/office.css` (`office43`), `app/index.html`, `tests/office-kosten-pool.test.mjs` (nuevo), `tests/browser/office-kostenarchiv.chromium.mjs` (nuevo), `tests/office-kostenberechnung.test.mjs`, `tests/office-produktbibliothek.test.mjs`, `tests/office-planner-layout.test.mjs`, `.github/workflows/verify-romy-browser.yml`.
- Base de datos: solo datos, sin migración (conector de Supabase): cuatro proyectos con estado «archiviert» y una Kostenberechnung archivada en cada uno (1.252 posiciones). Tres vienen de los Excel originales siguiendo sus fórmulas de suma (lo que el Excel no sumaba queda «nicht in der Summe»; las sumas de cabecera escritas a mano, como Pauschale) y una del PDF, porque el programa que la hizo ya no está. Las sumas coinciden al céntimo con los documentos (una con +0,02 € de redondeo). Los datos están solo en la base, nada en el repositorio.
- Deploy de funciones: ninguno (Pages al hacer merge).
- Cómo se probó: 381 tests unitarios, 7 nuevos del Datenpool con Kostenberechnungen sintéticas (las copias cuentan una vez, Kostenstand del origen, atípicos, Bestand, BKI brutto → netto, Übernahme con Fundstelle); cuatro recorridos nuevos en Chromium (Kostenarchiv, buscar y übernehmen, Archiv solo lectura, iPhone); el estado de cada Kostenberechnung importada comparado por md5 con la referencia local; el Datenpool probado en local con los datos reales.
- Quedó pendiente o sin probar:
  - importar más Kostenberechnungen antiguas desde el navegador (por ahora a través de Claude);
  - el Muster no trae valores del Baupreisindex: los valores del pool salen «ohne Baupreisindex unverändert» hasta meter los índices de Destatis;
  - a una de las cuatro le falta la BGF (sin «je m² BGF»);
  - probar con sesión real en el iPhone.
- Riesgos o decisiones que necesitan a Gari: los nombres de los cuatro proyectos archivados (se pueden cambiar); revisar los «Auffällig» (varios son filas fuera de la suma del original). En los datos no se borró ni se corrigió nada.
- PR: #142

### 2026-11-23 · Produktbibliothek: Fassade, Wand, Decke und Holzdeck aus den alten Kostenberechnungen · Claude
- Qué cambió y por qué (Gari, 23.11., 20:11: «Avanza como lo has planteado»): criterio acordado — en la Bibliothek va lo que se elige y se enseña al Bauherr; lo que solo se calcula (Putz, Anstrich, Gipskarton, Abdichtung, Gerüst, Zulagen, el Aufbau del Dach) espera al Datenpool. Fenster und Türen, no. Cargadas en la base, desde los Excel originales y la lectura del PDF del edificio existente: Fassade (Außenputz, Putz auf Holzfaser, hinterlüftetes Putzsystem, Metallbekleidung, Fassadenbekleidung de un edificio de oficinas, Lüftungslamellen), Wand (Naturstein, Fliesen, Glaswand, Sauna), Decke (Akustik-, Raster- y Streckmetalldecke) y el Holzdeck exterior en Bodenbeläge (KG 363). Mismas reglas: fila y texto original en la Quelle, Stand, KG, cantidades de una misma Kostenberechnung sumadas, notas donde falta la unidad.
- De paso: la muestra de la tarjeta ya no pinta madera para «Holzfaser» o «Holzwolle», que son aislantes.
- Archivos: `produktbibliothek.js` (`office4`), `produktbibliothek.html`, `tests/office-produktbibliothek.test.mjs`.
- Base de datos: solo datos, sin migración: 14 Leistungen nuevas con 23 Ansätze (ahora 33 entradas y 67 precios); comprobado por categoría.
- Deploy de funciones: ninguno.
- Cómo se probó: tests unitarios; carga en una transacción con comprobación del número de precios.
- Quedó pendiente o sin probar: nada nuevo.
- Riesgos o decisiones que necesitan a Gari: los Bodenaufbau ya cargados (Estrich, Dämmung, Abdichtung, Trockenschüttung) pasan al Datenpool cuando exista.
- PR: #141

### 2026-11-23 · Produktbibliothek: Herkunft beim Namen, KG auf der Karte, Auswahl im Projekt, Foto · Claude
- Qué cambió y por qué (Gari, 23.11., 19:35, con capturas del iPhone):
  - «in keinem laufenden Projekt» se leía como si el precio no viniera de ningún proyecto; hablaba del uso. Ahora la tarjeta dice de qué Kostenberechnungen sale el Ansatz («Ansatz der Kostenberechnung … (2022) · kein Angebot») y, aparte, si está elegido en un proyecto («Noch in keinem Projekt ausgewählt» / «Ausgewählt in …»).
  - **KG en la tarjeta y en el Produktblatt** («KG 324/353»), tomada de los Ansätze; la búsqueda también encuentra «kg 353».
  - **Zu Projekt solo elige:** proyecto, código y nota. Menge y Räume salen del diálogo, porque viven en la Kostenberechnung (y más adelante en Archicad, unidos por el código); el estado de la Bemusterung se cambia en el Produktblatt. Las columnas de la base siguen ahí, sin tocar.
  - **Filtro «Projekt»** en la Bibliothek: enseña solo lo elegido para ese proyecto, ordenado por código, como primera lista de materiales del proyecto.
  - **«Foto hinzufügen»** en el Produktblatt (en el iPhone, cámara o fotos): la foto pasa a ser la muestra de la tarjeta.
- Archivos: `produktbibliothek.js` (`office3`), `produktbibliothek.css` (`office2`), `produktbibliothek.html`, `tests/office-produktbibliothek.test.mjs`, `tests/browser/office-produktbibliothek.chromium.mjs`.
- Base de datos: ninguna.
- Deploy de funciones: ninguno (Pages al hacer merge).
- Cómo se probó: tests unitarios (el diálogo Zu Projekt no pide Menge, Räume ni estado) y los seis recorridos en Chromium (origen con nombres, KG, búsqueda por KG, filtro por proyecto, foto como muestra, Zu Projekt con nota).
- Quedó pendiente o sin probar: subir una foto desde el iPhone real.
- Riesgos o decisiones que necesitan a Gari: ninguno; cargar más categorías desde las KoBes espera su respuesta.
- PR: #140

### 2026-11-23 · Produktbibliothek: Kostenberechnungen zählen, nicht Positionen · Claude
- Qué cambió y por qué: con los datos reales, una tarjeta decía «Ansatz in 5 Kostenberechnungen» para Parkett, que sale de tres: contaba filas, y una Kostenberechnung con el mismo belag sobre la Bodenplatte y sobre los forjados tiene dos. Ahora cuenta Kostenberechnungen distintas. De paso, la muestra de la tarjeta mira solo nombre y familia (una descripción con «vergleichen» daba textura de madera por «eiche»).
- Archivos: `produktbibliothek.js` (`office2`), `produktbibliothek.html`, `tests/office-produktbibliothek.test.mjs`, `tests/browser/fixtures/fake-supabase-produkte.js` (una Kostenberechnung con dos filas), `tests/browser/office-produktbibliothek.chromium.mjs`.
- Base de datos: ninguna.
- Deploy de funciones: ninguno (Pages al hacer merge).
- Cómo se probó: tests unitarios y los seis recorridos en Chromium; la Bibliothek dibujada en local con la forma de los datos cargados (19 tarjetas, sin errores).
- Quedó pendiente o sin probar: nada nuevo.
- Riesgos o decisiones que necesitan a Gari: ninguno.
- PR: #139

### 2026-11-23 · Produktbibliothek (Phase 1): Bibliothek, Datenblatt-Leser, Preise mit Herkunft, Verwendung im Projekt · Claude
- Qué cambió y por qué (Gari, 23.11.: «sí, apruebo el boceto»): herramienta nueva en Werkzeuge, como Programa pero para materiales, empezando por Bodenbeläge. Un producto se registra una vez y se usa en cada proyecto.
  - **Bibliothek** (`produktbibliothek.html`): tarjetas con muestra, precio y su origen (Listenpreis = solo material; Ansatz de una Kostenberechnung = estimación; Angebot o Abrechnung = precio de mercado). Avisos: el mismo Ansatz en varias Kostenberechnungen cuenta como una fuente («seit 2022 unverändert übernommen»), «Spanne × n: Umfang prüfen» desde ×2, «1 Quelle», «Datenblatt geprüft/fehlt», «Bestand». Buscar también en las Merkmale (R10, Cfl-s1), filtrar por origen del precio, ordenar, Archiv. La KG de un Bodenbelag sale del uso: sobre la Bodenplatte KG 324, sobre Decken KG 353.
  - **Datenblatt prüfen und übernehmen:** Romy (Edge Function nueva `office-produkt-ai`, mismo modelo que la Kostenberechnung, `store:false`, sin búsqueda web, sin derechos de escritura) lee un PDF o una imagen de hasta 8 MB y propone producto, Merkmale con su página, lo que el documento no dice («fehlend», nunca adivinado) y los precios que trae. Nada se guarda hasta «Prüfen und übernehmen»; «S. 4» abre el PDF en esa página. Sin lectura se puede tomar a mano, y un documento ya guardado se puede hacer leer después.
  - **Produktblatt:** Technische Daten con página, Dokumente (bucket privado `office-produkte`, ruta persona/entrada/archivo), Preise con Stand, Art, Quelle, KG, proyecto y cantidad, precios de la familia (= Element de la Kostenberechnung) para comparar, y «Verwendet in» con Code por proyecto (BO-01, único en el proyecto) y estado de la Bemusterung.
  - **Permisos:** la Bibliothek es del Office: todo miembro lee, crea y mejora (catálogo común); nada se borra, se archiva. Documentos y precios los cambia o quita quien los puso, o un Admin. El uso en un proyecto lo ve todo el Office y lo cambian Team y Projektleitung.
  - **Projektwissen colectivo (decisión de Gari, 23.11.):** lo que aporta cualquiera del Team de un proyecto lo ve y revisa todo el Team; se queda así (cierra el riesgo anotado en #135).
- Archivos: nuevos `produktbibliothek.html`, `produktbibliothek.js` (`office1`), `produktbibliothek.css` (`office1`), `supabase/functions/office-produkt-ai/` (`core.mjs`, `index.ts`), `supabase/migrations/20261123180000_office_produktbibliothek_v1.sql`, `tests/sql/office-produktbibliothek-acceptance.sql`, `tests/office-produktbibliothek.test.mjs`, `tests/browser/office-produktbibliothek.chromium.mjs`, `tests/browser/fixtures/fake-supabase-produkte.js`; cambiados `app/shell.js` (`office51`, tarjeta y símbolo), `app/office-projects.js` (`office54`), `app/index.html`, `supabase/config.toml`, `.github/workflows/verify.yml`, `.github/workflows/verify-romy-browser.yml`, `tests/office-window-app.test.mjs`, `tests/office-kostenberechnung.test.mjs` (versiones).
- Base de datos: migración `20261123180000_office_produktbibliothek_v1.sql`: cinco tablas nuevas con RLS de los helpers `private.office_*`, un trigger (autor, archivo y proyecto fijos; «geprüft» lo sella la base), una función invoker que cuenta las lecturas, bucket privado de 25 MB con tres policies; nada destructivo — aplicada en Supabase: sí, tras la CI verde y el merge (pg_net desde el commit `697d2db`, md5 `8608eb74…` igual al del repo, registrada en `schema_migrations`). Comprobado en producción: 5 tablas con RLS, 17 policies, 3 policies de Storage, bucket privado de 25 MB, función invoker, anon sin acceso, nadie puede borrar entradas.
- Deploy de funciones: `office-produkt-ai` con el workflow manual (run 45232458418): tests, deploy y la comprobación de que sin sesión responde 401.
- Datos (solo en la base, no en el repo): 19 Leistungen de Bodenbeläge con 44 Ansätze de cuatro Kostenberechnungen antiguas (tres viviendas y un edificio existente), cada uno con Stand, Quelle (fila y texto original), KG, cantidad y comentario; posiciones iguales de una misma Kostenberechnung juntas, con la suma de las cantidades. Lo que una Kostenberechnung tenía en KG 325 sobre la Bodenplatte va en KG 324 con una nota.
- Cómo se probó: 374 tests unitarios (8 nuevos: schema estricto, prueba de cada respuesta del modelo, Edge Function, migración, página y tarjeta, repo sin títulos DIN ni datos de proyecto). Chromium con Supabase sintético, 6 recorridos: Bibliothek con origen de precios, búsqueda, filtro y Archiv; leer, revisar y solo entonces guardar (Merkmal descartado, código siguiente BO-02, la página aparece una sola vez); Zu Projekt con código repetido rechazado; precio con número alemán; Esc tras un «sí» anterior no borra nada; a mano; lector caído con mensaje claro y lectura posterior; iPhone sin scroll lateral. Abnahme SQL nueva (27 comprobaciones: D y anon sin nada, nada se borra, ruta ajena rechazada, precio ajeno intocable, uso solo Team y Projektleitung, código único, la lectura se cuenta) y las 73 migraciones reproducidas en un PostgreSQL 16 local.
- Quedó pendiente o sin probar: leer un datasheet real con una sesión del Office (el recorrido completo solo se probó con el Supabase sintético). «Link einfügen» del boceto queda para la fase 2 (Kostenarchiv y Datenpool), igual que llevar un producto a la Kostenberechnung; la Bemusterung es la fase 3.
- Riesgos o decisiones que necesitan a Gari: cualquier miembro puede corregir una entrada ajena de la Bibliothek (como en Programa); si prefiere solo autor o Admin, es un cambio pequeño. Los Ansätze antiguos son estimaciones: la tarjeta lo dice hasta que llegue un Angebot o una Abrechnung.
- PR: #137

### 2026-11-23 · Planner behält seine Stelle; Romys Vorschläge speicherbar; Heartbeat wieder in Gang; Prüfung des ganzen Office · Claude
- Qué cambió y por qué (Gari, 23.11.):
  - **El Planner saltaba a la izquierda:** cada cambio redibuja el board (`renderPlanner` reemplaza `#workBody`) y el board nuevo empezaba a la izquierda. Ahora recuerda su posición lateral, la de cada bucket y qué «Erledigte Aufgaben» estaban abiertas, y las restaura al redibujar. El board lleva su proyecto (`data-work-board-project`): otro proyecto o el Muster empiezan a la izquierda. Nada se guarda ni va a la base.
  - **Revisión completa (pedido de Gari):** cada función, tabla y columna que llaman la app y las funciones del servidor, contra la base del Office. Faltaban ocho funciones (solo existían en Window; la migración de fase 1 `20261108211200` portó a propósito solo los helpers privados): `minds_create_prospective_memory`, `minds_ack_standing_intents`, `minds_cancel_prospective_memory`, `minds_create_expectation`, `minds_review_expectation`, `minds_create_commitment`, `minds_save_work_claim` (la de «Wissen») y `minds_apply_personal_skill`. Efecto: confirmar en el chat una propuesta de Romy (recordatorio, Erwartung, Ziel, Projektwissen, Fähigkeit) devolvía «función no encontrada» y la propuesta se perdía. Migración `20261123120000_office_romy_vorschlaege_v1.sql`: las ocho, adaptadas al Office — security definer con search_path vacío; cada una comprueba sesión, miembro activo y filas propias; lo personal puede referirse a cualquier proyecto activo (como todos ven todos los proyectos); Projektwissen solo lo guarda y revisa el Team de un proyecto activo (la misma regla con la que lo lee), una revisión guarda la versión anterior y quién revisó, y las evidencias son archivos del mismo proyecto; Fähigkeiten solo para Romy; mensajes en alemán porque la app los muestra tal cual. El helper `minds_private.create_expectation` comprobaba el proyecto como proyecto personal de Window (`isabella_projects.user_id`); ahora `office_projects` activo.
  - **Heartbeat caído desde el 14.11. por la noche:** `isabella-heartbeat` fallaba cada 15 minutos (96 veces al día, en `minds_agent_runs`) porque la huella de «tareas vencidas» encadena los ids de todas las vencidas (18 → ~680 caracteres) y atención y continuidad admiten 500. Como esa huella se publica primero, caía la ronda entera: avisos de Termine próximos y de Erwartungen vencidas, el cierre de avisos resueltos y el mantenimiento del contexto de conversación. Ahora la huella se acorta a inicio + md5 solo para atención y continuidad; la tabla del heartbeat guarda la completa (`resolveAbsent` sigue igual).
  - **No tocado, porque en el Office no se alcanza:** doce llamadas y ocho tablas solo de Window (operating model, contrafactual, permisos, push, Window-Code, revisión de mejoras, feed/ideas/lecturas/Sofía) están en paneles ocultos o detrás de `if(OFFICE)return`. Test nuevo `tests/office-romy-vorschlaege.test.mjs`: toda función y tabla que usa el código tiene que nacer en una migración; lo que solo tiene Window está en una lista con el lugar que lo oculta, y si algo se porta tiene que salir de ella.
- Archivos: `app/work.js` (`office50`), `app/index.html`, nueva migración `supabase/migrations/20261123120000_office_romy_vorschlaege_v1.sql`, nueva `tests/sql/office-romy-vorschlaege-acceptance.sql`, `.github/workflows/verify.yml`, nuevos `tests/office-romy-vorschlaege.test.mjs`, `tests/office-planner-board.test.mjs` y `tests/browser/office-planner-board.chromium.mjs`; versión de `work.js` en cinco tests.
- Base de datos: migración `20261123120000_office_romy_vorschlaege_v1.sql`, sin nada destructivo (funciones nuevas, `minds_private.create_expectation` y `minds_publish_heartbeat` con `create or replace`) — aplicada en Supabase: sí, tras la CI verde y el merge (pg_net desde el commit `5608e74`, md5 comparado antes del `execute`, registrada en `schema_migrations`). Comprobado: las ocho funciones con anon sin ejecución y authenticated con ella, `minds_publish_heartbeat` sigue solo para service_role; el heartbeat de las 16:45 corrió con éxito por primera vez desde el 14.11 (1 candidato, clave de 127 caracteres, aviso en el briefing, contexto al día).
- Deploy de funciones: ninguno.
- Cómo se probó: 366 tests unitarios. Navegador: board con ocho buckets, desplazado a la derecha, se marca una tarea — sin el arreglo «vorher 1718, nachher 0», con él se queda; `office-planner-terminplan-sync` sigue verde. Las 72 migraciones reproducidas en un PostgreSQL 16 local desechable (nunca producción) con las diez abnahmen SQL en verde. La abnahme nueva: cada propuesta se guarda una vez por Anfrage-Kennung; archivado, sin confirmar, no miembro y anon no; B no puede cerrar recordatorios de A; T (Team) revisa el Projektwissen de A (sigue siendo de A, versión anterior y quittung de T); B sin Team y archivos de otro proyecto no; Fähigkeit «sofia» queda en Romy; huella de 18 tareas: completa en el heartbeat, clave corta y estable en atención y continuidad, un solo aviso. Control negativo: sin la migración las funciones no existen; sin el parche del heartbeat sale exactamente el error de producción.
- Quedó pendiente o sin probar: «Wissen» sigue oculto en Work (su vista aún dice «Conocimiento de …»); tiene sentido activarlo cuando suban documentos. Una prueba real de Gari: confirmar una propuesta de Romy en el chat.
- Riesgos o decisiones que necesitan a Gari: Projektwissen de un proyecto lo puede revisar cualquiera del Team, no solo quien lo propuso (todo el Team lo lee). Si prefiere solo autor o Projektleitung, es un cambio pequeño.
- PR: #135

### 2026-11-23 · Buckets entfernen, menú «Mehr», Aufgaben por Verantwortlich, Kostenberechnung para todo el Office · Claude
- Qué cambió y por qué (Gari, 23.11.):
  - **«Bucket entfernen» no hacía nada:** el Planner llama a `minds_work_bucket_archive`, `_restore` y `_reorder`, que solo existían en Window, nunca en la base del Office (la llamada fallaba). Migración `20261123100000_office_work_buckets_v1.sql`: las tres funciones, tomadas de Window y adaptadas a buckets de proyecto (puede quien lo creó, la Projektleitung o el Projektteam, igual que la policy de update); security invoker, bloqueo por proyecto; las tareas abiertas pasan a «Ohne Bucket», las terminadas quedan en el bucket archivado; nada se borra. Si una tarea abierta no se puede mover, se cancela todo. Así también funcionan ordenar y restaurar buckets.
  - **Menú «Mehr»:** fuera «Meine Gespräche», «Neues Gespräch», «Vorherige Romy-Version» y «Terminplan-Muster» (está en Werkzeuge). Romy es una sola conversación en el chat; los temas tienen sus Threads en Work. La versión anterior ya no se puede elegir: `index.html` fija `APP_CHAT_RUNTIME="window"` y borra la elección guardada en el navegador.
  - **Heute, Plan y Aufgaben solo con las propias** (propuesta aceptada en el chat): una tarea con Verantwortliche es solo de ellos; sin Verantwortliche sigue siendo de quien la creó. El Planner de cada proyecto y el Kalender (con «Nur meine») siguen mostrando todo. Antes el panel Heute del escritorio y la lista de Aufgaben no filtraban.
  - **Kostenberechnung visible para todo el Office**, como el Terminplan y las carpetas del servidor (decisión de Gari). Migración `20261123100100_office_kosten_lesen_office.sql`: solo añade policies (lectura para miembros; preguntar al asistente; el Verlauf sigue privado). Escribir, Stände, crear y borrar siguen en quien la creó, la Projektleitung y el Team.
- Archivos: `app/index.html`, `app/office-engine-chat.js` (`romy5`), `app/shell.js` (`office50`), `app/sync.js` (`office7`), `app/dashboard.js` (`office41`), `app/app.js` (`office55`), `kostenberechnung.js` (`office6`), `kostenberechnung.html`, `kostenberechnung-hilfe.html`, dos migraciones, `tests/sql/office-work-buckets-acceptance.sql` (nueva), `tests/sql/office-kostenberechnung-rls-acceptance.sql`, `tests/sql/office-kosten-ai-rls-acceptance.sql`, `.github/workflows/verify.yml`, tests unitarios y de navegador, `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: dos migraciones, sin nada destructivo (funciones nuevas y policies añadidas); aplicadas con el conector de Supabase (#116) tras la CI verde, y comprobadas: tres funciones invoker, anon sin ejecución, cinco policies nuevas.
- Deploy de funciones: ninguno.
- Cómo se probó: 357 tests unitarios; navegador 26 (una elección «legacy» antigua se borra al arrancar; el menú ya no ofrece las cuatro entradas); abnahmen SQL en la CI: buckets (C sin relación no puede, B del Team quita un bucket de A, tareas abiertas a «Ohne Bucket», terminadas quedan, nada borrado, ordenar, restaurar al final, no miembros y anon no), Kostenberechnung (C lee, no cambia), asistente (C pregunta, lee solo lo suyo).
- Quedó pendiente o sin probar: `minds_save_work_claim` (revisar entradas de «Wissen» en Work) tampoco existe en el Office; no tocado.
- Riesgos o decisiones que necesitan a Gari: las tareas creadas por él sin Verantwortliche siguen en su Heute hasta que las asigne.
- PR: #134

### 2026-11-22 · Eine Anleitung für Archicad: Teil III der Kostenberechnung, eigene Schemata, Klassifizierung aus dem Werkzeug · Claude
- Qué cambió y por qué: Gari (22.11., 12:24) no quiere dos Anleitungen («debe ser solo una Guía … tan bien hecha y estructurada que sea solo una Guía y no dos») y pidió una solución para publicar lo de Graphisoft en vez de dejarlo interno. Hecho:
  - **Teil III «Archicad»** de `kostenberechnung-hilfe.html` reúne todo lo del Doc privado y lo que ya había: drei Regeln; tabla Bauteil → Werkzeug · Klassifizierung (Graphisoft) → KG → Menge → Seite (32 filas); modelar según las BIM-Modellierungsrichtlinien (Wand/Decke/Fußbodenaufbau, Sohlplatte/Fundamente, Öffnungen, Dächer); Flächen nach DIN 277; Einrichten in Archicad 26 y Teamwork (7 pasos); las dos Auswertungen con los Spaltenköpfe que reconoce el import; Einlesen; Rezepte; Erster Test en 30 minutos; Grenzen. Sprungmarken arriba del capítulo.
  - **Publicar sin copiar:** las reglas en palabras propias con la página citada «(S. 12)» y el PDF público de Graphisoft enlazado (Stand 09/2023, GRA223294; las páginas coinciden con la edición que Gari pasó). En lugar de los recortes, **seis esquemas propios** en SVG (Abbildungen 3–8) con los números de KG encima: marca llena = elemento propio con su clasificación, marca discontinua = capa del Aufbau que llega por el Rezept, gris = sin KG. Ninguna imagen de Graphisoft en la página; la licencia CC BY-NC-SA 4.0 se nombra en «Nachlesen». En el iPhone los esquemas se desplazan en su marco (no se encogen ilegibles).
  - **Klassifizierung für Archicad (.xml)** en la tarjeta «Mengen aus Archicad»: la Kostenberechnung genera el XML desde `st.katalog` (Muster en la BD), KG 200–600 hasta la 3.ª Ebene (258 Items con el Muster 1.1), formato del Klassifizierungs-Manager como el XML anterior (los 101 Items antiguos salen idénticos). También en modo solo lectura y en el Muster. Así el XML con títulos DIN no entra al repo.
- Archivos: `kostenberechnung-hilfe.html`, `anleitung.css` (`office4`, también en `terminplan-hilfe.html`), `kosten-import.js` (`office3`, `klassifizierungXml`, `SYSTEM_NAME`), `kostenberechnung.js` (`office5`), `kostenberechnung.css` (`office6`), `kostenberechnung.html`, `tests/office-kostenberechnung.test.mjs`, `tests/browser/office-kostenberechnung.chromium.mjs`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- Base de datos: ninguna.
- Deploy de funciones: ninguno (Pages al hacer merge).
- Cómo se probó: Tests unitarios (XML: formato, anidado, escape, solo 200–600; Spaltenköpfe de la Anleitung reconocidos por `erkenneSpalten`; Teil III: secciones, Sprungmarken, 6 esquemas SVG, ninguna imagen embebida, numeración de Abbildungen 1–11, cita y enlace de Graphisoft, cada KG de la tabla válida; guardia de títulos DIN). Chromium: descarga del XML desde el Muster sin escribir nada; Anleitung en iPhone sin scroll lateral de la página. Esquemas revisados como imagen en escritorio y iPhone.
- Quedó pendiente o sin probar: importar el XML generado en Archicad 26 real (el formato es el mismo que el XML anterior); confirmar en el despacho la columna KG (Vorschlag, p. ej. Ringanker y Attika en 331). El Doc privado «Archicad 26 · Klassifizierung für die Kostenberechnung» queda superado: borrarlo o dejar un enlace solo con el OK de Gari.
- Riesgos o decisiones que necesitan a Gari: si quiere usar los dibujos originales de Graphisoft, haría falta su permiso (CC BY-NC-SA; uso comercial dudoso); la solución actual no los necesita.
- PR: #128

### 2026-11-22 · KI-Assistenten: Kosten-Assistent freier, kein Tageslimit für Terminplan und Kosten · Claude
- Qué cambió y por qué: Gari (22.11., 07:23) preguntó por qué el asistente de costes tenía reglas, límite y nada de internet, «¿No sería mejor un asistente más libre?». Respuesta honesta: el límite de 25 lo copié del Terminplan sin preguntar (y el 04.11 se le quitó a Romy un límite no aprobado), la falta de búsqueda web lo hacía más estricto que el Terminplan, y el tono era seco. Propuesta aceptada a las 10:16: «Sí cámbialo así», y «quita la regla en Terminplan de solo 25 consultas por persona al día. Sin límite para ambos.»
  - **Kein Tageslimit** für den Terminplan-Assistenten und den Kosten-Assistenten: `office_ai_consume_request` und `office_kosten_ai_consume_request` prüfen weiter Anmeldung, Office-Mitgliedschaft und Sichtbarkeit und zählen jede Anfrage, begrenzen aber nicht mehr (wie Romy seit dem 04.11). Die Edge Function des Terminplans bleibt unverändert; ihr 429-Zweig wird damit nicht mehr erreicht.
  - **Kosten-Assistent v2** (`office-kosten-ai-v2`): freies Gespräch wie mit einem Kollegen, in der Sprache der Nachricht (Deutsch oder Spanisch), über die Kostenberechnung hinaus; **Websuche** wie beim Terminplan (ohne Anhänge; allgemeine Suchbegriffe, nie Projektname oder -nummer), Quellen als Links unter der Antwort (vom Modell und aus den Zitaten der Suche). «Keine Rechtsberatung» und «knapp» sind weg.
  - **Preise mit Herkunft statt Verwerfen:** im Gespräch frei; im Vorschlag mit Quelle und Fundstelle (auch eine Webadresse) oder als **«Annahme KI»**. Ein Preis ohne Quelle oder mit behaupteter Quelle ohne Fundstelle wird nicht mehr verworfen, sondern «Annahme KI» (die behauptete Quelle steht im Kommentar); ein geänderter Preis ohne neue Fundstelle ebenso, weil die alte Fundstelle ihn nicht belegt.
  - Zwei neue Quellen im Rechenkern (`R.ARTEN`): **Internet** (Hersteller, Händler, Index; Fundstelle = Adresse) und **Annahme KI (Assistent)**; sie erscheinen in der Auswahl, in der Tabelle, im Bericht und in «Herkunft der Beträge».
  - Was bleibt: der Assistent schreibt nie selbst (Vorschlag, «Prüfen und übernehmen», «Rückgängig»), nur KG aus der Gliederung, Elemente nur in der 3. Ebene, «entfällt» nie über Positionen, höchstens 80 Positionen je Vorschlag (Laufzeit), nur Ansicht ohne Vorschläge.
- Archivos: `supabase/migrations/20261122100000_office_ki_ohne_tageslimit.sql` (neu), `supabase/functions/office-kosten-ai/` (`core.mjs`, `index.ts`, Kopie des Rechenkerns), `kosten-rechnen.js` (`office4`), `kosten-assistent.js` (`office2`), `kostenberechnung.css` (`office5`), `kostenberechnung.html`, `kostenberechnung-hilfe.html` (Teil IV: zwei Quellen; Teil VI neu), `tests/sql/office-kosten-ai-rls-acceptance.sql`, `tests/sql/office-terminplan-ai-ohne-limit-acceptance.sql` (neu, in `verify.yml`), `tests/office-kosten-assistent.test.mjs`, `tests/office-kostenberechnung.test.mjs`, `tests/browser/office-kostenberechnung.chromium.mjs`, `tests/browser/fixtures/fake-supabase-kosten.js`.
- Base de datos: migración `20261122100000_office_ki_ohne_tageslimit.sql` (ersetzt nur die beiden Funktionen; Tabellen, Zeilen, Rechte und Policies bleiben; nichts Destruktives) — aplicada en Supabase el 22.11 über den Supabase-Connector als `office_ki_ohne_tageslimit` (der Workflow bekommt 403, #116). Danach geprüft: beide Funktionen ohne Zähler und ohne Grenze, sie zählen jede Anfrage, `security invoker`, `anon` darf sie nicht aufrufen.
- Deploy de funciones: `office-kosten-ai` am 22.11 mit dem Workflow (Version 2); Preflight von tbarchitekten.github.io 204, fremde Herkunft 403, ohne Anmeldung 401. `office-terminplan-ai` unverändert (Version 10). Die Dateien auf Pages sind byte-gleich mit `main`.
- Cómo se probó: 353 Tests; Chromium 10 Tests der Kostenberechnung (Quellen-Links, neuer Fehlerfall); Edge Function lokal mit Deno gegen Ersatz von Supabase und OpenAI (Websuche nur ohne Anhänge, Zitate als Links, Preise als «Annahme KI», 403 statt 429); RLS-Abnahmen in der CI: 31 Anfragen an die Kosten und 30 an den Terminplan an einem Tag, alle gezählt.
- Quedó pendiente o sin probar: ein echter Lauf gegen das Modell mit Websuche, angemeldet.
- Riesgos o decisiones que necesitan a Gari: ohne Tageslimit hängen die Kosten des KI-Anbieters nur noch an der Nutzung; jede Anfrage bleibt in `office_terminplan_ai_requests` bzw. `office_kosten_ai_requests` gezählt.
- PR: #126

---

### 2026-11-21 · Kostenberechnung: KI-Assistent für die Kosten · Claude
- Qué cambió y por qué: Gari (21.11., 17:00, punto 5): «Falta agregar el asistente (de Inteligencia artificial, como en el Terminplan pero este asistente sería para los costos)». Umgesetzt wie beim Terminplan (Edge Function, Tageskontingent, Verlauf je Person, Vorschlag erst nach «Prüfen und übernehmen»):
  - Knopf «Assistent» im Kopf der Kostenberechnung; das Gespräch steht rechts an der Stelle der Details (Details gehen vor), auf dem iPhone von unten;
  - Aufträge: Fragen zur Berechnung («Was fehlt noch?», Abweichung zur Kostenschätzung), **altes Büro-Excel übernehmen** (.xlsx oder CSV; das Blatt mit den meisten KG; Zeilennummern wie im Blatt als Fundstelle), **Angebote und Kostenbeiträge** als PDF oder Foto (bis drei, je 8 MB), Elemente für eine KG vorschlagen;
  - Vorschlag als Karte (Änderung der Summe, Positionen mit Rechnung und Quelle, Elemente, Änderungen, «entfällt»); «Prüfen und übernehmen» gleicht mit dem aktuellen Stand ab, trägt ein und speichert über `geaendert()` (bedingt auf die Revision); «Rückgängig», solange nichts anderes geändert wurde; Positionen tragen `assistent` (Tag der Übernahme), die Details sagen es;
  - Regeln in der Edge Function (`core.mjs`, jede Antwort wird geprüft): kein Preis ohne Quelle und Fundstelle (nur ausdrücklich gewünschte Annahmen, als «Annahme KI:»), nur KG aus der Gliederung, Elemente nur in der 3. Ebene, Betrag für eine KG der 2. Ebene als Pauschale, «entfällt» nie über vorhandene Positionen, Änderungen nur an vorhandenen Positionen, höchstens 80 Positionen je Vorschlag, nur Ansicht ohne Vorschläge; keine Websuche; Text in Anhängen ist Quellmaterial, keine Anweisung;
  - Rechenkern als Kopie in der Funktion (`supabase/functions/office-kosten-ai/kosten-rechnen.js`, per Test byte-gleich), damit Kontext und Prüfung genauso rechnen wie das Werkzeug.
  - Nebenbei: `kosten-import.js` liest leere Excel-Zeilen mit Format (`<row …/>`) richtig (vorher konnten sie die nächste Zeile verschlucken) und liefert die Zeilennummer (`nr`) sowie alle sichtbaren Blätter (`leseXlsxBlaetter`); Escape schließt die Details jetzt auch, wenn der Fokus nach dem Neuzeichnen auf der Seite steht.
- Archivos: `kosten-assistent.js` (neu, `office1`), `kostenberechnung.js` und `kostenberechnung.css` (`office4`), `kosten-import.js` (`office2`), `kostenberechnung.html`, `kostenberechnung-hilfe.html` (Teil VI · Assistent) und `anleitung.css` (`office3`, auch in `terminplan-hilfe.html`), `supabase/functions/office-kosten-ai/` (`index.ts`, `core.mjs`, Kopie des Rechenkerns), `supabase/config.toml`, Migration `supabase/migrations/20261121180000_office_kosten_ai_v1.sql`, Abnahme `tests/sql/office-kosten-ai-rls-acceptance.sql` (in `verify.yml`), `tests/office-kosten-assistent.test.mjs` (neu), `tests/office-kostenberechnung.test.mjs`, `tests/browser/office-kostenberechnung.chromium.mjs`, `tests/browser/fixtures/fake-supabase-kosten.js`.
- Base de datos: migración `20261121180000_office_kosten_ai_v1.sql` (Tabellen `office_kosten_dialogue_messages` und `office_kosten_ai_requests` mit RLS, Funktion `office_kosten_ai_consume_request`, 25 Anfragen je Person und UTC-Tag; nichts Destruktives) — aplicada en Supabase el 21.11 über den Supabase-Connector als `office_kosten_ai_v1` (dieselbe Datei, die die CI abgenommen hat): der Workflow «apply-migration» bekam vom Management-API 403, weil das Token keine Migrationen schreiben darf (Office #116). Danach geprüft: RLS an beiden Tabellen mit je zwei Policies, `anon` ohne Zugriff, `authenticated` ohne UPDATE und DELETE, die Funktion ist `security invoker`; die Security-Advisors melden dazu nichts.
- Deploy de funciones: `office-kosten-ai` am 21.11 mit dem Workflow «Deploy Supabase Edge Functions» (ausgeliefert: `index.ts`, `core.mjs`, die Kopie des Rechenkerns und `office-terminplan-ai/attachments.mjs`); ohne Anmeldung 401, ein Preflight von tbarchitekten.github.io 204 mit den eigenen CORS-Kopfzeilen, eine fremde Herkunft 403 (die Funktion startet und prüft selbst). Nutzt das vorhandene Secret `TBA_OFFICE_OPENAI_API_KEY` und dasselbe Modell wie der Terminplan. Die Dateien auf Pages sind byte-gleich mit `main`.
- Cómo se probó: 353 Tests (neu 9: Schema streng, Anweisungen, Kontext kompakt und gekürzt, Prüfung der Antworten, Tabelle mit Zeilennummern, Übernahme und Vorschau rechnen wie das Werkzeug, Edge Function ohne Schreiben und mit Kontingent vor dem Modell, Migration mit RLS, Einbindung). Chromium 10 Tests der Kostenberechnung (neu: Vorschlag aus einem Angebot prüfen, übernehmen, rückgängig; Details gehen vor; Büro-Excel als Tabelle; Fehler der KI ändern nichts; iPhone). Edge Function lokal mit Deno gegen einen Ersatz von Supabase und OpenAI (Herkunft, Anmeldung, Revision, Anhänge, Kontingent, Prüfung, kein Schreibzugriff). Abnahme der RLS in der CI.
- Quedó pendiente o sin probar: ein echter Lauf gegen das Modell, angemeldet, mit einem echten Büro-Excel oder Angebot (das Excel liegt nicht im Repository; Gari hängt es im Assistenten an); Sichtprüfung angemeldet auf Pages.
- Riesgos o decisiones que necesitan a Gari: wie beim Terminplan gehen Stand und Anhänge an den KI-Anbieter des Office; Tageskontingent 25 je Person; die Kürzel der Gewerke bleiben seine Entscheidung.
- PR: #124

---

### 2026-11-21 · Kostenberechnung: Tabelle wie im Büro-Excel, Elemente, Gewerke, volle Breite · Claude
- Qué cambió y por qué: Gari (21.11., 17:00, mit Bildschirmfoto und dem Büro-Excel): (1) kein Leerraum an den Seiten; (2) Zeilen aufziehen wie in Excel, Produktnamen sind lang; (3) Spalten wie im Büro-Excel (KG · GW · Bezeichnung · Menge · EH · EP netto · Netto · Brutto · Kommentar), verglichen mit Phase0 und California; (4) unter jeder KG mehrere Elemente (Beispiel 335/336). Umgesetzt:
  - volle Breite (`.kb-wrap` bis 2400 px statt 1240 px);
  - «Positionen» als Tabelle mit KG · GW · Bezeichnung · Ort · Menge · EH · EP netto · Netto · Brutto · Quelle · Kommentar; Eingabe direkt in der Zeile, Enter springt wie in Excel in dieselbe Spalte der nächsten Zeile; Pauschalen als «1 psch»;
  - **Elemente**: Gruppe von Positionen in einer KG der 3. Ebene, Summe am Element; «+ Position» und «+ Element» an jeder KG, «+ Position» im Element; auflösen oder mit Positionen löschen; Positionen duplizieren und verschieben;
  - «Einzeilig» / «Ganzer Text» und ziehbare Breite von Bezeichnung und Kommentar (je Browser gemerkt);
  - **Gewerke**: Spalte GW und eine zweite Sicht nach Gewerken mit Summen, Namen der Gewerke in «Quellen». Vorbild: Phase0 (jederzeit zwischen DIN 276 und Gewerken wechseln), ORCA (kostengruppen- und gewerkeorientiert, Vergabeeinheiten), California (Kostengruppen, Leistungsbereiche, Lokalitäten → Spalte Ort). Beide Sichten ergeben dieselbe Summe;
  - Details rechts als Inspektor (die Tabelle rückt zur Seite), auf dem iPhone von unten;
  - Übersicht mit Netto und Brutto nebeneinander, Anteil und €/m² BGF; der Umschalter netto/brutto entfällt;
  - Bericht: Positionen wie im Excel mit Elementen und Brutto, Zusammenstellung nach Gewerken, Druck im Querformat.
- Archivos: `kostenberechnung.js`, `kostenberechnung.css`, `kosten-rechnen.js` (Summen je Element und Gewerk, `gewerkKurz`), `kostenberechnung.html` (`office3`), `kostenberechnung-hilfe.html` und `anleitung.css` (`office2`, Teil II neu), `terminplan-hilfe.html` (nur Version des Stils), `tests/office-kostenberechnung.test.mjs`, `tests/browser/office-kostenberechnung.chromium.mjs`.
- Base de datos: keine Migration. Der Stand bekommt die Felder `elemente`, `gewerke` und an der Position `gewerk`, `ort`, `element` (gleiches Schema v1; bestehende Stände bleiben gültig).
- Deploy de funciones: ninguno.
- Cómo se probó: 344 Tests (neu: Summen je Element und Gewerk, beide Sichten gleich; Spalten, Zeilenhöhe, volle Breite, Querformat). Chromium 7 Tests der Kostenberechnung (neu: Element mit zwei Positionen direkt in der Zeile, Enter, Details mit Quelle, Escape, Gewerke, einzeilig gemerkt, Bericht). Bildschirmfotos bei 1900 px, mit Details, nach Gewerken, einzeilig und auf dem iPhone, ohne Querscrollen.
- Quedó pendiente o sin probar: KI-Assistent der Kostenberechnung (nächster PR). Sichtprüfung angemeldet auf Pages.
- Riesgos o decisiones que necesitan a Gari: die Kürzel der Gewerke (GW) und ihre Namen im Büro; im Muster ist keine Liste vorgegeben, damit nichts Falsches drinsteht.
- PR: #123

---

### 2026-11-21 · Kostenberechnung bis zur 3. Ebene, Anleitung zur Kostenberechnung, Anleitung zum Terminplan überarbeitet · Claude
- Qué cambió y por qué: Gari (21.11., 12:23): die Kostenberechnung muss bis zur 3. Ebene gehen und alle Positionen zeigen («für die KG 330 … 331 bis 339, und so für alle KG»); eine Anleitung zur Kostenberechnung im Office wie beim Terminplan, im Stil der Seite; die Anleitung zum Terminplan in Stil und Inhalt korrigieren. DIN 276:2018-12 verlangt für die Kostenberechnung die 3. Ebene (Bauprofessor, FORUM Verlag; die Regel «mindestens 2. Ebene» stammt aus der Fassung 2008).
- Werkzeug: Jede KG des Musters ohne Unter-KG ist ein Blatt mit Stand (vollständig, offen, ohne Ansatz, entfällt, in Pauschale, optional). «Positionen» zeigt die ganze Gliederung: Köpfe der 2. Ebene mit Zwischensumme, darunter jede KG der 3. Ebene, auch leer. An der KG: Position anlegen (mit den Vorgaben des Musters), Entfällt mit Begründung, Pauschale für die ganze KG, «Übrige … ohne Ansatz: entfällt», Wieder aufnehmen. Vollständigkeit = geklärt / (geklärt + zu klären); «vorläufig», bis alles geklärt ist. «Was noch fehlt» meldet leere KG je Gruppe und mögliche Doppelzählung (Pauschale und Position darunter). Bericht mit «Kostenberechnung bis zur 3. Ebene».
- Muster 1.1 (nur Datenbank): Gliederung DIN 276:2018-12 gegen Tabelle 1 der Norm geprüft (Abdruck der Tabelle 1 bei der AKBW, Formblatt RLBau E 3.4): 326 KG (8/52/266), 277 Blätter. Gegenüber 1.0 korrigiert u. a. 190 (gibt es nicht), 121–129, 251/252, 52x und 56x; «Sonstiges zur KG …» optional; vorbelegt «entfällt»: 100 und 800 (trägt der Bauherr) sowie 314, 370, 385, 447, 458, 514, 537, 538 (im Hochbau in der Regel nicht); Vorgaben und kurze Hinweise je KG in eigenen Worten (230 korrigiert: Anlagen auf dem eigenen Grundstück gehören zu KG 500).
- Anleitungen: neu `kostenberechnung-hilfe.html` (Ablauf, Kostengruppen klären, Archicad, Kennwerte und Quellen, Vergleich und Bericht; Abbildungen als Nachbildungen mit Beispieldaten, ohne DIN-Titel), verlinkt im Kopf der Kostenberechnung und unter der Liste. `terminplan-hilfe.html` neu gesetzt mit dem gemeinsamen `anleitung.css` (Stil der Werkzeuge statt der grünen Palette, Grafiken in den Farben des Terminplans) und inhaltlich korrigiert: Teil «Masterplanner» → Muster-Planner im Office Planner, v0.3.4 (7 Buckets, 53 Aufgaben, 355 Prüfpunkte) statt v0.2 mit Review im Browser; «Termine aus Terminplan»; neuer Abschnitt Terminplan-Assistent; Feiertage (beim Anlegen sechs Jahre Bayern im Projektkalender); «keine Notizen»; BPH-Bauteilkatalog und Bemusterung 04.03–04.05 in LPH 3; PSP 06 mit M08/M08A, 3. Ebene und Weg zur Kostenberechnung; Karte für LPH 5 im Menü; Sprache geglättet.
- Terminplan: Der Hinweis zur Regelprüfung sagte «ohne Feiertage»; gerechnet wird aber mit den arbeitsfreien Tagen des Projektkalenders (`terminplan-engine.js`). Texte in `terminplan.html` korrigiert (Regelprüfung, Projektkalender, Fußzeile beim Drucken). Office: der Link heißt «Anleitung zum Terminplan · Werkzeug, Assistent, LPH 3 und LPH 5»; Tooltip des Muster-Planners ohne «lokale Review-Notizen».
- Archivos: `kosten-rechnen.js`, `kostenberechnung.js`, `kostenberechnung.css`, `kostenberechnung.html` (`office2`), neu `kostenberechnung-hilfe.html` und `anleitung.css`, `terminplan-hilfe.html`, `terminplan.html`, `app/office-projects.js` (`office53`), `app/index.html`, `tests/office-kostenberechnung.test.mjs`, `tests/browser/office-kostenberechnung.chromium.mjs`, `tests/browser/fixtures/fake-supabase-kosten.js`.
- Base de datos: keine Migration. Muster «Kostenberechnung LPH 3» auf Version 1.1 gesetzt (21.11.2026, `update` der Musterzeile in `office_kosten_templates` über den Supabase-Connector, nur solange noch keine Kostenberechnung daraus angelegt war; md5 des Stands `dd565eefad74395d362c99b08c52e0ff`). Keine Projektdaten berührt.
- Deploy de funciones: ninguno.
- Cómo se probó: 342 Tests (neu: 3. Ebene mit Ständen, Vollständigkeit und Doppelzählung; die Seite zeigt jede KG; Anleitungen: Deutsch, Stil, Inhalt, nichts Veraltetes, keine DIN-Titel, keine Projekte). Chromium 22 Tests, davon Kostenberechnung 6 (u. a. jede KG bis zur 3. Ebene in Liste und Bericht; Kostengruppen klären mit Entfällt, Pauschale, «Übrige … entfällt», Wieder aufnehmen; iPhone ohne Querscrollen). Beide Anleitungen auf Desktop und iPhone angesehen.
- Quedó pendiente o sin probar: Sichtprüfung angemeldet auf Pages. Die private Archicad-Klassifizierung für 200/400/500/600 bis zur 3. Ebene ergänzen. KI-Assistent der Kostenberechnung.
- Riesgos o decisiones que necesitan a Gari: die im Muster vorbelegten «entfällt» prüfen (100, 800 und acht im Hochbau seltene KG; lassen sich wieder aufnehmen); das Muster freigeben (Status «Entwurf»).
- PR: #122

---

### 2026-11-21 · Kostenberechnung LPH 3 als Werkzeug · Claude
- Qué cambió y por qué: Gari (21.11.): den Entwurf der Oberfläche als Werkzeug im Office umsetzen. Bisher rechnet das Büro die Kostenberechnung in Excel; v1 soll für das laufende Projekt rechtzeitig vor der Kostenberechnung im Terminplan stehen. Neue Seite `kostenberechnung.html`, vierte Karte in den Werkzeugen, gebaut nach dem Entwurf vom 21.11.: oben die Antwort (Summe, Kostenschätzung, Kostenvorgabe, Vollständigkeit), darunter die Gliederung nach DIN 276 zum Aufklappen, daneben «Was noch fehlt», «Mengen aus Archicad» und «Herkunft der Beträge». Fünf Ansichten: **Übersicht**, **Positionen** (Menge × Kennwert oder Betrag; jede Zahl zeigt ihre Herkunft als Kette brutto → Baupreisindex → Regionalfaktor → Zuschlag), **Quellen** (Kostenstand, USt, Bezugsgrößen DIN 277, Kostenvorgabe, Regionalfaktor, Zuschlag, Baupreisindex Destatis, Bauteiltypen und Rezepte, entfallende Gruppen, Quellenverzeichnis), **Vergleich** (Kostenschätzung je 1. Ebene, Abweichung, Ursache), **Bericht** (drucken oder PDF; Stände festhalten).
- Rechnen: eigener Kern `kosten-rechnen.js` mit denselben Regeln wie #107 (Cent als BigInt, kaufmännisch gerundet, fehlend ist nicht 0, «vorläufig», solange etwas offen ist), damit beide austauschbar bleiben; #107 bleibt getrennt. Zahlen: gespeicherte Werte mit Punkt (`dezimal`), Eingaben deutsch (`eingabe`). Vor dem Merge gefunden und behoben: ein gespeicherter Regionalfaktor «1.045» wäre als 1045 gelesen worden, ebenso Archicad-Mengen mit drei Nachkommastellen.
- Archicad: `kosten-import.js` liest die Interaktive Auswertung «TBA Kosten · Mengen» als .xlsx (ohne Bibliothek) oder CSV (deutsche Zahlen werden erkannt), fasst je KG und Bauteiltyp zusammen und vergleicht mit dem letzten Import. Ein **Rezept** verteilt die Menge eines Bauteiltyps auf mehrere KG (Außenwand auf 331/335/336). Kennwerte bleiben beim Neu-Einlesen stehen; was nicht mehr im Modell ist, wird markiert, nicht gelöscht. Schlüssel ist die Klassifizierung DIN 276 plus Eigenschaft «TBA Bauteiltyp» (Anleitung für Archicad 26 als Doc für Gari, nicht im Repository).
- Archivos: neu `kostenberechnung.html`, `kostenberechnung.js`, `kostenberechnung.css`, `kosten-rechnen.js`, `kosten-import.js`, `supabase/migrations/20261121100000_office_kostenberechnung_v1.sql`, `tests/sql/office-kostenberechnung-rls-acceptance.sql`, `tests/office-kostenberechnung.test.mjs`, `tests/fixtures/kosten-archicad-beispiel.xlsx` (synthetisch), `tests/browser/office-kostenberechnung.chromium.mjs`, `tests/browser/fixtures/fake-supabase-kosten.js`; geändert `app/shell.js` (`office49`, Karte und Symbol), `app/office-projects.js` (`office52`), `app/index.html`, `tests/office-window-app.test.mjs` (Pin), `.github/workflows/verify-romy-browser.yml` (neuer Schritt für den Chromium-Test), `.github/workflows/verify.yml` (neuer Schritt für die RLS-Abnahme).
- Base de datos: migración `20261121100000_office_kostenberechnung_v1.sql` — aplicada en Supabase: sí (21.11.2026, `apply_migration` über den Supabase-Connector vor dem Merge; in der Historie als `20261121093612 office_kostenberechnung_v1`, wie schon bei LPH 5 v0.2). Drei neue Tabellen (`office_kosten_templates`, `office_kosten_instances` mit `server_revision`, `office_kosten_versions`) mit RLS über die `private.office_*`-Helfer; Lesen enger als beim Terminplan: wer angelegt hat, Projektleitung oder Admin, Projektteam. Projekt und Ersteller sind nach dem Anlegen unveränderlich. RLS-Abnahme `tests/sql/office-kostenberechnung-rls-acceptance.sql` in einer zurückgerollten Transaktion: prüft ihr Ergebnis selbst, lief am 21.11. gegen die Datenbank (nichts geblieben) und läuft jetzt in jedem PR im CI (`verify.yml`) auf der frisch migrierten Datenbank. Das **Muster** «Kostenberechnung LPH 3» 1.0 (Entwurf) ist per SQL in der Datenbank angelegt, **nicht im Repository** (öffentlich): Gliederung nach DIN 276:2018-12 mit 120 Kostengruppen (3. Ebene bei KG 300), 17 Startpositionen, KG 100 und 800 entfallen. Keine bestehende Tabelle geändert.
- Deploy de funciones: ninguno.
- Cómo se probó: 339 Tests (13 neu: Herkunftskette auf den Cent nachgerechnet, Zahlen lesen, Rundung und fehlend ≠ 0, Entfallen, was noch fehlt, Archicad-Import als xlsx und CSV, Werkzeugkarte, Seite, Speichern nur auf die erwartete Revision, Migration, keine DIN-Titel und keine Projekte im Repository, Deutsch). Chromium mit synthetischem Supabase, 5 Tests: Ablauf Anlegen → Import → Kennwert → Tippfehler beim Regionalfaktor → Rezept → Vergleich → Bericht und Stand; Positionen von Hand; Muster nur Ansicht; Konflikt (ein neuerer Stand wird nicht überschrieben); iPhone 390 px ohne Querscrollen. Dabei zwei echte Fehler gefunden und behoben: Änderungen an Positionen gingen verloren (die Kennung enthält Doppelpunkte), und der Bericht war am iPhone zu breit. Bestehende Chromium-Tests 9/9.
- Quedó pendiente o sin probar: Sichtprüfung angemeldet auf Pages und in der App. **KI-Assistent** für die Kostenberechnung wie beim Terminplan (nächster Schritt). Titel der Gliederung mit Garis DIN 276 und BKI abgleichen; welche BKI-Bände; Bezugsflächen DIN 277 aus Archicad; Zuschlag für Heinze-Orientierungspreise an eigenen Angeboten kalibrieren.
- Riesgos o decisiones que necesitan a Gari: wer eine Kostenberechnung sehen und anlegen darf (jetzt: Ersteller, Projektleitung/Admin, Projektteam); das Muster freigeben (Status «Entwurf»); ob und wann #107 den Rechenkern ersetzt.
- PR: #121

---

### 2026-11-21 · Bürovorlagen LPH 3 in Word und Excel, mit Fundstellen; Projektstart neu gefasst · Claude
- Qué cambió y por qué: Gari hat die vier Muster aus #119 zu Recht verworfen: ohne Recherche geschrieben und an seiner Aufgabenbibliothek vorbei (die Schnittstellenmatrix war «Von × An» statt Themen/Bauteile × Disziplinen, die Rückfragen ohne Grundlage). Sein Auftrag: gründlich recherchieren, **editierbare Dokumente** bauen, lösen statt zurückziehen. Jetzt gibt es fünf **Bürovorlagen** in `muster/lph3/` — genau die Vorlagen, auf die die Karten selbst verweisen («Bürovorlage Schnittstellenmatrix verwendet», L3.SSM.1-01; «Planliste aus der Bürovorlage angelegt», L3.PLI.1-01): (1) `LPH3_1_Projektstartvermerk.docx` — L3.PSV.1-01…-09 mit Protokoll M00, Grundleistungen a)–g) und Besondere Leistungen nach HOAI Anl. 10, die neun Projektparameter der Bibliothek, was danach ins Office gehört. (2) `LPH3_2_Planliste.xlsx` — L3.PLI.1-01, -02, -04…-06 (Plankopf im CAD bleibt Handarbeit): Planliste mit Planschlüssel-Formel und Ausgabe-Spalten, Dokumente aus dem Ergebnisregister der Bibliothek, Ausgaben mit Versandnachweis (L3.A1.AUS-04), Verteiler, Austausch, Ablage mit Spalte «ins Office». (3) `LPH3_3_Koordination.xlsx` — Projekt (Prüfpflichten nach Art. 62a/62b BayBO, Koordinator nach § 3 BaustellV und Mindesttiefe der Kostenberechnung werden abgeleitet), Fachplanerbedarf (L3.FPB.1), Schnittstellenmatrix (L3.SSM.1, Legende V/G/B/K/M/F der ByAK, Prüfung «genau eine planende Stelle je Thema», Liefertermine an M01/M03/M07 gekoppelt), Fragenliste mit 85 Fragen in beide Richtungen, jede mit Grund und Fundstelle (L3.PGF.1-06, L3.A1.ABS-06), Eingang (L3.KLA.1-01, L3.KLA.2-02), Klärungsliste (L3.KLA.1/.2/.3), Entscheidungsliste (L3.ENV.1, L3.A3.ABS). (4) `LPH3_4_Kickoff_Fachplanung.docx` — L3.A1.ABS-01…-08: Einladung, Tagesordnung, Protokoll mit Lieferumfang, Kostenbeitrag, Schnittstellen v1 und Widerspruchsfrist. (5) `LPH3_5_Entscheidungsvorlage.docx` — L3.ENV.1-01…-06 und L3.A3.ABS-01…-05, Prüfkasten L3.A3.AUS, Ausfüllbeispiel Schallschutzniveau. `projektstart.html` neu gefasst: Kapitel 1 bleibt, Kapitel 2 sind die Vorlagen mit Zeitleiste (welche Vorlage bei welchem Meilenstein), Kapitel 3 die Grundlagen mit 21 Fundstellen und fünf Befunden, die man leicht übersieht. Werkzeug-Karte sagt jetzt «fünf Bürovorlagen».
- Recherche (abgerufen 20.11.2026): HOAI 2021 Anl. 10, 14, 15, 1 und § 4; BayBO Art. 62a, 62b, 31–34, 37, 38; Übersicht Bautechnische Nachweise des Bauministeriums (25.11.2024); LHM Bautechnische Nachweise; BaustellV § 3; ByAK M13 (Schnittstellenkatalog nach DIN 276), Leistungskatalog mit Schnittstellen, M08 (Koordination ist keine fachliche Kontrolle), M01 (Kostenberechnung); DAB 01/2019 (DIN 276:2018-12 gilt für die HOAI nicht von selbst); AHO-Heft 17 nur als Verweis (nicht frei lesbar); Stand der HOAI-Novelle. Liste: `scripts/muster-lph3/quellen.json`.
- Archivos: neu `muster/lph3/` (5 Dateien), `scripts/muster-lph3/build_xlsx.py`, `build_docx.cjs`, `quellen.json`; `projektstart.html`; `app/shell.js` (`office48`, Kartentext), `app/index.html`, `app/office-projects.js` (nur Kommentar); `tests/office-projektstart.test.mjs` (neu gefasst), `tests/office-window-app.test.mjs` (Pin `office48`).
- Neu bauen, wenn sich Bibliothek oder Inhalt ändern: `python3 scripts/muster-lph3/build_xlsx.py`, danach die Formeln mit LibreOffice berechnen (`recalc.py` des xlsx-Skills), damit Vorschau und Romy Werte sehen; `node scripts/muster-lph3/build_docx.cjs` (npm-Paket `docx`). Die Dateien nie von Hand ändern.
- Base de datos: keine Migration. Deploy de funciones: keiner.
- Cómo se probó: 326 Tests (9 im neu gefassten `office-projektstart`): jede Vorlage verlinkt und als Office-Datei vorhanden; **jeder Bibliotheks-Code**, den Blatt und Generatoren nennen, existiert als Aufgabe oder Prüfpunkt; jede Fundstelle steht im Blatt; jede Frage hat Grund, Fundstelle und gültigen Meilenstein, und die Zahl im Blatt stimmt; die Prüfpflicht-Logik ist festgenagelt; keine Projektnamen und Adressen in den Generatoren. Excel: Neuberechnung mit LibreOffice ohne Fehler (388 und 71 Formeln), Formeln mit Testwerten geprüft (GK 4 ohne Sonderbau → Bescheinigung durch Prüfsachverständigen; Aufzug → «offen – im Kick-off klären»; Licht → «mehrere planende Stellen»). Word: Schema-Validierung bestanden, als PDF gerendert und durchgesehen. Blatt: Desktop und 390 px ohne seitliches Scrollen — die Tabellen aus Kapitel 1 liefen auf dem Telefon schon vorher über, behoben.
- Quedó pendiente o sin probar: fachliche Durchsicht durch Gari und die Kolleginnen; Bürostandard (Planschlüssel, Ablage, Briefkopf) einsetzen, wo die Vorlagen Vorschläge machen; Öffnen in Excel und Word unter Windows (gerendert nur mit LibreOffice). Vorschlag an Gari, nicht umgesetzt, weil es sein Text ist: in L3.SSM.1 die Rollen «plant / wirkt mit / liefert Angaben» um die ByAK-Legende ergänzen.
- Riesgos o decisiones que necesitan a Gari: rechtliche Hinweise sind Arbeitshilfen, keine Rechtsberatung; tritt die HOAI-Novelle in Kraft (Ziel Anfang 2027), Fundstellen prüfen. Das Repository ist öffentlich: die Vorlagen enthalten keine Projekt- oder Personendaten, und das bleibt so.
- PR: #120

---

### 2026-11-20 · Projektstart: was ein Projekt braucht, und vier Muster · Claude
- Qué cambió y por qué: Gari teilt Bernried nächste Woche mit zwei Kolleginnen und füllt es mit Projektinformation. Seine Vorgabe: **nicht einfach vorbereiten, sondern sagen, welche Information gebraucht wird**, damit Romy ihr Potenzial erreicht. Neues Blatt `projektstart.html`, erreichbar über eine dritte Karte in den Werkzeugen. Kapitel 1 ist die Antwort darauf: drei Stufen, geordnet nach dem, **was jede freischaltet**, nicht nach Aufwand — Stufe 1 Dokumente / Beteiligte / Projektsteckbrief, Stufe 2 Entscheidungen mit Begründung / Verantwortliche / echte Fristen / gepflegter Terminplan, Stufe 3 Protokolle / Angebote / Planliste mit Indizes. Jede Zeile sagt auch, **wohin im Office** es gehört, und am Ende steht die Grenze: was Romy nicht bekommen soll.
- Die vier Muster: **Schnittstellenmatrix LPH 3** (wer liefert wem was, wofür — die letzte Spalte ist die, die sonst fehlt), **Rückfragenkatalog** an alle Fachplanungen einzeln (TWP, HLS, ELT, BPH, BRS), **Entscheidungspunkt** in fünf Angaben, **Planliste und Dokumentenstruktur**. Sie sind als Muster geschrieben, nicht für Bernried: sie entsprechen den acht Vorgängen der LPH-3-Vorlage, die sich ohne Projektunterlagen vorbereiten lassen (`t-source-0003`, `0004`, `0005`, `0017`, `0023`, `0024`, `0026`, `0046`), fast alle im Bucket A3. Von den 57 Vorgängen haben 23 nichts vorzubereiten und 26 brauchen Unterlagen, die es im Office noch nicht gibt.
- Archivos: neu `projektstart.html`, `app/shell.js` (`office47`, dritte Werkzeug-Karte), `app/office-projects.js` (`office51`), `app/index.html`, neu `tests/office-projektstart.test.mjs`.
- Base de datos: keine Migration. Deploy de funciones: keiner.
- Cómo se probó: 322 Tests, davon 5 neue — die Karte führt hin und zurück, das Blatt bleibt Muster statt Bernried-Dokument (höchstens zwei Erwähnungen), die drei Stufen sagen alle, wohin es im Office gehört, der Rückfragenkatalog deckt jede Fachplanung der Matrix ab, und es ist kein spanisches Wort übrig. 7 Chromium-Tests lokal grün.
- Quedó pendiente o sin probar: fachliche Durchsicht durch Gari — das Blatt ist ein Vorschlag und sagt das auch von sich. Und der nächste Schritt, den es nur vorbereitet: dass **Romy selbst** sagt, was einem Projekt fehlt, statt dass man das Blatt liest (Issue #118).
- Riesgos o decisiones que necesitan a Gari: ob die Muster fachlich so stehenbleiben. Sie sind bewusst knapp und ersetzen keine Bürostandards.
- Stand 21.11.2026: die vier Muster dieses Eintrags sind durch die Bürovorlagen LPH 3 ersetzt (Eintrag darüber).
- PR: #119

---

### 2026-11-15 · Terminplan ohne Notizen: Editor, CSV, Neuaufbau, Projektanlage und Muster LPH 5 v0.3 · Claude
- Qué cambió y por qué: Entscheidung Gari (15.11.2026), Folge von „ein Terminplan enthält keine Notizen“: (1) `terminplan.html`: Feld „Notiz / Lieferergebnis“ im Vorgangsdialog entfernt, Speichern setzt `note:''`, die Suche durchsucht keine Notizen mehr, CSV-Export ohne Spalte „Notiz“. (2) `terminplan-rebuild.js` (PDF-/KI-Neuaufbau und Planänderung) übernimmt keine Notizen mehr – weder aus der Quelle noch aus dem bisherigen Stand; eine alte Notiz erscheint im Vorschlag als Änderung, bevor bestätigt wird. (3) `office-core.js`: neue Projektpläne bekommen keine versteckte Projektnotiz mehr (`planningAssumptions.note`). (4) **Muster LPH 5 v0.3** ohne die 24 Vorgangsnotizen und `planningNotes`; Hinweise erhalten in `docs/LPH5-MUSTER-TERMINPLAN-HINWEISE.md`. Das Datenfeld `note` bleibt im Modell (leer), damit ältere Dateien und Importe weiter lesbar sind.
- Archivos: `terminplan.html` (`terminplan-rebuild.js?v=office40`), `terminplan-rebuild.js`, `office-core.js` (`index.html` `?v=5`, `app/index.html` `?v=office37`), `supabase/seed/terminplan-templates.json`, `supabase/migrations/20261115200000_office_lph5_template_v03.sql` (neu), `docs/LPH5-MUSTER-TERMINPLAN-HINWEISE.md` (neu); Tests: `office-37-acceptance` (Neuaufbau ohne Notizen, neuer Test), `office-38-window-parity` (neuer Test: kein Notizfeld, keine CSV-Spalte), `office-core` (neuer Projektplan ohne Notizen), `office-lph5-v02` (v0.3; v0.2 historisch = v0.3 mit Notizen; Hinweise vollständig im Dokument).
- Base de datos: migración `20261115200000_office_lph5_template_v03.sql` — aplicada en Supabase: sí (15.11.2026, `net.http_get` der Datei auf Merge-Commit `73342fa`, SHA-256 geprüft, eingetragen in `supabase_migrations.schema_migrations`); LPH 5 v0.3 aktiv mit 0 Notizen, v0.2 inaktiv.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test` 317/317; Chromium lokal 9/9 (App-Start, Muster-Planner, Termin-Abgleich).
- Quedó pendiente o sin probar: Vorgangsdialog im echten Terminplan mit Anmeldung (Gari). Der KI-Assistent fragt im Antwortschema weiterhin ein Feld `note` ab; es wird jetzt verworfen.
- Riesgos o decisiones que necesitan a Gari: —
- PR: #104

---

### 2026-11-15 · Muster LPH 3 v1.6 ohne Notizen; Bernried: Übergabe Planstand 02 nach der Koordination Runde 02 · Claude
- Qué cambió y por qué: Entscheidungen Gari (15.11.2026). (1) **Ein Terminplan enthält keine Notizen:** Vorlage LPH 3 v1.6 ohne die 33 Vorgangsnotizen und ohne `planningNotes`; Vorgänge, Termine und Verknüpfungen unverändert. Die Hinweise sind als Planungswissen erhalten in `docs/LPH3-MUSTER-TERMINPLAN-HINWEISE.md` (je PSP/ID). (2) **Bernried, Option 2:** Der Meilenstein „Integrierter Planstand 02 an Bauherren übergeben“ wartet jetzt auch auf die Koordination Runde 02 (03.05) → Übergabe 21.01.2027, Prüfphase 22.–28.01., M06 28.01.; 13 Vorgänge rücken eine Woche, M10 25.02.2027 (vorher 18.02.). Planner: 15 Aufgaben per Termin-Abgleich nachgeführt.
- Archivos: `supabase/seed/terminplan-templates.json`, `supabase/migrations/20261115190000_office_lph3_template_v16.sql` (neu), `docs/LPH3-MUSTER-TERMINPLAN-HINWEISE.md` (neu), `scripts/lph3-bibliothek/build.py` (Vorlage 1.6), `app/data/muster-planner-lph3-v0.3.json` (nur Verweis auf v1.6), `docs/LPH3-AUFGABENBIBLIOTHEK-v0.3.md`; Tests: `office-core` (neu: Vorlage ohne Notizen), `terminplan-planning` (v1.5 historisch, v1.6 = v1.5 ohne Notizen, Hinweise vollständig im Dokument; v1.6-Migration = Seed), `office-lph5-v02`, beide Muster-Planner-Tests.
- Base de datos: (1) migración `20261115190000_office_lph3_template_v16.sql` — aplicada en Supabase: sí (15.11.2026, `net.http_get` der Datei auf Merge-Commit `9ce6e9e`, SHA-256 geprüft, eingetragen in `supabase_migrations.schema_migrations`); v1.6 aktiv mit 0 Notizen, v1.5 inaktiv. (2) Bernried: ein `DO`-Block (eine Transaktion): Sicherung „Vor Planänderung · 2026-11-15 · Revision 15“, Revision 15 → 16, 15 Zeilen `isabella_tasks` (Termine, PSP-Text). Nichts gelöscht.
- Deploy de funciones: ninguno.
- Cómo se probó: Bernried mit der Engine gerechnet (gültig, Kaskaden danach ruhig) und als Trockenlauf (md5 identisch, 47 PDF-Belege, Basisplan gleich); danach md5 von Plan und Planner = Erwartung, keine Karte abgehakt berührt. `node --test` 314/314; `build.py` alle Prüfungen OK.
- Quedó pendiente o sin probar: Muster LPH 5 v0.2 hat noch 24 Notizen (Entscheidung Gari). Der Terminplan-Editor hat weiterhin das Feld „Notiz / Lieferergebnis“ und der CSV-Export eine Spalte „Notiz“.
- Riesgos o decisiones que necesitan a Gari: siehe oben (LPH 5, Editorfeld).
- PR: #102

---

### 2026-11-15 · Bernried: Bauphysik im Terminplan, Planner-Karten auf v0.3.4, keine Notizen; BTK.1 vor PGF.1 · Claude
- Qué cambió y por qué: (1) Bibliothek v0.3.4: `L3.BTK.1` steht in A1 jetzt vor `L3.PGF.1` statt hinter den Abgabe-Karten (Reihenfolge folgte der Definition in `lib.py`); Inhalt unverändert. (2) Garis Entscheidungen (15.11.2026) für Bernried: Bauphysik ist noch nicht beauftragt (Angebotsanfragen versandt) → M00A nennt jetzt „HLS, ELT, BPH; BRS sofern erforderlich“; zwei BPH-Vorgänge wie bei HLS (Arbeitsstand 01 · Bauteilkatalog, PSP 02.08; abgestimmter Beitrag · Endstand, PSP 05.06, nicht vor M06), an M03, Koordination 01, M07 und Mengenermittlung gebunden – ohne Terminverschiebung. „In einem Terminplan stehen keine Notizen“: alle 8 Notizen entfernt. Die 8 von v0.3.3 auf v0.3.4 geänderten Planner-Karten (`BTK.1` nach A1, `BTK.2`, `KLA.1`, `KLA.3`, `A5.ABS`, `A1.AUS`, `SCH.1`, `OBJ.1`) auf den neuen Text gebracht und neu verknüpft; `A5.AUS` behält den Bernried-Text.
- Archivos: `scripts/lph3-bibliothek/lib.py` (nur Reihenfolge), `app/data/muster-planner-lph3-v0.3.json` (neu erzeugt), Bitácora/Estado.
- Base de datos: keine Migration. Ein `DO`-Block (eine Transaktion) gegen das Live-Projekt: Sicherung „Vor Planänderung · 2026-11-15 · Revision 14“, Terminplan-Instanz Revision 14 → 15, 8 Zeilen `isabella_tasks` (Titel, Prüfpunkte, Notiz, Metadaten, Termine; `BTK.1` auch Bucket/Reihenfolge). Abbruch, falls eine Karte schon bearbeitet oder abgehakt war. Nichts gelöscht.
- Deploy de funciones: ninguno.
- Cómo se probó: Engine (`analyze` gültig, keine Terminänderung, Kaskaden ab den neuen Vorgängen ruhig); Trockenlauf gegen die Datenbank (md5 identisch, 0 Notizen, 47 PDF-Belege, Basisplan unverändert); danach md5 von Plan und Planner = Erwartung, Termin-Abgleich 53 verknüpft / 0 Änderungen; `build.py` alle Prüfungen OK; `node --test` grün.
- Quedó pendiente o sin probar: Ansicht mit Anmeldung (Gari).
- Riesgos o decisiones que necesitan a Gari: Die Vorlage (Muster v1.5) enthält noch Notizen; ob sie dort auch entfallen, entscheidet Gari.
- PR: #101

---

### 2026-11-15 · Der Eingang ist keine Sackgasse mehr · Claude
- Qué cambió y por qué: `bandeja.js` wurde beim Port aus Window ausgelassen — mit einem Test, der die Auslassung festhielt. `app.js`, `ahora.js` und `work.js` rufen aber `window.MINDS_BANDEJA`: ohne die Datei blieb der Eingang auf seiner Ladezeile stehen, und die Zeile «N zu bestätigen» in Heute erschien nie, weil `lastCount()` `undefined` zurückgab statt einer Zahl. Jetzt portiert, auf Deutsch, **nur mit dem Tab «Zu bestätigen»**: `isabella-feed` und `isabella-ideas` gibt es im Office nicht, die beiden anderen Tabs bleiben verborgen und ihr Code kam nicht mit. Der Navigationseintrag bleibt ebenfalls verborgen — der Eingang ist im Office kein ständiges Ziel, sondern taucht über die Zeile in Heute auf, sobald etwas darin liegt. Nebenbei: in `cockpitParaTi` stand eine überfällige Aufgabe noch als «Vencida ·» da; jetzt «Überfällig ·».
- Was der Eingang heute zeigt: nichts, und das ist richtig so. `minds_work_memory` hat null Zeilen, weil das Office **null Dokumente** hat (`office_project_files` = 0). Die nächtliche Akte-Pflege läuft und meldet `nothing_new` — sie hat nichts zu lesen. Der Bildschirm ist damit leer statt kaputt; gefüllt wird er, sobald Unterlagen im Office liegen.
- Archivos: neu `app/bandeja.js` (`office1`), `app/index.html`, `app/work.js` (`office49`), neu `tests/office-eingang.test.mjs`, `tests/office-app.test.mjs` (die Auslassung ist jetzt eine Ladung, mit Begründung).
- Base de datos: keine Migration.
- Deploy de funciones: keiner.
- Cómo se probó: 313 Tests, davon 5 neue, die prüfen, dass `bandeja.js` **jedes** Mitglied setzt, das die drei Aufrufer tatsächlich rufen (aus deren Quelltext gelesen, nicht aus Windows Export), dass die Zahl in Heute eine Zahl bekommt, dass keine spanische Zeile übrig ist und dass die beiden fremden Ansichten nicht mitkamen; 10 Chromium-Tests lokal grün.
- Quedó pendiente o sin probar: ein echter Blick von Gari, sobald es etwas zu bestätigen gibt — heute lässt sich nur die leere Fassung sehen. `turn-integrity.js` steht **nicht** mehr auf der Liste: die spanische Fassung dort ist kein Rest, sondern Windows lebender Text; `summary()` verzweigt nach Profil auf `officeSummary()`. Es gab nichts aufzuräumen.
- Riesgos o decisiones que necesitan a Gari: dass das Office keine Dokumente hat, ist die eigentliche Lücke — ohne sie bleibt die Akte-Pflege ohne Arbeit und Romy ohne Material.
- PR: #100

### 2026-11-15 · Bauteilkatalog durch die Bauphysik: Muster LPH 3 v1.5 und Bibliothek v0.3.4 · Claude
- Qué cambió y por qué: Gari wies darauf hin (15.11.2026), dass den Bauteilkatalog im Büro immer die Bauphysik erstellt; die HOAI führt ihn dort (Anlage 1 Nr. 1.2.2: LPH 2 Besondere Leistung „Erstellen eines fachübergreifenden Bauteilkatalogs“, LPH 3 c) „Bemessen der Bauteile des Gebäudes“). Die Bibliothek hatte ihn als Architektenleistung geführt (interne Annahme). Entscheidungen: (1) `L3.BTK.1` → **„Aufbauvorgaben für die Bauphysik festlegen“** (Architektur), von A2 nach A1, fällig mit M01 und Teil der Planungsgrundlagen (`L3.A1.AUS`). (2) Der Katalog kommt als Fachplanungsbeitrag Arbeitsstand 01 der Bauphysik vor M03 und wird in `L3.KLA.1` geprüft. (3) `L3.BTK.2` → **„Bauteilkatalog der Bauphysik prüfen und übernehmen“**; `L3.A5.ABS` gibt die Entscheidungen der Bemusterung an die Bauphysik, ihr Endstand wird in `L3.KLA.3` geprüft (erzeugt jetzt `BTK.3`). (4) **Muster-Terminplan v1.5:** `t060` BPH Arbeitsstand 01 · Bauteilkatalog (parallel zu ELT/HLS/TWP, vor M03, Koordination 01 beginnt wie bei den anderen) und `t061` BPH abgestimmter Beitrag · Bauteilkatalog Endstand (vor M07, nicht vor M06; Mengenermittlung wie bei den anderen). Kein Termin verschiebt sich, Musterende unverändert; PSP M03 jetzt 02.08, M07 05.06. Nebenbei: Kartentext `L3.A5.AUS` nennt keine interne Vorgangs-ID („t059“) mehr.
- Archivos: `supabase/seed/terminplan-templates.json`, `supabase/migrations/20261115120000_office_lph3_template_v15.sql` (neu), `scripts/lph3-bibliothek/{lib.py,build.py}` (v0.3.4, Vorlage 1.5, BPH als Dritter), `app/data/muster-planner-lph3-v0.3.json` (53 Aufgaben, 355 Prüfpunkte; A1 8, A2 9), `app/office-projects.js` (Kartentext v0.3.4), `app/index.html` (`office-projects.js?v=office50`), `docs/LPH3-AUFGABENBIBLIOTHEK-v0.3.md`; Tests: `office-core`, `terminplan-planning` (historische Kette v1.2→v1.3→v1.4 jetzt gegen die Migrationen; neu: v1.5 = v1.4 + Bauphysik; v1.5-Migration = Seed), `terminplan-link-view`, `terminplan-uebersicht` (107 Verknüpfungen, Übersicht 60), `office-lph5-v02`, beide Muster-Planner-Tests (neuer Test zur Rollenverteilung beim Bauteilkatalog).
- Base de datos: migración `20261115120000_office_lph3_template_v15.sql` — aplicada en Supabase: sí (15.11.2026, `net.http_get` der Datei auf Merge-Commit `ebce2f0`, SHA-256 geprüft, eingetragen in `supabase_migrations.schema_migrations`); v1.5 aktiv (61 Vorgänge, 107 Verknüpfungen), v1.4 inaktiv. Die einzige Projektinstanz ist unverändert.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` 308/308; Chromium lokal 6/6; `build.py` alle Prüfungen OK (61 Vorgänge zugeordnet, zeitlich konsistent); Vorlage mit beiden Engines gültig, Kaskade ab jedem neuen Vorgang ohne Folgeverschiebung, Projektkopie (auch „Fachplaner bereits beauftragt“) fehlerfrei.
- Quedó pendiente o sin probar: Laufende Projekte ändern sich durch die Vorlage nicht; Bernried bekommt die Bauphysik erst nach Garis OK (Vorschlag an Gari).
- Riesgos o decisiones que necesitan a Gari: —
- PR: #98

### 2026-11-14 · Terminplan Bernried: Meilenstein integrierter Planstand 02, Bemusterung zwei Wochen früher · Claude
- Qué cambió y por qué: Garis Entscheidungen (14.11.2026). (1) Neuer Meilenstein „Integrierter Planstand 02 an Bauherren übergeben“ (PSP 03.06, nach dem integrierten Arbeitsstand 02) und Prüfphase der Bauherren (03.07, 5 AT wie im Muster); M06 wartet auf deren Ende. Grund: der Vorabzug 02 (01.08) enthielt nur die Architektur; die Abgabe A4 im Planner hing deshalb an einem zu frühen Termin. (2) Bemusterungsblock (Vorbereitung 20 AT, Übergabe, Bemusterung) um 10 AT vorgezogen, weil die Vorbereitung bereits läuft. Kein anderer Termin bewegt sich; M06 und M10 bleiben.
- Archivos: nur Bitácora/Estado (Datenänderung, kein Code).
- Base de datos: keine Migration. Ein `DO`-Block (eine Transaktion): Sicherung „Vor Planänderung · 2026-11-14 · Revision 13“ in `office_terminplan_versions`, Terminplan-Instanz Revision 13 → 14 (2 Vorgänge neu, 4 geändert, PDF-Belege und Basisplan unverändert), 13 Planner-Aufgaben (Termine; bei `L3.A4.AUS`/`L3.A4.ABS` auch Verknüpfung und Notiz) und PSP-Referenz des Buckets A4. Nichts gelöscht.
- Deploy de funciones: ninguno.
- Cómo se probó: vorher mit der Engine gerechnet (`analyze` gültig, Kaskade ab jedem geänderten Vorgang ohne Folgeverschiebung) und als Trockenlauf gegen die Datenbank (md5 identisch, 47 PDF-Belege erhalten); danach md5 des Plans und der Planner-Aufgaben = Erwartung; Termin-Abgleich 53 verknüpft, 0 Änderungen; keine abgehakte oder erledigte Aufgabe berührt.
- Quedó pendiente o sin probar: Sicht im echten Terminplan und Planner mit Anmeldung (Gari).
- Riesgos o decisiones que necesitan a Gari: —
- PR: #97

### 2026-11-14 · Planner Bernried aus der Aufgabenbibliothek v0.3.3 angelegt und mit dem Terminplan verknüpft · Claude
- Qué cambió y por qué: Auf Garis Wunsch (14.11.2026) hat der Planner des Projekts Bernried jetzt die 7 Abgabe-Buckets und alle 53 Aufgaben der Bibliothek v0.3.3 – auch die, deren Termine schon vorbei sind, **keine als erledigt markiert** (Gari prüft sie einzeln). Jede Aufgabe ist über `metadata.office_planner.terminplan` mit den Vorgängen der Terminplan-Instanz des Projekts verknüpft; Start/Fällig kommen aus dem Terminplan (Regel wie im Knopf „Termine aus Terminplan“). Wo der Projekt-Terminplan einen Muster-Vorgang nicht hat, steht der Ersatzvorgang in der Notiz der Aufgabe.
- Archivos: nur Bitácora/Estado (Datenänderung, kein Code).
- Base de datos: keine Migration. Ein `DO`-Block (eine Transaktion) gegen das Live-Projekt: Bibliothek per `net.http_get` vom veröffentlichten JSON, SHA-256 geprüft; Abbruch, falls die Terminplan-Revision nicht der erwarteten entspricht oder schon Bibliotheksaufgaben existieren. Eingefügt: 7 Zeilen `minds_work_buckets`, 53 Zeilen `isabella_tasks` (`client_key` `lph3-bibliothek:<Projekt>:<Kennung>`). Nichts gelöscht oder geändert; bestehende Buckets und Aufgaben unberührt.
- Deploy de funciones: ninguno.
- Cómo se probó: Zählung danach 9 Buckets / 66 Aufgaben (vorher 2 / 13); 350 Prüfpunkte, keiner abgehakt, keine Aufgabe erledigt; md5 über Kennung, Termine, PSP, Notiz und Verknüpfung identisch mit der vorab berechneten Erwartung; `TBAPlannerTerminplanSync.plan` mit dem gespeicherten Terminplan: 53 verknüpft, 0 Änderungen, 0 fehlende Vorgänge.
- Quedó pendiente o sin probar: Sicht im echten Planner mit Anmeldung (Gari). Aufgaben mit vergangener Fälligkeit erscheinen als überfällig, bis Gari sie abhakt.
- Riesgos o decisiones que necesitan a Gari: Rückbau wäre ein `DELETE` über `client_key like 'lph3-bibliothek:%'` und die 7 Bucket-IDs – nur mit Garis OK.
- PR: #96

### 2026-11-14 · Themenpaket Bodenbeläge (Bibliothek v0.3.3) und Planner-Knopf „Termine aus Terminplan“ · Claude
- Qué cambió y por qué: Garis Entscheidungen (14.11.2026). (1) **Aufgabenbibliothek v0.3.3:** neues Themenpaket `L3.BOD.1` Bodenbeläge; jede Themenkarte (Bäder, Treppen, Fassade, Licht, Bodenbeläge) enthält jetzt „Optionen ausgearbeitet“ und „Muster je Option angefordert; Optionen mit Mustern als Entscheidungsblatt für den Auftraggeber aufbereitet“; `L3.MUS.1` braucht alle Themen, `L3.A5.ABS` hält je Thema die gewählte Option fest. 53 Aufgaben, 350 Prüfpunkte; alle Prüfungen OK. (2) **Planner ↔ Terminplan:** Aufgaben eines Projekts können über `metadata.office_planner.terminplan` (Vorgangs-IDs des Projekt-Terminplans) verknüpft sein. Neuer Knopf „Termine aus Terminplan“ (nur bei verknüpften Aufgaben, nie im Muster): rechnet Start/Fällig aus den Vorgängen, zeigt die Änderungen, speichert erst nach „Übernehmen“; erledigte Aufgaben bleiben; übrige Metadaten bleiben erhalten. Grundlage dafür, den Planner eines Projekts mit seinem Terminplan zu verbinden.
- Archivos: `scripts/lph3-bibliothek/{lib.py,build.py}`, `app/data/muster-planner-lph3-v0.3.json`, `app/planner-terminplan-sync.js` (neu, rein), `app/work.js` (Knopf, Vorschau, Speichern; Planner lädt `metadata`), `app/work-buckets.css`, `app/index.html` (`planner-terminplan-sync.js?v=office1`, `work.js?v=office48`, `work-buckets.css?v=3`), `app/office-projects.js` (Kartentext v0.3.3 · 53), `docs/LPH3-AUFGABENBIBLIOTHEK-v0.3.md`, `.github/workflows/verify-romy-browser.yml`; Tests: `tests/planner-terminplan-sync.test.cjs` (neu), `tests/browser/office-planner-terminplan-sync.chromium.mjs` (neu: echter Planner mit lokaler Fake-Datenbank – Knopf, Vorschau, Schreiben erst nach Bestätigung, Metadaten erhalten), Muster-Planner-Tests (53/350, Themen mit Optionen und Muster), fünf Tests mit `work.js?v=`.
- Base de datos: keine Migration (vorhandene Spalten `metadata`, `start_date`, `due_date`).
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` 306/306; Chromium lokal 6/6 (Muster-Planner 5, Termin-Abgleich 1); `build.py` alle Prüfungen OK.
- Quedó pendiente o sin probar: der Knopf mit echter Anmeldung (nur mit lokaler Fake-Datenbank geprüft). Die Verknüpfung eines laufenden Projekt-Planners mit seinem Terminplan erfolgt separat in der Datenbank (Details in der Projektakte, nicht hier).
- Riesgos o decisiones que necesitan a Gari: BOD.1 ist ein Vorschlag (fachlich prüfen).
- PR: #95

### 2026-11-14 · Muster LPH 3 v1.4: Bemusterungsvorbereitung 20 AT; Muster-Planner v0.3.2 · Claude
- Qué cambió y por qué: Entscheidung Gari (14.11.2026): Vorbereitung der Bemusterungsunterlagen 20 statt 15 AT. Vorlage LPH3 **v1.4**: nur `t058` (20 AT, 03.02.–02.03.2027) und Übergabe `t059` (02.03.) verschieben sich; Abstimmung `t030` (04.03.), alle übrigen Termine und das Musterende bleiben. Muster-Planner (Aufgabenbibliothek) **v0.3.2** aus v1.4 neu erzeugt: Inhalt unverändert, A5-Vorbereitungskarten enden am 02.03.; alle Prüfungen OK (zeitliche Konsistenz: Vorbereitung endet vor M05). Excel-Dateiname folgt jetzt der Version.
- Archivos: `supabase/seed/terminplan-templates.json`, `supabase/migrations/20261114200000_office_lph3_template_v14.sql` (neu), `app/data/muster-planner-lph3-v0.3.json`, `scripts/lph3-bibliothek/build.py`, `app/office-projects.js` (Kartentext v0.3.2), `app/index.html` (`office-projects.js?v=office49`), `docs/LPH3-AUFGABENBIBLIOTHEK-v0.3.md`; Tests: `office-core`, `terminplan-planning` (v1.3-Migration bleibt geprüft: v1.4 ändert nur t058/t059; neue Prüfung v1.4-Migration = Seed), `office-lph5-v02`, beide Muster-Planner-Tests.
- Base de datos: migración `20261114200000_office_lph3_template_v14.sql` — aplicada en Supabase: sí (14.11.2026, `net.http_get` der Datei auf Commit `4ad194a`, SHA-256 geprüft, eingetragen in `supabase_migrations.schema_migrations`); v1.4 aktiv, v1.3 inaktiv.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` 300/300; `build.py` alle Prüfungen OK; v1.3-Termine vor der Änderung exakt reproduziert.
- Quedó pendiente o sin probar: —. Eine laufende Projektinstanz wurde auf Garis Wunsch separat fortgeschrieben (Details in der Projektakte, nicht hier).
- Riesgos o decisiones que necesitan a Gari: 20 AT Vorbereitung laufen im Muster parallel zu `t011` (Vorabzug 02 fortschreiben) – Personalbedarf.
- PR: #94

### 2026-11-14 · Muster-Planner-Link aus der Terminplan-Karte, Kartentext v0.3.1, «Listenansicht» · Claude
- Qué cambió y por qué: (1) In der Karte «Muster-Terminplan LPH 3» führte «Muster-Planner ansehen» in der iPhone-App zu Work mit dem zuletzt gewählten Projekt (Bernried). Seit #85 (13.11.) war der Link ein reiner #-Wechsel (`./#section=work&muster=LPH3`); die Tab-Leiste der App fängt ihn ab. Vorher und in der separaten Muster-Planner-Karte (funktioniert) ist es eine volle Navigation über `../muster-planner.html` – jetzt wieder beide so. (2) Die Muster-Planner-Karte nannte noch «v0.2.1 · 57 TBA-Aufgaben» → «v0.3.1 · 7 Abgabe-Buckets · 52 TBA-Aufgaben»; ein Test prüft den Text gegen das JSON. (3) Gari sah die Buckets hochkant untereinander: Die Listenansicht ist auf seinem iPhone eingeschaltet (pro Gerät gespeichert, `minds-work-mobile-planner-layout-v1`); Isabella hat denselben Schalter («Vista lista») mit derselben Voreinstellung (Spalten). Gemessen: hochkant mit Spalten nebeneinander (300 px), mit Liste untereinander ohne Überlappung. Der Knopf hieß nur «Liste» (neben «‹ Terminpläne» leicht als Navigation zu lesen) → «Listenansicht», wie Windows «Vista lista».
- Archivos: `app/office-projects.js`, `app/work.js` (Knopftext), `app/index.html` (`work.js?v=office47`, `office-projects.js?v=office48`), Tests: beide Muster-Planner-Tests (Link über `muster-planner.html`; neuer Test Kartentext = JSON), fünf Tests mit `work.js?v=`.
- Base de datos: keine.
- Deploy de funciones: ninguno.
- Cómo se probó: `node --test tests/*.test.cjs tests/*.test.mjs` 299/299; Chromium-Test des Muster-Planners 5/5 lokal; Toolbar hochkant gerendert.
- Quedó pendiente o sin probar: der Link in der iPhone-App selbst (nicht automatisierbar hier); er nutzt jetzt denselben Weg wie die Karte, die bei Gari funktioniert.
- Riesgos o decisiones que necesitan a Gari: Listenansicht am iPhone einmal antippen, um wieder Spalten zu sehen (Einstellung bleibt auf dem Gerät).
- PR: #93

### 2026-11-14 · Planner wieder wie bei Isabella: «Liste» ohne überlappende Buckets, quer alle Karten · Claude
- Qué cambió y por qué: Gari meldete am iPhone (Muster LPH 3 und Planner Bernried) übereinanderliegende Buckets in «Liste» und im Querformat unsichtbare Karten; im Planner von Isabella (Window) funktioniert es. Vergleich mit Window (`gari01234/minds@d45775c`): alle Planner-Stylesheets sind identisch, nur Office lädt zusätzlich `office.css`. Fünf Regeln von Office #38 (05.11.) überschrieben Windows Layout: `.work-bucket{flex:0 0 328px}` / `flex-basis:300px` (in der Liste wird die Breite zur Höhe → 300 px hohe Buckets, Karten laufen über den nächsten), `.work-bucket-scroll{max-height:calc(100dvh - 260/250px)}` (quer ~130 px Kartenbereich) und `.work-board{…align-items:stretch…}`. Diese fünf Regeln sind entfernt; es gilt wieder Windows Layout. Gerendert mit Window-CSS, Office alt und Office neu bei 390×844 (Spalten und Liste), 844×390 und 1440×900: Office neu = Window in allen Fällen. «Liste» wird pro Gerät gespeichert (`minds-work-mobile-planner-layout-v1`), daher betraf es Muster und Projekte zugleich.
- Archivos: `app/office.css` (fünf Regeln entfernt, Kommentar), `app/index.html` (`office.css?v=office42`), `tests/office-planner-layout.test.mjs` (neu: office.css darf Board/Bucket/Kartenbereich nicht dimensionieren; Windows Listen-/Desktopregeln vorhanden), `tests/browser/office-musterplanner.chromium.mjs` (neuer Harness mit allen Stylesheets der echten Seite; Liste ohne Überlappung, quer keine versteckten Karten, Desktop in einer Reihe).
- Base de datos: keine.
- Deploy de funciones: ninguno.
- Cómo se probó: die neuen Tests schlagen mit dem alten `office.css` fehl (Bucket 300 px bei 756 px Inhalt; quer 130 von 3587 px) und bestehen jetzt; Chromium 5/5 lokal; `node --test tests/*.test.cjs tests/*.test.mjs` 298/298.
- Quedó pendiente o sin probar: Prüfung auf Garis iPhone; ggf. Seite neu laden, bis `office.css?v=office42` aktiv ist.
- Riesgos o decisiones que necesitan a Gari: keine. Lehre: Office soll Windows Planner-Layout nicht überschreiben; der alte Test-Harness lud nur 5 Stylesheets und konnte das nicht sehen.
- PR: #92

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
