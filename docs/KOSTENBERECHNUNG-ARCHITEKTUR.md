# TBA Office · Kostenberechnung LPH 3 · Architektur und Entwicklungsvertrag

**Stand:** 20.11.2026 · Review-Stand für Claude  
**Dokumentstatus:** Konsolidiertes **Zielbild v1.0**, zur fachlichen und technischen Prüfung. Es beschreibt die angestrebte Anwendung, **nicht** eine bereits implementierte oder normativ freigegebene Lösung.  
**Geltungsbereich:** TBA Office, interne Kostenberechnung der Leistungsphase 3, DIN 276:2018-12 bis zur dritten Ebene.  
**Dokumentverantwortung:** TBA; Änderungen über überprüfbare GitHub-PRs.  
**Eine maßgebliche Quelle:** Nach Annahme dieses PRs wird **diese Datei** die zentrale produktbezogene Sollbeschreibung. Ihr Dateiname bleibt auch bei Revisionen stabil. Frühere Gespräche und der technische Entwurf in PR #107 sind Quellen bzw. Experimente, keine konkurrierenden Soll-Versionen.

> **Leitidee:** Ein Kostenstand ist keine isolierte Tabelle. Er ist eine editierbare, prüfbare und versionierte wirtschaftliche Sicht auf das Architekturprojekt. Archicad liefert modellbasierte Mengen; Office verbindet Mengen, Kosten, technische Entscheidungen, Produkte, Dokumente, Aufgaben und Termine. Verbindliche Änderungen bleiben überprüfbar und werden nicht stillschweigend propagiert.

## 1. Entscheidungsstand und Grenzen

| Thema | Stand | Verbindliche Richtung |
| --- | --- | --- |
| Zweck | **Abgestimmt** | Kostenberechnung für LPH 3, **DIN 276:2018-12 bis 3. Ebene**; kein AVA-Gesamtsystem. |
| Ausgabestruktur | **Abgestimmt** | DIN-Kostengruppen als vollständiger, versionsgebundener Baum. Unter einer Gruppe der 3. Ebene sind mehrere interne **Kostenansätze** möglich; sie sind keine vierte DIN-Ebene und keine LV-Positionen. |
| Hauptarbeitsfläche | **Abgestimmtes Konzept** | Kostengruppenbaum, direkt bearbeitbare Kostentabelle, rechter Kontextbereich für Mengen, Preisbasis, Quellen, Verknüpfungen und Prüfungen. Konkrete UI noch zu erproben. |
| Kernfunktionen | **Abgestimmt** | Kostenansätze, Mengenbuch, Kostenelemente, Preisdaten, Prüfungen, Kostenvergleich, Revisionen, XLSX/PDF und Freigabestände. |
| Archicad | **Abgestimmt** | **Archicad 26 bleibt geometrische Quelle**; Office ist kein zweites BIM-Modell oder Aufmaß-CAD. Mengenbuch verwaltet Herkunft, wirtschaftliche Verwendung und Ergänzungen. |
| Datenaustausch Archicad | **Vorgeschlagene Reihenfolge** | Zuerst Interaktive Auswertungen → XLSX, danach gegebenenfalls Tapir/read-only Bridge, später IFC/IfcOpenShell. Jede Stufe braucht einen eigenen Praxistest. |
| Office Living Documents | **Abgestimmt** | Gemeinsame Datenobjekte statt mehrfach abgeschriebener Werte; Dokumente bleiben eigenständig editierbare Sichten, freigegebene Ausgaben unveränderlich. |
| Romy | **Abgestimmte Richtung** | Ein kontextueller Assistent über dem vorhandenen Office-Runtime, keine zweite KI. Zuerst lesend/prüfend; Änderungen nur nach vorhandenen Berechtigungs- und Freigaberegeln. |
| Software-Wiederverwendung | **Abgestimmt** | Anforderungen vor Technologieentscheidung; Open-Source-/Lizenzprüfung **vor** Ausbau des Eigenbaus. |
| Norm-/Vertragsprüfung | **Offen** | Verbindlichen DIN-Volltext, Nutzungsrechte, Abgabetiefe, Rundung, Umsatzsteuer und projektspezifische vertragliche Regeln prüfen. |
| Kosten-Datenquellen | **Offen** | Eigene belastbare Referenzen und rechtmäßig lizenzierte Fremddaten; keine importierten Preise ohne Herkunft und Nutzungsrecht. |

**Ausdrücklich außerhalb des Produkts v1:** Leistungsverzeichnisse, Ausschreibung, Vergabe, Preisspiegel von Bietern, Auftragserteilung, Abrechnung, Rechnungsprüfung, Kostenfeststellung, Baustellencontrolling, vollständiges BIM-5D, Honorarermittlung nach HOAI und autonome Modelländerungen. GAEB ist kein Startkriterium. Eine spätere Ergänzung braucht eine eigene begründete Entscheidung.

**Normbezug:** DIN Media führt DIN 276:2018-12 „Kosten im Bauwesen“; für die Ermittlung `anrechenbarer Kosten` verweist HOAI § 4 ausdrücklich auf DIN 276-1:2008-12. HOAI § 2 und DIN-Kostenermittlung dürfen nicht als identischer Vertrag behandelt werden. Insbesondere fordert HOAI § 2 im dort geregelten Zusammenhang für die Kostenberechnung mindestens die **zweite** Ebene, während das TBA-Zielprodukt die **dritte Ebene der DIN 276:2018-12** ausdrücklich als fachlichen Projektstandard vorsieht. Diese zusätzliche Tiefe ist kein HOAI-Honorarmodul. Ziel dieses Produkts bleibt die detaillierte LPH-3-Kostenberechnung bis zur dritten Ebene; ein HOAI-Honorarmodul entsteht nicht. Rechts-/Normquellen: https://www.dinmedia.de/de/norm/din-276/293154016 · https://www.gesetze-im-internet.de/hoai_2013/__2.html · https://www.gesetze-im-internet.de/hoai_2013/__4.html . Die vollständige Kostengliederung darf nur aus einer geklärten, für die Softwareverwendung zulässigen Quelle eingebunden werden.

## 2. Fachlicher Gegenstand

Die drei **normativen Ebenen** bilden die Summierungs- und Ausgabestruktur (beispielhafte Codes `300 → 310 → 311`, ohne Wiedergabe eines Normkatalogs). **Interne Kostenansätze** innerhalb einer Gruppe der dritten Ebene liefern deren nachvollziehbare Berechnungsgrundlage. Ein Ansatz kann auf modellbasierten Mengen, frei definierten Mengen, Kennwerten, Fachplanerbeiträgen oder begründeten Pauschalen beruhen. Ein Ansatz ist kein Leistungsverzeichnis-Eintrag.

Jede Kostengruppe besitzt unabhängig vom angezeigten Geldbetrag einen fachlichen Abdeckungsstatus: `zu_bewerten`, `bewertet`, `offen` oder `nicht_anwendbar` (Arbeitstitel; exakte Zustandsmaschine vor Implementierung prüfen). **Nicht bekannt ≠ 0 € ≠ nicht anwendbar.** Eine formal ausgefüllte Zeile sagt noch nicht aus, dass die zugehörigen Bauleistungen vollständig erfasst wurden.

Beträge werden nicht allein durch ein Sprachmodell berechnet. Mengen, Einheiten, Preise, Rundungs- und Summierungsregeln müssen in einem deterministischen, reproduzierbaren Rechenkern verarbeitet werden. Der genaue Rundungsvertrag sowie Pauschal-, prozentuale und indikative Ansätze sind anhand einer fachlich geprüften Musterrechnung festzulegen. **Das Rundungsverhalten von PR #107 ist ein Versuch, keine fachlich genehmigte Regel.**

## 3. Funktionsvertrag des Zielprodukts

| Bereich | Funktionale Anforderung | Mindestnachweis vor Abnahme |
| --- | --- | --- |
| **Kostengliederung** | Vollständiger Baum der vereinbarten DIN-Ausgabe bis Ebene 3; Suche, Filter, Ein-/Ausblenden, Summen, nicht anwendbare Gruppen; keine verdeckte Normumbenennung. | Normstand, Gruppenzuordnung, Summen und vollständiger Bericht sind prüfbar. |
| **Kostenansätze** | Direkte Tabellenbearbeitung von Beschreibung, Methode, Menge, Einheit, Einzel-/Kennwertpreis, Annahme, Quelle, Verantwortlichem und Status; mehrere Ansätze je KG. | Werte bleiben mit einer konkreten Kostengruppe und Quellenversion verbunden. |
| **Mengenbuch** | Importierte Archicad-Mengen, manuelle Ergänzungen, Formeln, Bezugsmengen und Prüfung von Einheiten; keine eigene CAD-Geometrie. | Jede verwendete Menge ist reproduzierbar oder explizit als unbestätigte Annahme ausgewiesen. |
| **Kostenelemente** | Wiederverwendbare Kosteneinheiten für Bau-/Bauteillösungen, mit dokumentiertem Leistungsumfang und optionalen Komponenten. | Pauschalwert und Zerlegung werden niemals gleichzeitig doppelt summiert. |
| **Preisreferenzen** | Preise mit Einheit, Netto-/Steuerbasis, Preisstand, Region, Quelle, Umfang und Status; eigene bestätigte Referenzen und lizenzierte externe Quellen. | Ein Produktpreis wird nicht als vollständiger Bauleistungspreis behandelt. |
| **Prüfungen** | Fehlende Mengen, Preise, Quellen, widersprüchliche Einheiten, veraltete Quellen, potenzielle Doppelansätze, offene KG und Fachplanerbeiträge. | Ungeklärte Sachverhalte bleiben sichtbar; keine falsche „100 % vollständig“-Behauptung. |
| **Kostenvergleich** | Kostenschätzung ↔ Kostenberechnung sowie Revisionsvergleich; Delta absolut/prozentual, soweit vergleichbar, mit dokumentierter Klassifikations-/Preisstandbasis. | Unterschiedliche Normstände und Bezugsgrößen werden nicht still vermischt. |
| **Dokumente und Ausgabe** | Editierbarer Arbeitsstand, XLSX/PDF, festgehaltener Freigabe- und Übergabestand, nachvollziehbare Berichte. | Freigegebene Ausgaben sind trotz späterer Änderungen exakt rekonstruierbar. |

**Priorität:** Diese acht Bereiche definieren das fachliche Zielbild. Die Umsetzung wird in überprüfbare Inkremente geteilt; ein Teilbereich darf nicht allein wegen seiner frühen technischen Fertigstellung als vollständige Kostenberechnung bezeichnet werden. Variantenvergleiche, geometrische IFC-Auswertung und weitergehende Preisanalytik können später ergänzt werden, ohne die Mindestversion zu blockieren.

## 4. Begriffe, Objekte und Identitäten

Der fachliche Datenbestand wird von seinen Dokumentansichten getrennt. Die folgenden Namen bezeichnen **Domänenobjekte, keine bereits genehmigten SQL-Tabellen**.

| Objekt | Identität und Verantwortung |
| --- | --- |
| **Projekt** | Projektübergreifende Zuordnung und Berechtigungsgrenze. Bestehende Office-Projektidentitäten sind zu verwenden; keine parallele Projektverwaltung. |
| **Kostenberechnung / Kostenstand** | Ein wirtschaftlicher Arbeitsstand zu Projekt, Zweck, Normausgabe, Preisstand und Währungs-/Steuerbasis. Mehrere Revisionen, ein explizit ausgewiesener Arbeitsstand. |
| **Kostengruppe** | Versionsgebundener Normknoten mit Elternbeziehung und Ebene; nur lizenzierte/zulässig gepflegte Inhalte. |
| **Kostenansatz** | Eigenständige stabile ID, KG-Zuordnung, Kalkulationsart, wirtschaftlicher Umfang, Berechnung und Status. Auch bei Verschiebung der Gruppe nachvollziehbar. |
| **Mengenquelle / Mengenstand** | Herkunft aus Archicad-Auswertung, Tapir, IFC, Fachplaner, Plan oder manueller Ermittlung; unverändertes Original bzw. verifizierbare Referenz, Datum, Modellrevision, Importvertrag und Hash. |
| **Mengenwert** | Messgröße, Einheit, Rohwert, Messregel, Referenzen zum Ursprungsobjekt und gegebenenfalls abgeleiteter wirtschaftlicher Wert. |
| **Preisreferenz** | Preis und Einheit, Quelle, Preisart (Angebot, Ist-Kosten, Kennwert, Schätzung ...), Bezugszeitraum, Region, Mengen-/Leistungsumfang und Nutzungsrecht. |
| **Kostenelement** | Wiederverwendbare technisch-wirtschaftliche Lösung; von einer projektbezogenen Verwendung zu unterscheiden. Komponenten können der Fachplanung entstammen. |
| **Produkt / Auswahl** | Produktstammdatum und projektbezogene Bemusterungsentscheidung; nicht identisch mit Preisreferenz oder Bauleistung. |
| **Verknüpfung** | Explizit typisierte Viele-zu-viele-Beziehung zu Raum, Bauteil, Archicad-Objekt, Dokumentversion, Produkt, Fachplaner, Aufgabe und Terminplan-Vorgang. |
| **Prüfung / Freigabe** | Feststellung, Beleg, Verantwortlicher, Zeitpunkt und Entscheidung; fachlicher Freigabestatus ist unabhängig von der automatischen Berechnungsfähigkeit. |
| **Ausgabe-Snapshot** | Unveränderlicher, versionierter Berechnungsstand mit referenzierten Quellständen, Rechenkonfiguration und exportierten Ergebnissen. |

**Quellwahrheit:** Archicad ist maßgeblich für die dort modellierte Geometrie, jedoch nicht automatisch für die wirtschaftliche Zuordnung. Die Kostenberechnung ist maßgeblich für die bestätigte Bewertung. Die Produktkarte ist maßgeblich für ihre Produktdaten, die **projektbezogene Auswahl** für die Bemusterungsentscheidung. Fachplanerbeiträge behalten ihre eigene Urheberschaft und fachliche Zuständigkeit. Planner und Terminplan bleiben maßgeblich für ihre jeweiligen Aufgaben und Termine. Kein Objekt überschreibt die Autorität eines anderen durch bloße Verlinkung.

## 5. Datenfluss und Versionierung

```text
ARCHICAD 26 (Geometrie)
  ├─ Interaktive Auswertung → XLSX/CSV  [erster Weg]
  ├─ Tapir / lokale Read-only-Bridge  [nach geprüfter Machbarkeit]
  └─ IFC / IfcOpenShell  [spätere Ergänzung]
                 ↓
        MENGENIMPORT / MODELLSTAND
   Rohwerte · GUIDs · Regelbasis · Dateien
                 ↓  Zuordnung / Prüfung
               MENGENBUCH
  Modellmengen · Formeln · manuelle Mengen
                 ↓  explizite Auswahl
 KOSTENANSÄTZE ←→ KOSTENELEMENTE ←→ PREISREFERENZEN
        ↓                  ↕
  DIN 276 / 3. EBENE    Produkte / Bemusterung
        ↓                  ↕
  KOSTENSTAND ←→ Fachplaner / Dokumente / Planliste
        ↕
  Planner / Terminplan / Freigabeverfahren / Romy
        ↓
  Versionierte XLSX-/PDF-Abgabe + unveränderlicher Snapshot
```

**Eine Änderung am Modell, Produkt oder Preis erzeugt zunächst einen nachweisbaren möglichen Änderungsbedarf.** Sie überschreibt weder eine bestehende wirtschaftliche Annahme noch einen freigegebenen Kostenstand. Rechenentwürfe und Vorschläge werden als solche gekennzeichnet. Alte Ausgaben bleiben bei neuen Quellrevisionen reproduzierbar.

**Getrennte Revisionen:** Modellstand, Mengenimport, Preisquelle, Kostenarbeitsstand, Bemusterungsentscheidung und Abgabeversion besitzen jeweils eigene Versionsidentität. „Neuester Stand“ ist keine gemeinsame Nummer, die alle gleichsetzt. Die Freigabe hält die verwendeten Versionen explizit fest.

## 6. Archicad 26 und Mengenbuch: präzisierter Vertrag

Das Mengenbuch wird **nicht** als geometrisches Aufmaßprogramm entwickelt. Archicad 26 bleibt das Entwurfs- und Geometriemodell; Office bewahrt Messwerte, Berechnungsgrundlagen, ergänzende Mengen und wirtschaftliche Verwendung. Das Modell wird nicht von Romy und nicht vom Kostenmodul editiert.

**Erster Integrationsweg:** Standardisierte **Interaktive Auswertungen** in Archicad 26 für Elemente, Komponenten und Zonen/Räume. Die Konfigurationen werden als TBA-konforme Schemata versioniert. Export in XLSX/CSV, Import in Office mit Feldmapping, eindeutiger Projekt- und Modellstand-Zuordnung, Prüfvorschau, Fehlerbericht und menschlicher Bestätigung. Die ursprüngliche Exportdatei wird unverändert referenziert bzw. projektsicher archiviert.

**Zweiter Integrationsweg, nur nach Test:** `Tapir` bietet für Archicad 26 den Befehl `GetQuantitiesOfElements` und Open-Source-Beispiele für Materialmengen und Raumoberflächen. Ein **lokaler, read-only Bridge-Prozess** darf über die lokal laufende Archicad-Instanz die ausdrücklich benötigten Daten auslesen und erst nach Authorisierung einen Mengenstand an Office übergeben. Keine allgemeinen Modell-Schreibbefehle, keine offenen TCP-Ports oder ungeprüfte Remote-Bridge. Die offizielle Python/JSON-API und Tapir sind getrennte Möglichkeiten; nicht jeder Wert aus einer Interaktiven Auswertung ist direkt über die offizielle API abrufbar.

**Dritter Integrationsweg, optional:** Versionierter IFC-Export mit dokumentiertem Translator; IfcOpenShell kann Mengen und Objektbeziehungen lesen. IFC ist weder ein erzwungener Eingang noch eine automatisch vollständig äquivalente Mengenquelle.

**Metadatenvertrag mit Ebenentrennung:** **Pro Importstand** werden Projektzuordnung, Originaldatei oder Herkunftsbeleg mit Hash, Erzeugungsweg, Zeitpunkt und – soweit tatsächlich verfügbar – Archicad-Version, Modellstand sowie Filter-/Berechnungskonfiguration gespeichert. **Pro Mengenwert** sind Mengenart, Einheit, ursprünglicher Rohwert und Verweis auf den Importstand erforderlich; Element-GUID, Komponentenkennung und konkrete Messregel werden **nur dann** übernommen, wenn die Quelle diese tatsächlich enthält. Eine fehlende Kennung/Regel ist ausdrücklich als `unbekannt / nicht verifiziert` sichtbar und begrenzt die automatische Zuordnung und fachliche Freigabe, verhindert aber nicht unbedingt eine vorläufige Erfassung. Fehlende Metadaten dürfen nicht aus Namen oder Vermutungen ergänzt werden. Ein Archicad-Element-GUID ist nicht identisch mit einem IFC GlobalId. Identitätswechsel und Importkollisionen werden offengelegt.

**Wirtschaftliche Mengen sind getrennt von Rohmengen.** Die Verwendung eines Werts als Ansatzmenge braucht eine bewusste Mengenart, Umrechnung bzw. Formel und fachliche Begründung; eine geometrische Fläche ist nicht automatisch eine abrechenbare Leistungsmenge. Einheitendimensionen und Umrechnungen sind zu validieren.

**Revisionsvergleich:** Bei erneutem Import zeigt Office unveränderte, veränderte, neue, entfallene und nicht sicher zuordenbare Werte. Mehrdeutige GUID-/Objekt-Zuordnungen erfordern Prüfung; Namen oder Positionen allein sind keine gesicherte Identität. Original-Mengenstände und die damit gerechneten Kostenstände bleiben erhalten.

**Verifikation vor Anbindung:** An einer synthetischen, nicht vertraulichen Kopie in Archicad **26** werden eine mehrschichtige Wand, eine Decke, eine Zone sowie Fenster/Türen in zwei Modellrevisionen geprüft; inklusive unterschiedlich großer Öffnungen, Rundung, Komponenten und Abgleich gegen eine Interaktive Auswertung. Weder die bloße Tapir-Kompatibilitätsangabe noch IFC-Importtests genügen als TBA-Abnahme.

Primärreferenzen: https://help.graphisoft.com/AC/26/GER/_AC26_Help/050_ViewsVB/050_ViewsVB-89.htm · https://help.graphisoft.com/AC/26/GER/_AC26_Help/060_ElementParameters/060_ElementParameters-32.htm · https://github.com/ENZYME-APD/tapir-archicad-automation · https://github.com/IfcOpenShell/IfcOpenShell .

## 7. Kalkulation, Preisquellen und Prüfvertrag

**Eingaben und Berechnungsarten:** Mengenbezug × Einheitspreis; transparente Referenzkennwerte (z. B. €/m² einer definierten Bezugsgröße); fachlich begründete Pauschale; Kostenbeiträge Dritter; und gegebenenfalls strukturierte Kostenelemente. Prozentansätze und Zuschläge nur, wenn ihre Bezugsbasis explizit definiert, der Leistungsumfang nicht doppelt angesetzt und die Methode fachlich bestätigt ist. Formeln dürfen keine unkontrollierten freien Codeausdrücke ausführen.

**Rechendisziplin:** Dezimale Typen und stabile Rundungsregeln, dimensionsgebundene Einheiten, deterministische Aggregation, fachlich dokumentierte Währung/Steuerbasis. Preisstand und Preisquelle sind nicht austauschbar. Es darf keine automatisch erfundene Preisangleichung aus Destatis-Indizes geben.

**Zustandsunterscheidung:** `0 €` als bewusst erfasster Wert, `kein Preis ermittelt`, `nicht anwendbar`, `geschätzt` und `fachlich bestätigt` bleiben unterscheidbar. Fehlende Werte dürfen nicht als Null das Gesamtbudget scheinbar schließen. Eine teilweise bekannte Summe darf angezeigt werden, aber nicht als bestätigter vollständiger Gesamtbetrag.

**Schutz vor Doppelansätzen:** Wenn ein grober Kennwert durch detaillierte Kostenansätze ersetzt wird, muss ein klarer Ablöse-/Ausschlussstatus bestehen. Ein zusammengesetztes Kostenelement wird entweder als Ganzes oder über seine freigegebene Zerlegung gerechnet – nicht beides zugleich. Warnungen sind überprüfbare Hinweise, keine unbegründete Behauptung eines Fehlers.

**Preisdaten und Recht:** Ein Produktregister enthält Hersteller-/Artikelinformationen, technische Unterlagen und projektbezogene Auswahl; ein Preisregister enthält wirtschaftliche Werte mit Datum, Region, Art und Leistungsabdeckung. Das eine speist nicht ungeprüft das andere. Eigene frühere Projektpreise dürfen nur verwendet werden, wenn die Rechte und ihr fachlicher Kontext geklärt sind. BKI, DBD, SIRADOS und DIN-Texte/Kataloge sind keine automatisch frei kopierbaren Datenquellen. DDC-CWICR-Daten sind derzeit nicht für betriebliche Nutzung freigegeben (CC BY-NC 4.0), solange keine geeignete Erlaubnis vorliegt. Destatis-Indizes sind Kontextinformationen, keine Einzelpositionspreise.

**Vergleich:** Kostenschätzung und Kostenberechnung können verschiedene Klassifikationstiefen, Preisstände und Referenzmengen besitzen. Vergleiche ordnen auf eine **fachlich nachvollziehbare gemeinsame Ebene** zu, dokumentieren Unvergleichbarkeit und erfinden keine proportionalen Aufteilungen. Es gibt keinen automatischen HOAI-Anrechenbar-Kosten-Abgleich in v1.

## 8. Arbeitsoberfläche und Dokumente

Die geplante **deutsche** Oberfläche führt in einem Projekt auf einen klar erkennbaren Kostenstand. Links steht der Kostengruppenbaum (Filter, Suchfeld und Abdeckungsstatus), in der Mitte eine editierbare Kostenansatztabelle (Beschreibung, Menge, Einheit, EP/Kennwert, Betrag, Methode, Prüfstatus), rechts die Belege und Bezüge (Mengenbuch, Preisreferenz, Kostenelement, Produkt, Fachplanerbeitrag, Planstand, Änderungsverlauf). Detail- und Revisionsprüfung sollen ohne Wechsel in mehrere unabhängige Dokumente möglich sein.

### Produktanforderung: radikal verständliche Oberfläche (TBA-Rückmeldung 20.11.2026)

**Benutzbarkeit ist eine fachliche Abnahmebedingung, kein kosmetisches Nachprojekt.** Phase0 dient als **visuelle und interaktive Referenz**, nicht als festgelegte Architektur oder kopierbares Design. Das Ziel ist ein sorgfältig gestalteter, ruhiger, deutschsprachiger Arbeitsraum, der die Präzision einer Kostentabelle erhält, ohne die Bedienungslogik einer universellen Tabellenkalkulation oder einer überladenen AVA-Suite zu übernehmen. Die konkrete visuelle Richtung wird vor Implementierung an Mockups und im Büro getestet.

- **Einstieg aus sinnvollen Vorlagen:** „Neue Kostenberechnung“ soll nach Wahl des passenden Projekt-/Normkontexts einen geordneten Arbeitsstand mit vollständigem KG-Baum, klaren leeren/noch offenen Zuständen und nachvollziehbarer Reihenfolge der Arbeit erzeugen. Keine willkürlichen erfundenen Beträge, keine automatisch behauptete Vollständigkeit.
- **Progressive Vertiefung:** Zuerst Projekt, Kostenstand und Kostengruppen; dann Kostenansätze und Mengen/Preise; detaillierte Formeln, Quellen, Verknüpfungen und Versionshistorie erst bei Bedarf im Kontextpanel. Tabellenediting bleibt leistungsfähig (Tastatur, Kopieren, Mehrfachauswahl, Einheiten), wird aber nicht zur frei programmierbaren Excel-Kopie.
- **Informationshierarchie:** Kostengruppen und offene Abdeckung deutlich, Summen und Abweichungen gut lesbar, Warnungen gezielt und begründet; ruhige Typografie, gezielter Weißraum, keine dauerhafte visuelle Alarmierung. Fachlich entscheidende Unsicherheit darf durch Vereinfachung niemals unsichtbar werden.
- **Wiederverwendbare Büropraxis:** TBA-spezifische Kostenelemente, Arbeitsvorlagen und gespeicherte Ansichten sind wichtiger als universell konfigurierbare Module für beliebige Büros. Eine Vorlage ist editierbar, enthält aber nur belegte Daten.
- **Prüfbare Nutzbarkeit:** Prototyp an einem realistischen, anonymisierten Kostenstand durch TBA-Bearbeitende testen: eine Position finden/anlegen, Mengenquelle prüfen, Ansatz korrigieren, fehlende Fachplanerangabe erkennen, Revision vergleichen und ein Ausgabedokument vorbereiten. Verständlichkeit, Fehler und unnötige Arbeitsschritte dokumentieren; UI nicht nach Screenshots allein als angenommen kennzeichnen.

**Unterscheidbare Arbeitszustände:** `Arbeitsstand`, `zur Prüfung`, `fachlich geprüft`, `freigegeben` und `abgegeben` sind als Zielzustände zu spezifizieren; nicht alle dürfen ohne Berechtigungs- und Quellenprüfung erreichbar sein. Ein Rechenalgorithmus darf den Status „fachlich geprüft“ nicht selbst vergeben. Der endgültige State-Machine-Vertrag ist vor SQL/Implementierung zu genehmigen.

**Bericht:** Hierarchie bis Ebene 3, Summen und Zwischensummen, Berechnungsgrundlagen und offene Annahmen, Preisstand, Quellen, Versions- und Freigabenachweis. XLSX bleibt ein interoperables, nachvollziehbares Exportformat; PDF die eingefrorene lesbare Ausgabe. Eine spätere Importfunktion verwendet stets Vorschau und explizite Zuordnung. Die Vollständigkeit des Berichts muss an einem professionellen Muster verifiziert werden.

## 9. Verbindungen zu Office Living Documents

| System / Dokument | Gewünschte Verknüpfung | Autoritätsgrenze |
| --- | --- | --- |
| **Terminplan** | Vorgangs-/Meilenstein-IDs für wirtschaftliche Arbeitsschritte und Abgaben; Terminhinweise. | Kein automatisches Verschieben von Terminplan-Vorgängen oder Baselines. |
| **Planner** | Kanonische Office-Aufgaben (u. a. `L3.KOB.1`), Ergebnisse, Prüfungen, Zuständigkeiten und Bearbeitungsstatus. | Kein Duplizieren der Aufgaben und kein automatisches Erledigen durch PDF-Erzeugung. |
| **Planliste** | Planstand/Version einer Geometrie- oder Mengengrundlage. | Ein PDF-Plan ersetzt nicht die Identität eines BIM-Modellstands. |
| **Bauteilregister / Kostenelemente** | Technischer Aufbau und wirtschaftliche Leistungsabdeckung. | Modelliertes Bauteil, technische Bauphysik-Vorgabe und Kostenansatz sind nicht dasselbe Objekt. |
| **Produktregister** | Fabrikate, Varianten, Unterlagen und Nachweise; optional Preisreferenzen. | Produktpreis ≠ Kosten einer kompletten Bauleistung. |
| **Bemusterungsmappe** | Projektbezogene Auswahl und Alternativen, in Specification und Presentation Mode. | Inspiration, Kandidat und freigegebene Spezifikation bleiben unterscheidbar. |
| **Bauteilkatalog Bauphysik** | Referenzen auf Fachplanungsbeiträge und Revisionen. | Die Bauphysik erstellt den vereinbarten Katalog; Architektur prüft/übernimmt nach eigener Rolle. |
| **Fachplanerbeiträge** | Eingelesene Kostenbeiträge, Annahmen und fachliche Bestätigungen. | Dritte behalten Urheberschaft und Entscheidungshoheit. |
| **Romy** | Kontextuelle Suche, Quellnachweis, Prüfungen und vorbereitete Vorschläge. | Keine stillschweigende Freigabe, Preisänderung oder externe Übermittlung. |

Das sind **Live-Beziehungen**, keine unkontrollierten Live-Überschreibungen. Eine neue Materialauswahl kann einen wirtschaftlichen Prüfbedarf erzeugen; sie ändert einen Kostenstand nicht automatisch. Die Identität einer technischen Lösung darf einen aus Archicad entfernten oder neu erzeugten Modellkörper überdauern.

Die bisherige LPH-3-Bibliothek v0.3.4 (53 Aufgaben, 355 Prüfpunkte) bietet projektbezogene Anknüpfungspunkte; sie ist laut Office-Dokumentation **noch nicht fachlich freigegeben**. Vor allem `L3.KOB.1`, `L3.MAT.1`, `L3.A5.ABS` und die Bauphysik-Katalog-Aufgaben dürfen erst nach expliziter Zuordnung angebunden werden. Die Task-IDs und Terminplan-Vorgang-IDs des Projekts, nicht bloße Titel/PSP-Anzeigen, sind technische Referenzen.

## 10. Assistent, Sicherheit und Datenhoheit

**Romy:** kein neues Agent-Runtime. Der Kostenbereich erhält einen kontextuellen Einstieg in den bestehenden Office-Assistenten, ähnlich dem Terminplan-Assistenten. Zuerst darf Romy nach Berechtigung lesen, Quellen verknüpft erläutern, offene Kostengruppen zeigen, Revisionsdifferenzen zusammenfassen und dokumentierte Fachplaner-Lücken markieren. Später darf sie Kostenansätze **vorschlagen** oder Berichtsentwürfe vorbereiten; jede verändernde Aktion benötigt die im Office geltende serverseitige Autorität und gegebenenfalls ausdrückliche Prüfung. Die KI berechnet keine endgültigen Geldsummen und erklärt fehlende Quellen nicht als Null.

**Kontextbezogene Assistenz im Kosteneditor – zusätzliches UX-Prinzip (TBA-Rückmeldung 20.11.2026):** Romy soll sichtbar *an der gerade betrachteten Kostengruppe, Position, Menge oder Revision* helfen, ohne den Benutzer zu einem separaten generischen Chat zu zwingen. Ein ruhiges, aufrufbares Seitenpanel kombiniert natürliche Sprache mit gezielten Funktionen: „Quelle dieser Menge zeigen“, „Offene Angaben zusammenstellen“, „Warum hat sich diese Gruppe verändert?“, „Entwurf eines Ansatzes vorbereiten“. Vorschläge erscheinen **direkt neben den betroffenen Zeilen**, enthalten Herkunft, Annahmen, Auswirkung und eine überprüfbare Vorher/Nachher-Vorschau; sie dürfen angenommen, bearbeitet oder verworfen werden. Es gibt keine ungefragten, verdeckten Datenänderungen. Der Assistent öffnet sich nicht zwangsläufig bei jedem Aufruf und reduziert nicht die sichtbare Nutzfläche des Editors.

**Referenzgrenze Phase0:** Der öffentlich dokumentierte Phase0-KI-Agent (Stand November 2026) konzentriert sich auf die Erstellung, Prüfung und Bepreisung von **Leistungsverzeichnissen**. Für das TBA-Produkt werden **keine** LV-Funktionen übernommen. Übertragbar ist das **Interaktionsprinzip** der in die Arbeitsfläche integrierten, überprüfbaren Hilfe, nicht eine unbelegte Fähigkeit zur automatischen DIN-276-Kostenberechnung der LPH 3. Quellen: https://www.phase0.com/warum-phase0 · https://www.phase0.com/presse/ki-agent-leistungsverzeichnisse-ava-software .

**Mandant und Daten:** TBA Office bleibt von der persönlichen Window-Installation getrennt. Supabase Office ist die persistente Source of Truth für genehmigte Kostenstände und Projektbeziehungen. Zugriffe nur innerhalb bestätigter Office-Projektmitgliedschaft; neue Tabellen erfordern projektgebundene RLS mit den vorhandenen `private.office_*`-Hilfen, getesteten Negativfällen und nachvollziehbaren Schreibrechten. Ein Archicad-Bridge-Prozess bekommt nur die kleinstmöglichen Lese- und Upload-Rechte. Weder Archicad-Dateien noch Kundenkosten, Angebote, Herstellerunterlagen oder vertrauliche Mengen werden in das **öffentliche GitHub-Repository** eingecheckt.

**Provenienz:** Jeder maschinell erzeugte Wert und jede Aussage über „vorhanden“, „nicht vorhanden“ oder „veraltet“ muss den geprüften Datenbestand und seinen Stichtag nennen. Nicht importierte Unterlagen sind **unbekannt**, nicht nachweislich nicht existent. Ein automatisch erzeugter Bericht ist kein fachlicher Freigabebeleg. Freigaben und Änderungen sind auditierbar, bestehende Versionen nicht destruktiv zu überschreiben.

## 11. Open-Source-Entscheidung erst nach Funktionsprüfung

Der technische Unterbau ist ausdrücklich **nicht entschieden**. Der Entwurf aus PR #107 (`app/office-kosten-core.js` plus synthetische Tests) ist ein isolierter Referenz-/Vergleichsversuch; er wird weder als fertiger Kalkulationskern noch als beschlossene Integrationsarchitektur behandelt. **PR #107 bleibt Draft und wird nicht mit diesem Dokument zusammengeführt.**

| Kandidat | Was genau prüfen | Besondere Schranke |
| --- | --- | --- |
| **Open Calc Studio** (LGPL-3.0) | Reiner JS-Rechenkern, Editor/Embed, Ansätze, Quellen, Mengenformeln, Varianten/Revisionen; Vergleich mit Anforderungen dieses Dokuments. | Lizenz-/Integrationsprüfung, fachliche Genauigkeit, deutschsprachige Norm-/Ausgabeanpassung, laufende Entwicklung. |
| **BIT-Atelier** (MIT, Drittkomponenten getrennt) | DIN-276-orientierter Editor, Kostengruppen, Tabellenlogik und Prüfungen als isolierbare Module. | Neuheit des Projekts, Stabilität/CI, Qualität der Kostenmethodik. |
| **IfcOpenShell/Ifc5D** (Lizenz je Komponente) | IFC-Mengenbezug und Objektidentität; späterer Anschluss. | Nicht Voraussetzung für v1, keine Annahme vollständiger Mengen. |
| **Tapir** (MIT) | Archicad-26-Mengenabfrage, Material-/Raumbezug, Read-only-Betrieb, Einheiten und Modellrevisionen. | Installation/Live-Test, lokale Verfügbarkeit, Zugriffsschutz und API-Grenzen. |
| **pyGAEB** (MIT) | Optionale künftige Dateiinteroperabilität. | Keine AVA-/GAEB-Pflicht für v1, X51-Roundtrip separat zu beweisen. |
| **Preisquellen** | Rechte, Preisart, Stand, Region, wirtschaftlichen Umfang und Importvertrag. | Proprietäre Kataloge und NC-Daten nicht ohne Erlaubnis übernehmen. |

**Auswahlprinzip:** Ein externes Modul wird nur übernommen, wenn es eine im Zielprodukt benötigte Fähigkeit zuverlässig erfüllt und Integration, Datenschutz, Lizenz, reproduzierbare Rechnungen sowie Wartung nachweislich günstiger sind als Eigenentwicklung. Die Open-Source-Suche folgt der Funktion, nicht umgekehrt. Die endgültige Wahl wird hier mit Entscheidung, Testbeleg und Lizenzstand dokumentiert. **Phase0** ist Referenz für verständliche Vorlagen, klare Interaktionshierarchie und kontextgebundene KI; kein Open-Source-Kandidat und kein Nachweis der TBA-Eignung ohne einen realen UI-Test.

## 12. Entwicklungsfolge mit Abnahmetoren

| Gate | Arbeitsergebnis | Eintritts-/Abnahmekriterium |
| --- | --- | --- |
| **G0 · Architektur** | Dieses Dokument als einzige Sollbeschreibung und nachvollziehbares Entscheidungsregister. | TBA bestätigt Zielbild; bisherige Gesprächstexte werden nicht als zusätzliche parallele Spezifikation weitergeführt. |
| **G1 · Fachliche Referenz** | Rechtmäßig verwendbarer, anonymisierter LPH-3-Kostenstand, Kostenschätzung und **zwei Revisionen**; Beispiel zu Bauteil, Mengen und Preisen. | Dritt-Ebenen-Struktur, Netto/USt, Formeln, Pauschalen, Rundung, Berichtsanforderung, Norm-/Lizenzlage und Quellenarten fachlich geprüft. |
| **G2 · Reuse-Spike** | Isolierter Vergleich von Open Calc Studio, BIT-Atelier und PR #107 anhand identischer synthetischer Fälle, zusätzlich statische Prüfung der Tapir-/Archicad-26-Schnittstellen. | Rechenfehler, Quellen-/Fehlerzustände, API/Embed, Lizenz, Sicherheit, UX und Integration dokumentiert; die Tapir-Live-Prüfung ist **keine** Voraussetzung für einen zunächst manuellen Editor. |
| **G3 · Fachliches und technisches Schema** | Versionierte Domänenobjekte, Mengenimporte, Referenzen, Freigabestände und testbare Berechtigungen. | Zwei-Projekt-/Zwei-Nutzer-Negativfälle, RLS, Audit, unveränderliche Snapshots und Lösch-/Revisionsschutz im lokalen Test. Keine produktive Migration vor Review. |
| **G4a · Benutzbarer Editor** | Deutsche Oberfläche: Kostengruppen, TBA-Vorlage, editierbare Ansätze, manuelle Mengen, Quellen, Summen und offene Zustände; zunächst rein synthetisch. | Ein repräsentativer Ansatz ist ohne Excel-Überfrachtung bearbeitbar und deterministisch nachrechenbar; **keine** vollständige fachliche Kostenberechnung behaupten. |
| **G4b · Fachlich vollständiger Kern** | Mengenbuch mit Archicad-XLSX-Import, Kostenelemente, Prüfungen, Kostenvergleich, revisionsfeste Freigabe, XLSX/PDF; Validierung gegen anonymisierten TBA-Referenzfall. | Mengen, Einheiten, Rundung, Doppelansätze, Preisstand, Quellen und Ausgabe sind durch Fachtest nachvollziehbar; erst hier fachliche Abnahme möglich. |
| **G5 · Verknüpfte Dokumente** | Lesen/Verknüpfen von Planner, Terminplan, Planliste, Produktregister, Bemusterung und Bauphysik-Dokumenten über stabile IDs. | Revisionsänderungen erzeugen Prüfbedarf ohne stille Mutation; fachliche Rollen und Projektgrenzen werden respektiert. |
| **G6 · Romy-Kostenassistent** | Kontextuelle, quellenbezogene Analyse und vorbereitete Berichte/Vorschläge. | Berechtigungen, nachvollziehbare Belege, Quellen-Staleness und Bestätigung für Änderungen; keine unautorisierten Writes oder Sendungen. |
| **Optionale Gates** | Tapir-Live-Bridge, IFC, Preis-API, Varianten und weitere Interoperabilität. | Nur nach nachgewiesenem Nutzen im Arbeitsablauf und separater TBA-Freigabe. |

G2 darf parallel zur fachlichen Vorbereitung von G1 untersucht werden, **nicht** aber die Anforderungen still ersetzen. Die praktische Archicad-Prüfung erfordert eine echte Archicad-26-Installation; aus GitHub-Code oder Graphisoft-Hilfetexten allein kann kein bestandenes TBA-E2E behauptet werden.

**Minimale fachliche Abnahmefälle:** vollständiger und unvollständiger Kostenstand; Nullwert/nicht anwendbar/unbekannt; Einheit/Umrechnung; gleiche Leistung doppelt über Kennwert und Detailansatz; manuelle und Modellmenge; veränderte und gelöschte GUIDs; unzuordenbare Mengen; zwei Preisstände; übernommener Fachplanerbetrag; Kostenschätzung mit gröberer Gliederung; zwei Revisionen; eingefrorene PDF/XLSX-Ausgabe; fremdes Projekt; unerlaubte Freigabe; Quellenänderung nach Abgabe. Die Ergebnisse müssen maschinell bzw. fachlich unabhängig überprüft werden.

## 13. Offene Entscheidungen (nicht durch Implementierung vorwegnehmen)

| Frage | Warum offen und was benötigt wird |
| --- | --- |
| **Normkatalog und Nutzungslizenz** | Rechtmäßige Einbindung des vollständigen 2018er DIN-276-Baums in die interne App prüfen. |
| **Fachliche Musterfälle** | Echte/anonymisierte Kostenberechnung, Kostenschätzung, zwei Revisionen und Berichtsmuster von TBA fehlen für Abnahme. |
| **Rechenregeln** | Bezugsgröße für Kennwerte, Varianten, prozentuale Zuschläge, Rundungszeitpunkt, Einheitendimensionen, Netto/USt und Pauschalen freigeben. |
| **Abdeckung und Freigabe** | Wer darf eine Kostengruppe als nicht anwendbar markieren, Kostenstände fachlich prüfen und verbindlich ausgeben? |
| **Archicad-Setup** | TBA-Umgebung (Windows/macOS/Teamwork, Lizenz, vorhandene Auswertungsschemata, Publisher) und Bridge-Akzeptanz lokal testen. |
| **Datenhoheit Dritter** | Welche Fachplanerbeiträge und früheren Projektpreise dürfen gespeichert, wiederverwendet und projektübergreifend recherchiert werden? |
| **Softwarekomponenten** | Keine SDK- oder Implementierungsentscheidung ohne Reuse-Spike, Lizenzprüfung und reproduzierbare Testbelege. |
| **Dokumenteditoren** | Produktregister, Bemusterungsmappe und Planliste brauchen eigene Objektverträge; die hier beschriebenen Links implizieren nicht, dass ihre Editoren schon existieren. |

Diese Punkte sind **nicht** stillschweigend entschieden, auch wenn spätere Implementierungsentwürfe technische Standardwerte vorschlagen.

## 14. Governance, Pflege und Referenzen

**Änderungsregel:** Neue Produktanforderungen, Invarianten und fachliche Abnahmeentscheidungen werden **in dieser Datei** aktualisiert, mit PR, Datum, Begründung und Auswirkungen auf bestehenden Code/Tests. Keine neuen konkurrierenden `Kostenberechnung-v2/v3`-Spezifikationen als parallele Wahrheit. Implementierungsnotizen und Rechercheberichte bleiben nachgeordnete Belege. Änderungen der Konzepte werden ausdrücklich freigegeben; eine Änderung der UI allein ist keine Änderung dieses fachlichen Vertrags.

**Status der Implementierung am 19.11.2026:** Kein produktiver Kosteneditor, keine Kostentabellen und keine Archicad-Kopplung in Office. Der experimentelle Rechenkern in **Draft-PR #107** ist nicht gemergt. Die Architektur in diesem Dokument stellt **keine** Datenbankmigration, Veröffentlichung oder Annahme einer Kostenberechnung dar.

**Referenzdokumentation im Repository:** `docs/ESTADO.md` (Live-Entwicklungsstatus), `docs/BITACORA.md` (Change Log), `docs/LPH3-AUFGABENBIBLIOTHEK-v0.3.md` (Aufgaben/Ergebnisregister), `docs/TERMINPLAN-PLANNER-INTEGRATION-v0.1.md` (historisches Integrationskonzept) und `docs/OFFICE-KOSTENMODELL-v0.1.md` **nur im ungemergten PR #107** (technischer Versuch). Externe, lizenzierte bzw. beschränkte Quellen werden nicht in dieses öffentliche Repo übernommen.

### Entscheidungsverlauf

| Datum | Entscheidung / Einordnung |
| --- | --- |
| 19.11.2026 | LPH-3-Kostenberechnung bis Ebene 3; acht funktionale Kernbereiche; Verbindung zu Office-Dokumenten und eigener Romy-Kontextfläche als Produktziel. |
| 19.11.2026 | Mengenbuch als **Archicad-26-gestütztes** Mengen- und Quellenregister präzisiert; XLSX zuerst, Tapir-Bridge erst nach Live-Test, IFC optional. |
| 19.11.2026 | Reuse-Audit vor Eigenentwicklung; PR #107 bleibt Draft und Vergleichsbasis, keine Produktfreigabe. |
| 20.11.2026 | Review für Claude vorbereitet: importbezogene Metadaten präzisiert, G4 in zwei überprüfbare Inkremente geteilt, unabhängiger Review und Zusammenarbeit über GitHub definiert. |
| 20.11.2026 | Ergänzung aus TBA-Rückmeldung: **Bedienbarkeit, visuelle Klarheit und gute Vorlagen** sind verbindliche UX-Ziele; Phase0 als Referenz für die Integration von kontextueller KI, ausdrücklich **ohne** LV-Funktionen. Umsetzung und konkrete Oberfläche müssen an TBA-Arbeitsfällen geprüft werden. |
| 19.11.2026 | Dieser Konsolidierungsstand v1.0 als **Dokument zur fachlichen Prüfung**, noch nicht als freigegebene Implementierungsspezifikation. |

## 15. Zusammenarbeit mit Claude und ChatGPT · Übergabeprotokoll

**Rollen und Entscheidungsautorität:** Gari/TBA bestimmt fachliche Ziele, Prioritäten, Freigaben und jede produktive Änderung. Claude und ChatGPT sollen kritisch und unabhängig zusammenarbeiten, **nicht** wechselseitig Aussagen ungeprüft übernehmen. Abweichende Vorschläge mit Belegen vergleichen und von Gari entscheiden lassen. Ein gemeinsames Dokument bedeutet nicht, dass ungeprüfte Entwürfe bereits fachlich freigegeben sind.

**Gemeinsame Quelle und Änderungsdisziplin:** Nach Annahme ist **diese eine Datei** der fachliche Vertrag; `docs/ESTADO.md` dokumentiert den tatsächlichen Systemstand, `docs/BITACORA.md` die Änderungen. Vor jeder Arbeit `AGENTS.md` lesen, aktuellen HEAD und PR-Stände prüfen. PR **#108** enthält das Architektur-Draft; PR **#107** enthält nur einen getrennten technischen Rechenkern-Versuch. Nicht voreilig zusammenführen. Keine zweite parallele Architekturfassung anlegen. Repository ist öffentlich: keine echten Projektmengen, Archicad-Modelle, Preisdaten, Angebote oder Kundendokumente hier einchecken.

### Erster Auftrag an Claude: unabhängiges fachlich-technisches Review, **noch kein Code**

Das Dokument ohne Zustimmungspflicht gegen den wirklichen Office-Repository-/Runtime-Stand prüfen. Insbesondere **DIN 276 bis 3. Ebene versus HOAI**, Kostenansatz- und Mengenobjekte, unterschiedliche Mengenquellen aus **Archicad 26**, Modellrevisionen, Einheiten-/Rundungsregeln, Doppelansatzschutz, Preisprovenienz und Datenlizenz, Änderungs- und Freigaberechte mit projektbezogener RLS, Verbindungen zu Planner/Terminplan/Bemusterung/Produktregister, UX-Prinzipien nach Phase0 und die **tatsächliche** Wiederverwendbarkeit von Open Calc Studio, BIT-Atelier und Tapir beurteilen. Die technischen Alternativen offen vergleichen; keine Wahl aufgrund von Marketing oder Lizenzetikett allein.

**Erwartetes Review-Ergebnis:** Für jeden materiellen Befund Abschnitt, belegte Beobachtung/Quelle, Risiko/Auswirkung, konkrete Änderung und nötigen Test nennen. Gesicherte Fakten von plausiblen Hypothesen trennen. **Auch aktiv prüfen, welche Anforderungen für ein einziges kleines Architekturbüro zu komplex sind**, und was man ohne Verlust an professioneller Sicherheit weglassen kann. Keine reine Bestätigung. Review-Kommentare in Draft-PR #108 oder ein zusammenhängender Prüfbericht reichen als erster Arbeitsschritt. Offene Fragen ausdrücklich an Gari adressieren.

**Grenze dieses Auftrags:** Keine SQL-Migration, kein Deploy, keine Produktionsänderung, keine Merge-Aktion, kein sofortiges Ausbauen von PR #107 und keine eigenständige größere Implementierung. Für spätere konkrete Arbeit zuerst ein gemeinsames Arbeitspaket und eine verantwortliche Branch festlegen. Kein gleichzeitiges Bearbeiten derselben Datei ohne Abstimmung. Jeder PR nennt Tests, Quellen, Commit und verbleibende Unsicherheit; alle Office-Schutzregeln aus `AGENTS.md` gelten weiter.

**Kommunikation:** Claude- und ChatGPT-Chats synchronisieren sich nicht automatisch. Gari bzw. GitHub-Kommentare/PRs transportieren neue Erkenntnisse; keiner der beiden Assistenten darf einen direkten Austausch oder eine gegenseitige Freigabe behaupten, wenn beides nicht stattgefunden hat.

