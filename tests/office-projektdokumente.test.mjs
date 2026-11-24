// Projektstart · Dokumente des Projekts (24.11.2026): Klärungsliste, Entscheidungsliste, Entscheidungsvorlage.
// Geprüft wird ohne Netz: die Spalten und Auswahllisten sind die der Bürovorlage (scripts/muster-lph3/build_xlsx.py);
// Datumseingabe, «überfällig», Zählen und Filtern; das Zusammenführen bei gleichzeitiger Bearbeitung; Klärung →
// Aufgabe und Entscheidung; Mehrkosten mit USt; der Aufbau der Vorlage; Romy schlägt nie eine Entscheidung vor;
// Excel und Word lassen sich lesen; Migration mit RLS für jede Tabelle; keine Projektdaten im öffentlichen Repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const K=require('../projektdokumente-kern.js'),X=require('../projektdokumente-export.js'),I=require('../kosten-import.js');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const HEUTE='2026-11-24';
const zeile=(id,nr,daten)=>({id,nr,daten});

test('Spalten und Auswahllisten sind die der Bürovorlage',()=>{
  const py=read('scripts/muster-lph3/build_xlsx.py');
  const koepfe=marke=>{
    const block=py.slice(py.indexOf(marke));
    const m=/heads = \[([\s\S]*?)\]\n\s*header\(ws, 6, heads, \[([^\]]*)\]/.exec(block);
    return {koepfe:JSON.parse('['+m[1]+']'),breiten:JSON.parse('['+m[2]+']')};
  };
  const kla=koepfe('# ───────── Klärungsliste'),ent=koepfe('# ───────── Entscheidungen');
  assert.deepEqual(K.SPALTEN.klaerungsliste.map(s=>s.kopf),kla.koepfe);
  assert.deepEqual(K.SPALTEN.klaerungsliste.map(s=>s.breite),kla.breiten);
  assert.deepEqual(K.SPALTEN.entscheidungsliste.map(s=>s.kopf),ent.koepfe);
  assert.deepEqual(K.SPALTEN.entscheidungsliste.map(s=>s.breite),ent.breiten);
  const liste=name=>JSON.parse(new RegExp('"'+name+'": (\\[[^\\]]*\\])').exec(py)[1]);
  assert.deepEqual(K.STATUS_KLAERUNG,liste('Status Klärung'));
  assert.deepEqual(K.STATUS_ENTSCHEIDUNG,liste('Status Entscheidung'));
  assert.deepEqual(K.DISZIPLINEN.map(d=>d[0]),liste('Disziplin'));
  assert.deepEqual(K.RUNDEN,liste('Runde'));
  // Kompakt wie im Entwurf: 8 Spalten in der Klärungsliste.
  assert.equal(K.SPALTEN.klaerungsliste.filter(s=>s.kompakt).length,8);
});

test('Datum eintippen wie im Büro: mit und ohne Jahr',()=>{
  assert.equal(K.leseDatum('05.12.',HEUTE),'2026-12-05');
  assert.equal(K.leseDatum('5.12',HEUTE),'2026-12-05');
  assert.equal(K.leseDatum('15.01.',HEUTE),'2027-01-15','eine Frist im Januar liegt im nächsten Jahr');
  assert.equal(K.leseDatum('20.06.',HEUTE),'2026-06-20','ein Datum im Juni liegt näher im laufenden Jahr');
  assert.equal(K.leseDatum('5.12.26',HEUTE),'2026-12-05');
  assert.equal(K.leseDatum('2026-12-05',HEUTE),'2026-12-05');
  assert.equal(K.leseDatum('',HEUTE),'');
  assert.equal(K.leseDatum('31.02.2026',HEUTE),null);
  assert.equal(K.leseDatum('morgen',HEUTE),null);
  assert.equal(K.datumKurz('2026-12-05',HEUTE),'05.12.');
  assert.equal(K.datumKurz('2027-01-15',HEUTE),'15.01.2027');
  assert.equal(K.excelTag('2026-12-05'),46361);
});

test('überfällig, Zählen und Filtern',()=>{
  const k=[zeile('a',1,{status:'offen',frist:'2026-11-20',disziplinen:['TWP','HLS'],verantwortlich:'TWP',sachverhalt:'Unterzug kreuzt Trasse'}),
    zeile('b',2,{status:'gelöst',frist:'2026-11-01',disziplinen:['BPH'],verantwortlich:'ARCH'}),
    zeile('c',3,{status:'in Klärung',frist:'2026-12-05',ag:'ja',disziplinen:['HLS'],verantwortlich:'HLS'}),
    zeile('d',4,{status:'Entscheidungspunkt',disziplinen:[],verantwortlich:''})];
  assert.equal(K.ueberfaellig('klaerungsliste',k[0].daten,HEUTE),true);
  assert.equal(K.ueberfaellig('klaerungsliste',k[1].daten,HEUTE),false,'gelöst ist nie überfällig');
  assert.equal(K.ueberfaellig('klaerungsliste',k[3].daten,HEUTE),false,'ohne Frist nie überfällig');
  const z=K.zaehle('klaerungsliste',k,HEUTE);
  assert.equal(K.zusammenfassung('klaerungsliste',z),'4 Punkte · 1 offen · 1 in Klärung · 1 überfällig · 2 Entscheidungspunkte');
  assert.deepEqual(K.zaehleFilter('klaerungsliste',k,HEUTE),{alle:4,offen:1,'in Klärung':1,ueberfaellig:1,entscheidungspunkte:2,geloest:1});
  assert.deepEqual(K.filtere('klaerungsliste',k,{disziplin:'HLS',heute:HEUTE}).map(x=>x.id),['a','c']);
  assert.deepEqual(K.filtere('klaerungsliste',k,{disziplin:'ARCH',heute:HEUTE}).map(x=>x.id),['b'],'auch wer verantwortlich ist');
  assert.deepEqual(K.filtere('klaerungsliste',k,{suche:'unterzug',heute:HEUTE}).map(x=>x.id),['a']);
  const e=[zeile('e',1,{status:'vorgelegt',bis:'2026-11-20'}),zeile('f',2,{status:'entschieden',bis:'2026-11-01',entschieden_am:'2026-11-12',entscheider:'AG',entscheidung:'B'}),
    zeile('g',3,{status:'vorbereitet',bis:'2027-01-15'})];
  assert.equal(K.zusammenfassung('entscheidungsliste',K.zaehle('entscheidungsliste',e,HEUTE)),
    '3 Entscheidungen · 1 vorbereitet · 1 vorgelegt · 1 entschieden · 1 überfällig · 1 ohne Bestätigung in Textform');
  assert.equal(K.nummer('entscheidungsliste',3),'E-03');
  assert.equal(K.nummer('entscheidungsvorlagen',2),'02');
});

test('gleichzeitige Bearbeitung: eigene Felder gelten, fremde bleiben',()=>{
  const basis={ort:'A',frist:'2026-12-01',status:'offen'};
  const lokal={...basis,frist:'2026-12-05'};
  const server={...basis,ort:'Achse C',server:'x'};
  let m=K.zusammenfuehren(basis,lokal,server);
  assert.deepEqual(m.daten,{ort:'Achse C',frist:'2026-12-05',status:'offen',server:'x'});
  assert.deepEqual(m.kollisionen,[]);
  m=K.zusammenfuehren(basis,{...basis,status:'gelöst'},{...basis,status:'in Klärung'});
  assert.equal(m.daten.status,'gelöst');
  assert.deepEqual(m.kollisionen,['status']);
  const ohne={...basis};delete ohne.frist;
  assert.equal('frist' in K.zusammenfuehren(basis,ohne,basis).daten,false,'hier entfernte Felder bleiben entfernt');
  assert.deepEqual(K.geaenderteFelder(basis,lokal),['frist']);
});

test('Klärung → Aufgabe im Planner und Entscheidung',()=>{
  const k=zeile('k9',9,{sachverhalt:'Platzbedarf Wärmepumpe und Speicher größer als im Raumprogramm',ort:'UG, Technikraum',plan:'GR UG',
    loesung:'Technikraum um eine Achse erweitern',verantwortlich:'HLS',frist:'2026-11-21',status:'offen',ag:'ja',protokoll:'Koordination 02',folgen:'Fläche'});
  const e=K.entscheidungAusKlaerung(k);
  assert.equal(e.herkunft,'Klärungsliste Nr 9');
  assert.deepEqual(e.herkunft_ref,{art:'klaerungsliste',zeile_id:'k9',nr:9});
  assert.equal(e.thema,'Platzbedarf Wärmepumpe und Speicher größer als im Raumprogramm');
  assert.equal(e.anlass,'Platzbedarf Wärmepumpe und Speicher größer als im Raumprogramm\nOrt: UG, Technikraum\nPlan: GR UG');
  assert.deepEqual(e.optionen,[{id:'A',text:'Technikraum um eine Achse erweitern'},{id:'B',text:''}]);
  assert.equal(e.bis,'2026-11-21');
  assert.equal(e.status,'vorbereitet');
  assert.ok(K.vorschlagErlaubt(e),'eine vorbereitete Entscheidung enthält keine Entscheidung');
  assert.deepEqual(K.wartendeEntscheidungspunkte([k],[]).map(z=>z.id),['k9']);
  assert.deepEqual(K.wartendeEntscheidungspunkte([k],[zeile('e1',1,e)]),[],'übernommen wartet nicht mehr');
  assert.deepEqual(K.wartendeEntscheidungspunkte([zeile('k9',9,{...k.daten,status:'entfällt'})],[]),[]);
  const t=K.aufgabeAusKlaerung(k,{dokumentId:'d1',projektId:'p1'});
  assert.equal(t.title,'Klärung Nr 9 · HLS: Platzbedarf Wärmepumpe und Speicher größer als im Raumprogramm');
  assert.equal(t.due_date,'2026-11-21');
  assert.equal(t.project_id,'p1');
  assert.deepEqual(t.metadata,{source:'klaerungsliste',dokument_id:'d1',zeile_id:'k9',nr:9});
  assert.match(t.notes,/^Aus der Klärungsliste, Nr 9\.\nOrt: UG, Technikraum\n/);
  const lang=K.aufgabeAusKlaerung(zeile('x',1,{sachverhalt:'Wort '.repeat(80)}),{dokumentId:'d',projektId:'p'});
  assert.ok(lang.title.length<=200&&lang.title.endsWith('…'));
  assert.equal(lang.due_date,null);
});

test('«entschieden» und Romy: Prüfung wie in der Datenbank',()=>{
  assert.match(K.pruefe('entscheidungsliste',{status:'entschieden',entschieden_am:'2026-11-12'}),/braucht Entscheider und Entscheidung/);
  assert.equal(K.pruefe('entscheidungsliste',{status:'entschieden',entschieden_am:'2026-11-12',entscheider:'AG',entscheidung:'B'}),'');
  assert.equal(K.pruefe('klaerungsliste',{status:'gelöst'}),'');
  assert.equal(K.vorschlagErlaubt({status:'entschieden'}),false);
  assert.equal(K.vorschlagErlaubt({entscheider:'AG'}),false);
  assert.equal(K.vorschlagErlaubt({bestaetigt_am:''}),false);
  assert.deepEqual(K.ohneEntscheidung({status:'entschieden',entscheidung:'B',frage:'F'}),{frage:'F'});
  // Dieselben Felder prüft die Migration.
  const sql=read('supabase/migrations/20261124065338_office_projektdokumente_v1.sql');
  assert.ok(sql.includes("not (daten ?| array['"+K.NUR_VON_HAND.join("','")+"'])"));
});

test('Mehrkosten mit Umsatzsteuer, Kennwert × Menge',()=>{
  const d={empfehlung:'A',optionen:[{id:'A',text:'Parkett',kennwert:'214,52 €/m²',menge:'210 m²'},{id:'B',text:'Naturstein',betrag:'50.053,50'},{id:'C',text:'ohne Preis'}]};
  assert.deepEqual(K.betragVon(d.optionen[0]),{cent:4504920n,berechnet:true});
  assert.deepEqual(K.betragVon(d.optionen[1]),{cent:5005350n,berechnet:false});
  const m=K.mehrkosten(d);
  assert.deepEqual(m,[{id:'B',gegenueber:'A',netto:500430n,brutto:595512n}]);
  assert.equal(K.euro(m[0].netto),'5.004,30 €');
  assert.equal(K.euro(m[0].brutto),'5.955,12 €');
  // Ohne Empfehlung: gegenüber der günstigsten. Empfohlen die teurere: die andere ist Minderkosten.
  assert.equal(K.mehrkosten({...d,empfehlung:''})[0].gegenueber,'A');
  assert.equal(K.mehrkosten({...d,empfehlung:'B'})[0].netto,-500430n);
  assert.equal(K.optionenText(d),'A: Parkett · B: Naturstein · C: ohne Preis');
  assert.equal(K.folgenText({optionen:[{id:'A',kosten:'keine',termine:''},{id:'B',kosten:'+ 2 cm',genehmigung:'keine'}]}),'A: Kosten: keine · B: Kosten: + 2 cm; Genehmigung: keine');
  assert.equal(K.naechsteOptionId(d.optionen),'D');
});

test('Entscheidungsvorlage im Aufbau der Bürovorlage',()=>{
  const e1=zeile('e1',1,{thema:'Bodenbelag Wohnräume',herkunft:'Bemusterung',anlass:'Vor dem Abschluss der Bemusterung.',frage:'Parkett oder Naturstein?',
    optionen:[{id:'A',text:'Parkett Eiche, geölt',kennwert:'214,52',menge:'210',quelle:'Datenpool'},{id:'B',text:'Naturstein',betrag:'50.053,50',termine:'Lieferzeit erfragen'}],
    empfehlung:'A',begruendung:'Günstiger und passend zur übrigen Bemusterung.',festliegt:'Aufbauhöhe, Sockelleisten',bis:'2027-01-15',status:'vorbereitet',kostenbezug:'Kostenstand 4. Quartal 2026'});
  const e2=zeile('e2',2,{thema:'Fenster',status:'entschieden',entschieden_am:'2026-11-12',entscheider:'Auftraggeber',entscheidung:'B: Holz-Aluminium',optionen:[{id:'A',text:'Holz'},{id:'B',text:'Holz-Aluminium'}]});
  const v=zeile('v1',2,{punkte:['e1'],status:'Entwurf',besprechung:'M04'});
  const inh=K.vorlageInhalt(v,[e1,e2],{projekt:{number:'T-01',name:'Testhaus'},stand:HEUTE,namen:{verfasser:'Test'}});
  assert.equal(inh.nr,'02');
  assert.equal(inh.titel,'Bodenbelag Wohnräume');
  const b=K.vorlageBloecke(inh);
  const texte=b.map(x=>x.text||'').join('\n');
  assert.equal(b[0].text,'Entscheidungsvorlage 02 · Bodenbelag Wohnräume');
  assert.equal(b[1].text,'T-01 Testhaus · Vorlage zur Besprechung M04 · Stand 24.11.2026 · Entwurf');
  assert.deepEqual(b.filter(x=>x.typ==='h2').map(x=>x.text),['1 · Anlass','2 · Frage an den Auftraggeber','3 · Varianten und Kosten','4 · Folgen je Variante',
    '5 · Empfehlung des Büros','6 · Was danach festliegt','7 · Entscheidung des Auftraggebers']);
  assert.ok(!b.some(x=>x.text==='Übersicht'),'eine Entscheidung braucht keine Übersicht');
  assert.match(texte,/Mehrkosten B gegenüber A: 5\.004,30 € netto \(5\.955,12 € brutto\), Kostenstand 4\. Quartal 2026\./);
  assert.match(texte,/Das Büro empfiehlt Variante A \(Parkett Eiche, geölt\)\. Günstiger/);
  assert.match(texte,/Statt der Unterschrift genügt eine Bestätigung in Textform, zum Beispiel per E-Mail, bis 15\.01\.2027\./);
  assert.deepEqual(b.find(x=>x.typ==='auswahl').zeilen,['Variante A · Parkett Eiche, geölt','Variante B · Naturstein']);
  assert.deepEqual(b.find(x=>x.typ==='tabelle').zeilen[0],['A · Parkett Eiche, geölt','','214,52','210','45.049,20 € *']);
  // Zwei Entscheidungen: Übersicht; eine entschiedene zeigt die Entscheidung statt der Ankreuzfelder.
  const zwei=K.vorlageBloecke(K.vorlageInhalt(zeile('v2',3,{punkte:['e1','e2']}),[e1,e2],{projekt:{number:'T-01',name:'Testhaus'},stand:HEUTE}));
  assert.equal(zwei.find(x=>x.typ==='h1').text,'Übersicht');
  assert.deepEqual(zwei.find(x=>x.typ==='tabelle').zeilen.map(z=>z[0]),['E-01','E-02']);
  assert.ok(zwei.some(x=>x.text==='Entschieden am 12.11.2026 von Auftraggeber: B: Holz-Aluminium.'));
  assert.ok(zwei.some(x=>x.text==='Die Bestätigung in Textform steht noch aus.'));
  assert.ok(zwei.some(x=>x.text==='2.1 · Anlass'));
  // Leere Abschnitte sagen, was fehlt, statt leer zu bleiben.
  const leer=K.vorlageBloecke(K.vorlageInhalt(zeile('v3',4,{punkte:['e3']}),[zeile('e3',3,{thema:'T'})],{}));
  assert.ok(leer.some(x=>x.text==='[Anlass ergänzen]'));
  assert.ok(leer.some(x=>x.text==='[Varianten ergänzen]'));
});

test('Excel und Word lassen sich lesen',async()=>{
  assert.equal(X.crc32(new TextEncoder().encode('123456789')),0xCBF43926);
  assert.equal(X.spalte(0)+X.spalte(25)+X.spalte(26)+X.spalte(27),'AZAAAB');
  const k=[zeile('a',1,{runde:'01',erfasst_am:'2026-11-18',disziplinen:['TWP','HLS'],ort:'1. OG',sachverhalt:'Unterzug & Trasse <Flur>',verantwortlich:'TWP',frist:'2026-11-20',status:'offen',ag:'ja'}),
    zeile('b',2,{sachverhalt:'zweite',status:'gelöst',frist:'2026-11-01'})];
  const bytes=X.xlsx(X.listenBlatt(K,'klaerungsliste',k,{projekt:'T-01 · Testhaus',heute:HEUTE}),new Date('2026-11-24T08:00:00Z'));
  const blaetter=await I.leseXlsxBlaetter(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  assert.equal(blaetter[0].name,'Klärungsliste');
  const z=blaetter[0].zeilen;
  const kopf=z.find(r=>r.includes('Sachverhalt · Konflikt'));
  assert.deepEqual([...kopf],K.SPALTEN.klaerungsliste.map(s=>s.kopf));
  const erste=z[z.indexOf(kopf)+1];
  assert.equal(String(erste[0]),'1');
  assert.equal(erste[3],'TWP, HLS');
  assert.equal(erste[6],'Unterzug & Trasse <Flur>');
  assert.equal(erste[15],'überfällig');
  assert.equal(z[z.indexOf(kopf)+2][15],'','gelöst ist nicht überfällig');
  const docx=X.docx({titel:'Entscheidungsvorlage 02',bloecke:[{typ:'titel',text:'Entscheidungsvorlage 02'},{typ:'tabelle',kopf:['A','B'],breiten:[50,50],zeilen:[['1','2 & 3']]},
    {typ:'p',text:'Zeile eins\nZeile zwei'},{typ:'auswahl',zeilen:['Variante A']},{typ:'unterschrift',links:'Datum',rechts:'Unterschrift'}],fusszeile:'T-01'});
  const zip=await I.zipDateien(docx.buffer.slice(docx.byteOffset,docx.byteOffset+docx.byteLength));
  const doc=await zip.text('word/document.xml');
  assert.ok(doc.includes('<w:pStyle w:val="Title"/>'));
  assert.ok(doc.includes('2 &amp; 3'));
  assert.ok(doc.includes('<w:br/>'),'Zeilenumbrüche bleiben');
  assert.ok(doc.includes('☐  Variante A'));
  assert.match(await zip.text('word/footer1.xml'),/PAGE[\s\S]*NUMPAGES/);
  assert.ok((await zip.text('[Content_Types].xml')).includes('wordprocessingml.footer+xml'));
  assert.ok((await zip.text('word/styles.xml')).includes('<w:sz w:val="22"/>'),'Fließtext 11 pt');
});

test('Migration: neue Tabellen mit RLS, nichts Destruktives, Verlauf nur durch den Trigger',()=>{
  const sql=read('supabase/migrations/20261124065338_office_projektdokumente_v1.sql');
  const tabellen=[...sql.matchAll(/create table public\.(\w+)/g)].map(m=>m[1]);
  assert.deepEqual(tabellen,['office_projektdokumente','office_projektdokument_zeilen','office_projektdokument_vorschlaege',
    'office_projektdokument_aenderungen','office_projektdokument_staende','office_projektdokument_ai_requests']);
  for(const t of tabellen)assert.ok(sql.includes('alter table public.'+t+' enable row level security;'),'RLS fehlt: '+t);
  // Außerhalb der Funktionen (die Verlaufseinträge zusammenfassen) keine Anweisung, die Daten oder Objekte entfernt.
  assert.ok(!/\b(drop|truncate|delete from)\b/i.test(sql.replace(/\$\$[\s\S]*?\$\$/g,'').replace(/on delete (cascade|restrict|set null)/g,'')),'nichts Destruktives');
  assert.ok(sql.includes('grant select on public.office_projektdokument_aenderungen to authenticated;'),'den Verlauf schreibt niemand von außen');
  assert.ok(sql.includes('grant update (status) on public.office_projektdokument_vorschlaege to authenticated;'));
  assert.ok(!/grant[^;]*delete[^;]*office_projektdokument_staende/.test(sql),'Stände bleiben');
  assert.ok(!/grant[^;]*delete[^;]*office_projektdokumente\b/.test(sql),'Dokumente werden nicht gelöscht');
  assert.match(sql,/raise exception 'Romy trägt keine Entscheidung ein'/);
  assert.match(sql,/raise exception 'Eine Entscheidung braucht Datum, Entscheider und Entscheidung'/);
  const ci=read('.github/workflows/verify.yml'),browser=read('.github/workflows/verify-romy-browser.yml');
  assert.ok(ci.includes('tests/sql/office-projektdokumente-rls-acceptance.sql'));
  assert.ok(browser.includes('tests/browser/office-projektdokumente.chromium.mjs'));
});

test('Seite, Versionen und öffentliches Repository',()=>{
  const html=read('projektdokumente.html');
  for(const f of ['projektdokumente.css?v=','projektdokumente-kern.js?v=','projektdokumente-export.js?v=','projektdokumente.js?v='])assert.ok(html.includes(f),'fehlt: '+f);
  const TITEL=/Tragende Außenwände|Nichttragende Außenwände|Außenwandöffnungen|Außenwandbekleidungen|Deckenkonstruktionen|Deckenbeläge|Deckenbekleidungen|Dachkonstruktionen|Dachbeläge|Dachbekleidungen|Baugrube|\bGründung\b|Herrichten und Erschließen|Elementierte Außenwandkonstruktionen/;
  const dateien=['projektdokumente.html','projektdokumente.js','projektdokumente-kern.js','projektdokumente-export.js','projektdokumente.css',
    'supabase/migrations/20261124065338_office_projektdokumente_v1.sql','tests/sql/office-projektdokumente-rls-acceptance.sql',
    'tests/browser/office-projektdokumente.chromium.mjs','tests/browser/fixtures/fake-supabase-dokumente.js'];
  for(const name of dateien){
    const txt=read(name);
    assert.ok(!TITEL.test(txt),'DIN-276-Titel in '+name+': '+(txt.match(TITEL)||[])[0]);
    assert.ok(!/Bernried|Schwarz/.test(txt),name+' nennt ein Projekt');
    const mails=(txt.match(/[\w.+-]+@[\w-]+\.[a-z.]{2,}/gi)||[]).filter(m=>!/\.invalid$/.test(m));
    assert.deepEqual(mails,[],'E-Mail-Adresse in '+name);
    const kommentare=(txt.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|--[^\n]*|<!--[\s\S]*?-->/g)||[]).join('\n');
    assert.ok(!/\b(para|que|como|desde|proyecto|archivo|tarea|también|costos|cálculo|guardar)\b/i.test(kommentare),'spanische Wörter in '+name);
  }
});
