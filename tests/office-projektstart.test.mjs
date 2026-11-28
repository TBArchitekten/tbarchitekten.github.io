// Projektstart · was ein Projekt braucht, und die Bürovorlagen LPH 3 (20./21.11.2026, Gari).
//
// Gari: «no preparar un documento, o a Romy, para que diga lo que necesita de información para
// avanzar» — und danach: «investigación exhaustiva, consultas fuentes en internet, te esfuerzas para
// hacer documentos editables … resuelves en vez de sugerir mejor no hacerlo».
// Das Blatt sagt, welche Information ein Projekt braucht, und führt zu fünf Bürovorlagen in Word und
// Excel. Sie sind aus der Aufgabenbibliothek LPH 3 abgeleitet und mit HOAI, BayBO und den Merkblättern
// der Bayerischen Architektenkammer belegt; erzeugt werden sie aus scripts/muster-lph3/.
//
// Geprüft wird: das Blatt ist erreichbar und bleibt Muster statt Projektdokument; jede Vorlage ist
// verlinkt und als Office-Datei vorhanden; jeder Bibliotheks-Code, auf den Blatt und Vorlagen
// verweisen, existiert wirklich; jede Fundstelle steht im Blatt; die Prüfpflicht-Logik folgt der BayBO.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync} from 'node:fs';
const url=p=>new URL('../'+p,import.meta.url);
const read=p=>readFileSync(url(p),'utf8');
const seite=read('projektstart.html'),shell=read('app/shell.js'),projekte=read('app/office-projects.js');
const xlsxSrc=read('scripts/muster-lph3/build_xlsx.py'),docxSrc=read('scripts/muster-lph3/build_docx.cjs');
const quellenJson=read('scripts/muster-lph3/quellen.json'),quellen=JSON.parse(quellenJson);
const bib=JSON.parse(read('app/data/muster-planner-lph3-v0.3.json'));
const VORLAGEN=['LPH3_1_Projektstartvermerk.docx','LPH3_2_Planliste.xlsx','LPH3_3_Koordination.xlsx',
  'LPH3_4_Kickoff_Fachplanung.docx','LPH3_5_Entscheidungsvorlage.docx'];

test('die Werkzeuge führen zum Projektstart',()=>{
  assert.match(shell,/id="officeToolsStart" aria-label="Projektstart öffnen"/);
  assert.match(shell,/<strong>Projektstart<\/strong><small>[^<]*fünf Bürovorlagen für die LPH 3/);
  // Seit 24.11.2026 öffnet die Karte die Dokumente des Projekts; das Muster bleibt dieses Blatt («Muster ansehen»).
  assert.match(projekte,/getElementById\('officeToolsStart'\)\?\.addEventListener\('click',\(\)=>\{\s*window\.location\.href='\.\.\/projektdokumente\.html';/);
  assert.match(seite,/<a href="\.\/projektdokumente\.html">Zu den Dokumenten eines Projekts<\/a>/);
  // und zurück: das Blatt liegt neben terminplan-hilfe.html, nicht in der App.
  assert.match(seite,/href="\.\/app\/#section=tools"/);
});

test('es ist ein Muster, kein Projektdokument',()=>{
  // Bernried darf höchstens als Beispiel vorkommen, nie als Inhalt des Blattes.
  const bernried=(seite.match(/Bernried/g)||[]).length;
  assert.ok(bernried<=2,'das Blatt ist auf Bernried geschrieben statt auf jedes Projekt ('+bernried+'×)');
  assert.match(seite,/Dies sind <strong>Muster<\/strong>, keine Projektdokumente/);
  assert.match(seite,/Sie sind ein Vorschlag und stehen zur Korrektur/);
  // Das Repository ist öffentlich: in den Quellen der Vorlagen keine Projekte und keine Adressen.
  for(const [name,src] of [['build_xlsx.py',xlsxSrc],['build_docx.cjs',docxSrc],['quellen.json',quellenJson]]){
    assert.ok(!/Bernried|Schwarz/.test(src),name+' nennt ein Projekt');
    assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(src),name+' enthält eine E-Mail-Adresse');
  }
});

test('die drei Stufen sagen, was sie freischalten',()=>{
  for(const stufe of ['Stufe 1 · Ohne das bleibt fast alles stehen',
    'Stufe 2 · Macht sie nützlich statt nur richtig','Stufe 3 · Macht sie vorausdenkend'])
    assert.ok(seite.includes(stufe),'fehlt: '+stufe);
  for(const was of ['Dokumente, irgendwelche','Die Beteiligten','Projektsteckbrief'])
    assert.ok(seite.includes(was),'fehlt in Stufe 1: '+was);
  // Jede Zeile sagt auch, wohin es im Office gehört — sonst ist die Liste nicht benutzbar.
  assert.ok((seite.match(/<th[^>]*>Wohin im Office<\/th>/g)||[]).length===3,'nicht jede Stufe sagt, wohin');
  assert.match(seite,/Was die KI nicht braucht und nicht bekommen soll/);
});

test('jede Vorlage ist verlinkt und als Office-Datei vorhanden',()=>{
  for(const f of VORLAGEN){
    assert.ok(seite.includes(`href="./muster/lph3/${f}" download`),'nicht verlinkt: '+f);
    const p='muster/lph3/'+f;
    assert.ok(existsSync(url(p)),'fehlt: '+p);
    assert.ok(statSync(url(p)).size>8000,'zu klein, kaum eine echte Vorlage: '+p);
    const kopf=readFileSync(url(p)).subarray(0,4);
    assert.deepEqual([...kopf],[0x50,0x4b,0x03,0x04],'keine Office-Datei (ZIP): '+p);
    assert.ok((f.endsWith('.xlsx')?xlsxSrc:docxSrc).includes(f),'kein Generator für '+f);
  }
});

test('jeder Code, auf den Blatt und Vorlagen verweisen, steht in der Bibliothek',()=>{
  const aufgaben=new Set(),pruefpunkte=new Set();
  for(const b of bib.buckets)for(const t of b.tasks){aufgaben.add(t.id);for(const c of t.checkCodes||[])pruefpunkte.add(c)}
  const fehlt=[];
  for(const [name,src] of [['projektstart.html',seite],['build_xlsx.py',xlsxSrc],['build_docx.cjs',docxSrc]]){
    for(const code of new Set(src.match(/L3\.[A-Z0-9]+\.[A-Z0-9]+(?:-\d{2})?/g)||[])){
      const ok=code.includes('-')?pruefpunkte.has(code):aufgaben.has(code);
      if(!ok)fehlt.push(name+': '+code);
    }
  }
  assert.deepEqual(fehlt,[],'Verweise ohne Gegenstück in der Aufgabenbibliothek');
  // Die Karten, für die die Vorlagen gebaut sind, kommen im Blatt vor.
  for(const k of ['L3.PSV.1','L3.PLI.1','L3.FPB.1','L3.SSM.1','L3.PGF.1','L3.A1.ABS','L3.KLA.1','L3.ENV.1','L3.A3.ABS'])
    assert.ok(seite.includes(k),'Karte fehlt im Blatt: '+k);
});

test('jede Fundstelle steht im Blatt',()=>{
  assert.ok(quellen.quellen.length>=15);
  for(const q of quellen.quellen)
    assert.ok(seite.includes(`href="${q.url.replace(/&/g,'&amp;')}"`),'Fundstelle fehlt im Blatt: '+q.id);
  assert.match(seite,/keine Rechtsberatung/);
});

test('die Fragenliste deckt jede Disziplin ab, jede Frage mit Grund und Fundstelle',()=>{
  const fragen=[...xlsxSrc.matchAll(/^\s+\("(ALLE|TWP|HLS|ELT|BPH|BRS|GEO|VER|FRA)", ([AF]), "[^"]+", "[^"]+", "([^"]+)", "([^"]+)", "M\d\dA?"\),$/gm)];
  const alle=(xlsxSrc.match(/^\s+\("(ALLE|TWP|HLS|ELT|BPH|BRS|GEO|VER|FRA)", [AF], /gm)||[]).length;
  assert.equal(fragen.length,alle,'eine Frage ohne Grund, Fundstelle oder gültigen Meilenstein');
  assert.ok(seite.includes(`${alle} vorbereitete Fragen`),'die Zahl im Blatt stimmt nicht ('+alle+')');
  const je={};for(const m of fragen)je[m[1]]=(je[m[1]]||0)+1;
  for(const d of ['TWP','HLS','ELT','BPH','BRS'])assert.ok(je[d]>=8,'zu wenig Fragen für '+d);
  for(const d of ['ALLE','GEO','VER','FRA'])assert.ok(je[d]>=4,'zu wenig Fragen für '+d);
  // In beide Richtungen: was wir fragen, und was die Fachplanung von uns braucht.
  for(const d of ['TWP','HLS','ELT','BPH','BRS'])
    assert.ok(fragen.some(m=>m[1]===d&&m[2]==='F'),d+': keine Angabe, die die Fachplanung von uns braucht');
});

test('die Prüfpflichten folgen der BayBO und sind im Blatt Projekt berechnet',()=>{
  // Standsicherheit (Art. 62a Abs. 2): GK 4 und 5 immer; Sonderbau Prüfung, sonst Bescheinigung;
  // GK 1–3 nach Kriterienkatalog; Wohngebäude GK 1–2 frei.
  assert.match(xlsxSrc,/IF\(AND\(C14="ja",C12<=2\)/);
  assert.match(xlsxSrc,/IF\(C12>=4,IF\(C13="ja","Prüfung durch Bauaufsichtsbehörde, Prüfingenieur oder Prüfamt/);
  assert.match(xlsxSrc,/Kriterienkatalog \(Anlage 2 BauVorlV\)/);
  // Brandschutz (Art. 62b Abs. 2): Sonderbau, Mittel- und Großgarage, GK 5.
  assert.match(xlsxSrc,/IF\(OR\(C13="ja",C15="ja",C12=5\)/);
  // Zuständigkeit: je Thema genau eine planende Stelle (G oder B), «?» heißt offen.
  assert.match(xlsxSrc,/"offen – im Kick-off klären"/);
  assert.match(xlsxSrc,/"mehrere planende Stellen – abgrenzen"/);
});

test('deutsch, und ohne spanische Reste',()=>{
  assert.match(seite,/<html lang="de">/);
  for(const [name,txt] of [['projektstart.html',seite.replace(/<code>[^<]*<\/code>/g,'')],['quellen.json',quellenJson]])
    assert.ok(!/\b(para|que|como|desde|proyecto|archivo|tarea|también)\b/i.test(txt),'spanische Wörter in '+name);
});
