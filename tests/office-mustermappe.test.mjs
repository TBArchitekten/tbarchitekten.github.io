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
  assert.match(html,/Vorlage zur Bemusterung am 03\.12\.2026/);assert.match(html,/<footer class="mm-fusszeile"><span>5\/5<\/span><b>Bodenbelagsplan EG<\/b><\/footer>/);
  assert.match(html,/office-projektdokumente\/d\/u\/plan\.jpg/,'freie Seite aus dem Bucket der Mappe');
  assert.doesNotMatch(html,/<textarea|contenteditable|mm-raster/,'Druck ohne Eingabefelder und ohne Raster');
  assert.match(html,/kein Foto/,'ohne Foto ein Platzhalter');
  const ueb=M.uebersichtGruppen(inh);
  assert.deepEqual(ueb.map(g=>g.titel),['Für beide Strategien','Strategie A','Strategie B']);
  assert.deepEqual(ueb.map(g=>g.punkte.map(p=>p.code)),[['B5'],['B2'],['B3']]);
});

test('Bearbeiten: Texte direkt auf der Seite mit festen ids, Daten der Position im Kopf',()=>{
  const {v,za,zb,zc}=beispiel();
  const inh=M.mappeInhalt(v,[za,zb,zc],{projekt:{number:'T-01',name:'Testhaus'},stand:'2026-11-24'});
  const s3=M.seiteHtml(inh.seiten[2],inh,{nr:3,gesamt:5,modus:'bearbeiten'});
  // Seit 26.11.2026 steht der Text beim Bearbeiten in denselben Elementen wie im PDF, nur zum Hineinschreiben.
  assert.match(s3,/<p class="mm-frage mm-ed" id="mm-e1-frage" data-mmtext="frage" data-z="e1" contenteditable="plaintext-only" role="textbox" aria-multiline="true"/);
  assert.match(s3,/id="mm-e1-begruendung"/);assert.match(s3,/<p>Ausstellung 537 m²\n630 m²<\/p>/);
  assert.doesNotMatch(s3,/<textarea/);
  assert.match(s3,/<p class="mm-name"><b>A · <\/b><span class="mm-fett mm-ed" id="mm-e1-A-name" data-mmanp="e1\|A\|name" contenteditable="plaintext-only" role="textbox" data-einzeilig aria-label="Name der Variante" data-leer="Name der Variante">Parkett Eiche geölt<\/span>/);
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
  assert.match(html,/projektdokumente\.css\?v=office14/);assert.match(html,/projektdokumente\.js\?v=office14/);
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
  assert.match(druck,/<p class="mm-name"><b>A · <\/b><b>Eiche &lt;b&gt;Landhausdiele&lt;\/b&gt;<\/b>/,'maskiert');assert.match(druck,/<p class="mm-t-klein mm-leise">Holz AG<\/p>/);
  // Alle Kennwerte stehen in der Tabelle; die Seite zeigt, was in den Rahmen passt (eine Zeile je Grundlinie).
  assert.match(druck,/<th scope="row">Oberfläche<\/th><td>geölt<\/td>/);assert.match(druck,/<th scope="row">F<\/th><td>6<\/td>/);
  assert.doesNotMatch(druck,/<textarea|contenteditable|mm-geaendert|mm-bild-knopf|mm-kw-plus|data-rahmen/,'im Druck keine Felder und Knöpfe');
  const bearb=M.seiteHtml(inh.seiten[2],inh,{modus:'bearbeiten'});
  assert.match(bearb,/class="mm-fett mm-ed mm-geaendert" id="mm-e1-A-name" data-mmanp="e1\|A\|name"[^>]*title="In dieser Mappe geändert">Eiche &lt;b&gt;Landhausdiele&lt;\/b&gt;<\/span>/);
  assert.match(bearb,/<table class="mm-kennwerte mm-geaendert" data-mmkwtab="e1\|A" title="In dieser Mappe geändert">/);
  assert.match(bearb,/<th scope="row" class="mm-ed" id="mm-e1-A-kw1f" data-mmkw="e1\|A" contenteditable="plaintext-only"[^>]*>Oberfläche<\/th><td class="mm-ed" id="mm-e1-A-kw1w" data-mmkw="e1\|A"[^>]*>geölt<\/td>/);
  assert.match(bearb,/data-act="mm-kw-neu" data-z="e1" data-o="A">\+ Kennwert<\/button>/);
  assert.doesNotMatch(bearb.match(/<p class="[^"]*" id="mm-e1-B-herkunft"[^>]*>/)[0],/mm-geaendert/,'B: wie die Bibliothek');
  assert.doesNotMatch(bearb.match(/<span class="[^"]*" id="mm-e1-B-name"[^>]*>/)[0],/mm-geaendert/);
  const mat=M.seiteHtml(inh.seiten[3],inh,{modus:'druck'});
  assert.match(mat,/<p class="mm-name"><b>Eiche &lt;b&gt;Landhausdiele&lt;\/b&gt;<\/b> <span class="mm-empf">Empfehlung des Büros<\/span><\/p>/);assert.match(mat,/<th scope="row">F<\/th><td>6<\/td>/);
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
  assert.match(druck,/<span class="mm-foto mm-rahmen mm-foto-gross" data-mmfoto="A\|0"><img class="mm-foto-bild" src="https:\/\/bilder\.invalid\/office-projektdokumente\/d\/u\/eigen\.jpg"[^>]*style="object-position:30% 40%;transform:scale\(1\.5\);transform-origin:30% 40%">/);
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
  // Seit 26.11.2026 rechts über den Eigenschaften (die Bühne füllt das Fenster).
  // Seit B2 (27.11.2026) in Reitern: Hinweise, Übersatz, Rahmen und die Seite unter «Seite».
  assert.match(js,/'<div class="mm-teil" data-teil="seite"><div data-mm-hinweise>'\+mappeHinweise\(v,seite\)\+'<\/div><div data-mm-uebersatz><\/div><div data-mm-rahmen>'\+layoutKarte\(\)\+'<\/div>'\+t\.seite\+'<\/div>'/);
  assert.match(js,/return \{seite:karte,position,mappe:positionen\+angaben\+termin\+/);
  assert.match(js,/else if\(act==='mm-bild'&&z\)bildDialog\(z,el\.dataset\.o,el\.dataset\.i\);/);
  assert.match(js,/optionenPatch\(z,el\.dataset\.o,o=>M\.zuruecksetzen\(o,el\.dataset\.feld\)\);/);
  assert.match(js,/M\.fotoSetzen\(l,i,\{id:'m-'\+crypto\.randomUUID\(\),pfad,quelle:'mappe',name\}\)/);
  assert.match(js,/const pfad=M\.dateiPfad\(dok\.id,nutzer\.id,crypto\.randomUUID\(\),typ\);/,'derselbe Pfad wie die Policy');
  assert.match(js,/Das Bild bleibt in dieser Mappe; die Produktbibliothek ändert sich nicht\./);
  assert.doesNotMatch(js.slice(js.indexOf('function bildDialogZeichnen'),js.indexOf('async function bildHochladenUndSetzen')),/office_produkt_dokumente|from\('office_produkte'\)/,'aus der Mappe ändert sich die Bibliothek nie');
  const css=readFileSync(new URL('../projektdokumente.css',import.meta.url),'utf8');
  assert.match(css,/\.mm-ed\.mm-geaendert,\.mm-kennwerte\.mm-geaendert\{box-shadow:inset 0 0 0 calc\(var\(--mm\) \* \.35\) var\(--m-information\)\}/);
  assert.match(css,/\.mm-rahmen\{position:relative;overflow:hidden\}/);
  const kern=readFileSync(new URL('../mustermappe-kern.js',import.meta.url),'utf8');
  assert.match(readFileSync(new URL('../projektdokumente.html',import.meta.url),'utf8'),/mustermappe-kern\.js\?v=office5/);
  assert.ok(kern.includes('Anpassen für diese Mappe (Gari, 26.11.2026)'));
});

// Gari, 26.11.2026: das TBA-Raster A3 quer (Rastersysteme nach Müller-Brockmann und Gerstner) statt des 6 × 6 aus
// Archicad; Kopf- und Fußzeile wie im Master; Bearbeiten direkt auf der Seite, die aussieht wie das PDF.
test('TBA-Raster: 12 × 8 Felder von 28 mm, Abstand und Grundlinie 4 mm, Ränder 20/24/21 mm, Proportionen der Felder',()=>{
  const R=M.RASTER;
  assert.equal(R.links+M.rasterMass(R.spalten)+R.links,R.breite,'420 mm');
  assert.equal(R.oben+M.rasterMass(R.zeilen)+R.unten,R.hoehe,'297 mm');
  assert.equal(M.rasterMass(12),380);assert.equal(M.rasterMass(8),252);
  assert.equal(M.rasterMass(6)/M.rasterMass(4),188/124,'6 × 4 Felder ≈ 3:2');
  assert.ok(Math.abs(M.rasterMass(7)/M.rasterMass(5)-Math.SQRT2)<.005,'7 × 5 Felder ≈ A-Format (0,4 mm Unterschied)');
  assert.equal((R.feld+R.abstand)%R.grundlinie,0,'Felder und Abstand auf der Grundlinie');
  assert.equal(R.kopf,R.oben-2*R.grundlinie);assert.equal(R.fuss,R.oben+M.rasterMass(8)+2*R.grundlinie);
  assert.deepEqual([...M.BUERO],['Titus Bernhard','Architekten','BDA']);
});

test('Seiten auf dem Raster: Rahmen je Vorlage, Kopf- und Fußzeile, Raster nur beim Bearbeiten',()=>{
  const {v,za,zb,zc}=beispiel();
  v.daten.kopf_phase='Entwurf';
  const inh=M.mappeInhalt(v,[za,zb,zc],{projekt:{number:'T-01',name:'Testhaus'},stand:'2026-11-26'});
  assert.deepEqual(inh.kopf,{projekt:'T-01 Testhaus',phase:'Entwurf',untertitel:'Mustermappe Bodenbeläge'});
  const bild=(pfad,bucket)=>'https://bilder.invalid/'+bucket+'/'+pfad;
  const verg=M.seiteHtml(inh.seiten[2],inh,{nr:3,gesamt:5,bild});
  assert.match(verg,/<header class="mm-kopfzeile"><span>T-01 Testhaus \| <b>Entwurf<\/b> \| Mustermappe Bodenbeläge<\/span><span class="mm-kz-rechts"><span>26\.11\.2026<\/span><span>Titus Bernhard <b>Architekten<\/b> BDA<\/span><\/span><\/header>/);
  assert.match(verg,/<footer class="mm-fusszeile"><span>3\/5<\/span><b>B2 Holz – Eiche · Vergleich<\/b><\/footer>/);
  // Zwei Varianten: je 6 Felder breit, Foto 4 Zeilen (3:2), Text 2 Zeilen; die Zonen über B (ab Feld 7); unten
  // Empfehlung 6, Kosten 2, Zu beachten 4.
  const r=h=>[...h.matchAll(/class="mm-r[^"]*" style="grid-column:(\d+) \/ span (\d+);grid-row:(\d+) \/ span (\d+)"/g)].map(m=>m.slice(1).join(','));
  assert.deepEqual(r(verg),['1,6,1,1','7,6,1,1','1,6,2,4','1,6,6,2','7,6,2,4','7,6,6,2','1,6,8,1','7,2,8,1','9,4,8,1']);
  assert.doesNotMatch(verg,/mm-raster/);
  // Drei Varianten: 3 × 4 Felder, Foto 3 Zeilen (4:3), Text 3 Zeilen, unten 4/4/4. Eine Variante: Foto 8 × 6, Text 4 × 6.
  const z3={...za,daten:{...za.daten,optionen:[...za.daten.optionen,{...za.daten.optionen[1],id:'C'}]}};
  const inh3=M.mappeInhalt(v,[z3,zb,zc]);
  assert.deepEqual(r(M.seiteHtml(inh3.seiten[2],inh3,{})).slice(0,2),['1,8,1,1','9,4,1,1'],'Zonen über C');
  assert.deepEqual(r(M.seiteHtml(inh3.seiten[2],inh3,{})).slice(2),['1,4,2,3','1,4,5,3','5,4,2,3','5,4,5,3','9,4,2,3','9,4,5,3','1,4,8,1','5,4,8,1','9,4,8,1']);
  const z1={...za,daten:{...za.daten,optionen:za.daten.optionen.slice(0,1)}};
  const inh1=M.mappeInhalt(v,[z1,zb,zc]);
  assert.deepEqual(r(M.seiteHtml(inh1.seiten[2],inh1,{})).slice(2,4),['1,8,2,6','9,4,2,6']);
  // Material: Foto 6 × 8 links, rechts Kopf, Beschreibung, Kennwerte, Kosten, Zu beachten. Freie Seite: Bild 10 × 8.
  assert.deepEqual(r(M.seiteHtml(inh.seiten[3],inh,{})),['1,6,1,8','7,6,1,1','7,6,2,4','7,6,6,2','7,2,8,1','9,4,8,1']);
  assert.deepEqual(r(M.seiteHtml(inh.seiten[4],inh,{bild})),['1,10,1,8','11,2,1,8']);
  // Übersicht: Spalten der Tabelle auf dem Raster (1, 2, 3, 3, 1 und 2 Felder von 380 mm), als Anteile der Breite: in
  // einem schmaleren Rahmen (Etappe 2) bleiben die Verhältnisse.
  const ueb=M.seiteHtml(inh.seiten[1],inh,{});
  const anteile=[...ueb.matchAll(/<col style="width:([\d.]+)%">/g)].map(m=>Number(m[1]));
  assert.deepEqual(anteile.map(x=>Math.round(x*380/100)),[32,64,96,96,32,60]);
  assert.ok(Math.abs(anteile.reduce((a,x)=>a+x,0)-100)<0.001);
  // Beim Bearbeiten: das Raster (96 Felder, 24 große) hinter den Rahmen; die Rahmen haben einen Namen für den Übersatz.
  const bearb=M.seiteHtml(inh.seiten[2],inh,{modus:'bearbeiten'});
  assert.equal((bearb.match(/<div class="mm-raster" aria-hidden="true">(.*?)<\/div>/)[1].match(/<i><\/i>/g)||[]).length,96);
  assert.equal((bearb.match(/<div class="mm-raster-gross" aria-hidden="true">(.*?)<\/div>/)[1].match(/<i><\/i>/g)||[]).length,24);
  assert.match(bearb,/data-rahmen="Zu beachten"/);assert.match(bearb,/data-rahmen="A"/);
  // Kopfzeile aus den Angaben der Mappe, wenn gesetzt (z. B. die Adresse wie im Archicad-Master).
  v.daten.kopf_projekt='Musterstraße 1 Musterstadt';v.daten.kopf_untertitel='1. BA';
  assert.deepEqual(M.mappeInhalt(v,[za,zb,zc],{projekt:{number:'T-01',name:'Testhaus'}}).kopf,{projekt:'Musterstraße 1 Musterstadt',phase:'Entwurf',untertitel:'1. BA'});
  // Ein Stand von vor dem Raster (ohne kopf) bekommt die Kopfzeile aus Projekt und Titel.
  const alt={...inh,kopf:undefined};
  assert.match(M.seiteHtml(alt.seiten[0],alt,{}),/<header class="mm-kopfzeile"><span>T-01 Testhaus \| Mustermappe Bodenbeläge<\/span>/);
});

test('Deckblatt: Titelbild aus dem Speicher der Mappe (optional), Titel unten links, Text rechts',()=>{
  const {v,za,zb,zc}=beispiel();
  v.daten.seiten[0]={...v.daten.seiten[0],bild:{pfad:'d/u/titel.jpg',name:'Rendering'}};
  const inh=M.mappeInhalt(v,[za,zb,zc],{projekt:{number:'T-01',name:'Testhaus'}});
  const bild=(pfad,bucket)=>'https://bilder.invalid/'+bucket+'/'+pfad;
  const deck=M.seiteHtml(inh.seiten[0],inh,{bild});
  assert.match(deck,/style="grid-column:1 \/ span 12;grid-row:1 \/ span 5"><img class="mm-foto mm-foto-deck" src="https:\/\/bilder\.invalid\/office-projektdokumente\/d\/u\/titel\.jpg"/);
  assert.match(deck,/style="grid-column:1 \/ span 8;grid-row:6 \/ span 2"><p class="mm-kicker">Mustermappe<\/p><h2 class="mm-t-gross">Bodenbeläge<\/h2><p class="mm-t-mittel">T-01 · Testhaus<\/p>/);
  assert.ok(M.allePfade(inh).mappe.includes('d/u/titel.jpg'),'das Titelbild wird signiert');
  const ohne=M.mappeInhalt(beispiel().v,[za,zb,zc]);
  assert.doesNotMatch(M.seiteHtml(ohne.seiten[0],ohne,{}),/mm-foto/,'ohne Titelbild bleibt die Fläche im PDF weiß');
  assert.match(M.seiteHtml(ohne.seiten[0],ohne,{modus:'bearbeiten'}),/Titelbild \(optional\): rechts ein Bild oder ein PDF hochladen\./);
  // Kennwerte aus der Tabelle auf der Seite (Liste statt Text).
  const o=za.daten.optionen[0];
  assert.deepEqual(M.anpassen(o,'kennwerte',[{feld:' Aufbau ',wert:'21 mm'},{feld:'',wert:''}]).muster_merkmale,[{feld:'Aufbau',wert:'21 mm'}]);
  assert.equal(M.anpassen(o,'kennwerte',[{feld:'Aufbau',wert:'massiv 16 mm'},{feld:'Brandverhalten',wert:'Cfl-s1'}]).muster_merkmale,undefined,'wie die Bibliothek');
});

test('Arbeitsfläche und Blatt: Zoom, Schalter, Übersatz, Raster in mm, Arial, Text auf der Seite',()=>{
  const js=readFileSync(new URL('../projektdokumente.js',import.meta.url),'utf8');
  assert.match(js,/const MM_A3=1587,MM_STUFEN=\[\.25,\.33,\.5,\.67,\.75,1,1\.25,1\.5,2,3\];/);
  assert.match(js,/try\{localStorage\.setItem\('tba-office\.mustermappe\.ansicht',JSON\.stringify\(mm\.ansicht\)\)\}catch\{\}/);
  assert.match(js,/if\(!\(e\.ctrlKey\|\|e\.metaKey\)\|\|ui\.ansicht!=='mappe'\|\|!e\.target\.closest\?\.\('\.mm-buehne'\)\)return;/);
  assert.match(js,/\},\{passive:false\}\);/);
  assert.match(js,/if\(ui\.ansicht==='mappe'&&el\.matches\('\.mm-ed'\)\)\{mappeEingabe\(el\);return\}/);
  assert.match(js,/document\.execCommand\('insertText',false,t\);/,'Einfügen nur als Text');
  assert.match(js,/const ueber=r\.scrollHeight>r\.clientHeight\+1;r\.classList\.toggle\('mm-uebersatz',ueber\);/);
  assert.match(js,/Passt nicht ganz in den Rahmen/);
  assert.match(js,/const r=box\.querySelector\('\[data-mmfoto="'\+CSS\.escape\(oid\+'\|'\+i\)\+'"\]'\)\?\.getBoundingClientRect\(\);/);
  assert.doesNotMatch(js,/mm\.lesen|Lesegröße|textarea\.mm-text/,'kein Umschalter «Lesegröße» und keine Felder mehr auf der Seite');
  const css=readFileSync(new URL('../projektdokumente.css',import.meta.url),'utf8');
  assert.match(css,/\.pd-mappe-wrap\{max-width:none\}/);
  assert.match(css,/\.mm-seite\{--mm:calc\(100cqw \/ 420\);/);
  assert.match(css,/font-family:Arial,"Helvetica Neue",Helvetica,"Liberation Sans",sans-serif;\n  font-size:calc\(var\(--mm\) \* 3\.175\);line-height:calc\(var\(--mm\) \* 4\)/);
  assert.match(css,/\.mm-satz\{position:absolute;left:calc\(var\(--mm\) \* 20\);top:calc\(var\(--mm\) \* 24\);width:calc\(var\(--mm\) \* 380\);height:calc\(var\(--mm\) \* 252\);\n  display:grid;grid-template-columns:repeat\(12,minmax\(0,1fr\)\);grid-template-rows:repeat\(8,minmax\(0,1fr\)\);gap:calc\(var\(--mm\) \* 4\)\}/);
  assert.match(css,/\.mm-kopfzeile\{bottom:calc\(var\(--mm\) \* 281\);text-transform:uppercase;letter-spacing:\.02em\}/);
  assert.match(css,/\.mm-fusszeile\{bottom:calc\(var\(--mm\) \* 13\)\}/);
  assert.match(css,/\.mm-buehne\.raster \.mm-raster,\.mm-buehne\.raster \.mm-raster-gross\{display:grid\}/);
  // Überschriften und Absätze der App gelten nicht auf dem Blatt (sonst 19 px statt 20 pt und 6 pt Abstand im Druck).
  assert.match(css,/\.pd h2:where\(:not\(\.mm-seite \*\)\)\{font-size:19px;/);
  assert.match(css,/\.pd-druck p:where\(:not\(\.mm-seite \*\)\)\{margin:0 0 6pt\}/);
  assert.doesNotMatch(css,/^\.pd h[23]\{|\.pd-druck p\{/m);
  // Farben nur aus den Tokens.
  const blatt=css.slice(css.indexOf('/* Mustermappe (L3.MAP.1'),css.indexOf('/* Präsentieren im Bemusterungstermin'));
  assert.doesNotMatch(blatt,/#[0-9a-f]{3,8}\b|rgba?\(/i);
});

// Etappe 2 (Gari, 26.11.2026): Rahmen verschieben und in der Größe ändern, Feld für Feld. Das Layout gehört zur Seite,
// getrennt nach ihrer Form (Vergleich mit 1, 2 oder 3 Varianten); im PDF gilt dasselbe.
test('Layout der Seite: Rahmen auf dem Raster verschieben, Größe ändern, ausblenden, nach Form der Seite getrennt',()=>{
  const {v,za,zb,zc}=beispiel();
  const r=h=>[...h.matchAll(/class="mm-r[^"]*" style="grid-column:(\d+) \/ span (\d+);grid-row:(\d+) \/ span (\d+)"/g)].map(m=>m.slice(1).join(','));
  // Bereinigen: nur bekannte Schlüssel, ganze Felder im Raster (12 × 8), mindestens ein Feld.
  assert.deepEqual(M.layoutSauber({'vergleich-2':{'foto-1':{c:1,r:2,w:7,h:5},'text-1':{c:12,r:1,w:2,h:1},zonen:{aus:true},'x y':{c:1,r:1,w:1,h:1},kopf:{c:1.5,r:1,w:1,h:1}},'<b>':{kopf:{c:1,r:1,w:1,h:1}}}),
    {'vergleich-2':{'foto-1':{c:1,r:2,w:7,h:5},zonen:{aus:true}}});
  assert.equal(M.layoutSauber({}),null);assert.equal(M.layoutSauber([]),null);
  let l=M.layoutSetzen(null,'vergleich-2','foto-1',{c:1,r:2,w:7,h:5});
  assert.deepEqual(l,{'vergleich-2':{'foto-1':{c:1,r:2,w:7,h:5}}});
  l=M.layoutSetzen(l,'vergleich-2','zonen',{aus:true});
  assert.deepEqual(Object.keys(l['vergleich-2']),['foto-1','zonen']);
  assert.equal(M.layoutSetzen(M.layoutSetzen(l,'vergleich-2','zonen',null),'vergleich-2','foto-1',null),null,'ohne Abweichung kein Layout');
  assert.deepEqual(M.layoutVorlage({...l,'vergleich-3':{kopf:{c:1,r:1,w:12,h:1}}},'vergleich-2'),{'vergleich-3':{kopf:{c:1,r:1,w:12,h:1}}});
  // Größe: Felder, Millimeter und Seitenverhältnis.
  assert.deepEqual(M.rahmenMass({w:6,h:4}),{breite:188,hoehe:124,felder:'6 × 4 Felder',mm:'188 × 124 mm',verhaeltnis:'3:2'});
  assert.equal(M.rahmenMass({w:7,h:5}).verhaeltnis,'A-Format');assert.equal(M.rahmenMass({w:7,h:4}).verhaeltnis,'16:9');
  assert.equal(M.rahmenMass({w:6,h:8}).verhaeltnis,'3:4');assert.equal(M.rahmenMass({w:1,h:1}).felder,'1 × 1 Feld');
  assert.equal(M.rahmenMass({w:12,h:5}).verhaeltnis,'2,44:1');
  // Vergleich mit zwei Varianten: Foto A 7 × 5 statt 6 × 4, Zonen ausgeblendet; im PDF genauso.
  v.daten.seiten[2]={...v.daten.seiten[2],layout:l};
  let inh=M.mappeInhalt(v,[za,zb,zc]);
  assert.equal(M.layoutBasis(inh.seiten[2],inh),'vergleich-2');
  const druck=M.seiteHtml(inh.seiten[2],inh,{});
  assert.deepEqual(r(druck),['1,6,1,1','1,7,2,5','1,6,6,2','7,6,2,4','7,6,6,2','1,6,8,1','7,2,8,1','9,4,8,1']);
  assert.doesNotMatch(druck,/data-mmr|mm-ebene/,'im PDF keine Ebene und keine Schlüssel');
  // Beim Bearbeiten: Schlüssel, Name, Stelle auf der Seite und in der Vorlage, angepasst; darüber die Ebene.
  const bearb=M.seiteHtml(inh.seiten[2],inh,{modus:'bearbeiten'});
  assert.match(bearb,/<div class="mm-r mm-r-foto" style="grid-column:1 \/ span 7;grid-row:2 \/ span 5" data-mmr="foto-1" data-mmr-name="Foto A" data-mmr-g="1,2,7,5" data-mmr-std="1,2,6,4" data-mmr-eigen>/);
  assert.match(bearb,/data-rahmen="A" data-mmr="text-1" data-mmr-name="Text A" data-mmr-g="1,6,6,2" data-mmr-std="1,6,6,2">/);
  assert.match(bearb,/<\/div><div class="mm-ebene"><\/div><footer/);
  const liste=M.rahmenDerSeite(inh.seiten[2],inh);
  assert.equal(liste.basis,'vergleich-2');
  assert.deepEqual(liste.rahmen.map(x=>x.key+(x.aus?':aus':x.eigen?':eigen':'')),['kopf','zonen:aus','foto-1:eigen','text-1','foto-2','text-2','empfehlung','kosten','beachten']);
  // Mit drei Varianten gilt wieder die Vorlage (eigene Form der Seite); das Layout für zwei bleibt gespeichert.
  const z3={...za,daten:{...za.daten,optionen:[...za.daten.optionen,{...za.daten.optionen[1],id:'C'}]}};
  inh=M.mappeInhalt(v,[z3,zb,zc]);
  assert.equal(M.layoutBasis(inh.seiten[2],inh),'vergleich-3');
  assert.deepEqual(r(M.seiteHtml(inh.seiten[2],inh,{})).slice(0,3),['1,8,1,1','9,4,1,1','1,4,2,3']);
  // Ein ungültiger Eintrag (über den Rand) gilt nicht: die Vorlage.
  v.daten.seiten[3]={...v.daten.seiten[3],layout:{material:{foto:{c:8,r:1,w:6,h:8},kopf:{c:7,r:2,w:6,h:1}}}};
  inh=M.mappeInhalt(v,[za,zb,zc]);
  assert.deepEqual(r(M.seiteHtml(inh.seiten[3],inh,{})).slice(0,2),['1,6,1,8','7,6,2,1']);
  // Material: der Platz für das nächste Foto nur beim Bearbeiten (beim Ziehen sichtbar), dort, wo Bild 2 stehen wird.
  za.daten.optionen[0].muster_fotos=[{id:'f1',pfad:'p/1.jpg'}];
  v.daten.seiten[3]={...v.daten.seiten[3],layout:{material:{'foto-2':{c:10,r:6,w:3,h:2}}}};
  inh=M.mappeInhalt(v,[za,zb,zc]);
  const mat=M.seiteHtml(inh.seiten[3],inh,{modus:'bearbeiten',bild:p=>'https://bilder.invalid/'+p});
  assert.match(mat,/<div class="mm-r mm-r-foto mm-r-ablage" style="grid-column:10 \/ span 3;grid-row:6 \/ span 2"><div class="mm-ablage" data-bildplatz="e1\|A\|1"><span>Bild 2<\/span><\/div><\/div>/);
  assert.doesNotMatch(M.seiteHtml(inh.seiten[3],inh,{bild:p=>'https://bilder.invalid/'+p}),/mm-ablage/);
  assert.ok(!M.rahmenDerSeite(inh.seiten[3],inh).rahmen.some(x=>x.key==='foto-2'),'der Platz ist kein Rahmen der Liste');
  // Übersicht, Deckblatt und freie Seite haben ihre Schlüssel.
  assert.deepEqual(M.rahmenDerSeite(inh.seiten[1],inh).rahmen.map(x=>x.key),['kopf','tabelle']);
  assert.deepEqual(M.rahmenDerSeite(inh.seiten[0],inh).rahmen.map(x=>x.titel),['Titelbild','Titel','Deckblatt-Text']);
  assert.deepEqual(M.rahmenDerSeite(inh.seiten[4],inh).rahmen.map(x=>x.key+':'+x.titel),['bild:Bild','text:Titel und Text']);
  assert.equal(M.layoutBasis(inh.seiten[4],inh),'frei');
});
