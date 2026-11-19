# TBA Office · Kostenmodell v0.1 · Architektur- und Validierungsvertrag

Stand: 19.11.2026 · **Technischer Prototyp zur Prüfung**. Keine fachliche Freigabe, kein DIN-konformer Kostenbericht, keine produktive Integration. Dieses Dokument enthält keine geschützten Kostengruppentabellen, Normtexte, Herstellerpreise oder Projektdaten.

## Ziel und Grenze

Ein bearbeitbarer Kostenstand soll künftig mit Terminplan, kanonischem Planner (`isabella_tasks`), Fachplanerbeiträgen, Architekturunterlagen, Produktregister und Bemusterungsmappe verknüpft werden. Jede Kostenposition braucht eine stabile Identität; Dokumente sind **Ansichten** auf Datenobjekte, spätere Ausgaben unveränderliche Versionsstände. Dieser PR legt ausschließlich einen **reinen deterministischen Rechenkern** an: keine UI, keine Datenbank, keine Migration, keine neuen Berechtigungen, kein KI-Aufruf.

Nicht enthalten: DIN-276-Katalog oder Kennziffern-Verzeichnis, HOAI-Honorarermittlung, Umsatzsteuerrechnung, Vergabe/Abrechnung, GAEB, IFC-Mengenermittlung, Preisindizes, Kostenfreigabe, Romy-Automatik. **`status=ready` bedeutet nur, dass Pflichtfelder dieses Prototyps vorhanden sind; niemals eine fachliche Abnahme oder DIN-Konformität.**

## Beobachteter Office-Kontext

Die aktuelle Muster-Bibliothek LPH 3 v0.3.4 hat 53 Aufgaben und 355 Prüfpunkte; `L3.KOB.1` betrifft die Kostenberechnung, `L3.MAT.1` Produktrecherche und `L3.A5.ABS` Bemusterungsentscheidungen. Projektaufgaben sind kanonische `isabella_tasks` mit `metadata.office_planner.terminplan` (Vorgangs-IDs). Kein Kostenmodell darf diese Aufgaben oder Terminplan-Baselines als Nebenwirkung verändern. Der reale Bernried-Kostenstand wurde hier **nicht** geladen oder verändert.

## Berechnungsschnittstelle

Datei: `app/office-kosten-core.js`. CommonJS sowie Browser-Global `TBAOfficeKostenCore`; reine Funktion `calculate(model)`, keine Seiteneffekte. Ein ausschließlich synthetischer Test:

~~~js
const model = {
  schema: 'tba.office.kosten.v0.1',
  projectId: 'synthetic-only',
  purpose: 'kostenberechnung',
  classification: {system: 'project-specific', edition: 'test-1'},
  currency: 'EUR', taxBasis: 'net',
  positions: [{
    id: 'A', label: 'Testposition', groupCode: 'KG-A', unit: 'm2',
    quantity: '2.5000', unitPriceEur: '100.0000', priceDate: '2026-11-19',
    quantitySource: {kind: 'manual', reference: 'Synthetisches Prüfaufmaß'},
    priceSource: {kind: 'manual', reference: 'Synthetischer Testpreis'}
  }]
};
const result = TBAOfficeKostenCore.calculate(model);
// result.knownSubtotalCents === '25000'; result.totalCents === '25000'
~~~

Die Inhalte sind synthetisch. `groupCode` ist eine übergebene Zeichenkette; der Prototyp erfindet, validiert oder lizenziert keine DIN-Kostengruppen. Die Oberfläche muss `de-DE`-Zahlen später explizit und ohne mehrdeutige Heuristiken in kanonische Punkt-Dezimalstrings umwandeln.

`quantity` und `unitPriceEur` müssen nichtnegative **Strings** mit maximal vier Nachkommastellen sein. Berechnet wird mit `BigInt`, je Position kaufmännisch auf Cent gerundet (`half up`), Ergebnis als **Cent-String**, nicht als Gleitkommazahl. `EUR` und `net` sind ausdrücklich verlangt; keine USt-Annahme. Doppelte Positions-IDs, negative Preise, Exponenten, Kommadezimalzahlen und `Number`-Preise werden abgewiesen. Eine echte Null ist zulässig; unbekannte Mengen oder Preise (`null`) werden **nicht** auf Null gesetzt.

Fehlen Gruppe, Einheit, Mengen- oder Preisquelle oder valides Preisdatum, bleibt die Position `incomplete`. `knownSubtotalCents` bleibt für rechnerisch bekannte Werte sichtbar, während `totalCents` bei jeder offenen Position `null` ist; dasselbe gilt für unvollständige Gruppen. Auch ein **leeres Modell** wird nicht als bestätigte Null-Kostenberechnung ausgegeben. Diese maschinelle Vollständigkeit sagt noch nichts über den realen Leistungsumfang: Doppelleistungen, Pauschalen, Aufschläge, Zuschläge und fehlende Kostengruppen benötigen einen zusätzlichen Fachvertrag.

## Rechtlicher und fachlicher Stand

DIN 276:2018-12 ist die recherchierte aktuelle Ausgabe für Kosten im Bauwesen. Nach **HOAI § 4 Abs. 1** wird bei `anrechenbare Kosten` ausdrücklich DIN 276-1:2008-12 zugrunde gelegt. **HOAI § 2 Abs. 11** definiert die Kostenberechnung auf Grundlage der Entwurfsplanung mit Zeichnungen, Mengen und Erläuterungen und fordert bei der dortigen Kostengliederung mindestens die zweite Ebene. Diese Zwecke dürfen nicht durch eine automatische Umbenennung von Gruppen vermischt werden. Primärquellen: https://www.gesetze-im-internet.de/hoai_2013/__2.html und https://www.gesetze-im-internet.de/hoai_2013/__4.html.

Vor einem produktiven Modul: Volltext und Normstand fachlich prüfen, Nutzung der Kostengliederung lizenzrechtlich klären, Vertrag und Abgabeanforderungen bestätigen. Keine geschützten Normtabellen oder BKI-/DBD-/SIRADOS-Bibliotheken ohne Berechtigung in das **öffentliche** Repository kopieren.

## Ziel-Datenmodell (Vorschlag, noch keine SQL-Tabellen)

`Kostenstand`: Projekt, Zweck, Ausgabe der Klassifikation, Preisstand, Steuermodus, Revision, Freigabe. `Kostenposition`: stabile UUID, Stand-ID, Gruppe, Objekt-/Raum-/Bauteilbezug, Menge, Einheit, Preis, Berechnungsart, Quellen, Zuständigkeit, Status. `Kostenquelle`: Dokument/Angebot/Schätzung mit Datum und konkreter Version. `Kostenelement`: optionale Bauleistung aus mehreren nachgewiesenen Bestandteilen. `Kostenlink`: Verweise zu Produkten/Bemusterungsmappe/Plan/Fachplanerbeitrag/Planner-Aufgabe/Terminplan-Vorgang ausschließlich über IDs und Projektgrenzen. `Kostenfreigabe`: unveränderlicher Ausgabe-Snapshot mit Version, Dokumentreferenzen und Nachweis.

Eine Produktwahl darf keine Kostenposition stillschweigend aktualisieren. Fachplanerbeiträge behalten ihren Urheber und ihre Freigabe; zu möglichen Preisfolgen nur Vorschläge. Für spätere neue Tabellen gilt das etablierte Office-RLS-System mit `private.office_*`, `office_project_members` und serverseitiger Autorität. Keine `service_role`-Keys in Browsercode.

## Etappen und Abnahmegrenzen

**A · Dieser PR:** Deterministische Arithmetik, eindeutige IDs, fehlende Nachweise und unvollständige Stände; rein synthetische Node-Tests. Kein UI, keine Produktionsdaten, kein Deploy.

**B · Fachvertrag:** Mit TBA eine anonymisierte, rechtmäßig verwendbare LPH-3-Kostenberechnung und zwei Revisionen sowie ein Bau-/Produktbeispiel prüfen. Festzulegen: Kostengruppentiefe, Mengenarten, Rundung, Pauschalen, Prozentpositionen, USt, Vor-/Nachkalkulationsabgrenzung, Doppelleistungen, Preisquellen und Berichtsgestalt. Die aktuelle Rundung ist eine **technische Pilotentscheidung**, keine geprüfte Vertragsregel.

**C · Daten & Sicherheit:** Versionierte Stände und Quellen, projektgebundene RLS, fachliche Freigaben, Audit-Trail. Zwei Projekte/zwei Nutzer und Negativfälle in rollbackbaren Transaktionen prüfen, bevor irgendeine Migration angewendet wird.

**D · Editor und Dokumente:** Deutsche Oberfläche, Gruppen-/Positions-/Quellenansicht, differenzierter Arbeitsstand und freigegebene Version, XLSX/PDF-Export, XLSX-Import-Vorschau mit ausdrücklicher Bestätigung und unabhängige Summenprüfung.

**E · Verknüpfung und Romy:** Zunächst read-only zu `L3.KOB.1`, Terminplan, Produkte, Fachplanern und Bemusterung. Änderungen als nachweisbare Vorschläge; keine automatische Preisfortschreibung, kein autonomer Versand. GAEB X51, IFC und kommerzielle Kostenquellen nur nach fachlicher und lizenzrechtlicher Prüfung.

## Validierung

Am 19.11.2026 **11 lokale, synthetische Node-Tests bestanden**; der vollständige Office-Testlauf und die CI müssen im PR gesondert verifiziert werden. Kein authentifizierter Browser-Test, keine reale Kostenberechnung, keine Datenänderung, keine Freigabe oder Konformitätsprüfung. Die erste fachliche Abnahme bleibt offen.
