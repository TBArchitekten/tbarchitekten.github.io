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
  // Seit 26.11.2026 ist der Name beim Bearbeiten ein Feld (für diese Mappe änderbar); im Druck bleibt «A · Name».
  assert.match(s3,/<span>A · <\/span><textarea id="mm-e1-A-name" class="mm-text mm-text-name" data-mmanp="e1\|A\|name"[^>]*>Parkett Eiche geölt<\/textarea>/);
  assert.match(s3,/Empfehlung/);
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

// Gari, 25.11.2026: Die Mustermappe ist ein eigenes Werkzeug (Tools › Mustermappe) und im Projekt ein Reiter in Work,
// nicht mehr eine Karte im Projektstart.
test('Werkzeug Mustermappe: Mappen je Projekt, nicht mehr im Projektstart; die Mappe führt zurück zu den Mappen',()=>{
  const js=readFileSync(new URL('../projektdokumente.js',import.meta.url),'utf8');
  assert.match(js,/ui\.werkzeug=p\.get\('werkzeug'\)==='mustermappe'\?'mustermappe':'';/);
  assert.match(js,/if\(ziel\)\{gehe\(\{werkzeug:ui\.werkzeug,projekt:ziel\.id\},\{ersetzen:true\}\);return\}/);
  assert.match(js,/else if\(ui\.werkzeug\)\{\n    ui\.ansicht='mappen';/);
  assert.match(js,/else if\(ui\.ansicht==='mappen'\)renderMappen\(\);/);
  assert.match(js,/function renderMappen\(\)\{/);
  assert.match(js,/titel:'Mustermappen',\n    intro:esc\(MAPPE_INTRO\),aktionen:projektwahl\+'<button type="button" class="btn btn-primary" data-act="mm-neu">Neue Mustermappe<\/button>'/);
  // Die Übersicht des Projektstarts hat keine Karte «Mustermappen» mehr.
  const uebersicht=js.slice(js.indexOf('function renderUebersicht(){'),js.indexOf('// ---------- Listen ----------'));
  assert.doesNotMatch(uebersicht,/Mustermappen|mm-neu|L3\.MAP\.1/);
  assert.match(js,/kopf\(\{zurueck:\[url\(\{werkzeug:'mustermappe',projekt:projekt\.id\}\),'‹ Mustermappen'\],\n    kicker:'Mustermappe · '\+projektName\(\),titel:inh\.titel,meta,aktionen\}\)/);
  // Ein anderes Projekt in der Liste der Mappen bleibt im Werkzeug.
  assert.match(js,/gehe\(\{werkzeug:ui\.ansicht==='mappen'\?ui\.werkzeug:'',projekt:el\.value\}\)/);
  // ?neu=1 öffnet einmal den Dialog; im Rahmen ohne Liste dahinter.
  assert.match(js,/if\(neu\)history\.replaceState\(null,'',url\(\{werkzeug:ui\.werkzeug,projekt:pid\}\)\);/);
  assert.match(js,/if\(neu&&IM_REITER\)zeichne\('<div class="pd-wrap"><p class="meta">Neue Mustermappe …<\/p><\/div>',null\);else render\(\);/);
  const html=readFileSync(new URL('../projektdokumente.html',import.meta.url),'utf8');
  assert.match(html,/projektdokumente\.css\?v=office9/);assert.match(html,/projektdokumente\.js\?v=office8/);
});

// Gari, 26.11.2026: Layouts nach dem Erzeugen bearbeiten. Texte aus der Bibliothek nur für diese Mappe ändern (markiert,
// mit «Zurücksetzen»), jedes Foto ersetzen (aus der Bibliothek oder eigenes Bild der Mappe) und zuschneiden; das
// Seitenraster bleibt fest.
test('Texte für diese Mappe: Name, Hersteller und Serie, Kennwerte, Beschreibung; gleich wie die Bibliothek = nicht geändert',()=>{
  const {za}=beispiel();
  const o=za.daten.optionen[0];
  let n=M.anpassen(o,'name','Eiche geölt, Landhausdiele');
  assert.equal(n.muster_name,'Eiche geölt, Landhausdiele');assert.equal(o.muster_name,undefined,'das Original bleibt');
  assert.equal(M.anpassen(n,'name','  Parkett Eiche geölt ').muster_name,undefined,'wieder wie die Bibliothek');
  assert.equal(M.anpassen(n,'name','').muster_name,undefined,'ohne Namen gilt die Bibliothek');
  n=M.anpassen(n,'herkunft','');assert.equal(n.muster_herkunft,'','Zeile bewusst leer');
  assert.equal(M.anpassen(n,'herkunft','Holz AG · Linie 1').muster_herkunft,undefined);
  n=M.anpassen(n,'kennwerte','Aufbau: massiv 16 mm\n\nRutschhemmung: R10\nnur ein Satz ohne Feld');
  assert.deepEqual(n.muster_merkmale,[{feld:'Aufbau',wert:'massiv 16 mm'},{feld:'Rutschhemmung',wert:'R10'},{feld:'',wert:'nur ein Satz ohne Feld'}]);
  assert.equal(M.anpassen(n,'kennwerte','Aufbau: massiv 16 mm\nBrandverhalten: Cfl-s1').muster_merkmale,undefined,'wie die Bibliothek');
  assert.equal(M.merkmaleText(o.muster_produkt.merkmale),'Aufbau: massiv 16 mm\nBrandverhalten: Cfl-s1');
  assert.equal(M.merkmaleAusText(Array.from({length:30},(_,i)=>'F'+i+': x').join('\n')).length,16);
  n=M.anpassen(n,'beschreibung','Muster liegt im Büro.');assert.equal(n.muster_text,'Muster liegt im Büro.');
  assert.deepEqual(M.geaenderteTexte(n).map(x=>x.feld),['name','herkunft','kennwerte','beschreibung']);
  assert.deepEqual(M.geaenderteTexte(M.zuruecksetzen(n,'kennwerte')).map(x=>x.name),['Name','Hersteller und Serie','Beschreibung']);
  assert.deepEqual(M.geaenderteTexte(o),[]);
  // Unter einer Seite nur, was die Seite zeigt, in ihrer Reihenfolge: der Vergleich zeigt keine Beschreibung.
  assert.deepEqual(M.anpassbarAuf({typ:'vergleich'}),['name','herkunft','kennwerte']);
  assert.deepEqual(M.anpassbarAuf({typ:'material'}),['name','herkunft','beschreibung','kennwerte']);
  assert.deepEqual(M.anpassbarAuf({typ:'material',zeige:{kennwerte:false}}),['name','herkunft','beschreibung']);
  assert.deepEqual(M.anpassbarAuf({typ:'frei'}),[]);
  assert.deepEqual(M.geaenderteTexte(n,M.anpassbarAuf({typ:'vergleich'})).map(x=>x.feld),['name','herkunft','kennwerte']);
  assert.deepEqual(M.geaenderteTexte(n,M.anpassbarAuf({typ:'material'})).map(x=>x.feld),['name','herkunft','beschreibung','kennwerte']);
});

test('Geänderte Texte stehen auf der Seite und im PDF; beim Bearbeiten durchgezogen umrandet, die Bibliothek bleibt',()=>{
  const {v,za,zb,zc}=beispiel();
  let o=za.daten.optionen[0];
  o=M.anpassen(o,'name','Eiche <b>Landhausdiele</b>');o=M.anpassen(o,'herkunft','Holz AG');o=M.anpassen(o,'kennwerte','Aufbau: 21 mm\nOberfläche: geölt\nC: 3\nD: 4\nE: 5\nF: 6');
  za.daten.optionen[0]=o;
  const inh=M.mappeInhalt(v,[za,zb,zc]);
  const a=inh.punkte[0].optionen[0];
  assert.equal(a.name,'Eiche <b>Landhausdiele</b>');assert.equal(a.herkunft,'Holz AG');assert.deepEqual(a.geaendert,{name:true,herkunft:true,kennwerte:true,beschreibung:false});
  assert.equal(o.muster_produkt.name,'Parkett Eiche geölt','der Auszug der Bibliothek bleibt');
  const druck=M.seiteHtml(inh.seiten[2],inh,{modus:'druck'});
  assert.match(druck,/<h3>A · Eiche &lt;b&gt;Landhausdiele&lt;\/b&gt;<\/h3>/,'maskiert');assert.match(druck,/<p class="mm-klein">Holz AG<\/p>/);
  assert.match(druck,/<th scope="row">Oberfläche<\/th><td>geölt<\/td>/);assert.doesNotMatch(druck,/<th scope="row">F<\/th>/,'Vergleich: fünf Zeilen');
  assert.doesNotMatch(druck,/<textarea|mm-geaendert|mm-bild-knopf/,'im Druck keine Felder und Knöpfe');
  const bearb=M.seiteHtml(inh.seiten[2],inh,{modus:'bearbeiten'});
  assert.match(bearb,/class="mm-text mm-text-name mm-geaendert" data-mmanp="e1\|A\|name"[^>]*title="In dieser Mappe geändert"/);
  assert.match(bearb,/data-mmanp="e1\|A\|kennwerte"[^>]*>Aufbau: 21 mm\nOberfläche: geölt/);
  assert.match(bearb,/Auf dieser Seite stehen die ersten 5 Zeilen\./);
  assert.match(bearb,/class="mm-text mm-text-klein" data-mmanp="e2|e1\|B\|herkunft"|data-mmanp="e1\|B\|herkunft"/,'B: wie die Bibliothek, gestrichelt');
  assert.doesNotMatch(bearb.match(/<textarea[^>]*data-mmanp="e1\|B\|name"[^>]*>/)[0],/mm-geaendert/);
  const mat=M.seiteHtml(inh.seiten[3],inh,{modus:'druck'});
  assert.match(mat,/<h3 class="mm-material-name">Eiche &lt;b&gt;Landhausdiele&lt;\/b&gt;<\/h3>/);assert.match(mat,/<th scope="row">F<\/th><td>6<\/td>/,'Material: zehn Zeilen');
  assert.match(M.seiteHtml(inh.seiten[1],inh,{modus:'druck'}),/A · Eiche &lt;b&gt;Landhausdiele/,'auch in der Übersicht');
});

test('Fotos: ersetzen, anhängen, entfernen, nach vorn, Ausschnitt; eigene Bilder aus dem Speicher der Mappe',()=>{
  const l0=[{id:'d1',pfad:'u/p1/1.jpg'},{id:'d2',pfad:'u/p1/2.jpg'}];
  assert.deepEqual(M.fotoSetzen(l0,0,{id:'d3',pfad:'u/p1/3.jpg'}).map(f=>f.id),['d3','d2']);
  assert.deepEqual(M.fotoSetzen(l0,2,{id:'m1',pfad:'d/u/x.jpg',quelle:'mappe',name:'Muster'}),
    [{id:'d1',pfad:'u/p1/1.jpg'},{id:'d2',pfad:'u/p1/2.jpg'},{id:'m1',pfad:'d/u/x.jpg',quelle:'mappe',name:'Muster'}]);
  assert.deepEqual(M.fotoSetzen(l0,0,{id:'d2',pfad:'u/p1/2.jpg'}).map(f=>f.id),['d2'],'dasselbe Bild nur einmal');
  assert.equal(M.fotoSetzen([...l0,{id:'d3',pfad:'c'}],5,{id:'d4',pfad:'d'}).length,3,'höchstens drei');
  assert.deepEqual(M.fotoEntfernen(l0,0).map(f=>f.id),['d2']);
  assert.deepEqual(M.fotoNachVorn(l0,1).map(f=>f.id),['d2','d1']);
  const l1=M.fotoAusschnitt(l0,1,{x:20,y:130,z:9});
  assert.deepEqual(l1[1].ausschnitt,{x:20,y:100,z:3},'begrenzt');assert.equal(l1[0].ausschnitt,undefined);
  assert.equal(M.fotoAusschnitt(l1,1,{x:50,y:50,z:1})[1].ausschnitt,undefined,'Mitte ohne Vergrößerung = kein Ausschnitt');
  assert.equal(M.ausschnittVon({x:'a',y:null,z:0.5}),null);
  assert.equal(M.fotoSauber({id:'x',pfad:'p',quelle:'fremd',ausschnitt:{x:10}}).quelle,undefined);
  // Auf der Seite: eigenes Bild aus dem Bucket der Mappe, Ausschnitt als object-position und scale; Pfade nach Bucket.
  const {v,za,zb,zc}=beispiel();
  za.daten.optionen[0].muster_fotos=[{id:'m1',pfad:'d/u/eigen.jpg',quelle:'mappe',ausschnitt:{x:30,y:40,z:1.5}},{id:'d2',pfad:'u/p1/2.jpg'}];
  const inh=M.mappeInhalt(v,[za,zb,zc]);
  const bild=(pfad,bucket)=>'https://bilder.invalid/'+bucket+'/'+pfad;
  const druck=M.seiteHtml(inh.seiten[3],inh,{modus:'druck',bild});
  assert.match(druck,/<span class="mm-foto mm-rahmen mm-foto-gross"><img class="mm-foto-bild" src="https:\/\/bilder\.invalid\/office-projektdokumente\/d\/u\/eigen\.jpg"[^>]*style="object-position:30% 40%;transform:scale\(1\.5\);transform-origin:30% 40%">/);
  assert.match(druck,/office-produkte\/u\/p1\/2\.jpg/);assert.doesNotMatch(druck,/data-bildplatz|Bild ändern/);
  assert.deepEqual(M.allePfade(inh),{produkt:['u/p1/2.jpg'],mappe:['d/u/eigen.jpg','d/u/plan.jpg']});
  const bearb=M.seiteHtml(inh.seiten[3],inh,{modus:'bearbeiten',bild});
  assert.match(bearb,/data-bildplatz="e1\|A\|0"/);
  assert.match(bearb,/data-act="mm-bild" data-z="e1" data-o="A" data-i="0">Bild ändern<\/button><button type="button" class="mm-bild-knopf" data-act="mm-bild" data-z="e1" data-o="A" data-i="2">\+ Bild<\/button>/);
  assert.match(bearb,/data-bildplatz="e1\|A\|1"/);
  // Ohne Foto: beim Bearbeiten «Bild wählen», im PDF nur der Platzhalter.
  const ohne=M.seiteHtml(inh.seiten[2],inh,{modus:'bearbeiten'});
  assert.match(ohne,/<span>kein Foto<\/span><span class="mm-bild-knoepfe"><button type="button" class="mm-bild-knopf" data-act="mm-bild" data-z="e1" data-o="B" data-i="0">Bild wählen<\/button>/);
  // Die freie Seite zeigt ihr Bild ganz, ohne Rahmen und Knöpfe.
  assert.match(M.seiteHtml(inh.seiten[4],inh,{modus:'bearbeiten',bild}),/<img class="mm-foto mm-foto-frei" src="https:\/\/bilder\.invalid\/office-projektdokumente\/d\/u\/plan\.jpg"/);
});

test('Seite: Hinweise mit «zurücksetzen», Dialog «Bild ändern», eigene Bilder in den Speicher der Mappe',()=>{
  const js=readFileSync(new URL('../projektdokumente.js',import.meta.url),'utf8');
  assert.match(js,/data-act="mm-zuruecksetzen" data-z="'\+z\.id\+'" data-o="'\+esc\(o\.id\)\+'" data-feld="'\+x\.feld\+'">'\+esc\(x\.name\)\+' zurücksetzen<\/button>/);
  assert.match(js,/'<div data-mm-hinweise>'\+mappeHinweise\(v,seite\)\+'<\/div><\/section>'/);
  assert.match(js,/else if\(act==='mm-bild'&&z\)bildDialog\(z,el\.dataset\.o,el\.dataset\.i\);/);
  assert.match(js,/optionenPatch\(z,el\.dataset\.o,o=>M\.zuruecksetzen\(o,el\.dataset\.feld\)\);/);
  assert.match(js,/M\.fotoSetzen\(l,i,\{id:'m-'\+crypto\.randomUUID\(\),pfad,quelle:'mappe',name\}\)/);
  assert.match(js,/const pfad=M\.dateiPfad\(dok\.id,nutzer\.id,crypto\.randomUUID\(\),typ\);/,'derselbe Pfad wie die Policy');
  assert.match(js,/Das Bild bleibt in dieser Mappe; die Produktbibliothek ändert sich nicht\./);
  assert.doesNotMatch(js.slice(js.indexOf('function bildDialogZeichnen'),js.indexOf('async function bildHochladenUndSetzen')),/office_produkt_dokumente|from\('office_produkte'\)/,'aus der Mappe ändert sich die Bibliothek nie');
  const css=readFileSync(new URL('../projektdokumente.css',import.meta.url),'utf8');
  assert.match(css,/\.mm-text\.mm-geaendert\{border-style:solid;border-color:var\(--m-information\)\}/);
  assert.match(css,/\.mm-rahmen\{position:relative;overflow:hidden\}/);
  const kern=readFileSync(new URL('../mustermappe-kern.js',import.meta.url),'utf8');
  assert.match(readFileSync(new URL('../projektdokumente.html',import.meta.url),'utf8'),/mustermappe-kern\.js\?v=office3/);
  assert.ok(kern.includes('Anpassen für diese Mappe (Gari, 26.11.2026)'));
});
