// Mustermappe · Kern (24.11.2026): Positionen, Kandidaten aus der Bibliothek, Seitenvorlagen A3, Beleg statt Fundstelle,
// keine Unterschrift auf den Seiten (entschieden wird im Bemusterungstermin). Erfundene Daten.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';

const require=createRequire(import.meta.url);
const M=require('../mustermappe-kern.js');

const produkt=(id,extra={})=>({id,name:'Parkett Eiche geölt',hersteller:'Holz AG',serie:'Linie 1',beschreibung:'Massiv, 16 mm.',
  merkmale:[{feld:'Aufbau',wert:'massiv 16 mm',seite:4},{feld:'Brandverhalten',wert:'Cfl-s1',seite:5},{feld:'',wert:'leer'}],
  fehlend:['R-Gruppe'],status:'geprueft',updated_at:'2026-11-20T10:00:00.000Z',...extra});
function beispiel(){
  const v={id:'v1',nr:2,daten:M.neueMappe({themenpaket:'Bodenbeläge',termin:'2026-12-03',verfasser:'Test Leitung'})};
  const a=M.neuePosition({code:'B2',bezeichnung:'Holz – Eiche',strategie:'A',titel:v.daten.titel,vorlageId:'v1'});
  const oa=M.kandidat([],produkt('p1'),{produkt:'BO-01 · Parkett Eiche geölt · Holz AG'});
  Object.assign(oa,{kennwert:'189,69 €/m²',kennwert_quelle:'Kostenberechnung T-90 Altbau, Zeile 12',kennwert_beleg:'Angebot 2025, fortgeschrieben auf 2026-Q4'});
  const ob=M.kandidat([oa],produkt('p2',{name:'Stein <script>alert(1)</script>',merkmale:[]}));
  a.optionen=[oa,ob];a.empfehlung='A';a.frage='Welcher Belag für das Obergeschoss?';a.muster.zonen='Ausstellung 537 m²';a.muster.flaeche='630 m²';
  const b=M.neuePosition({code:'B3',bezeichnung:'Linoleum',strategie:'B'});
  const c=M.neuePosition({code:'B5',bezeichnung:'Feinsteinzeug'});
  const za={id:'e1',nr:4,daten:a},zb={id:'e2',nr:5,daten:b},zc={id:'e3',nr:6,daten:c};
  v.daten.punkte=['e1','e2','e3'];
  v.daten.seiten=[...v.daten.seiten,{id:'s3',typ:'vergleich',punkt:'e1'},{id:'s4',typ:'material',punkt:'e1',option:'A'},
    {id:'s5',typ:'frei',titel:'Bodenbelagsplan EG',bild:{pfad:'d/u/plan.jpg',name:'Plan'}},{id:'s6',typ:'vergleich',punkt:'weg'}];
  return {v,za,zb,zc};
}

test('Neue Mappe und Position: Themenpaket, Termin, Code und Thema wie in der Entscheidungsliste',()=>{
  const d=M.neueMappe({themenpaket:'Bäder',termin:'3.12.',verfasser:'X'});
  assert.equal(d.form,'mustermappe');assert.equal(d.titel,'Mustermappe Bäder');assert.equal(d.besprechung,'Bemusterung');
  assert.equal(d.besprechung_am,'','nur ISO-Daten');assert.deepEqual(d.seiten.map(x=>x.typ),['deckblatt','uebersicht']);
  assert.ok(M.istMappe({daten:d}));assert.ok(!M.istMappe({daten:{titel:'Vorlage'}}));
  const p=M.neuePosition({code:' B2 ',bezeichnung:'Holz – Eiche',strategie:'Z',titel:'Mustermappe Bäder',vorlageId:'v9'});
  assert.equal(p.thema,'B2 · Holz – Eiche');assert.equal(p.status,'vorbereitet');assert.equal(p.herkunft,'Mustermappe Bäder');
  assert.equal(p.vorlage_id,'v9');assert.equal(p.muster.strategie,'','unbekannte Strategie fällt weg');assert.deepEqual(p.optionen,[]);
  assert.deepEqual(Object.keys(p.muster).sort(),[...M.MUSTER_FELDER].sort());
});

test('Kandidat aus der Bibliothek: Auszug mit Stand, neuer Stand erst nach Übernehmen',()=>{
  const o=M.kandidat([{id:'A'}],produkt('p1'));
  assert.equal(o.id,'B');assert.equal(o.produkt_id,'p1');assert.deepEqual(o.muster_fotos,[]);
  assert.equal(o.muster_produkt.merkmale.length,2,'leere Merkmale fallen weg');assert.equal(o.muster_produkt.merkmale[0].seite,4);
  assert.deepEqual(o.muster_produkt.fehlend,['R-Gruppe']);assert.equal(o.muster_produkt.stand,'2026-11-20T10:00:00.000Z');
  assert.equal(M.veraltet(o,produkt('p1')),false);
  assert.equal(M.veraltet(o,produkt('p1',{updated_at:'2026-11-24T08:00:00.000Z'})),true);
  assert.equal(M.veraltet({id:'A'},produkt('p1')),false,'ohne Auszug kein Hinweis');
  const viele=M.produktAuszug(produkt('p1',{merkmale:Array.from({length:30},(_,i)=>({feld:'F'+i,wert:'x'.repeat(400)}))}));
  assert.equal(viele.merkmale.length,16);assert.equal(viele.merkmale[0].wert.length,240);
});

test('Fotos: angeklickt in Reihenfolge, höchstens drei, erneut geklickt wieder weg',()=>{
  let f=[];for(const i of [1,2,3,4])f=M.fotosUmschalten(f,{id:'d'+i,pfad:'u/p/'+i+'.jpg'});
  assert.deepEqual(f.map(x=>x.id),['d1','d2','d3']);
  f=M.fotosUmschalten(f,{id:'d2',pfad:'u/p/2.jpg'});assert.deepEqual(f.map(x=>x.id),['d1','d3']);
});

test('Seiten: ohne Liste die Standardfolge, Seiten entfernter Positionen fallen weg, verschieben',()=>{
  assert.deepEqual(M.seitenVon({punkte:['e1']}).map(x=>x.typ+':'+(x.punkt||'')),['deckblatt:','uebersicht:','vergleich:e1']);
  const {v}=beispiel();
  const l=M.seitenVon(v.daten);
  assert.deepEqual(l.map(x=>x.id),[v.daten.seiten[0].id,v.daten.seiten[1].id,'s3','s4','s5'],'Seite der entfernten Position weg');
  assert.deepEqual(M.seiteVerschieben(l,'s4',-1).map(x=>x.id).slice(2,4),['s4','s3']);
  assert.deepEqual(M.seiteVerschieben(l,l[0].id,-1).map(x=>x.id),l.map(x=>x.id),'nicht über den Anfang');
});

test('Inhalt und PDF: Beleg statt Fundstelle, maskiert, Termin im Fuß, keine Unterschrift',()=>{
  const {v,za,zb,zc}=beispiel();
  const inh=M.mappeInhalt(v,[za,zb,zc],{projekt:{number:'T-01',name:'Testhaus'},stand:'2026-11-24',nummer:n=>'E-'+String(n).padStart(2,'0')});
  assert.equal(inh.schema,M.SCHEMA);assert.equal(inh.punkte.length,3);assert.equal(inh.seiten.length,5);
  const html=M.mappeHtml(inh,{bild:(pfad,bucket)=>'https://bilder.invalid/'+bucket+'/'+pfad});
  assert.doesNotMatch(html,/T-90|Altbau|Zeile 12/,'keine Fundstelle mit anderen Projekten');
  assert.match(html,/Angebot 2025, fortgeschrieben/);
  assert.doesNotMatch(html,/<script>/);assert.match(html,/Stein &lt;script&gt;/);
  assert.doesNotMatch(html,/Unterschrift|unterschreiben/i,'entschieden wird im Termin');
  assert.match(html,/Vorlage zur Bemusterung am 03\.12\.2026/);assert.match(html,/Seite 5 von 5/);
  assert.match(html,/office-projektdokumente\/d\/u\/plan\.jpg/,'freie Seite aus dem Bucket der Mappe');
  assert.doesNotMatch(html,/<textarea/,'Druck ohne Eingabefelder');
  assert.match(html,/kein Foto/,'ohne Foto ein Platzhalter');
  const ueb=M.uebersichtGruppen(inh);
  assert.deepEqual(ueb.map(g=>g.titel),['Für beide Strategien','Strategie A','Strategie B']);
  assert.deepEqual(ueb.map(g=>g.punkte.map(p=>p.code)),[['B5'],['B2'],['B3']]);
});

test('Bearbeiten: Texte als Felder mit festen ids auf der Seite, Daten der Position im Kopf',()=>{
  const {v,za,zb,zc}=beispiel();
  const inh=M.mappeInhalt(v,[za,zb,zc],{projekt:{number:'T-01',name:'Testhaus'},stand:'2026-11-24'});
  const s3=M.seiteHtml(inh.seiten[2],inh,{nr:3,gesamt:5,modus:'bearbeiten'});
  assert.match(s3,/<textarea id="mm-e1-frage"[^>]*data-mmtext="frage" data-z="e1"/);
  assert.match(s3,/id="mm-e1-begruendung"/);assert.match(s3,/Ausstellung 537 m²<br>630 m²/);
  assert.match(s3,/A · Parkett Eiche geölt/);assert.match(s3,/Empfehlung/);
  const s4=M.seiteHtml(inh.seiten[3],inh,{nr:4,gesamt:5,modus:'bearbeiten'});
  assert.match(s4,/data-mmopt="e1\|A"/);assert.match(s4,/Massiv, 16 mm\./);assert.match(s4,/Variante A/);
  const s5=M.seiteHtml(inh.seiten[4],inh,{nr:5,gesamt:5,modus:'bearbeiten'});
  assert.match(s5,/data-mmseite="s5\|titel"/);
  const deck=M.seiteHtml(inh.seiten[0],inh,{modus:'bearbeiten'});
  assert.match(deck,/Bodenbeläge/);assert.match(deck,/T-01 · Testhaus/);assert.match(deck,/data-mmvorlage="deckblatt_text"/);
});

test('Nach dem Termin: die Seite zeigt die Entscheidung, die Übersicht die gewählte Variante',()=>{
  const {v,za,zb,zc}=beispiel();
  Object.assign(za.daten,{status:'entschieden',entscheidung:'A: Parkett Eiche geölt',entschieden_am:'2026-12-03',entscheider:'Bauherr'});
  const inh=M.mappeInhalt(v,[za,zb,zc],{projekt:{number:'T-01',name:'Testhaus'}});
  assert.equal(M.gewaehlt(inh.punkte[0]),'A · Parkett Eiche geölt');
  const html=M.mappeHtml(inh);
  assert.match(html,/Entschieden am 03\.12\.2026 von Bauherr: A · Parkett Eiche geölt/);
  assert.match(html,/entschieden: A · Parkett Eiche geölt/);
});

test('Fotos: ohne Wahl das erste der Bibliothek; Pfade für die Signatur getrennt nach Bucket',()=>{
  const {v,za,zb,zc}=beispiel();
  za.daten.optionen[1].muster_fotos=[{id:'d9',pfad:'u/p2/9.jpg'}];
  const inh=M.mitStandardFotos(M.mappeInhalt(v,[za,zb,zc]),id=>id==='p1'?[{id:'d1',pfad:'u/p1/1.jpg'},{id:'d2',pfad:'u/p1/2.jpg'}]:[]);
  assert.deepEqual(inh.punkte[0].optionen.map(o=>o.fotos.map(f=>f.pfad)),[['u/p1/1.jpg'],['u/p2/9.jpg']]);
  assert.deepEqual(M.allePfade(inh),{produkt:['u/p1/1.jpg','u/p2/9.jpg'],mappe:['d/u/plan.jpg']});
});

test('Bilder der Mappe: Pfad wie die Policy, nur Bilder bis 15 MB',()=>{
  assert.equal(M.dateiPfad('d1','u1','x','image/png'),'d1/u1/x.png');
  assert.equal(M.dateiPfad('d1','u1','x','application/pdf'),'');
  assert.equal(M.bildPruefen('image/jpeg',1000),'');
  assert.match(M.bildPruefen('application/pdf',1000),/Bild/);
  assert.match(M.bildPruefen('image/png',16*1024*1024),/15 MB/);
  const datei=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>/^\d{14}_office_projektdokumente_bilder\.sql$/.test(f));
  assert.equal(datei.length,1,'genau eine Migration für die Bilder');
  const sql=readFileSync(new URL('../supabase/migrations/'+datei[0],import.meta.url),'utf8');
  assert.match(sql,/'office-projektdokumente', 'office-projektdokumente', false, 15728640/);
  assert.match(sql,/split_part\(name, '\/', 2\) = \(select auth\.uid\(\)\)::text/);
  assert.doesNotMatch(sql,/\b(drop|delete from|truncate|alter table)\b/i,'nichts Bestehendes wird geändert');
});

test('Seite der Projektdokumente lädt den Kern vor der Seite, mit Version',()=>{
  const html=readFileSync(new URL('../projektdokumente.html',import.meta.url),'utf8');
  const kern=html.indexOf('mustermappe-kern.js?v='),seite=html.indexOf('projektdokumente.js?v=');
  assert.ok(kern>0&&kern<seite);
  const js=readFileSync(new URL('../projektdokumente.js',import.meta.url),'utf8');
  assert.match(js,/@page\{size:A3 landscape;margin:0\}/,'A3 quer nur für den Druck der Mappe');
  assert.match(js,/mappeStandZeigen/);assert.doesNotMatch(js,/Unterschrift Bauherr/);
});

test('Position ohne Kandidat: im Bearbeiten ein Hinweis, im PDF kein Text für das Büro',()=>{
  const {v,za,zb,zc}=beispiel();
  v.daten.seiten.push({id:'s7',typ:'vergleich',punkt:'e3'});
  zc.daten.muster.kosten='80–125 €/m²';
  const inh=M.mappeInhalt(v,[za,zb,zc]);
  const s7=inh.seiten.find(x=>x.id==='s7');
  assert.match(M.seiteHtml(s7,inh,{modus:'bearbeiten'}),/Noch kein Kandidat/);
  const druck=M.seiteHtml(s7,inh,{modus:'druck'});
  assert.doesNotMatch(druck,/Noch kein Kandidat|Bibliothek wählen/);
  assert.match(druck,/80–125 €\/m²/);
});
