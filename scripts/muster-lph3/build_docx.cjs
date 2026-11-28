// Bürovorlagen LPH 3 als Word: Projektstartvermerk (L3.PSV.1), Kick-off Fachplanung (L3.A1.ABS),
// Entscheidungsvorlage (L3.ENV.1 / L3.A3.ABS).
//
// Aufruf aus dem Repo:  NODE_PATH=<npm-global>/node_modules node scripts/muster-lph3/build_docx.cjs
// Schreibt muster/lph3/LPH3_1_Projektstartvermerk.docx, LPH3_4_Kickoff_Fachplanung.docx,
// LPH3_5_Entscheidungsvorlage.docx.
//
// Muster: keine Projekt-, Kunden- oder Personendaten (das Repository ist öffentlich).
// Fundstellen: scripts/muster-lph3/quellen.json; Karten und Parameter aus der Aufgabenbibliothek.
'use strict';
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, Header, Footer, PageNumber, BorderStyle, LevelFormat, PageBreak,
  ExternalHyperlink, VerticalAlign,
} = require('docx');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO, 'muster', 'lph3');
const BIB = JSON.parse(fs.readFileSync(path.join(REPO, 'app/data/muster-planner-lph3-v0.3.json'), 'utf8'));
const Q = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/muster-lph3/quellen.json'), 'utf8'));
const STAND = '20.11.2026';

// ───────── Gestaltung
const W = 9638;                       // A4 mit 2 cm Rand: nutzbare Breite in DXA
const GREEN = '355B49', GREY = '7F7F7F', MUTED = '5F6B63', LIGHT = 'E4ECE6', NOTE = 'F3F6F3';
const LINE = { style: BorderStyle.SINGLE, size: 4, color: 'C9D3CB' };
const BORDERS = { top: LINE, bottom: LINE, left: LINE, right: LINE, insideHorizontal: LINE, insideVertical: LINE };

// Text mit Platzhaltern: [ … ] grau kursiv, ☐ in einer Schrift, die das Zeichen hat.
function runs(text, base = {}) {
  const out = [];
  for (const part of String(text).split(/(\[[^\]]*\]|☐)/)) {
    if (!part) continue;
    if (part === '☐') out.push(new TextRun({ ...base, text: '☐', font: 'Segoe UI Symbol' }));
    else if (part.startsWith('[') && part.endsWith(']')) out.push(new TextRun({ ...base, text: part, italics: true, color: GREY }));
    else out.push(new TextRun({ ...base, text: part }));
  }
  return out;
}
const P = (text, o = {}) => new Paragraph({ children: runs(text, o.run || {}), spacing: { after: o.after ?? 120, before: o.before ?? 0 }, alignment: o.align, keepNext: o.keepNext });
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const SMALL = (text, o = {}) => P(text, { ...o, run: { size: 18, color: MUTED, ...(o.run || {}) } });
const bullet = (text) => new Paragraph({ numbering: { reference: 'punkte', level: 0 }, children: runs(text), spacing: { after: 60 } });
const check = (text) => new Paragraph({ children: [...runs('☐  '), ...runs(text)], spacing: { after: 80 }, indent: { left: 0 } });

function note(lines) {
  // Hinweiskasten: schattierte Absätze mit linker Linie
  return lines.map((t, i) => new Paragraph({
    children: runs(t, { size: 19, color: '3D5447' }),
    shading: { type: ShadingType.CLEAR, fill: NOTE, color: 'auto' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: '6B9881', space: 8 } },
    spacing: { after: i === lines.length - 1 ? 200 : 0, before: i === 0 ? 60 : 0 },
    indent: { left: 120, right: 120 },
  }));
}

function cell(content, width, o = {}) {
  const paras = (Array.isArray(content) ? content : [content]).map((c) => c instanceof Paragraph ? c
    : new Paragraph({ children: runs(c ?? '', { size: o.size || 19, bold: o.bold, color: o.color }), spacing: { after: 40 }, alignment: o.align }));
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    verticalAlign: o.valign || VerticalAlign.TOP,
    columnSpan: o.span,
    children: paras,
  });
}

// Tabelle: Kopfzeile grün, Zeilen als Arrays; eine Zeile {section:'…'} wird als Zwischenzeile gesetzt.
function table(widths, head, rows, o = {}) {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum !== W) throw new Error(`Spaltenbreiten ${sum} ≠ ${W}: ${head.join(' | ')}`);
  const tr = [];
  if (head) tr.push(new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(h, widths[i], { fill: GREEN, bold: true, color: 'FFFFFF', size: 18 })) }));
  for (const r of rows) {
    if (r && r.section) { tr.push(new TableRow({ cantSplit: true, children: [cell(r.section, W, { fill: LIGHT, bold: true, color: GREEN, span: widths.length })] })); continue; }
    tr.push(new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], { fill: o.firstColFill && i === 0 ? 'F7F9F7' : undefined, bold: o.firstColBold && i === 0, height: o.height })) }));
  }
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, borders: BORDERS, rows: tr });
}
const gap = (after = 160) => new Paragraph({ children: [], spacing: { after } });

function meta(rows) {
  return table([2600, W - 2600], null, rows, { firstColBold: true, firstColFill: true });
}

function titleBlock(title, sub) {
  return [
    new Paragraph({ children: [new TextRun({ text: 'Bürovorlage LPH 3 · Muster', size: 17, color: MUTED, allCaps: true, characterSpacing: 30 })], spacing: { after: 80 } }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }),
    P(sub, { run: { size: 19, color: MUTED }, after: 240 }),
  ];
}

function quellen(ids) {
  const list = Q.quellen.filter((q) => ids.includes(q.id));
  return [
    H2('Fundstellen'),
    ...list.map((q) => new Paragraph({ numbering: { reference: 'punkte', level: 0 }, spacing: { after: 40 }, children: [
      new TextRun({ text: q.titel + ' – ', size: 18, color: MUTED }),
      new ExternalHyperlink({ link: q.url, children: [new TextRun({ text: q.url, style: 'Hyperlink', size: 18 })] }),
    ] })),
    SMALL(Q.hinweis, { before: 80 }),
  ];
}

function doc(children, footerTitle) {
  return new Document({
    creator: 'TBA Office',
    lastModifiedBy: 'TBA Office',
    title: footerTitle,
    description: 'Bürovorlage LPH 3 · Muster · Stand ' + STAND,
    styles: {
      default: { document: { run: { font: 'Arial', size: 21 } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: 'Arial', size: 40, bold: true, color: '202823' }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 28, bold: true, color: GREEN }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 23, bold: true, color: '202823' }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true, outlineLevel: 1 } },
      ],
    },
    numbering: { config: [{ reference: 'punkte', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 567, footer: 567 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: footerTitle + ' · Projekt: ', size: 16, color: MUTED }), new TextRun({ text: '[Projekt]', size: 16, color: GREY, italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [
        new TextRun({ text: `TBA Office · Bürovorlage LPH 3 · Stand ${STAND} · Seite `, size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED }),
        new TextRun({ text: ' von ', size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED }),
      ] })] }) },
      children,
    }],
  });
}

async function save(d, name) {
  const buf = await Packer.toBuffer(d);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('geschrieben: muster/lph3/' + name);
}

// ════════════════════════════════════════════ 1 · Projektstartvermerk
function projektstartvermerk() {
  const params = BIB.parameters;
  const c = [];
  c.push(...titleBlock('Projektstartvermerk LPH 3', 'mit Protokoll des Projektauftakts (M00) · Aufgabe L3.PSV.1 · Prüfpunkte L3.PSV.1-01 bis -09 · Aufgabenbibliothek LPH 3 v0.3.4'));
  c.push(...note([
    'So verwenden: graue Klammertexte ersetzen, nicht Zutreffendes streichen, ☐ ankreuzen.',
    'Der Vermerk hält fest, womit die LPH 3 beginnt. Fehlt die Freigabe der LPH 2 oder ist der Leistungsumfang unklar: vor Planungsbeginn an die Büroleitung (L3.PSV.1, erledigt wenn).',
  ]));
  c.push(meta([
    ['Projekt', '[Name wie im Office]'], ['Projektnummer', '[ ]'], ['Auftraggeber', '[Firma bzw. Name; Ansprechpartner mit Rolle]'],
    ['Verfasser', '[Projektleitung]'], ['Datum', '[TT.MM.JJJJ]'], ['Verteiler', '[Büroleitung, Projektteam]'], ['Ablage', '[05_Protokolle] und Office · Schreibtisch des Projekts'],
  ]));

  c.push(H1('1  Grundlagen und Auftrag'));
  c.push(table([500, 3300, 2988, 1050, 1800], ['Nr', 'Punkt', 'Stand · Fundstelle', 'bestätigt', 'offen: wer, bis wann'], [
    ['1.1', 'Vorplanung (LPH 2) vom Auftraggeber in Textform freigegeben oder Änderungswünsche dokumentiert (L3.PSV.1-01)', '[Datum, Form – z. B. E-Mail vom …]', '☐', '[ ]'],
    ['1.2', 'Kostenschätzung LPH 2 und Kostenvorgabe bzw. Budget liegen vor; Bezugsstand für den späteren Vergleich festgelegt (L3.PSV.1-03)', '[Betrag, Stand, brutto/netto, Kostengruppen]', '☐', '[ ]'],
    ['1.3', 'Fassung der DIN 276 und Gliederungstiefe der Kostenberechnung vertraglich geklärt (L3.PSV.1-04)', '[Fassung 2018-12 / 2008-12; 2. / 3. Ebene; Fundstelle im Vertrag]', '☐', '[ ]'],
    { section: 'Planungsgrundlagen (L3.PSV.1-05)' },
    ['1.4', 'Vermessung: Lage- und Höhenplan mit Höhenbezug', '[liegt vor vom … / fehlt, angefordert bei …]', '☐', '[ ]'],
    ['1.5', 'Baugrund: geotechnischer Bericht (Gründung, Grundwasser, Versickerung)', '[ ]', '☐', '[ ]'],
    ['1.6', 'Bestandsunterlagen (bei Bestand: Aufmaß, Bauakten)', '[ ]', '☐', '[ ]'],
    ['1.7', 'Bebauungsplan, örtliche Satzungen (Stellplätze, Gestaltung, Freiflächen, Entwässerung)', '[ ]', '☐', '[ ]'],
    ['1.8', 'Raumprogramm mit Nutzungen', '[ ]', '☐', '[ ]'],
  ]));
  c.push(SMALL('Zu 1.3: Für das Honorar gilt DIN 276-1:2008-12 (HOAI § 4 Abs. 1); DIN 276:2018-12 gilt nicht automatisch. Für die Kostenberechnung als Leistung: nach DIN 276:2018-12 mindestens 3. Ebene, nach DIN 276-1:2008-12 mindestens 2. Ebene (ByAK-Merkblatt M01); Technische Ausrüstung 3. Ebene (HOAI Anlage 15 LPH 3 f).', { before: 80 }));

  c.push(H1('2  Beauftragter Leistungsumfang LPH 3'));
  c.push(P('Grundleistungen nach HOAI Anlage 10 (Objektplanung Gebäude und Innenräume), Leistungsphase 3 (L3.PSV.1-02):'));
  c.push(table([500, 6838, 1000, 1300], ['', 'Grundleistung', 'beauftragt', 'Bemerkung'], [
    ['a)', 'Erarbeiten der Entwurfsplanung auf der Grundlage der Vorplanung unter Verwendung der Beiträge anderer an der Planung fachlich Beteiligter; Zeichnungen z. B. bei Gebäuden im Maßstab 1:100, bei Innenräumen 1:50 bis 1:20', '☐ ja  ☐ nein', '[ ]'],
    ['b)', 'Bereitstellen der Arbeitsergebnisse als Grundlage für die anderen an der Planung fachlich Beteiligten sowie Koordination und Integration von deren Leistungen', '☐ ja  ☐ nein', '[ ]'],
    ['c)', 'Objektbeschreibung', '☐ ja  ☐ nein', '[ ]'],
    ['d)', 'Verhandlungen über die Genehmigungsfähigkeit', '☐ ja  ☐ nein', '[ ]'],
    ['e)', 'Kostenberechnung nach DIN 276 und Vergleich mit der Kostenschätzung', '☐ ja  ☐ nein', '[ ]'],
    ['f)', 'Fortschreiben des Terminplans', '☐ ja  ☐ nein', '[ ]'],
    ['g)', 'Zusammenfassen, Erläutern und Dokumentieren der Ergebnisse', '☐ ja  ☐ nein', '[ ]'],
  ]));
  c.push(gap(120));
  c.push(table([4819, 4819], ['Besondere Leistungen LPH 3 (vereinbart?)', 'Weitere vereinbarte Leistungen · Ausschlüsse'], [
    [[P('☐  Analyse der Alternativen und Varianten mit Kostenuntersuchung (Optimierung)', { after: 40 }), P('☐  Wirtschaftlichkeitsberechnung', { after: 40 }),
      P('☐  Aufstellen und Fortschreiben einer vertieften Kostenberechnung', { after: 40 }), P('☐  Fortschreiben von Raumbüchern', { after: 40 })],
     [P('☐  Bemusterung (Themenpakete, Mustermappe)', { after: 40 }), P('☐  Innenraumplanung', { after: 40 }), P('☐  [weitere]', { after: 40 }), P('Ausschlüsse: [ ]', { after: 40 })]],
  ]));
  c.push(SMALL('Eine vertiefte Kostenuntersuchung von Varianten ist Besondere Leistung; ohne Beauftragung bleibt die Kostenfolge in Entscheidungsvorlagen in der vertraglich vereinbarten Tiefe (L3.ENV.1-03).', { before: 80 }));

  c.push(H1('3  Fachplaner'));
  c.push(P('Stand der Fachplaner (L3.PSV.1-06). Fehlt eine Beauftragung, folgt das Blatt «Fachplanerbedarf» der Koordinationsmappe (L3.FPB.1).'));
  c.push(table([2000, 2938, 1200, 1500, 2000], ['Disziplin', 'Büro · Ansprechpartner (Firma, Rolle)', 'beauftragt', 'Leistungsphasen', 'Bemerkung'], [
    ['Tragwerksplanung (TWP)', '[ ]', '☐ ja ☐ nein', '[ ]', '[ ]'],
    ['HLS', '[ ]', '☐ ja ☐ nein', '[ ]', '[ ]'],
    ['ELT', '[ ]', '☐ ja ☐ nein', '[ ]', '[ ]'],
    ['Bauphysik (BPH)', '[ ]', '☐ ja ☐ nein', '[ ]', '[ ]'],
    ['Brandschutz (BRS)', '[ ]', '☐ ja ☐ nein', '[ ]', '[Prüfpflicht: Art. 62b BayBO]'],
    ['Geotechnik (GEO)', '[ ]', '☐ ja ☐ nein', '[ ]', '[ ]'],
    ['Vermessung (VER)', '[ ]', '☐ ja ☐ nein', '[ ]', '[ ]'],
    ['Freianlagen (FRA)', '[ ]', '☐ ja ☐ nein', '[ ]', '[ ]'],
    ['[weitere]', '[ ]', '☐ ja ☐ nein', '[ ]', '[ ]'],
  ]));

  c.push(H1('4  Projektparameter für den Planner'));
  c.push(P('Die Parameter steuern, welche Aufgaben und Prüfpunkte der Planner für das Projekt anlegt (L3.PSV.1-07).'));
  c.push(table([900, 2500, 2100, 4138], ['Code', 'Parameter', 'Festlegung', 'Wirkung im Planner'],
    params.map((p) => [p.code, p.name, `[${p.values}]`, p.effect])));
  c.push(SMALL('Gebäudeklasse nach Art. 2 Abs. 3 BayBO, Sonderbau nach Art. 2 Abs. 4 BayBO. Daraus folgen die Prüfpflichten von Standsicherheits- und Brandschutznachweis (Art. 62a, 62b BayBO); die Koordinationsmappe, Blatt «Projekt», leitet sie ab.', { before: 80 }));

  c.push(H1('5  Rollen im Büro'));
  c.push(table([3600, 3438, 2600], ['Rolle (L3.PSV.1-08)', 'Person', 'Vertretung'], [
    ['Projektleitung', '[ ]', '[ ]'], ['Bearbeitung Grundrisse, Schnitte, Ansichten, Lageplan', '[je Planart]', '[ ]'], ['Themenpakete (Bäder, Treppen, Fassade, Licht, Böden)', '[je Thema eine Person]', '[ ]'],
    ['Kostenplanung', '[ ]', '[ ]'], ['Planliste und Ablage', '[ ]', '[ ]'], ['Prüfung und Freigabe', '[Büroleitung]', '[ ]'],
  ]));

  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('6  Protokoll Projektauftakt (M00)'));
  c.push(meta([['Datum, Ort', '[TT.MM.JJJJ, Ort oder Videokonferenz]'], ['Teilnehmende', '[Auftraggeber: Name, Rolle · Büro: Name, Rolle]'], ['Protokoll', '[Name]'], ['Verteiler', '[alle Teilnehmenden]']]));
  c.push(gap(120));
  c.push(table([600, 3000, 3838, 1000, 1200], ['TOP', 'Gegenstand', 'Ergebnis · Festlegung', 'wer', 'bis wann'], [
    ['1', 'Ziele und Rahmen der LPH 3; Ergebnis der Vorplanung', '[ ]', '[ ]', '[ ]'],
    ['2', 'Freigabe der LPH 2, Änderungswünsche', '[ ]', '[ ]', '[ ]'],
    ['3', 'Leistungsumfang LPH 3, Besondere Leistungen, Ausschlüsse', '[ ]', '[ ]', '[ ]'],
    ['4', 'Kostenvorgabe, Kostenschätzung, Fassung der DIN 276', '[ ]', '[ ]', '[ ]'],
    ['5', 'Terminplan LPH 3: Meilensteine M00 bis M11, Prüffristen des Auftraggebers', '[ ]', '[ ]', '[ ]'],
    ['6', 'Fachplaner: Bedarf, Beauftragung (M00A), Kick-off (M02)', '[ ]', '[ ]', '[ ]'],
    ['7', 'Entscheidungswege: wer entscheidet beim Auftraggeber, in welcher Form (Textform), mit welchen Fristen', '[ ]', '[ ]', '[ ]'],
    ['8', 'Bemusterung und Qualitäten (falls vereinbart)', '[ ]', '[ ]', '[ ]'],
    ['9', 'Nächste Schritte', '[ ]', '[ ]', '[ ]'],
  ]));
  c.push(H2('Offene Punkte'));
  c.push(table([600, 5638, 1800, 1600], ['Nr', 'Punkt', 'verantwortlich', 'Termin'], [['1', '[ ]', '[ ]', '[ ]'], ['2', '[ ]', '[ ]', '[ ]'], ['3', '[ ]', '[ ]', '[ ]']]));

  c.push(H1('7  Nach dem Vermerk'));
  c.push(check('Vermerk in der Projektablage und im Office abgelegt (Schreibtisch des Projekts) – dort liest die KI ihn mit.'));
  c.push(check('Projektsteckbrief im Office ausgefüllt, vor allem die beauftragten Leistungsphasen: daran erkennt die KI, ob eine Arbeit innerhalb des Auftrags liegt.'));
  c.push(check('Beteiligte im Office eingetragen (Firma, Rolle) – private Daten gehören nicht hinein.'));
  c.push(check('Projektparameter im Planner gesetzt; Terminplan mit den Meilensteinen angelegt.'));
  c.push(check('Koordinationsmappe (LPH3_3_Koordination.xlsx) angelegt: Blatt «Projekt» ausgefüllt.'));
  c.push(check('Bei fehlender Freigabe der LPH 2 oder unklarem Leistungsumfang: Büroleitung informiert, bevor die Planung beginnt.'));
  c.push(...quellen(['HOAI-A10', 'HOAI-4', 'ByAK-M01', 'DAB-276', 'BayBO-62a', 'BayBO-62b', 'TBA-BIB']));
  return doc(c, 'Projektstartvermerk LPH 3');
}

// ════════════════════════════════════════════ 4 · Kick-off Fachplanung
function kickoff() {
  const c = [];
  c.push(...titleBlock('Kick-off Fachplanung LPH 3 (M02)', 'Einladung mit Tagesordnung und Protokoll · Aufgabe L3.A1.ABS · Prüfpunkte L3.A1.ABS-01 bis -08'));
  c.push(...note([
    'Teil A geht mit den Unterlagen vorab hinaus (L3.A1.ABS-01). Teil B ist das Protokoll.',
    'Voraussetzung: die Fachplaner sind beauftragt (M00A). Für die Koordinationsrunden 01 und 02 (L3.KLA.1, L3.KLA.2) dasselbe Protokoll verwenden; die Tagesordnung sind dann die offenen Punkte der Klärungsliste.',
  ]));
  c.push(H1('Teil A · Einladung'));
  c.push(meta([
    ['Projekt', '[ ]'], ['Termin', '[TT.MM.JJJJ, Uhrzeit, Dauer]'], ['Ort', '[Büro / Videokonferenz, Link]'], ['Einladende', '[Projektleitung]'],
    ['Eingeladen', '[TWP · HLS · ELT · BPH · BRS · weitere – je Firma und Ansprechpartner]; ggf. Auftraggeber'],
  ]));
  c.push(H2('Unterlagen (mit dem Paket M01 versandt)'));
  for (const t of ['Planungsgrundlagen: Pläne als PDF und Austauschdatei, gekennzeichnet «vorläufig – kein freigegebener Entwurf», mit Datum und Index (L3.PGF.1)',
    'Schnittstellen- und Liefermatrix v0 (Koordinationsmappe, Blatt «Schnittstellen»)', 'Aufbauvorgaben für die Bauphysik (L3.BTK.1)',
    'Fragenliste je Disziplin (Koordinationsmappe, Blatt «Fragenliste»)', 'Terminplan LPH 3, Auszug mit M03 und M07']) c.push(bullet(t));
  c.push(H2('Tagesordnung'));
  c.push(table([600, 6438, 2600], ['TOP', 'Gegenstand', 'Bezug'], [
    ['1', 'Projekt, Entwurf und Planungsziele', 'L3.A1.ABS-02'],
    ['2', 'Kostenvorgabe und Terminplan LPH 3; Liefertermine Arbeitsstand 01 (M03) und Endstand (M07)', 'L3.A1.ABS-02'],
    ['3', 'Lieferumfang je Disziplin: Pläne, Schemata, Berechnungen, Kostenbeitrag, Beschreibungstexte', 'L3.A1.ABS-03'],
    ['4', 'Kostenbeitrag je Disziplin: Kostengruppen, Gliederungstiefe, Preisstand', 'L3.A1.ABS-04'],
    ['5', 'Schnittstellenmatrix Punkt für Punkt; offene Zuständigkeiten entscheiden', 'L3.A1.ABS-05'],
    ['6', 'Rückfragen zu den Planungsgrundlagen (Fragenliste)', 'L3.A1.ABS-06'],
    ['7', 'Austausch: Dateiformate, Nullpunkt, Planstände und Index', 'L3.PLI.1-06'],
    ['8', 'Behördenabstimmungen in der LPH 3 (Genehmigungsfähigkeit)', 'HOAI Anl. 10 LPH 3 d)'],
    ['9', 'Koordinationsrhythmus und Kommunikationsweg', 'L3.A1.ABS-07'],
    ['10', 'Verschiedenes, nächste Termine', ''],
  ]));
  c.push(P('Bitte bringen Sie mit: Ihre Rückfragen zu den Planungsgrundlagen, Ihren vorgesehenen Lieferumfang für Arbeitsstand 01 und Endstand sowie Ihre Terminzusagen.', { before: 120 }));

  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('Teil B · Protokoll'));
  c.push(meta([['Projekt', '[ ]'], ['Datum, Ort', '[ ]'], ['Protokoll', '[Name]'], ['Verteiler', '[alle Teilnehmenden, Auftraggeber]']]));
  c.push(gap(120));
  c.push(table([2200, 3000, 3238, 1200], ['Disziplin', 'Name', 'Firma', 'anwesend'], [
    ['Architektur', '[ ]', '[ ]', '☐'], ['Tragwerksplanung', '[ ]', '[ ]', '☐'], ['HLS', '[ ]', '[ ]', '☐'], ['ELT', '[ ]', '[ ]', '☐'],
    ['Bauphysik', '[ ]', '[ ]', '☐'], ['Brandschutz', '[ ]', '[ ]', '☐'], ['[weitere]', '[ ]', '[ ]', '☐'],
  ]));
  const erg = (top, titel) => [H2(`TOP ${top}  ${titel}`), table([700, 5938, 1500, 1500], ['Nr', 'Festlegung · Ergebnis', 'wer', 'bis wann'], [[`${top}.1`, '[ ]', '[ ]', '[ ]'], [`${top}.2`, '[ ]', '[ ]', '[ ]']])];
  c.push(...erg(1, 'Projekt, Entwurf, Planungsziele'));
  c.push(...erg(2, 'Kostenvorgabe und Terminplan'));
  c.push(H2('TOP 3  Lieferumfang je Disziplin'));
  c.push(table([1500, 3069, 3069, 2000], ['Disziplin', 'Arbeitsstand 01 (M03)', 'Endstand (M07)', 'Termin bestätigt'], [
    ['TWP', '[Tragwerkslösung, Hauptabmessungen, Bauteildicken, Gründungskonzept]', '[überschlägige Bemessung, Mengen, Textbeitrag]', '[ ]'],
    ['HLS', '[Anlagenkonzept, Technikflächen, Schächte, Schemata]', '[Entwurf, Anlagenliste, Durchführungen und Lasten, Kosten 3. Ebene, Text]', '[ ]'],
    ['ELT', '[Konzept, Technikflächen, Trassen, Sicherheitsanlagen]', '[Entwurf, Anlagenliste, Kosten 3. Ebene, Text]', '[ ]'],
    ['BPH', '[Bauteilkatalog Arbeitsstand 01]', '[Bauteilkatalog Endstand, Kennwerte, Bericht]', '[ ]'],
    ['BRS', '[Brandschutzkonzept, Entwurf]', '[abgestimmtes Brandschutzkonzept]', '[ ]'],
    ['[weitere]', '[ ]', '[ ]', '[ ]'],
  ]));
  c.push(SMALL('Vorschläge in Klammern nach HOAI Anlage 14, 15 und Anlage 1 Nr. 1.2 – im Termin je Disziplin vereinbaren und ins Blatt «Eingang» der Koordinationsmappe übertragen.', { before: 60 }));
  c.push(H2('TOP 4  Kostenbeitrag je Disziplin'));
  c.push(table([1500, 2400, 1700, 1500, 1338, 1200], ['Disziplin', 'Kostengruppen', 'Gliederungstiefe', 'Preisstand', 'Format', 'Termin'], [
    ['TWP', '[Mengen für KG 300]', '[ ]', '[ ]', '[ ]', '[ ]'], ['HLS', '[KG 410–430]', '[3. Ebene]', '[ ]', '[XLSX]', '[ ]'],
    ['ELT', '[KG 440–480]', '[3. Ebene]', '[ ]', '[XLSX]', '[ ]'], ['FRA', '[KG 500]', '[ ]', '[ ]', '[ ]', '[ ]'], ['[weitere]', '[ ]', '[ ]', '[ ]', '[ ]', '[ ]'],
  ]));
  c.push(H2('TOP 5  Schnittstellenmatrix: Änderungen gegenüber v0'));
  c.push(table([3200, 4438, 2000], ['Thema', 'Entscheidung', 'zuständig (planend)'], [['[z. B. Aufzug und Förderanlagen]', '[ ]', '[ ]'], ['[ ]', '[ ]', '[ ]'], ['[ ]', '[ ]', '[ ]']]));
  c.push(SMALL('Mit diesen Änderungen gilt die Matrix als Version v1 (Blatt «Schnittstellen», Version auf v1 setzen).', { before: 60 }));
  c.push(H2('TOP 6  Rückfragen'));
  c.push(table([1500, 6138, 2000], ['Nr (Fragenliste)', 'Antwort oder Termin', 'wer'], [['[z. B. TWP-05]', '[ ]', '[ ]'], ['[ ]', '[ ]', '[ ]'], ['[ ]', '[ ]', '[ ]']]));
  c.push(H2('TOP 7  Austausch'));
  c.push(table([1928, 1928, 1928, 1927, 1927], ['Dateiformat', 'Nullpunkt (Lage)', 'Höhenbezug', 'Layer · Modell', 'Plattform'], [['[DWG, IFC, PDF]', '[ ]', '[±0,00 = … m ü. NHN]', '[ ]', '[ ]']]));
  c.push(...erg(8, 'Behördenabstimmungen'));
  c.push(H2('TOP 9  Koordinationsrhythmus und Kommunikationsweg'));
  c.push(meta([['Koordinationsrunden', '[Turnus, Tag, Dauer; Runde 01 nach M03, Runde 02 vor M07]'], ['Kommunikationsweg', '[E-Mail-Verteiler, Plattform, Ansprechpartner]'], ['Planstände', '[wer gibt neue Stände frei, wie werden sie angekündigt]']]));
  c.push(...erg(10, 'Verschiedenes, nächste Termine'));
  c.push(P('Einwände gegen dieses Protokoll bitte innerhalb von [5] Arbeitstagen in Textform. Danach gelten das Protokoll und die Schnittstellenliste v1 als abgestimmt.', { before: 200 }));
  c.push(P('Anlagen: Schnittstellenliste v1 · beantwortete Rückfragenliste · Terminplan LPH 3 (Stand [ ])'));
  c.push(H1('Nach dem Kick-off'));
  c.push(check('Protokoll mit Schnittstellenliste v1 an alle verteilt (L3.A1.ABS-08).'));
  c.push(check('Lieferumfang je Disziplin ins Blatt «Eingang» übertragen; Termine M03 und M07 im Terminplan bestätigt.'));
  c.push(check('Protokoll im Schreibtisch des Projekts abgelegt – die KI liest es und kann Fristen und offene Punkte daraus vorschlagen.'));
  c.push(...quellen(['HOAI-A10', 'HOAI-A14', 'HOAI-A15', 'HOAI-A1', 'ByAK-M13', 'ByAK-SSL', 'ByAK-M08', 'TBA-BIB']));
  return doc(c, 'Kick-off Fachplanung LPH 3');
}

// ════════════════════════════════════════════ 5 · Entscheidungsvorlage
function entscheidungsvorlage() {
  const c = [];
  c.push(...titleBlock('Entscheidungsvorlage', 'LPH 3 · Arbeitsstand 02 · Aufgaben L3.ENV.1 (Vorlage, M04) und L3.A3.ABS (Entscheidung, M05)'));
  c.push(...note([
    'Vor dem Versand prüfen und diesen Kasten löschen: Annahmen und gesicherte Fakten getrennt (L3.A3.AUS-01) · Kostenaussagen intern plausibilisiert (-02) · Terminplan und Entscheidungsliste beigefügt (-03) · Freigabe durch die Büroleitung dokumentiert (-04).',
    'Entscheidungspunkte gesammelt vorlegen, nicht einzeln: Quelle sind Klärungsliste, Rückmeldeliste und Baurechts-Check (L3.ENV.1-01). Punkte ohne Bedeutung für den Auftraggeber bleiben draußen.',
  ]));
  c.push(meta([
    ['Projekt', '[ ]'], ['Auftraggeber', '[ ]'], ['Vorlage Nr.', '[ ]'], ['Datum', '[TT.MM.JJJJ]'], ['Verfasser', '[Projektleitung]'],
    ['Freigabe Büroleitung', '[Name, Datum]'], ['Entscheidungsbesprechung (M05)', '[Termin]'],
  ]));
  c.push(H1('Übersicht'));
  c.push(table([600, 3200, 2238, 1500, 2100], ['Nr', 'Entscheidungspunkt', 'Empfehlung', 'Entscheidung bis', 'wenn später'], [
    ['1', '[ ]', '[ ]', '[TT.MM.JJJJ]', '[welche Lieferung wartet]'], ['2', '[ ]', '[ ]', '[ ]', '[ ]'], ['3', '[ ]', '[ ]', '[ ]', '[ ]'],
  ]));

  const block = (nr, ex) => {
    const v = (a, b) => (ex ? a : b);
    const out = [];
    out.push(H1(`${nr}  ${v('Schallschutzniveau der Trenndecken und Trennwände', '[Entscheidungspunkt]')}`));
    out.push(meta([['Herkunft', v('Fragenliste BPH-12; Klärungsliste Nr. 7', '[Klärungsliste Nr. … / Rückmeldeliste / Baurechts-Check]')], ['Frage an den Auftraggeber', v('Welches Schallschutzniveau soll für Trenndecken und Trennwände vereinbart werden?', '[in einem Satz]')]]));
    out.push(H2('Sachverhalt'));
    out.push(P(v('Die Bauphysik bemisst Decken und Wände nach dem vereinbarten Niveau. Vereinbart ist bisher nichts; die Mindestanforderungen der DIN 4109-1 sind nicht automatisch der Standard, den die Nutzer erwarten.', '[zwei bis vier Sätze, ohne Vorgeschichte; Skizze oder Planausschnitt einfügen (L3.ENV.1-02)]')));
    out.push(table([4819, 4819], ['Gesichert', 'Angenommen (zu bestätigen)'], [[v('Nutzung Wohnen, Trenndecken zwischen Wohnungen; Deckenstärke lt. Tragwerk 22 cm', '[ ]'), v('Estrich- und Bodenaufbau nach Aufbauvorgaben; Kostenkennwerte lt. Bauphysik', '[ ]')]]));
    out.push(H2('Optionen'));
    out.push(table([800, 2638, 1700, 1100, 2000, 1400], ['', 'Beschreibung', 'Kosten', 'Termine', 'Qualität · Gestaltung', 'Genehmigung'], [
      ['A', v('Mindestanforderungen DIN 4109-1', '[ ]'), v('keine Mehrkosten', '[ ]'), v('keine', '[ ]'), v('hörbare Nachbargeräusche möglich', '[ ]'), v('keine Folge', '[ ]')],
      ['B', v('Erhöhter Schallschutz nach Vereinbarung (z. B. VDI 4100)', '[ ]'), v('Decke + 2 cm, höherer Estrichaufbau; Mehrkosten KG 350 lt. Bauphysik', '[ ]'), v('keine', '[ ]'), v('deutlich ruhiger; Geschosshöhe + 3 cm', '[ ]'), v('keine Folge', '[ ]')],
      ['C', '[ ]', '[ ]', '[ ]', '[ ]', '[ ]'],
    ]));
    out.push(SMALL('Kostenfolge in der vertraglich vereinbarten Tiefe. Eine vertiefte Kostenuntersuchung von Varianten ist Besondere Leistung der LPH 3 (HOAI Anlage 10; L3.ENV.1-03).', { before: 60 }));
    out.push(H2('Empfehlung des Büros'));
    out.push(P(v('Option B, weil die Nutzung ruhebedürftig ist und die Mehrkosten im Verhältnis gering sind.', '[Option und Begründung – oder ausdrücklich keine, wenn die Abwägung beim Auftraggeber liegt (L3.ENV.1-05)]')));
    out.push(H2('Was danach festliegt'));
    out.push(P(v('Deckenstärke, Bodenaufbauten, Geschosshöhe, Türen; der Bauteilkatalog der Bauphysik (Endstand) baut darauf auf.', '[welche Planungen und Lieferungen auf der Entscheidung aufbauen; was ein späterer Wechsel kostet]')));
    out.push(H2('Entscheidung erbeten bis'));
    out.push(P(v('[TT.MM.JJJJ] – danach wartet der Bauteilkatalog der Bauphysik; der Endstand (M07) verschiebt sich um die Zeit der Verzögerung.', '[Datum] – [ab wann welche Lieferung wartet; Terminfolge einer späteren Entscheidung (L3.ENV.1-06)]')));
    out.push(H2('Entscheidung (in der Besprechung M05 auszufüllen)'));
    out.push(meta([
      ['Entscheidung', v('[gewählte Option, ggf. Bedingungen]', '[gewählte Option, ggf. Bedingungen]')], ['Datum · Entscheider', '[TT.MM.JJJJ · Name, Rolle]'],
      ['Kosten- und Terminfolge', '[ ]'], ['Falls nicht entschieden', '[neue Frist] · Annahme für die Weiterplanung: [ ]'],
      ['In Textform bestätigt am', '[TT.MM.JJJJ] (L3.A3.ABS-04)'], ['Weitergegeben an', '☐ Planung  ☐ Fachplaner  ☐ Bemusterung  ☐ Entscheidungsliste (L3.A3.ABS-05)'],
    ]));
    return out;
  };
  c.push(...block(1, false));
  c.push(SMALL('Weitere Entscheidungspunkte: Abschnitt 1 kopieren und fortlaufend nummerieren.', { before: 120 }));
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(new Paragraph({ children: [new TextRun({ text: 'Ausfüllbeispiel – nicht versenden', bold: true, color: GREY, size: 20, allCaps: true })], spacing: { after: 60 } }));
  c.push(SMALL('Zeigt, wie ein ausgefüllter Punkt aussieht. Zahlen und Annahmen sind erfunden.'));
  c.push(...block('B', true));
  c.push(...quellen(['HOAI-A10', 'ByAK-M08', 'TBA-BIB']));
  return doc(c, 'Entscheidungsvorlage LPH 3');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await save(projektstartvermerk(), 'LPH3_1_Projektstartvermerk.docx');
  await save(kickoff(), 'LPH3_4_Kickoff_Fachplanung.docx');
  await save(entscheidungsvorlage(), 'LPH3_5_Entscheidungsvorlage.docx');
})().catch((e) => { console.error(e); process.exit(1); });
