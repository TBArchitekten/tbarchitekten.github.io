/* TBA Office · Projektdokumente · Kern (24.11.2026, Claude, Auftrag Gari: die Bürovorlagen LPH 3 als Dokumente des
   Projekts, im Office bearbeitet). Rein und ohne DOM, im Browser und in Node prüfbar.
   Hier stehen die Spalten der Klärungsliste (L3.KLA) und der Entscheidungsliste (L3.ENV, L3.A3) wie in der Bürovorlage
   LPH3_3_Koordination.xlsx, jede mit Typ; dazu Zählen, Filtern, «überfällig», Datumseingabe, das Zusammenführen bei
   gleichzeitiger Bearbeitung und der Inhalt einer Entscheidungsvorlage (Aufbau wie LPH3_5_Entscheidungsvorlage.docx).
   Gelernt von Programmen mit KI (Recherche vom 24.11.2026): Spalten mit Typ und berechneten Werten (Google Tables),
   Vorschläge mit Fundstelle, die erst gelten, wenn jemand sie übernimmt (Canvas, Tiptap), Verlauf je Zeile (Copilot).
   Romy schlägt nie eine Entscheidung vor; das prüft auch die Datenbank.
   Seit dem zweiten Schritt (24.11.2026): Varianten mit Produkt, Kennwert und Menge aus dem Office, jede Zahl mit Fundstelle
   für das Büro und Beleg für das Dokument; ein Vorschlag ändert an den Varianten nur, was er nennt (optionenZusammen).
   Weitere Listen der Bürovorlage (28.11.2026, Gari: die Listen des Projektstarts im Projekt bearbeiten wie die
   Entscheidungsliste, statt ein Excel herunterzuladen): Fachplanerbedarf, Schnittstellen- und Liefermatrix, Fragenliste und
   Eingang der Beiträge, mit den Spalten und Auswahllisten der Bürovorlage. Termine stehen als Meilenstein (M00 … M11) oder
   als Datum; das Datum eines Meilensteins kommt aus dem Terminplan des Projekts (setzeTermine), wie in der Vorlage aus dem
   Blatt «Projekt». Was die Vorlage mit Formeln rechnet, rechnet der Kern («Zuständigkeit eindeutig?», «Stand»).
   Zweiter Teil (28.11.2026) aus LPH3_2_Planliste.xlsx: Planliste (Plannummer aus dem Planschlüssel des Projekts, je
   Ausgabe der ausgegebene Index), Dokumente, Ausgaben, Verteiler (je Ausgabe das Format), Austausch und Ablage. Die
   Spalten «Ausgabe n» von Planliste und Verteiler gehören zur Ausgabe Nr n der Liste «Ausgaben». */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TBA_PROJEKTDOKUMENTE=api;
})(typeof self!=='undefined'?self:this,function(){
'use strict';

const DISZIPLINEN=[['ALLE','alle Beteiligten'],['ARCH','Architektur'],['TWP','Tragwerksplanung'],['HLS','Heizung, Lüftung, Sanitär'],
  ['ELT','Elektro'],['BPH','Bauphysik'],['BRS','Brandschutz'],['GEO','Geotechnik'],['VER','Ingenieurvermessung'],['FRA','Freianlagen'],
  ['AUF','Förderanlagen (Aufzug)'],['AG','Auftraggeber'],['BEH','Behörde']];
const RUNDEN=['01','02','03'];
const STATUS_KLAERUNG=['offen','in Klärung','gelöst','Vorbehalt','Entscheidungspunkt','entfällt'];
const STATUS_ENTSCHEIDUNG=['vorbereitet','vorgelegt','entschieden','vertagt','entfällt'];
const JA_NEIN=['ja','nein'];
// Felder, die nur jemand aus dem Projektteam setzt, nie ein Vorschlag von Romy (wie die Prüfung in der Datenbank).
const NUR_VON_HAND=['entschieden_am','entscheidung','entscheider','bestaetigt_am'];
// Auswahllisten der weiteren Listen, wie im Blatt «Listen» der Bürovorlage.
const ZUSTAENDIGKEIT=['V','G','B','K','M','F','?','G/K','K/G','G/F','M/F','V/F','–'];
const LEGENDE=[['V','Verantwortung'],['G','plant (Grundleistung)'],['B','plant (Besondere Leistung)'],['K','koordiniert und integriert'],
  ['M','wirkt mit'],['F','liefert Angaben / legt Anforderungen fest'],['?','offen – im Kick-off klären']];
const JA_NEIN_PRUEFEN=['ja','nein','prüfen'];
const BEAUFTRAGT=['ja','nein','angefragt'];
const STATUS_FACHPLANER=['offen','angefragt','Angebot liegt vor','empfohlen','beauftragt','entfällt'];
const STATUS_SCHNITTSTELLE=['v0 Vorschlag','offen – Kick-off','v1 abgestimmt','geändert'];
const STATUS_FRAGE=['offen','beantwortet','Termin vereinbart','entfällt'];
const WER_FRAGT=['Architektur → Fachplanung','Fachplanung → Architektur'];
const BESTAETIGUNG=['stimmt überein','Vorbehalt','ausstehend'];
// Auswahllisten der Planliste (Blatt «Listen» von LPH3_2_Planliste.xlsx).
const PLANARTEN=[['LP','Lageplan'],['GR','Grundriss'],['SC','Schnitt'],['AN','Ansicht'],['DT','Detail'],['TH','Themenplan'],['SO','Sonstiges']];
const STATUS_PLAN=['in Bearbeitung','Teilstand (vorläufig)','Arbeitsstand 01','Stand 02','Endstand LPH 3','ersetzt','entfällt'];
const FORMATE=['A0','A1','A2','A3','A4','Sonderformat'];
const UEBERGABE=['PDF','PDF + DWG','PDF + IFC','PDF + DWG + IFC','–'];
// Ausgaben als Spalten: die Planliste zeigt zehn, der Verteiler acht (wie in der Vorlage).
const AUSGABEN_PLANLISTE=10,AUSGABEN_VERTEILER=8;
// Meilensteine des Muster-Terminplans LPH 3 (Blatt «Projekt» der Bürovorlage). Das Datum steht im Terminplan des Projekts.
const MEILENSTEINE=[['M00','Projektauftakt mit Auftraggeber'],['M00A','Erforderliche Fachplaner beauftragt'],
  ['M01','Vorläufige Planungsgrundlagen an beauftragte Fachplaner übermittelt'],['M02','Kick-off Fachplaner'],
  ['M03','Zieltermin Fachplanungsbeiträge Arbeitsstand 01'],['M04','Entscheidungspunkte an Auftraggeber bereitstellen'],
  ['M05','Entscheidungsbesprechung Auftraggeber · Arbeitsstand 02'],['M06','Abstimmung Entwurfsstand LPH 3 mit Auftraggeber abgeschlossen'],
  ['M07','Abgestimmte Beiträge der beauftragten Fachplaner bereitgestellt'],['M08','Kostenbesprechung · Kostenberechnung mit Kostenschätzung vergleichen'],
  ['M08A','Kostenentscheidung und Budgetabgleich dokumentiert'],['M09','Interne Abgabe und Abschlussprüfung LPH 3'],
  ['M10','Abschlussbesprechung · Ergebnisse LPH 3 übergeben und erläutern'],['M11','Freigabe LPH 3 durch Auftraggeber (vorläufig)']];
// Spalten der Schnittstellenmatrix je Beteiligtem: Feld, Kopf, Kürzel für den Filter, Breite.
const MATRIX=[['z_ag','AG','AG',5.5],['z_beh','Behörde · Prüfung','BEH',8],['z_arch','ARCH','ARCH',6],['z_twp','TWP','TWP',5.5],
  ['z_hls','HLS','HLS',5.5],['z_elt','ELT','ELT',5.5],['z_bph','BPH','BPH',5.5],['z_brs','BRS','BRS',5.5],['z_geo','GEO','GEO',5.5],
  ['z_ver','VER','VER',5.5],['z_fra','FRA','FRA',5.5]];

// Spalten wie in der Bürovorlage. kompakt: in der kompakten Ansicht sichtbar (8 von 16 bzw. 8 von 17).
// typ: nr, text, lang, datum, auswahl, mehrfach, janein, optionen, empfehlung, berechnet.
const SPALTEN={
  klaerungsliste:[
    {key:'nr',kopf:'Nr',kurz:'Nr',typ:'nr',kompakt:true,breite:6},
    {key:'runde',kopf:'Runde',typ:'auswahl',werte:RUNDEN,breite:7},
    {key:'erfasst_am',kopf:'erfasst am',typ:'datum',breite:11},
    {key:'disziplinen',kopf:'Disziplinen · Beteiligte',kurz:'Disziplinen',typ:'mehrfach',werte:DISZIPLINEN.map(d=>d[0]),kompakt:true,breite:16},
    {key:'ort',kopf:'Ort (Geschoss, Achse, Bauteil)',kurz:'Ort',typ:'text',kompakt:true,breite:20},
    {key:'plan',kopf:'Plan · Index',typ:'text',breite:14},
    {key:'sachverhalt',kopf:'Sachverhalt · Konflikt',typ:'lang',kompakt:true,breite:42},
    {key:'loesung',kopf:'Lösungsvorschlag',typ:'lang',breite:36},
    {key:'verantwortlich',kopf:'verantwortlich',kurz:'verantw.',typ:'auswahl',werte:DISZIPLINEN.map(d=>d[0]),kompakt:true,breite:14},
    {key:'frist',kopf:'Frist',typ:'datum',kompakt:true,breite:11},
    {key:'status',kopf:'Status',typ:'auswahl',werte:STATUS_KLAERUNG,kompakt:true,breite:13},
    {key:'ag',kopf:'Entscheidungspunkt AG?',kurz:'AG?',typ:'janein',werte:JA_NEIN,kompakt:true,breite:11},
    {key:'folgen',kopf:'Folgen: Kosten, Termine, Gestaltung, Genehmigung',kurz:'Folgen',typ:'lang',breite:34},
    {key:'erledigt_am',kopf:'erledigt am',typ:'datum',breite:11},
    {key:'protokoll',kopf:'Protokoll',typ:'text',breite:14},
    {key:'ueberfaellig',kopf:'überfällig',typ:'berechnet',breite:11}
  ],
  entscheidungsliste:[
    {key:'nr',kopf:'Nr',kurz:'Nr',typ:'nr',kompakt:true,breite:6},
    {key:'herkunft',kopf:'Herkunft (Klärungsliste, Rückmeldeliste, Baurechts-Check)',kurz:'Herkunft',typ:'text',breite:18},
    {key:'thema',kopf:'Thema',typ:'text',kompakt:true,breite:20},
    {key:'frage',kopf:'Frage an den Auftraggeber',typ:'lang',kompakt:true,breite:32},
    {key:'optionen',kopf:'Optionen',typ:'optionen',kompakt:true,breite:34},
    {key:'empfehlung',kopf:'Empfehlung des Büros',kurz:'Empfehlung',typ:'empfehlung',breite:30},
    {key:'folgen',kopf:'Folgen je Option: Kosten, Termine, Qualität, Genehmigung',kurz:'Folgen je Option',typ:'berechnet',breite:40},
    {key:'festliegt',kopf:'Was danach festliegt',typ:'lang',breite:28},
    {key:'bis',kopf:'Entscheidung bis',typ:'datum',kompakt:true,breite:11},
    {key:'vorgelegt_am',kopf:'vorgelegt am (M04)',kurz:'vorgelegt am',typ:'datum',breite:11},
    {key:'entschieden_am',kopf:'entschieden am',typ:'datum',breite:11},
    {key:'entscheidung',kopf:'Entscheidung',typ:'lang',kompakt:true,breite:26},
    {key:'entscheider',kopf:'Entscheider',typ:'text',breite:14},
    {key:'annahme',kopf:'Annahme für die Weiterplanung (falls offen)',kurz:'Annahme',typ:'lang',breite:28},
    {key:'bestaetigt_am',kopf:'in Textform bestätigt am',kurz:'bestätigt am',typ:'datum',breite:11},
    {key:'status',kopf:'Status',typ:'auswahl',werte:STATUS_ENTSCHEIDUNG,kompakt:true,breite:12},
    {key:'ueberfaellig',kopf:'überfällig',typ:'berechnet',breite:11}
  ],
  // Weitere Listen: typ meilenstein ist ein Code (M03) oder ein Datum; datumSpalte: im Excel wie in der Vorlage mit der
  // Spalte «Datum» daneben. typ zustaendigkeit: ein Feld der Matrix (V G B K M F ?).
  fachplanerbedarf:[
    {key:'nr',kopf:'Nr',typ:'nr',kompakt:true,breite:5},
    {key:'disziplin',kopf:'Disziplin',typ:'text',kompakt:true,breite:22},
    {key:'kuerzel',kopf:'Kürzel',typ:'text',breite:7},
    {key:'leistungsbild',kopf:'Leistungsbild · Grundlage',kurz:'Leistungsbild',typ:'text',breite:30},
    {key:'regel',kopf:'In der Regel erforderlich, wenn …',typ:'lang',breite:38},
    {key:'erforderlich',kopf:'erforderlich?',typ:'auswahl',werte:JA_NEIN_PRUEFEN,kompakt:true,breite:10},
    {key:'begruendung',kopf:'Begründung (für das Projekt)',kurz:'Begründung',typ:'lang',kompakt:true,breite:28},
    {key:'beauftragt',kopf:'beauftragt?',typ:'auswahl',werte:BEAUFTRAGT,kompakt:true,breite:10},
    {key:'buero',kopf:'Büro · Ansprechpartner (Firma, Rolle)',kurz:'Büro · Ansprechpartner',typ:'text',kompakt:true,breite:26},
    {key:'lph',kopf:'beauftragte Leistungsphasen',kurz:'LPH',typ:'text',breite:12},
    {key:'umfang',kopf:'Umfang LPH 3 und Besondere Leistungen (Vorschlag)',kurz:'Umfang LPH 3',typ:'lang',breite:40},
    {key:'abgrenzung',kopf:'Abgrenzung: Lücken, Doppelungen',kurz:'Abgrenzung',typ:'lang',breite:28},
    {key:'angebot_am',kopf:'Angebot vom',typ:'datum',breite:11},
    {key:'bewertung',kopf:'Bewertung · Empfehlung des Büros',kurz:'Bewertung',typ:'lang',breite:30},
    {key:'bis',kopf:'Entscheidung AG bis',kurz:'Entscheidung bis',typ:'meilenstein',kompakt:true,breite:12},
    {key:'status',kopf:'Status',typ:'auswahl',werte:STATUS_FACHPLANER,kompakt:true,breite:13}
  ],
  schnittstellen:[
    {key:'nr',kopf:'Nr',typ:'nr',kompakt:true,breite:5},
    {key:'thema',kopf:'Thema · Bauteil',kurz:'Thema · Bauteil',typ:'text',kompakt:true,breite:30},
    {key:'kg',kopf:'KG DIN 276 (2018-12)',kurz:'KG',typ:'text',breite:12},
    ...MATRIX.map(([key,kopf,kurz,breite])=>({key,kopf,kurz,typ:'zustaendigkeit',werte:ZUSTAENDIGKEIT,kompakt:true,breite})),
    {key:'eindeutig',kopf:'Zuständigkeit eindeutig?',kurz:'eindeutig?',typ:'berechnet',kompakt:true,breite:16},
    {key:'liefert',kopf:'Was wird geliefert',typ:'lang',breite:34},
    {key:'format',kopf:'Format',typ:'text',breite:16},
    {key:'lieferung1',kopf:'Lieferung 1',typ:'meilenstein',datumSpalte:true,kompakt:true,breite:9},
    {key:'lieferung2',kopf:'Lieferung 2',typ:'meilenstein',datumSpalte:true,breite:9},
    {key:'zweck',kopf:'Wird gebraucht für',typ:'text',breite:28},
    {key:'grundlage',kopf:'Grundlage',typ:'text',breite:26},
    {key:'status',kopf:'Status',typ:'auswahl',werte:STATUS_SCHNITTSTELLE,kompakt:true,breite:13},
    {key:'bemerkung',kopf:'Bemerkung · Klärung',kurz:'Bemerkung',typ:'lang',breite:30}
  ],
  fragenliste:[
    {key:'nr',kopf:'Nr',typ:'nr',kompakt:true,breite:8},
    {key:'disziplin',kopf:'Disziplin',typ:'auswahl',werte:DISZIPLINEN.map(d=>d[0]),kompakt:true,breite:8},
    {key:'wer',kopf:'Wer fragt',typ:'auswahl',werte:WER_FRAGT,breite:15},
    {key:'thema',kopf:'Thema',typ:'text',kompakt:true,breite:15},
    {key:'frage',kopf:'Frage · benötigte Angabe',kurz:'Frage · benötigte Angabe',typ:'lang',kompakt:true,breite:58},
    {key:'zweck',kopf:'Wird gebraucht für',typ:'text',breite:30},
    {key:'grundlage',kopf:'Grundlage',typ:'text',breite:26},
    {key:'bis',kopf:'gebraucht bis',typ:'meilenstein',datumSpalte:true,kompakt:true,breite:9},
    {key:'antwort',kopf:'Antwort · Festlegung',kurz:'Antwort · Festlegung',typ:'lang',kompakt:true,breite:40},
    {key:'beantwortet_von',kopf:'beantwortet von',typ:'text',breite:14},
    {key:'beantwortet_am',kopf:'am',kurz:'beantwortet am',typ:'datum',breite:11},
    {key:'status',kopf:'Status',typ:'auswahl',werte:STATUS_FRAGE,kompakt:true,breite:12},
    {key:'uebernommen',kopf:'übernommen in',typ:'text',breite:18},
    {key:'bemerkung',kopf:'Bemerkung',typ:'lang',breite:26}
  ],
  planliste:[
    {key:'nr',kopf:'Nr',typ:'nr',kompakt:true,breite:5},
    {key:'plannummer',kopf:'Plannummer',typ:'plannummer',kompakt:true,breite:18},
    {key:'planart',kopf:'Planart',typ:'auswahl',werte:PLANARTEN.map(p=>p[0]),breite:7},
    {key:'geschoss',kopf:'Geschoss · Bereich',typ:'text',breite:9},
    {key:'lfd',kopf:'lfd. Nr',typ:'text',breite:6},
    {key:'titel',kopf:'Plantitel',typ:'text',kompakt:true,breite:34},
    {key:'massstab',kopf:'Maßstab',typ:'text',kompakt:true,breite:8},
    {key:'format',kopf:'Format',typ:'auswahl',werte:FORMATE,breite:8},
    {key:'zustaendig',kopf:'zuständig',typ:'text',kompakt:true,breite:12},
    {key:'status',kopf:'Status',typ:'auswahl',werte:STATUS_PLAN,kompakt:true,breite:16},
    {key:'index',kopf:'Index',typ:'text',kompakt:true,breite:6},
    {key:'indexdatum',kopf:'Indexdatum',typ:'datum',kompakt:true,breite:11},
    {key:'aenderung',kopf:'Änderung zum letzten Index',kurz:'Änderung',typ:'lang',breite:30},
    {key:'bemerkung',kopf:'Bemerkung',typ:'lang',breite:22},
    ...Array.from({length:AUSGABEN_PLANLISTE},(_,i)=>({key:'a'+(i+1),kopf:'Ausgabe '+(i+1),typ:'ausgabe',ausgabe:i+1,breite:9}))
  ],
  dokumente:[
    {key:'nr',kopf:'Code',typ:'nr',kompakt:true,breite:7},
    {key:'ergebnis',kopf:'Ergebnis',typ:'text',kompakt:true,breite:36},
    {key:'zustaende',kopf:'Zustände laut Bibliothek',typ:'lang',breite:46},
    {key:'erzeugt',kopf:'erzeugt durch',typ:'text',kompakt:true,breite:22},
    {key:'format',kopf:'Format',typ:'text',breite:12},
    {key:'zustaendig',kopf:'zuständig',typ:'text',kompakt:true,breite:14},
    {key:'stand',kopf:'aktueller Stand',typ:'text',vorschlaege:'zustaende',kompakt:true,breite:22},
    {key:'index',kopf:'Index · Datum',typ:'text',kompakt:true,breite:14},
    {key:'ablageort',kopf:'Ablageort',typ:'text',kompakt:true,breite:26},
    {key:'bemerkung',kopf:'Bemerkung',typ:'lang',breite:24}
  ],
  ausgaben:[
    {key:'nr',kopf:'Nr',typ:'nr',kompakt:true,breite:5},
    {key:'datum',kopf:'Datum',typ:'datum',kompakt:true,breite:11},
    {key:'anlass',kopf:'Anlass',typ:'text',kompakt:true,breite:36},
    {key:'meilenstein',kopf:'Meilenstein · PSP',typ:'text',kompakt:true,breite:14},
    {key:'empfaenger',kopf:'Empfänger',typ:'text',kompakt:true,breite:30},
    {key:'formate',kopf:'Formate',typ:'auswahl',werte:UEBERGABE,kompakt:true,breite:14},
    {key:'inhalt',kopf:'Pläne und Dokumente (mit Index)',kurz:'Pläne und Dokumente',typ:'lang',kompakt:true,breite:40},
    {key:'versandweg',kopf:'Versandweg',typ:'text',breite:16},
    {key:'nachweis',kopf:'Nachweis (Ablageort)',kurz:'Nachweis',typ:'text',kompakt:true,breite:26},
    {key:'bemerkung',kopf:'Bemerkung',typ:'lang',breite:26}
  ],
  verteiler:[
    {key:'nr',kopf:'Empfänger',typ:'nr',kompakt:true,breite:22},
    {key:'buero',kopf:'Büro · Rolle',typ:'text',kompakt:true,breite:26},
    ...Array.from({length:AUSGABEN_VERTEILER},(_,i)=>({key:'a'+(i+1),kopf:'Ausgabe '+(i+1),typ:'ausgabe',ausgabe:i+1,werte:UEBERGABE,kompakt:true,breite:16}))
  ],
  austausch:[
    {key:'nr',kopf:'Fachplanung',typ:'nr',kompakt:true,breite:18},
    {key:'dateiformat',kopf:'Dateiformat',typ:'text',kompakt:true,breite:14},
    {key:'version',kopf:'Version · Software',typ:'text',kompakt:true,breite:18},
    {key:'nullpunkt',kopf:'Koordinaten · Nullpunkt (Lage)',kurz:'Nullpunkt (Lage)',typ:'lang',kompakt:true,breite:28},
    {key:'hoehe',kopf:'Höhenbezug ±0,00 = … m ü. NHN',kurz:'Höhenbezug',typ:'text',kompakt:true,breite:22},
    {key:'struktur',kopf:'Layer- · Modellstruktur',typ:'lang',kompakt:true,breite:28},
    {key:'einheiten',kopf:'Einheiten',typ:'text',kompakt:true,breite:10},
    {key:'weg',kopf:'Übergabeweg (Plattform)',kurz:'Übergabeweg',typ:'text',kompakt:true,breite:22},
    {key:'vereinbart_am',kopf:'vereinbart am',typ:'datum',kompakt:true,breite:11},
    {key:'bemerkung',kopf:'Bemerkung',typ:'lang',breite:26}
  ],
  ablage:[
    {key:'nr',kopf:'Ordner',typ:'nr',kompakt:true,breite:30},
    {key:'inhalt',kopf:'Inhalt',typ:'lang',kompakt:true,breite:46},
    {key:'regel',kopf:'Regel',typ:'lang',kompakt:true,breite:46},
    {key:'office',kopf:'ins Office (Romy liest mit)?',kurz:'ins Office?',typ:'auswahl',werte:JA_NEIN,kompakt:true,breite:16},
    {key:'bemerkung',kopf:'Bemerkung',typ:'lang',kompakt:true,breite:30}
  ],
  eingang:[
    {key:'nr',kopf:'Disziplin',typ:'nr',kompakt:true,breite:9},
    {key:'buero',kopf:'Büro',typ:'text',kompakt:true,breite:18},
    {key:'umfang01',kopf:'Lieferumfang Arbeitsstand 01 (lt. Kick-off)',kurz:'Lieferumfang 01',typ:'lang',breite:38},
    {key:'erwartet01',kopf:'erwartet (M03)',kurz:'01 erwartet',typ:'meilenstein',kompakt:true,breite:11},
    {key:'eingang01',kopf:'eingegangen am',kurz:'01 eingegangen',typ:'datum',kompakt:true,breite:11},
    {key:'index01',kopf:'Planstand · Index',typ:'text',breite:12},
    {key:'vollstaendig',kopf:'vollständig?',typ:'auswahl',werte:JA_NEIN,kompakt:true,breite:10},
    {key:'fehlt',kopf:'fehlt · angemahnt am',typ:'lang',breite:22},
    {key:'umfang_end',kopf:'Lieferumfang Endstand (lt. Kick-off)',kurz:'Lieferumfang Endstand',typ:'lang',breite:38},
    {key:'erwartet_end',kopf:'erwartet (M07)',kurz:'Endstand erwartet',typ:'meilenstein',kompakt:true,breite:11},
    {key:'eingang_end',kopf:'eingegangen am',kurz:'Endstand eingegangen',typ:'datum',kompakt:true,breite:11},
    {key:'index_end',kopf:'Index',typ:'text',breite:9},
    {key:'rueckmeldung',kopf:'Rückmeldung zum integrierten Stand',kurz:'Rückmeldung',typ:'auswahl',werte:BESTAETIGUNG,kompakt:true,breite:16},
    {key:'vorbehalt',kopf:'Vorbehalt',typ:'lang',breite:28},
    {key:'stand',kopf:'Stand',typ:'berechnet',kompakt:true,breite:20}
  ]
};
const DOKUMENTE={
  klaerungsliste:{titel:'Klärungsliste Koordination',kurz:'Klärungsliste',code:'L3.KLA',zeile:'Punkt',zeilen:'Punkte',
    untertitel:'L3.KLA.1 (Runde 01) · L3.KLA.2 (Runde 02, Bestätigung je Disziplin) · L3.KLA.3 (geschlossen nach M07) · je Konflikt Ort, Beteiligte, Lösungsvorschlag, Verantwortlicher, Frist (L3.KLA.1-07)'},
  entscheidungsliste:{titel:'Entscheidungsliste',kurz:'Entscheidungsliste',code:'L3.ENV · L3.A3',zeile:'Entscheidung',zeilen:'Entscheidungen',
    untertitel:'L3.ENV.1 (Entscheidungsvorlage, M04) · L3.A3.ABS (Entscheidungsprotokoll, M05) · jede Entscheidung mit Datum und Entscheider; offene Punkte mit neuer Frist und Annahme für die Weiterplanung'},
  entscheidungsvorlagen:{titel:'Entscheidungsvorlagen',kurz:'Entscheidungsvorlagen',code:'L3.ENV.1',zeile:'Vorlage',zeilen:'Vorlagen'},
  fachplanerbedarf:{titel:'Fachplanerbedarf und Beauftragungsempfehlung',kurz:'Fachplanerbedarf',code:'L3.FPB.1',zeile:'Disziplin',zeilen:'Disziplinen',
    untertitel:'L3.FPB.1 · Entscheidungshilfe für den Auftraggeber · Prüfpunkte L3.FPB.1-01 bis -06 · entfällt, wenn alle Fachplaner bei Phasenbeginn beauftragt sind (P-FPL = ja)'},
  schnittstellen:{titel:'Schnittstellen- und Liefermatrix',kurz:'Schnittstellen',code:'L3.SSM.1',zeile:'Schnittstelle',zeilen:'Schnittstellen',
    untertitel:'L3.SSM.1 (v0, Vorschlag des Büros, mit dem Paket M01) · L3.A1.ABS (v1, im Kick-off M02 abgestimmt) · Legende V G B K M F nach ByAK-Muster-Schnittstellenkatalog (M13)'},
  fragenliste:{titel:'Fragenliste je Disziplin · Rückfragenliste',kurz:'Fragenliste',code:'L3.PGF.1 · L3.A1.ABS',zeile:'Frage',zeilen:'Fragen',
    untertitel:'L3.PGF.1-06 (Fragen je Disziplin im Planungsgrundlagen-Paket, M01) · L3.A1.ABS-06 (Rückfragen im Kick-off beantwortet oder terminiert, M02). Fragen ohne Bezug zum Projekt auf «entfällt» setzen, nicht löschen.'},
  eingang:{titel:'Eingang der Fachplanungsbeiträge',kurz:'Eingang',code:'L3.KLA.1-01 · L3.KLA.2-02',zeile:'Disziplin',zeilen:'Disziplinen',
    untertitel:'L3.KLA.1-01 (Eingang Arbeitsstand 01 gegen den vereinbarten Lieferumfang, M03) · L3.KLA.2-02 (Rückmeldung je Disziplin zum integrierten Stand) · Endstand M07'},
  planliste:{titel:'Planliste',kurz:'Planliste',code:'L3.PLI.1',zeile:'Plan',zeilen:'Pläne',
    untertitel:'L3.PLI.1 · alle vorgesehenen Pläne der LPH 3 · Plannummer aus dem Planschlüssel (Anleitung) · je Ausgabe der ausgegebene Index'},
  dokumente:{titel:'Dokumente der LPH 3',kurz:'Dokumente',code:'L3.PLI.1 · L3.DOK.1',zeile:'Ergebnis',zeilen:'Ergebnisse',
    untertitel:'Ergebnisregister der Aufgabenbibliothek LPH 3 v0.3.4 ohne Pläne – je Ergebnis Stand, Index und Ablageort'},
  ausgaben:{titel:'Ausgaben · Versandnachweis',kurz:'Ausgaben',code:'L3.A1.AUS-04',zeile:'Ausgabe',zeilen:'Ausgaben',
    untertitel:'L3.A1.AUS-04 (Versand dokumentiert: Datum, Verteiler, Index) · je Ausgabe eine Zeile; die Planliste liest Datum und Anlass von hier'},
  verteiler:{titel:'Verteiler',kurz:'Verteiler',code:'L3.PLI.1-05',zeile:'Empfänger',zeilen:'Empfänger',
    untertitel:'L3.PLI.1-05 · wer erhält was in welchem Format · Spalten = Ausgaben aus dem Blatt Ausgaben'},
  austausch:{titel:'Austauschformate',kurz:'Austausch',code:'L3.PLI.1-06',zeile:'Fachplanung',zeilen:'Fachplanungen',
    untertitel:'L3.PLI.1-06 · Dateiformat, Nullpunkt, Layer- bzw. Modellstruktur je Fachplanung · im Kick-off festlegen (Fragenliste ALLE-05)'},
  ablage:{titel:'Ablagestruktur des Projekts',kurz:'Ablage',code:'L3.PLI.1-04',zeile:'Ordner',zeilen:'Ordner',
    untertitel:'L3.PLI.1-04 · Eingang und Ausgang, Fachplaner, Behörden, Protokolle · Vorschlag, bis der Bürostandard ihn ersetzt'}
};
// Listen, die die Bürovorlage mit Zeilen vorbelegt (projektdokumente-vorlagen.js); in der Reihenfolge des Ablaufs.
const WEITERE=['fachplanerbedarf','schnittstellen','fragenliste','eingang','planliste','dokumente','ausgaben','verteiler','austausch','ablage'];
// Listen mit dem Filter «Disziplin» (in der Planliste: «Planart»).
const MIT_DISZIPLIN=['klaerungsliste','schnittstellen','fragenliste','planliste'];
const ARTEN=Object.keys(DOKUMENTE);

// ---------- Text, Datum, Zahlen ----------
const s=v=>v===null||v===undefined?'':String(v);
const kurz=(t,n=90)=>{const x=s(t).replace(/\s+/g,' ').trim();return x.length>n?x.slice(0,n-1).replace(/\s+\S*$/,'')+' …':x};
const ISO=/^(\d{4})-(\d{2})-(\d{2})$/;
function gueltigIso(iso){
  const m=ISO.exec(s(iso));if(!m)return false;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  return d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3];
}
function heuteIso(jetzt=new Date()){
  const d=jetzt instanceof Date?jetzt:new Date(jetzt);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
// «05.12.», «5.12.2026», «5.12.26», «2026-12-05». Ohne Jahr gilt das Datum, das höchstens ein halbes Jahr vor oder
// nach heute liegt (eine Frist im Januar, im November eingetragen, ist im nächsten Jahr). Leer bleibt leer; null heißt ungültig.
function leseDatum(text,heute=heuteIso()){
  const t=s(text).trim();
  if(!t)return '';
  if(ISO.test(t))return gueltigIso(t)?t:null;
  const m=/^(\d{1,2})\.(\d{1,2})\.?(\d{2}|\d{4})?$/.exec(t.replace(/\s+/g,''));
  if(!m)return null;
  const tag=+m[1],monat=+m[2];
  const iso=j=>j+'-'+String(monat).padStart(2,'0')+'-'+String(tag).padStart(2,'0');
  if(m[3]){const j=m[3].length===2?2000+(+m[3]):+m[3];const x=iso(j);return gueltigIso(x)?x:null}
  const hj=+heute.slice(0,4),h=Date.parse(heute+'T00:00:00Z');
  let best=null,abstand=Infinity;
  for(const j of [hj-1,hj,hj+1]){
    const x=iso(j);if(!gueltigIso(x))continue;
    const a=Math.abs(Date.parse(x+'T00:00:00Z')-h);
    if(a<abstand){abstand=a;best=x}
  }
  return best;
}
// Anzeige: im laufenden Jahr «05.12.», sonst «05.12.2027».
function datumKurz(iso,heute=heuteIso()){
  if(!gueltigIso(iso))return '';
  const [j,m,t]=iso.split('-');
  return t+'.'+m+'.'+(j===heute.slice(0,4)?'':j);
}
function datumLang(iso){if(!gueltigIso(iso))return '';const [j,m,t]=iso.split('-');return t+'.'+m+'.'+j}
// Excel zählt Tage ab dem 30.12.1899.
function excelTag(iso){if(!gueltigIso(iso))return null;return Math.round((Date.parse(iso+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000)}
// Geldbeträge in Cent als BigInt: «45.049,20», «45049.2», «214,52 €/m²».
function leseZahl(text){
  let t=s(text).replace(/\s|€|EUR/gi,'').replace(/\/.*$/,'').replace(/m²|m2|m³|m3|m|Stk\.?|psch\.?/gi,'');
  if(!t)return null;
  if(/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t))t=t.replace(/\./g,'').replace(',','.');
  else if(/^-?\d+(,\d+)?$/.test(t))t=t.replace(',','.');
  else if(!/^-?\d+(\.\d+)?$/.test(t))return null;
  const n=Number(t);return Number.isFinite(n)?n:null;
}
const cent=n=>n===null?null:BigInt(Math.round(n*100));
function euro(c,{einheit=true}={}){
  if(c===null||c===undefined)return '';
  const neg=c<0n,a=neg?-c:c,e=a/100n,r=a%100n;
  const ganz=e.toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return (neg?'−':'')+ganz+','+r.toString().padStart(2,'0')+(einheit?' €':'');
}

// ---------- Termine: Meilenstein oder Datum ----------
// Ein Termin ist ein Code des Terminplans («M03», «M00A») oder ein Datum. Die Daten der Meilensteine setzt die Seite aus
// dem Terminplan des Projekts; ohne Terminplan bleibt ein Meilenstein ohne Datum (in der Vorlage «Datum fehlt»).
const CODE=/^M\d{2}[A-Z]?$/;
let TERMINE=new Map();
function setzeTermine(liste){TERMINE=new Map(Object.entries(liste||{}).filter(([c,d])=>CODE.test(c)&&gueltigIso(d)))}
function termine(){return Object.fromEntries(TERMINE)}
const istMeilenstein=v=>CODE.test(s(v).trim());
function meilensteinName(code){return (MEILENSTEINE.find(m=>m[0]===s(code).trim())||[])[1]||''}
// Datum eines Termins: das Datum selbst oder das des Meilensteins im Terminplan, sonst leer.
function terminVon(v){
  const t=s(v).trim();
  if(gueltigIso(t))return t;
  return CODE.test(t)?TERMINE.get(t)||'':'';
}
// Eingabe: «M03», «m3», «M00a», ein Eintrag der Vorschlagsliste («M03 · Zieltermin …») oder ein Datum. null heißt ungültig.
function leseTermin(text,heute=heuteIso()){
  const t=s(text).trim();
  if(!t)return '';
  const m=/^m\s*(\d{1,2})\s*([a-z]?)$/i.exec(t);
  if(m)return 'M'+m[1].padStart(2,'0')+m[2].toUpperCase();
  const c=/^(M\d{2}[A-Z]?)(\s|$)/.exec(t);
  if(c)return c[1];
  return leseDatum(t,heute);
}
// Was die Vorlage in der Spalte «Datum» zeigt, wenn kein Datum da ist.
function terminFehlt(v){const t=s(v).trim();if(!CODE.test(t))return '';return TERMINE.has(t)||meilensteinName(t)?'Datum fehlt':'Meilenstein?'}
function terminText(v,heute=heuteIso(),{lang=false}={}){
  const t=s(v).trim();if(!t)return '';
  const zeige=d=>lang?datumLang(d):datumKurz(d,heute);
  if(CODE.test(t)){const d=TERMINE.get(t);return t+(d?' · '+zeige(d):'')}
  return gueltigIso(t)?zeige(t):t;
}

// ---------- Planschlüssel ----------
// Plannummer wie die Formel der Vorlage: Projektkürzel – Leistungsphase – Planart – Geschoss/Bereich – laufende Nummer
// (ohne Geschoss, wenn dort «–» steht). Kürzel, Leistungsphase und Trennzeichen stehen beim Dokument «Planliste» (meta);
// die Seite setzt sie. Eine eigene Plannummer in der Zeile (Bürostandard) gilt vor der gerechneten.
let PLANSCHLUESSEL={kuerzel:'',lph:'3',trenn:'-'};
function setzePlanschluessel(m){PLANSCHLUESSEL={kuerzel:s(m?.kuerzel).trim(),lph:s(m?.lph).trim()||'3',trenn:m?.trenn===undefined||m?.trenn===null||m?.trenn===''?'-':s(m.trenn)}}
function planschluessel(){return {...PLANSCHLUESSEL}}
function plannummerAus(d){
  if(!s(d?.titel).trim())return '';
  const {kuerzel,lph,trenn}=PLANSCHLUESSEL,g=s(d?.geschoss).trim(),n=s(d?.lfd).trim();
  return (kuerzel||'(Kürzel)')+trenn+lph+trenn+s(d?.planart).trim()+(!g||g==='–'?'':trenn+g)+trenn+(/^\d$/.test(n)?'0'+n:n);
}
function plannummer(d){return s(d?.plannummer).trim()||plannummerAus(d)}

// ---------- Zeilen ----------
const FELDER={klaerungsliste:['runde','erfasst_am','disziplinen','ort','plan','sachverhalt','loesung','verantwortlich','frist','status','ag','folgen','erledigt_am','protokoll','aufgabe_id','entscheidung_id','fundstelle'],
  entscheidungsliste:['herkunft','herkunft_ref','thema','frage','anlass','gesichert','angenommen','optionen','empfehlung','begruendung','festliegt','wenn_spaeter','kostenbezug','bis','vorgelegt_am','entschieden_am','entscheidung','entscheider','annahme','bestaetigt_am','status','vorlage_id','fundstelle'],
  entscheidungsvorlagen:['titel','punkte','auftraggeber','besprechung','besprechung_am','verfasser','freigabe','status','vorgelegt_am','weitergegeben'],
  fachplanerbedarf:['disziplin','kuerzel','leistungsbild','regel','erforderlich','begruendung','beauftragt','buero','lph','umfang','abgrenzung','angebot_am','bewertung','bis','status'],
  schnittstellen:['gruppe','thema','kg',...MATRIX.map(m=>m[0]),'eindeutig','liefert','format','lieferung1','lieferung2','zweck','grundlage','status','bemerkung'],
  fragenliste:['code','disziplin','wer','thema','frage','zweck','grundlage','bis','antwort','beantwortet_von','beantwortet_am','status','uebernommen','bemerkung'],
  eingang:['disziplin','buero','umfang01','erwartet01','eingang01','index01','vollstaendig','fehlt','umfang_end','erwartet_end','eingang_end','index_end','rueckmeldung','vorbehalt'],
  planliste:['plannummer','planart','geschoss','lfd','titel','massstab','format','zustaendig','status','index','indexdatum','aenderung','bemerkung',...Array.from({length:AUSGABEN_PLANLISTE},(_,i)=>'a'+(i+1))],
  dokumente:['code','ergebnis','zustaende','erzeugt','format','zustaendig','stand','index','ablageort','bemerkung'],
  ausgaben:['datum','anlass','meilenstein','empfaenger','formate','inhalt','versandweg','nachweis','bemerkung'],
  verteiler:['empfaenger','buero',...Array.from({length:AUSGABEN_VERTEILER},(_,i)=>'a'+(i+1))],
  austausch:['fachplanung','dateiformat','version','nullpunkt','hoehe','struktur','einheiten','weg','vereinbart_am','bemerkung'],
  ablage:['ordner','inhalt','regel','office','bemerkung']};
// Je Variante: Beschreibung, Zahlen und Folgen. Zu Kennwert und Menge gehören die Fundstelle (für das Büro) und der Beleg
// (für das Dokument an den Auftraggeber, ohne andere Projekte); produkt_id und kobe_ref verweisen auf Produktbibliothek
// und Kostenberechnung (projektdokumente-zahlen.js). «quelle» bleibt für eine Angabe von Hand.
const OPTION_FELDER=['id','text','produkt','produkt_id','kennwert','kennwert_quelle','kennwert_beleg','menge','menge_quelle','menge_beleg','kobe_ref',
  'betrag','quelle','kosten','termine','qualitaet','genehmigung'];
function leereZeile(art,{heute=heuteIso(),runde=''}={}){
  if(art==='klaerungsliste')return {runde:runde||'',erfasst_am:heute,disziplinen:[],ort:'',plan:'',sachverhalt:'',loesung:'',verantwortlich:'',frist:'',status:'offen',ag:'nein',folgen:'',erledigt_am:'',protokoll:''};
  if(art==='entscheidungsliste')return {herkunft:'',thema:'',frage:'',optionen:[{id:'A',text:''},{id:'B',text:''}],empfehlung:'',begruendung:'',festliegt:'',bis:'',status:'vorbereitet'};
  if(art==='fachplanerbedarf')return {disziplin:'',kuerzel:'',erforderlich:'',begruendung:'',beauftragt:'',buero:'',bis:'M00A',status:'offen'};
  if(art==='schnittstellen')return {gruppe:'',thema:'',kg:'',...Object.fromEntries(MATRIX.map(m=>[m[0],''])),liefert:'',format:'',lieferung1:'',lieferung2:'',status:'v0 Vorschlag'};
  if(art==='fragenliste')return {code:'',disziplin:'',wer:WER_FRAGT[0],thema:'',frage:'',zweck:'',grundlage:'',bis:'',antwort:'',status:'offen'};
  if(art==='eingang')return {disziplin:'',buero:'',umfang01:'',erwartet01:'M03',umfang_end:'',erwartet_end:'M07'};
  if(art==='planliste')return {planart:'',geschoss:'',lfd:'',titel:'',massstab:'',format:'',zustaendig:'',status:'in Bearbeitung',index:''};
  if(art==='dokumente')return {code:'',ergebnis:'',zustaende:'',erzeugt:'',stand:'',index:'',ablageort:''};
  if(art==='ausgaben')return {datum:'',anlass:'',meilenstein:'',empfaenger:'',formate:'',inhalt:'',nachweis:''};
  if(art==='verteiler')return {empfaenger:'',buero:''};
  if(art==='austausch')return {fachplanung:'',dateiformat:'',version:'',nullpunkt:'',hoehe:'',struktur:'',einheiten:'',weg:''};
  if(art==='ablage')return {ordner:'',inhalt:'',regel:'',office:'ja'};
  return {titel:'',punkte:[],status:'Entwurf'};
}
function optionen(d){return Array.isArray(d?.optionen)?d.optionen.filter(o=>o&&typeof o==='object'):[]}
function naechsteOptionId(liste){
  const ids=new Set(liste.map(o=>s(o.id)));
  for(const c of 'ABCDEFGH')if(!ids.has(c))return c;
  return 'X'+(liste.length+1);
}
function erledigt(art,d){
  if(REGELN[art])return REGELN[art].erledigt(d||{});
  return art==='klaerungsliste'?['gelöst','entfällt'].includes(d?.status):['entschieden','entfällt'].includes(d?.status);
}
function faelligAm(art,d){
  if(REGELN[art])return REGELN[art].faellig(d||{});
  return art==='klaerungsliste'?s(d?.frist):art==='entscheidungsliste'?s(d?.bis):'';
}
// Wie die Formel der Bürovorlage: Frist gesetzt, nicht gelöst oder entfallen, Frist vor heute.
function ueberfaellig(art,d,heute=heuteIso()){
  const f=faelligAm(art,d);
  return !!f&&gueltigIso(f)&&!erledigt(art,d)&&f<heute;
}
function istEntscheidungspunkt(d){return d?.ag==='ja'||d?.status==='Entscheidungspunkt'}
function ohneBestaetigung(d){return d?.status==='entschieden'&&!gueltigIso(d?.bestaetigt_am)}
// Ein Vorschlag ändert an den Varianten nur, was er nennt: je Variante zusammengeführt, die übrigen bleiben.
function optionenZusammen(alt,neu){
  const liste=(Array.isArray(alt)?alt:[]).filter(o=>o&&typeof o==='object').map(o=>({...o}));
  for(const o of Array.isArray(neu)?neu:[]){
    if(!o||typeof o!=='object'||!s(o.id))continue;
    const i=liste.findIndex(x=>s(x.id)===s(o.id));
    if(i>=0)liste[i]={...liste[i],...o};else liste.push({...o});
  }
  return liste;
}
const OPTION_ANZEIGE=[['text','Beschreibung'],['produkt','Produkt'],['kennwert','Kennwert'],['menge','Menge'],['betrag','Betrag'],
  ['kosten','Kosten'],['termine','Termine'],['qualitaet','Qualität'],['genehmigung','Genehmigung']];
function optionenAenderung(alt,neu){
  const vorher=new Map(optionen({optionen:alt}).map(o=>[s(o.id),o]));
  return optionen({optionen:neu}).map(o=>{
    const a=vorher.get(s(o.id))||{};
    const teile=OPTION_ANZEIGE.filter(([k])=>k in o&&s(o[k])!==s(a[k])).map(([k,l])=>l+' '+(kurz(s(a[k]),40)||'–')+' → '+(kurz(s(o[k]),40)||'–'));
    return teile.length?o.id+': '+teile.join(', '):'';
  }).filter(Boolean).join(' · ')||'keine Änderung';
}
// Beleg der Zahlen für das Dokument; die Fundstellen (mit Projekt und Zeile) bleiben im Büro.
function belegText(o){
  return [s(o?.kennwert_beleg).trim()&&'Kennwert: '+s(o.kennwert_beleg).trim(),s(o?.menge_beleg).trim()&&'Menge: '+s(o.menge_beleg).trim(),s(o?.quelle).trim()].filter(Boolean).join('; ');
}
function fundstellenText(o){
  return [s(o?.kennwert_quelle).trim()&&'Kennwert: '+s(o.kennwert_quelle).trim(),s(o?.menge_quelle).trim()&&'Menge: '+s(o.menge_quelle).trim(),s(o?.quelle).trim()].filter(Boolean).join(' · ');
}
function optionenText(d){return optionen(d).filter(o=>s(o.text).trim()).map(o=>o.id+': '+s(o.text).trim()).join(' · ')}
function folgenText(d){
  return optionen(d).map(o=>{
    const t=[['kosten','Kosten'],['termine','Termine'],['qualitaet','Qualität'],['genehmigung','Genehmigung']]
      .filter(([k])=>s(o[k]).trim()).map(([k,l])=>l+': '+s(o[k]).trim()).join('; ');
    return t?o.id+': '+t:'';
  }).filter(Boolean).join(' · ');
}
function empfehlungText(d){
  const e=s(d?.empfehlung).trim(),b=s(d?.begruendung).trim();
  return e&&b?e+', '+b:e||b;
}
// Nummer zum Anzeigen. In der Fragenliste der Code der Frage («TWP-03»), im Eingang die Disziplin, wie in der Vorlage.
function nummer(art,nr,d){
  const n=Number(nr)||0;
  if(art==='entscheidungsliste')return 'E-'+String(n).padStart(2,'0');
  if(art==='entscheidungsvorlagen')return String(n).padStart(2,'0');
  if(art==='fragenliste'&&s(d?.code).trim())return s(d.code).trim();
  if(art==='eingang'&&s(d?.disziplin).trim())return s(d.disziplin).trim();
  // Listen ohne Nummer in der Vorlage: die erste Spalte nennt die Zeile.
  const name={dokumente:'code',verteiler:'empfaenger',austausch:'fachplanung',ablage:'ordner'}[art];
  if(name&&s(d?.[name]).trim())return s(d[name]).trim();
  return String(n);
}
// Nächster Code einer Frage für eine Disziplin: «TWP-07» nach «TWP-06».
function naechsterCode(zeilen,disziplin){
  const c=s(disziplin).trim().toUpperCase().replace(/[^A-Z0-9ÄÖÜ]/g,'');
  if(!c)return '';
  const muster=new RegExp('^'+c+'-(\\d+)$');
  const max=(zeilen||[]).reduce((m,z)=>{const x=muster.exec(s(z?.daten?.code).trim());return x?Math.max(m,+x[1]):m},0);
  return c+'-'+String(max+1).padStart(2,'0');
}
// «Zuständigkeit eindeutig?» wie die Formel der Vorlage: ein «?» ist offen; genau eine planende Stelle (G oder B, auch
// in G/K) ist eindeutig. Wo die Vorlage «–» setzt (Grundlagen, Zuarbeit), bleibt es dabei.
function zustaendigkeit(d){
  if(s(d?.eindeutig).trim()==='–')return '–';
  const w=MATRIX.map(([k])=>s(d?.[k]).trim()).filter(Boolean);
  if(!w.length)return '';
  const alle=w.join(' ').toUpperCase();
  if(alle.includes('?'))return 'offen – im Kick-off klären';
  const n=(alle.match(/[GB]/g)||[]).length;
  return n===1?'eindeutig':n===0?'keine planende Stelle':'mehrere planende Stellen – abgrenzen';
}
const ZU_KLAEREN=z=>/^(offen|keine|mehrere)/.test(z);
// «Stand» im Eingang wie die Formel der Vorlage.
function eingangStand(d,heute=heuteIso()){
  if(!s(d?.disziplin).trim())return '';
  if(!gueltigIso(d?.eingang01)){const e=terminVon(d?.erwartet01);return e&&e<heute?'Arbeitsstand 01 überfällig':'Arbeitsstand 01 ausstehend'}
  if(d?.vollstaendig==='nein')return 'Arbeitsstand 01 unvollständig';
  if(!gueltigIso(d?.eingang_end)){const e=terminVon(d?.erwartet_end);return e&&e<heute?'Endstand überfällig':'Endstand ausstehend'}
  if(d?.rueckmeldung==='stimmt überein')return 'bestätigt';
  if(d?.rueckmeldung==='Vorbehalt')return 'Vorbehalt';
  return 'Rückmeldung ausstehend';
}
// Wen eine Zeile betrifft (Filter «Disziplin»). Die Fragenliste zeigt dazu die Fragen an alle, wie die Vorlage empfiehlt.
function betrifft(art,d,code){
  if(art==='fragenliste')return d?.disziplin===code||d?.disziplin==='ALLE';
  if(art==='schnittstellen'){const m=MATRIX.find(x=>x[2]===code);const v=m?s(d?.[m[0]]).trim():'';return !!v&&v!=='–'}
  if(art==='eingang')return d?.disziplin===code;
  if(art==='fachplanerbedarf')return d?.kuerzel===code;
  if(art==='planliste')return d?.planart===code;
  return (Array.isArray(d?.disziplinen)&&d.disziplinen.includes(code))||d?.verantwortlich===code;
}
// Wert einer Spalte als Text, wie er in Excel und im Verlauf steht.
function zellText(art,key,d,{nr,heute=heuteIso()}={}){
  if(key==='nr')return nummer(art,nr,d);
  if(key==='ueberfaellig')return ueberfaellig(art,d,heute)?'überfällig':'';
  if(art==='schnittstellen'&&key==='eindeutig')return zustaendigkeit(d);
  if(art==='eingang'&&key==='stand')return eingangStand(d,heute);
  if(art==='planliste'&&key==='plannummer')return plannummer(d);
  if(art==='entscheidungsliste'&&key==='optionen')return optionenText(d);
  if(art==='entscheidungsliste'&&key==='folgen')return folgenText(d);
  if(art==='entscheidungsliste'&&key==='empfehlung')return empfehlungText(d);
  const v=d?.[key];
  if(Array.isArray(v))return v.join(', ');
  const sp=(SPALTEN[art]||[]).find(x=>x.key===key);
  if(sp?.typ==='datum')return datumLang(v);
  if(sp?.typ==='meilenstein')return terminText(v,heute,{lang:true});
  return s(v);
}
function feldName(art,key){
  const sp=(SPALTEN[art]||[]).find(x=>x.key===key);
  if(sp)return sp.kurz||sp.kopf;
  return ({anlass:'Anlass',gesichert:'Gesichert',angenommen:'Angenommen (zu bestätigen)',begruendung:'Begründung',wenn_spaeter:'Wenn später entschieden wird',
    kostenbezug:'Kostenstand · Kostengruppe',vorlage_id:'Vorlage',aufgabe_id:'Aufgabe im Planner',entscheidung_id:'Entscheidungsliste',herkunft_ref:'Herkunft',
    fundstelle:'Fundstelle',titel:'Titel',punkte:'Entscheidungen',auftraggeber:'Auftraggeber',besprechung:'Besprechung',besprechung_am:'Datum der Besprechung',
    verfasser:'Verfasser',freigabe:'Freigabe Büroleitung',weitergegeben:'Weitergegeben an',gruppe:'Gruppe',code:'Code der Frage',disziplin:'Disziplin',
    eindeutig:'Zuständigkeit eindeutig?',empfaenger:'Empfänger',fachplanung:'Fachplanung',ordner:'Ordner'})[key]||key;
}

// Zählen für Kopf und Übersicht.
function zaehle(art,zeilen,heute=heuteIso()){
  const d=zeilen.map(z=>z.daten||{});
  const n=f=>d.filter(f).length;
  if(REGELN[art])return {gesamt:d.length,ueberfaellig:n(x=>ueberfaellig(art,x,heute)),...REGELN[art].zaehle(n,heute)};
  if(art==='klaerungsliste')return {gesamt:d.length,offen:n(x=>x.status==='offen'),inKlaerung:n(x=>x.status==='in Klärung'),
    ueberfaellig:n(x=>ueberfaellig(art,x,heute)),entscheidungspunkte:n(istEntscheidungspunkt),geloest:n(x=>erledigt(art,x)),
    aufgaben:n(x=>!!x.aufgabe_id)};
  if(art==='entscheidungsliste')return {gesamt:d.length,vorbereitet:n(x=>x.status==='vorbereitet'),vorgelegt:n(x=>x.status==='vorgelegt'),
    entschieden:n(x=>x.status==='entschieden'),vertagt:n(x=>x.status==='vertagt'),ueberfaellig:n(x=>ueberfaellig(art,x,heute)),ohneBestaetigung:n(ohneBestaetigung)};
  return {gesamt:d.length,vorgelegt:n(x=>x.status==='vorgelegt'),entwurf:n(x=>x.status!=='vorgelegt')};
}
const plural=(n,e,m)=>n+' '+(n===1?e:m);
function zusammenfassung(art,z){
  if(REGELN[art])return REGELN[art].text(z).filter(Boolean).join(' · ');
  if(art==='klaerungsliste')return [plural(z.gesamt,'Punkt','Punkte'),z.offen+' offen',z.inKlaerung+' in Klärung',z.ueberfaellig+' überfällig',
    plural(z.entscheidungspunkte,'Entscheidungspunkt','Entscheidungspunkte')].join(' · ');
  if(art==='entscheidungsliste'){
    const t=[plural(z.gesamt,'Entscheidung','Entscheidungen'),z.vorbereitet+' vorbereitet',z.vorgelegt+' vorgelegt',z.entschieden+' entschieden'];
    if(z.vertagt)t.push(z.vertagt+' vertagt');
    t.push(z.ueberfaellig+' überfällig');
    if(z.ohneBestaetigung)t.push(z.ohneBestaetigung+' ohne Bestätigung in Textform');
    return t.join(' · ');
  }
  return plural(z.gesamt,'Vorlage','Vorlagen');
}
const FILTER={
  klaerungsliste:[['alle','Alle'],['offen','Offen'],['in Klärung','In Klärung'],['ueberfaellig','Überfällig'],['entscheidungspunkte','Entscheidungspunkte'],['geloest','Gelöst']],
  entscheidungsliste:[['alle','Alle'],['vorbereitet','Vorbereitet'],['vorgelegt','Vorgelegt'],['entschieden','Entschieden'],['ueberfaellig','Überfällig'],['ohne_bestaetigung','Ohne Bestätigung']],
  fachplanerbedarf:[['alle','Alle'],['nicht_beurteilt','Nicht beurteilt'],['erforderlich','Erforderlich'],['nicht_beauftragt','Noch nicht beauftragt'],['pruefen','Zu prüfen'],
    ['beauftragt','Beauftragt'],['ueberfaellig','Überfällig']],
  schnittstellen:[['alle','Alle'],['klaeren','Zuständigkeit klären'],['v0 Vorschlag','Vorschlag v0'],['offen – Kick-off','Offen bis Kick-off'],['v1 abgestimmt','Abgestimmt v1'],['geändert','Geändert']],
  fragenliste:[['alle','Alle'],['offen','Offen'],['ueberfaellig','Überfällig'],['Termin vereinbart','Termin vereinbart'],['beantwortet','Beantwortet'],['entfällt','Entfällt']],
  eingang:[['alle','Alle'],['ausstehend','Ausstehend'],['ueberfaellig','Überfällig'],['vorbehalt','Vorbehalt'],['bestaetigt','Bestätigt']],
  planliste:[['alle','Alle'],['in Bearbeitung','In Bearbeitung'],['Teilstand (vorläufig)','Teilstand'],['Arbeitsstand 01','Arbeitsstand 01'],['Stand 02','Stand 02'],
    ['Endstand LPH 3','Endstand'],['nie_ausgegeben','Noch nie ausgegeben'],['weg','Ersetzt oder entfällt']],
  dokumente:[['alle','Alle'],['ohne_stand','Ohne Stand'],['mit_stand','Mit Stand']],
  ausgaben:[['alle','Alle'],['geplant','Geplant'],['ausgegeben','Ausgegeben']],
  verteiler:[['alle','Alle']],
  austausch:[['alle','Alle'],['offen','Noch nicht vereinbart'],['vereinbart','Vereinbart']],
  ablage:[['alle','Alle'],['ins_office','Ins Office'],['nicht_ins_office','Nicht ins Office']]
};
// Wurde ein Plan schon einmal ausgegeben (ein Index in einer Spalte «Ausgabe n»)?
const ausgegeben=d=>Array.from({length:AUSGABEN_PLANLISTE},(_,i)=>s(d?.['a'+(i+1)]).trim()).some(Boolean);
// Regeln der weiteren Listen: erledigt, fällig (das Datum, ab dem eine Zeile überfällig wird), zählen, Text für Kopf und
// Übersicht, Filter. Wie in der Vorlage: eine offene Frage nach ihrem Termin, ein Fachplaner, der erforderlich sein kann
// und nicht beauftragt ist, nach «Entscheidung AG bis», ein Beitrag nach seinem erwarteten Termin.
const REGELN={
  fachplanerbedarf:{
    erledigt:d=>d.erforderlich==='nein'||d.beauftragt==='ja'||['beauftragt','entfällt'].includes(d.status),
    faellig:d=>REGELN.fachplanerbedarf.erledigt(d)?'':terminVon(d.bis),
    zaehle:n=>({nichtBeurteilt:n(x=>!s(x.erforderlich).trim()),erforderlich:n(x=>x.erforderlich==='ja'),pruefen:n(x=>x.erforderlich==='prüfen'),
      nichtBeauftragt:n(x=>x.erforderlich==='ja'&&x.beauftragt!=='ja'),beauftragt:n(x=>x.beauftragt==='ja'||x.status==='beauftragt')}),
    text:z=>[plural(z.gesamt,'Disziplin','Disziplinen'),z.nichtBeurteilt?z.nichtBeurteilt+' noch nicht beurteilt':'',
      z.erforderlich+' erforderlich'+(z.nichtBeauftragt?', davon '+z.nichtBeauftragt+' noch nicht beauftragt':''),z.pruefen?z.pruefen+' zu prüfen':'',
      z.ueberfaellig?z.ueberfaellig+' überfällig':''],
    passt:(d,f)=>({nicht_beurteilt:!s(d.erforderlich).trim(),erforderlich:d.erforderlich==='ja',nicht_beauftragt:d.erforderlich==='ja'&&d.beauftragt!=='ja',
      pruefen:d.erforderlich==='prüfen',beauftragt:d.beauftragt==='ja'||d.status==='beauftragt'})[f]
  },
  schnittstellen:{
    erledigt:()=>false,
    faellig:()=>'',
    zaehle:n=>({klaeren:n(x=>ZU_KLAEREN(zustaendigkeit(x))),v0:n(x=>x.status==='v0 Vorschlag'),kickoff:n(x=>x.status==='offen – Kick-off'),
      v1:n(x=>x.status==='v1 abgestimmt'),geaendert:n(x=>x.status==='geändert')}),
    text:z=>[plural(z.gesamt,'Schnittstelle','Schnittstellen'),plural(z.klaeren,'Zuständigkeit','Zuständigkeiten')+' offen oder doppelt',
      z.v0+' Vorschlag v0',z.kickoff?z.kickoff+' offen bis zum Kick-off':'',z.v1+' abgestimmt v1',z.geaendert?z.geaendert+' geändert':''],
    passt:(d,f)=>f==='klaeren'?ZU_KLAEREN(zustaendigkeit(d)):undefined
  },
  fragenliste:{
    erledigt:d=>['beantwortet','entfällt'].includes(d.status),
    faellig:d=>d.status==='offen'?terminVon(d.bis):'',
    zaehle:n=>({offen:n(x=>x.status==='offen'),termin:n(x=>x.status==='Termin vereinbart'),beantwortet:n(x=>x.status==='beantwortet'),entfaellt:n(x=>x.status==='entfällt')}),
    text:z=>[plural(z.gesamt,'Frage','Fragen'),z.offen+' offen',z.termin?z.termin+' mit Termin':'',z.beantwortet+' beantwortet',z.entfaellt?z.entfaellt+' entfällt':'',
      z.ueberfaellig?z.ueberfaellig+' überfällig':'']
  },
  eingang:{
    erledigt:d=>eingangStand(d)==='bestätigt',
    faellig:d=>!gueltigIso(d.eingang01)?terminVon(d.erwartet01):d.vollstaendig!=='nein'&&!gueltigIso(d.eingang_end)?terminVon(d.erwartet_end):'',
    zaehle:(n,heute)=>({erster:n(x=>gueltigIso(x.eingang01)),ende:n(x=>gueltigIso(x.eingang_end)),bestaetigt:n(x=>eingangStand(x,heute)==='bestätigt'),
      vorbehalt:n(x=>eingangStand(x,heute)==='Vorbehalt')}),
    text:z=>[plural(z.gesamt,'Disziplin','Disziplinen'),'Arbeitsstand 01 von '+z.erster+' eingegangen','Endstand von '+z.ende+' eingegangen',z.bestaetigt+' bestätigt',
      z.vorbehalt?z.vorbehalt+' mit Vorbehalt':'',z.ueberfaellig+' überfällig'],
    passt:(d,f,heute)=>{const st=eingangStand(d,heute);return ({ausstehend:!!st&&!['bestätigt','Vorbehalt'].includes(st),vorbehalt:st==='Vorbehalt',bestaetigt:st==='bestätigt'})[f]}
  },
  // Pläne, die ersetzt sind oder entfallen, zählen nicht mehr mit (grau, wie in der Vorlage).
  planliste:{
    erledigt:d=>['ersetzt','entfällt'].includes(d.status),
    faellig:()=>'',
    zaehle:n=>({aktiv:n(x=>!['ersetzt','entfällt'].includes(x.status)),bearbeitung:n(x=>x.status==='in Bearbeitung'),
      teilstand:n(x=>x.status==='Teilstand (vorläufig)'),a01:n(x=>x.status==='Arbeitsstand 01'),s02:n(x=>x.status==='Stand 02'),
      ende:n(x=>x.status==='Endstand LPH 3'),ausgegeben:n(x=>ausgegeben(x)&&!['ersetzt','entfällt'].includes(x.status)),weg:n(x=>['ersetzt','entfällt'].includes(x.status))}),
    text:z=>[plural(z.aktiv,'Plan','Pläne'),z.bearbeitung?z.bearbeitung+' in Bearbeitung':'',z.teilstand?z.teilstand+' Teilstand':'',z.a01?z.a01+' Arbeitsstand 01':'',
      z.s02?z.s02+' Stand 02':'',z.ende?z.ende+' Endstand':'',z.ausgegeben+' schon ausgegeben',z.weg?z.weg+' ersetzt oder entfallen':''],
    passt:(d,f)=>({nie_ausgegeben:!ausgegeben(d)&&!['ersetzt','entfällt'].includes(d.status),weg:['ersetzt','entfällt'].includes(d.status)})[f]
  },
  dokumente:{
    erledigt:()=>false,
    faellig:()=>'',
    zaehle:n=>({mitStand:n(x=>!!s(x.stand).trim())}),
    text:z=>[plural(z.gesamt,'Ergebnis','Ergebnisse'),z.mitStand+' mit Stand',(z.gesamt-z.mitStand)+' noch ohne'],
    passt:(d,f)=>({ohne_stand:!s(d.stand).trim(),mit_stand:!!s(d.stand).trim()})[f]
  },
  // Eine Ausgabe mit Datum bis heute ist ausgegeben; ohne Datum oder mit späterem Datum geplant.
  ausgaben:{
    erledigt:()=>false,
    faellig:()=>'',
    zaehle:(n,heute)=>({ausgegeben:n(x=>gueltigIso(x.datum)&&x.datum<=heute)}),
    text:z=>[plural(z.gesamt,'Ausgabe','Ausgaben'),z.ausgegeben+' ausgegeben',(z.gesamt-z.ausgegeben)+' geplant'],
    passt:(d,f,heute)=>{const aus=gueltigIso(d.datum)&&d.datum<=heute;return ({ausgegeben:aus,geplant:!aus})[f]}
  },
  verteiler:{
    erledigt:()=>false,
    faellig:()=>'',
    zaehle:()=>({}),
    text:z=>[plural(z.gesamt,'Empfänger','Empfänger')+' · '+AUSGABEN_VERTEILER+' Ausgaben als Spalten']
  },
  austausch:{
    erledigt:()=>false,
    faellig:()=>'',
    zaehle:n=>({vereinbart:n(x=>gueltigIso(x.vereinbart_am))}),
    text:z=>[plural(z.gesamt,'Fachplanung','Fachplanungen'),z.vereinbart+' vereinbart',(z.gesamt-z.vereinbart)+' noch offen'],
    passt:(d,f)=>({offen:!gueltigIso(d.vereinbart_am),vereinbart:gueltigIso(d.vereinbart_am)})[f]
  },
  ablage:{
    erledigt:()=>false,
    faellig:()=>'',
    zaehle:n=>({office:n(x=>x.office==='ja')}),
    text:z=>[plural(z.gesamt,'Ordner','Ordner'),z.office+' ins Office',(z.gesamt-z.office)+' nicht ins Office'],
    passt:(d,f)=>({ins_office:d.office==='ja',nicht_ins_office:d.office==='nein'})[f]
  }
};
function passt(art,d,filter,heute=heuteIso()){
  if(!filter||filter==='alle')return true;
  if(filter==='ueberfaellig')return ueberfaellig(art,d,heute);
  const eigen=REGELN[art]?.passt?.(d||{},filter,heute);
  if(eigen!==undefined)return eigen;
  if(filter==='entscheidungspunkte')return istEntscheidungspunkt(d);
  if(filter==='geloest')return erledigt(art,d);
  if(filter==='ohne_bestaetigung')return ohneBestaetigung(d);
  return d?.status===filter;
}
function filtere(art,zeilen,{filter='alle',disziplin='',suche='',heute=heuteIso()}={}){
  const q=s(suche).trim().toLowerCase();
  return zeilen.filter(z=>{
    const d=z.daten||{};
    if(!passt(art,d,filter,heute))return false;
    if(disziplin&&!betrifft(art,d,disziplin))return false;
    if(q){
      const t=((SPALTEN[art]||[]).map(sp=>zellText(art,sp.key,d,{nr:z.nr,heute})).join(' ')+' '+s(d.gruppe)).toLowerCase();
      if(!t.includes(q))return false;
    }
    return true;
  });
}
function zaehleFilter(art,zeilen,heute=heuteIso()){
  const out={};
  for(const [k] of FILTER[art]||[])out[k]=zeilen.filter(z=>passt(art,z.daten||{},k,heute)).length;
  return out;
}

// ---------- Verknüpfungen ----------
// Entscheidungspunkte der Klärungsliste, die noch nicht in der Entscheidungsliste stehen.
function wartendeEntscheidungspunkte(klaerung,entscheidungen){
  const ids=new Set(entscheidungen.map(z=>z.id));
  const ausKlaerung=new Set(entscheidungen.map(z=>z.daten?.herkunft_ref?.zeile_id).filter(Boolean));
  return klaerung.filter(z=>{
    const d=z.daten||{};
    if(!istEntscheidungspunkt(d)||erledigt('klaerungsliste',d))return false;
    if(d.entscheidung_id&&ids.has(d.entscheidung_id))return false;
    return !ausKlaerung.has(z.id);
  });
}
function entscheidungAusKlaerung(z){
  const d=z.daten||{};
  const loesung=s(d.loesung).trim();
  // Thema kurz wie in der Bürovorlage; Ort und Plan stehen im Anlass.
  const anlass=[s(d.sachverhalt).trim(),s(d.ort).trim()?'Ort: '+s(d.ort).trim():'',s(d.plan).trim()?'Plan: '+s(d.plan).trim():''].filter(Boolean).join('\n');
  return {herkunft:'Klärungsliste Nr '+z.nr,herkunft_ref:{art:'klaerungsliste',zeile_id:z.id,nr:z.nr},
    thema:kurz(s(d.sachverhalt).trim()||s(d.ort).trim(),70),frage:'',anlass,
    optionen:loesung?[{id:'A',text:loesung},{id:'B',text:''}]:[{id:'A',text:''},{id:'B',text:''}],
    empfehlung:'',begruendung:'',festliegt:'',bis:gueltigIso(d.frist)?d.frist:'',status:'vorbereitet',
    annahme:'',fundstelle:s(d.protokoll).trim()};
}
// Aufgabe im Planner aus einer Klärung: Titel mit Nummer und Verantwortlichem, fällig zur Frist.
function aufgabeAusKlaerung(z,{dokumentId,projektId}){
  const d=z.daten||{};
  const wer=s(d.verantwortlich).trim();
  const titel=kurz('Klärung Nr '+z.nr+(wer?' · '+wer:'')+': '+(s(d.sachverhalt).trim()||s(d.ort).trim()||'ohne Sachverhalt'),200);
  const notiz=[['Ort',d.ort],['Plan · Index',d.plan],['Sachverhalt',d.sachverhalt],['Lösungsvorschlag',d.loesung],['Folgen',d.folgen],['Protokoll',d.protokoll]]
    .filter(([,v])=>s(v).trim()).map(([k,v])=>k+': '+s(v).trim()).join('\n');
  return {title:titel,project_id:projektId,due_date:gueltigIso(d.frist)?d.frist:null,work_status:'not_started',
    notes:('Aus der Klärungsliste, Nr '+z.nr+'.\n'+notiz).slice(0,3990),
    metadata:{source:'klaerungsliste',dokument_id:dokumentId,zeile_id:z.id,nr:z.nr}};
}

// ---------- Speichern ----------
const gleich=(a,b)=>JSON.stringify(a??'')===JSON.stringify(b??'');
// Drei Stände eines Felds: was der Client zuletzt vom Server hatte (basis), was hier geändert wurde (lokal) und was
// inzwischen auf dem Server steht. Hier Geändertes gilt; der Rest kommt vom Server. Haben beide dasselbe Feld
// verschieden geändert, steht es in «kollisionen» (hier gilt dann die eigene Eingabe, wie in einer Tabelle).
function zusammenfuehren(basis,lokal,server){
  const daten={...server},kollisionen=[];
  const keys=new Set([...Object.keys(basis||{}),...Object.keys(lokal||{})]);
  for(const k of keys){
    if(gleich(lokal?.[k],basis?.[k]))continue;
    if(!gleich(server?.[k],basis?.[k])&&!gleich(server?.[k],lokal?.[k]))kollisionen.push(k);
    if(lokal&&k in lokal)daten[k]=lokal[k];else delete daten[k];
  }
  return {daten,kollisionen};
}
function geaenderteFelder(basis,lokal){
  const keys=new Set([...Object.keys(basis||{}),...Object.keys(lokal||{})]);
  return [...keys].filter(k=>!gleich(basis?.[k],lokal?.[k]));
}
// Vorschläge von Romy dürfen keine Entscheidung enthalten.
function vorschlagErlaubt(daten){
  const d=daten||{};
  if(NUR_VON_HAND.some(k=>k in d))return false;
  return d.status!=='entschieden';
}
function ohneEntscheidung(daten){
  const d={...(daten||{})};
  for(const k of NUR_VON_HAND)delete d[k];
  if(d.status==='entschieden')delete d.status;
  return d;
}
// Prüfungen vor dem Speichern, mit Text für die Anzeige (die Datenbank prüft dasselbe).
function pruefe(art,d){
  if(art==='entscheidungsliste'&&d?.status==='entschieden'){
    const fehlt=[['entschieden_am','Datum'],['entscheider','Entscheider'],['entscheidung','Entscheidung']].filter(([k])=>!s(d[k]).trim()).map(([,l])=>l);
    if(fehlt.length)return '«entschieden» braucht '+fehlt.join(', ').replace(/, ([^,]*)$/,' und $1')+'.';
  }
  return '';
}

// ---------- Vorschläge von Romy ----------
// Wortweiser Vergleich für «grün eingefügt, rot gestrichen» (längste gemeinsame Teilfolge der Wörter).
function wortDiff(alt,neu){
  const a=s(alt).split(/(\s+)/).filter(x=>x!==''),b=s(neu).split(/(\s+)/).filter(x=>x!=='');
  if(a.length*b.length>400000)return [{typ:'weg',text:s(alt)},{typ:'neu',text:s(neu)}];
  const L=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)L[i][j]=a[i]===b[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  const out=[],dazu=(typ,text)=>{const l=out[out.length-1];if(l&&l.typ===typ)l.text+=text;else out.push({typ,text})};
  let i=0,j=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){dazu('gleich',a[i]);i++;j++}
    else if(L[i+1][j]>=L[i][j+1]){dazu('weg',a[i]);i++}
    else{dazu('neu',b[j]);j++}
  }
  while(i<a.length)dazu('weg',a[i++]);
  while(j<b.length)dazu('neu',b[j++]);
  return out;
}
// Was ein übernommener Vorschlag an einer Zeile ändert, in Worten («Frist: 28.11. → 06.12.»).
function aenderungText(art,alt,daten,heute=heuteIso()){
  return Object.keys(daten||{}).filter(k=>!k.startsWith('_')).map(k=>{
    if(k==='optionen')return 'Varianten: '+optionenAenderung(alt?.optionen,daten.optionen);
    const sp=(SPALTEN[art]||[]).find(x=>x.key===k);
    const zeige=d=>sp?.typ==='datum'?datumKurz(d?.[k],heute):zellText(art,k,d||{},{heute});
    return feldName(art,k)+': '+(kurz(zeige(alt),60)||'–')+' → '+(kurz(zeige(daten),60)||'–');
  }).join(' · ');
}

// ---------- Kosten einer Variante ----------
function betragVon(o){
  const b=leseZahl(o?.betrag);
  if(b!==null)return {cent:cent(b),berechnet:false};
  const k=leseZahl(o?.kennwert),m=leseZahl(o?.menge);
  if(k!==null&&m!==null)return {cent:cent(k*m),berechnet:true};
  return {cent:null,berechnet:false};
}
// Mehrkosten gegenüber der empfohlenen Variante, sonst gegenüber der günstigsten. USt in Prozent, ganzzahlig gerundet.
function mehrkosten(d,{ustProzent=19}={}){
  const mit=optionen(d).map(o=>({id:o.id,...betragVon(o)})).filter(x=>x.cent!==null);
  if(mit.length<2)return [];
  const basis=mit.find(x=>x.id===s(d?.empfehlung).trim())||mit.reduce((a,b)=>b.cent<a.cent?b:a);
  return mit.filter(x=>x.id!==basis.id).map(x=>{
    const netto=x.cent-basis.cent;
    const brutto=(netto*BigInt(100+ustProzent)+(netto<0n?-50n:50n))/100n;
    return {id:x.id,gegenueber:basis.id,netto,brutto};
  });
}

// ---------- Entscheidungsvorlage ----------
// Inhalt einer Vorlage aus der Vorlagenzeile und ihren Entscheidungen; daraus entstehen Ansicht, Word und Stand.
function vorlageInhalt(vorlage,entscheidungen,{projekt={},stand=heuteIso(),namen={}}={}){
  const v=vorlage?.daten||{};
  const ids=Array.isArray(v.punkte)?v.punkte:[];
  const punkte=ids.map(id=>entscheidungen.find(z=>z.id===id)).filter(Boolean).map(z=>{
    const d=z.daten||{};
    return {id:z.id,nr:nummer('entscheidungsliste',z.nr),thema:s(d.thema),herkunft:s(d.herkunft),frage:s(d.frage),anlass:s(d.anlass),
      gesichert:s(d.gesichert),angenommen:s(d.angenommen),
      optionen:optionen(d).map(o=>{const b=betragVon(o);return {...Object.fromEntries(OPTION_FELDER.map(k=>[k,s(o[k])])),betragCent:b.cent===null?null:b.cent.toString(),betragBerechnet:b.berechnet}}),
      mehrkosten:mehrkosten(d).map(m=>({...m,netto:m.netto.toString(),brutto:m.brutto.toString()})),kostenbezug:s(d.kostenbezug),
      empfehlung:s(d.empfehlung),begruendung:s(d.begruendung),festliegt:s(d.festliegt),wennSpaeter:s(d.wenn_spaeter),bis:s(d.bis),
      status:s(d.status),entschiedenAm:s(d.entschieden_am),entscheidung:s(d.entscheidung),entscheider:s(d.entscheider),
      annahme:s(d.annahme),bestaetigtAm:s(d.bestaetigt_am),fundstelle:s(d.fundstelle)};
  });
  const nr=nummer('entscheidungsvorlagen',vorlage?.nr);
  const titel=s(v.titel).trim()||(punkte.length===1?punkte[0].thema:'Entscheidungen zur Besprechung');
  const bis=punkte.map(p=>p.bis).filter(gueltigIso).sort()[0]||'';
  return {schema:'tba.office.entscheidungsvorlage.v1',nr,titel,projekt:{nummer:s(projekt.number),name:s(projekt.name)},
    auftraggeber:s(v.auftraggeber),besprechung:s(v.besprechung)||'M04',besprechungAm:s(v.besprechung_am),
    verfasser:s(v.verfasser)||s(namen.verfasser),freigabe:s(v.freigabe),status:s(v.status)||'Entwurf',vorgelegtAm:s(v.vorgelegt_am),
    weitergegeben:s(v.weitergegeben),stand,bis,punkte};
}
// Die Vorlage als Folge einfacher Blöcke; Ansicht im Browser und Word lesen dieselbe Folge.
function vorlageBloecke(inhalt){
  const b=[],p=t=>s(t).trim();
  const projekt=[inhalt.projekt.nummer,inhalt.projekt.name].filter(Boolean).join(' ');
  b.push({typ:'titel',text:'Entscheidungsvorlage '+inhalt.nr+' · '+inhalt.titel});
  b.push({typ:'unter',text:[projekt,'Vorlage zur Besprechung '+inhalt.besprechung+(inhalt.besprechungAm?' am '+datumLang(inhalt.besprechungAm):''),
    'Stand '+datumLang(inhalt.stand),inhalt.status==='vorgelegt'?'vorgelegt am '+datumLang(inhalt.vorgelegtAm):'Entwurf'].filter(Boolean).join(' · ')});
  const kopf=[['Projekt',projekt],['Auftraggeber',inhalt.auftraggeber],['Vorlage Nr.',inhalt.nr],['Verfasser',inhalt.verfasser],
    ['Freigabe Büroleitung',inhalt.freigabe]].filter(([,v])=>p(v));
  if(kopf.length)b.push({typ:'felder',zeilen:kopf});
  const mehrere=inhalt.punkte.length>1;
  if(mehrere){
    b.push({typ:'h1',text:'Übersicht'});
    b.push({typ:'tabelle',kopf:['Nr','Entscheidungspunkt','Empfehlung','Entscheidung bis'],breiten:[12,48,22,18],
      zeilen:inhalt.punkte.map(x=>[x.nr,x.thema,x.empfehlung?'Variante '+x.empfehlung:'offen',datumLang(x.bis)])});
  }
  inhalt.punkte.forEach((x,i)=>{
    const n=mehrere?(i+1)+'.':'';
    if(mehrere)b.push({typ:'h1',text:x.nr+' · '+x.thema,seitenumbruch:i>0});
    if(x.herkunft)b.push({typ:'klein',text:'Herkunft: '+x.herkunft});
    b.push({typ:'h2',text:n+'1 · Anlass'});
    b.push({typ:'p',text:p(x.anlass)||'[Anlass ergänzen]',feld:'anlass',punkt:x.id});
    if(p(x.gesichert))b.push({typ:'p',text:'Gesichert: '+p(x.gesichert)});
    if(p(x.angenommen))b.push({typ:'p',text:'Angenommen (zu bestätigen): '+p(x.angenommen)});
    b.push({typ:'h2',text:n+'2 · Frage an den Auftraggeber'});
    b.push({typ:'p',text:p(x.frage)||'[Frage ergänzen]',feld:'frage',punkt:x.id});
    const opts=x.optionen.filter(o=>p(o.text));
    b.push({typ:'h2',text:n+'3 · Varianten und Kosten'});
    if(opts.length){
      b.push({typ:'tabelle',varianten:x.id,ids:opts.map(o=>o.id),kopf:['Variante','Produkt','Kennwert netto','Menge','Betrag netto'],breiten:[34,18,16,12,20],rechts:[2,3,4],
        zeilen:opts.map(o=>[o.id+' · '+p(o.text),p(o.produkt),p(o.kennwert),p(o.menge),o.betragCent===null?'':euro(BigInt(o.betragCent))+(o.betragBerechnet?' *':'')])});
      if(opts.some(o=>o.betragBerechnet))b.push({typ:'klein',text:'* Kennwert × Menge'});
      for(const m of x.mehrkosten){
        const netto=BigInt(m.netto),brutto=BigInt(m.brutto);
        b.push({typ:'p',text:(netto>=0n?'Mehrkosten ':'Minderkosten ')+m.id+' gegenüber '+m.gegenueber+': '+euro(netto<0n?-netto:netto)+' netto ('+euro(brutto<0n?-brutto:brutto)+' brutto)'+(p(x.kostenbezug)?', '+p(x.kostenbezug):'')+'.'});
      }
      const quellen=opts.filter(o=>belegText(o)).map(o=>o.id+': '+belegText(o));
      if(quellen.length)b.push({typ:'klein',text:'Quellen: '+quellen.join(' · ')});
    }else b.push({typ:'p',text:'[Varianten ergänzen]'});
    b.push({typ:'h2',text:n+'4 · Folgen je Variante'});
    const folgen=opts.filter(o=>['kosten','termine','qualitaet','genehmigung'].some(k=>p(o[k])));
    if(folgen.length)b.push({typ:'tabelle',kopf:['Variante','Kosten','Termine','Qualität · Gestaltung','Genehmigung'],breiten:[14,22,22,22,20],
      zeilen:folgen.map(o=>[o.id,p(o.kosten),p(o.termine),p(o.qualitaet),p(o.genehmigung)])});
    else b.push({typ:'p',text:'[Folgen je Variante ergänzen]'});
    b.push({typ:'h2',text:n+'5 · Empfehlung des Büros'});
    const empf=opts.find(o=>o.id===x.empfehlung);
    b.push({typ:'p',text:(x.empfehlung?'Das Büro empfiehlt Variante '+x.empfehlung+(empf?' ('+p(empf.text)+')':'')+'.':'Eine Empfehlung steht noch aus.')+(p(x.begruendung)?' '+p(x.begruendung):''),feld:'begruendung',punkt:x.id});
    b.push({typ:'h2',text:n+'6 · Was danach festliegt'});
    b.push({typ:'p',text:p(x.festliegt)||'[ergänzen]',feld:'festliegt',punkt:x.id});
    if(p(x.wennSpaeter))b.push({typ:'p',text:'Wenn später entschieden wird: '+p(x.wennSpaeter)});
    b.push({typ:'h2',text:n+'7 · Entscheidung des Auftraggebers'});
    if(x.status==='entschieden'){
      b.push({typ:'p',text:'Entschieden am '+datumLang(x.entschiedenAm)+(x.entscheider?' von '+x.entscheider:'')+': '+x.entscheidung+'.'});
      b.push({typ:'p',text:x.bestaetigtAm?'In Textform bestätigt am '+datumLang(x.bestaetigtAm)+'.':'Die Bestätigung in Textform steht noch aus.'});
    }else{
      b.push({typ:'auswahl',zeilen:opts.map(o=>'Variante '+o.id+' · '+p(o.text))});
      b.push({typ:'unterschrift',links:'Datum',rechts:'Unterschrift Auftraggeber'});
      b.push({typ:'klein',text:'Statt der Unterschrift genügt eine Bestätigung in Textform, zum Beispiel per E-Mail'+(gueltigIso(x.bis)?', bis '+datumLang(x.bis):'')+'.'});
      if(p(x.annahme))b.push({typ:'klein',text:'Bis zur Entscheidung wird so weitergeplant: '+p(x.annahme)});
    }
  });
  return b;
}

return Object.freeze({DISZIPLINEN,RUNDEN,STATUS_KLAERUNG,STATUS_ENTSCHEIDUNG,JA_NEIN,NUR_VON_HAND,SPALTEN,DOKUMENTE,ARTEN,FELDER,OPTION_FELDER,FILTER,
  ZUSTAENDIGKEIT,LEGENDE,JA_NEIN_PRUEFEN,BEAUFTRAGT,STATUS_FACHPLANER,STATUS_SCHNITTSTELLE,STATUS_FRAGE,WER_FRAGT,BESTAETIGUNG,MEILENSTEINE,MATRIX,
  WEITERE,MIT_DISZIPLIN,PLANARTEN,STATUS_PLAN,FORMATE,UEBERGABE,AUSGABEN_PLANLISTE,AUSGABEN_VERTEILER,setzePlanschluessel,planschluessel,
  plannummer,plannummerAus,ausgegeben,setzeTermine,termine,istMeilenstein,meilensteinName,terminVon,leseTermin,terminFehlt,terminText,naechsterCode,
  zustaendigkeit,eingangStand,betrifft,faelligAm,
  kurz,gueltigIso,heuteIso,leseDatum,datumKurz,datumLang,excelTag,leseZahl,euro,leereZeile,optionen,naechsteOptionId,erledigt,ueberfaellig,
  istEntscheidungspunkt,ohneBestaetigung,optionenText,folgenText,empfehlungText,nummer,zellText,feldName,zaehle,zusammenfassung,passt,filtere,
  zaehleFilter,wartendeEntscheidungspunkte,entscheidungAusKlaerung,aufgabeAusKlaerung,zusammenfuehren,geaenderteFelder,vorschlagErlaubt,
  ohneEntscheidung,pruefe,wortDiff,aenderungText,betragVon,mehrkosten,vorlageInhalt,vorlageBloecke,optionenZusammen,optionenAenderung,
  belegText,fundstellenText});
});
