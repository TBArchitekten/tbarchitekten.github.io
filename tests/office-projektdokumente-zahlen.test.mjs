// Projektstart · Zahlen der Varianten (24.11.2026): Produkt, Kennwert und Menge einer Variante kommen aus der
// Produktbibliothek, dem Datenpool und der Kostenberechnung des Projekts, fortgeschrieben mit dem Baupreisindex.
// Geprüft ohne Netz, mit erfundenen Projekten (9901, 9902, 9903): Fundstelle für das Büro, Beleg für das Dokument ohne
// andere Projekte, Romy wählt nur unter Kandidaten, ein Vorschlag ändert an den Varianten nur, was er nennt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Z=require('../projektdokumente-zahlen.js'),K=require('../projektdokumente-kern.js');
const R=require('../kosten-rechnen.js'),P=require('../kosten-pool.js');

const INDIZES=[{quartal:'2022-Q3',wert:'118.9'},{quartal:'2025-Q4',wert:'138.2'},{quartal:'2026-Q3',wert:'141.7'}];
const muster={state:{indizes:INDIZES,indexReihe:'Baupreisindex Wohngebäude',ustProzent:'19'}};
const pos=(id,kg,titel,menge,einheit,wert,{kostenstand='2022-Q3',art='eigen',status='',zeile=0}={})=>({id,kg,titel,menge,einheit,
  mengenquelle:{art:'archicad'},kennwert:{art,wert,fundstelle:'Beispielquelle',kostenstand},status,...(zeile?{archivZeile:zeile}:{})});
const archiv=(id,nr,name,positionen)=>({id,project_number:nr,project_name:name,is_archived:true,
  state:{schema:R.SCHEMA,kostenstand:'2022-Q3',indizes:INDIZES,positionen,archiv:{reifegrad:'berechnung'}}});
const laufend={id:'kobe-1',project_id:'proj-1',project_number:'9903',project_name:'Neubau Test',is_archived:false,
  state:{schema:R.SCHEMA,kostenstand:'2026-Q4',indizes:INDIZES,ustProzent:'19',positionen:[
    pos('a','352','Parkett Wohnräume','210','m²','180',{kostenstand:'2026-Q4'}),
    pos('b','352','Fliesen Bäder','38,5','m²','95',{kostenstand:'2026-Q4'}),
    pos('c','359','Pauschale Sonstiges','1','psch','500',{kostenstand:'2026-Q4'}),
    pos('d','352','Sockelleisten','140','m','12',{kostenstand:'2026-Q4',status:'entfaellt'})]}};
const instanzen=[archiv('alt-1','9901','Beispielhaus',[pos('x1','352','Parkett Eiche geölt','120','m²','180',{zeile:12})]),
  archiv('alt-2','9902','Musterhof',[pos('y1','352','Parkett Eiche','95','m²','180',{zeile:40}),pos('y2','352','Naturstein Platten','80','m²','200',{zeile:41})])];

test('Kostenstand: die Kostenberechnung des Projekts, sonst das Quartal von heute',()=>{
  assert.equal(Z.quartalVon('2026-03-31'),'2026-Q1');
  assert.equal(Z.quartalVon('2026-11-24'),'2026-Q4');
  assert.equal(Z.quartalVon('2026-13-01'),'');
  const mitKobe=Z.ziel({kobe:laufend,muster,heute:'2026-11-24'});
  assert.equal(mitKobe.kostenstand,'2026-Q4');assert.equal(mitKobe.herkunft,'kobe');
  const ohne=Z.ziel({muster,heute:'2027-02-10'});
  assert.equal(ohne.kostenstand,'2027-Q1');assert.equal(ohne.herkunft,'heute');
  assert.deepEqual(ohne.indizes,INDIZES,'ohne Kostenberechnung gilt der Index des Musters');
});

test('Fortschreiben mit dem Baupreisindex, mit Werten und vorläufigem Index',()=>{
  const z=Z.ziel({kobe:laufend});
  const f=Z.fortschreiben(18000n,'2022-Q3',z,R,P);
  assert.equal(f.cent,21452n,'180,00 € × 141,7 / 118,9 = 214,52 €');
  assert.match(f.text,/Baupreisindex 3\. Quartal 2022 → 4\. Quartal 2026 \(118,9 → 141,7\), Index bis 3\. Quartal 2026/);
  assert.equal(Z.fortschreiben(18000n,'2026-Q4',z,R,P).fortgeschrieben,false,'gleicher Kostenstand');
  assert.equal(Z.fortschreiben(18000n,'2019-Q1',z,R,P).fehlt,true,'Quartal vor der Reihe: nicht fortgeschrieben');
  assert.equal(Z.fortschreiben(18000n,'',z,R,P).ohneStand,true);
});

test('Produkt: Datenblatt, Code im Projekt, Suche',()=>{
  const produkte=[{id:'p1',name:'Parkett Eiche geölt',hersteller:'Holz AG',kategorie:'bodenbelag',status:'geprueft'},
    {id:'p2',name:'Naturstein Jura',hersteller:'Stein GmbH',kategorie:'bodenbelag',status:'entwurf'},
    {id:'p3',name:'Akustikdecke',kategorie:'decke',status:'entwurf',archiviert:true}];
  const doks=[{produkt_id:'p1',art:'datenblatt'},{produkt_id:'p2',art:'preisliste'}];
  assert.equal(Z.datenblatt(produkte[0],doks),'geprueft');
  assert.equal(Z.datenblatt(produkte[1],doks),'fehlt');
  assert.equal(Z.datenblatt({...produkte[1],status:'geprueft'},[{produkt_id:'p2',art:'datenblatt'}]),'geprueft');
  assert.equal(Z.datenblatt(produkte[1],[{produkt_id:'p2',art:'datenblatt'}]),'ungeprueft');
  const verw=[{produkt_id:'p1',projekt_id:'proj-1',code:'BO-02',status:'vorgeschlagen'},{produkt_id:'p1',projekt_id:'proj-1',code:'BO-01',status:'verworfen'},
    {produkt_id:'p2',projekt_id:'proj-9',code:'BO-01',status:'freigegeben'}];
  assert.equal(Z.verwendungIm('p1','proj-1',verw).code,'BO-02','verworfene zählen nicht');
  assert.equal(Z.produktText(produkte[0],Z.verwendungIm('p1','proj-1',verw)),'BO-02 · Parkett Eiche geölt · Holz AG');
  assert.equal(Z.naechsterCode('proj-1','bodenbelag',verw),'BO-03');
  assert.equal(Z.naechsterCode('proj-1','fassade',verw),'FA-01');
  const treffer=Z.produktSuche(produkte,'Parkett Eiche',P);
  assert.equal(treffer[0].p.id,'p1');
  assert.ok(!treffer.some(t=>t.p.id==='p3'),'archivierte Produkte nicht');
});

test('Kennwert aus einem Preis: eingebaut vor Material, fortgeschrieben, Beleg ohne Herkunft',()=>{
  const z=Z.ziel({kobe:laufend});
  const preise=[{id:'r1',produkt_id:'p1',art:'listenpreis_material',betrag:'64.90',einheit:'m²',stand:'2026-05-02',quelle:'Preisliste 2026'},
    {id:'r2',produkt_id:'p1',art:'angebot_eingebaut',betrag:'185',einheit:'m²',stand:'2025-11-10',quelle:'Angebot Schreinerei',projekt_bezeichnung:'9901 Beispielhaus'}];
  assert.deepEqual(Z.preiseVon('p1',preise).map(x=>x.id),['r2','r1'],'eingebaut zuerst');
  const k=Z.kennwertAusPreis(preise[1],{name:'Parkett Eiche geölt'},z,R,P);
  assert.equal(k.kennwert,'189,69 €/m²','185 € × 141,7 / 138,2');
  assert.match(k.kennwert_quelle,/^Produktbibliothek: Parkett Eiche geölt, Angebot eingebaut 185,00 €\/m², Stand 11\/2025, Angebot Schreinerei, 9901 Beispielhaus; Baupreisindex/);
  assert.equal(k.kennwert_beleg,'Angebot eingebaut, Stand 11/2025, fortgeschrieben auf 4. Quartal 2026');
  assert.ok(!/9901|Beispielhaus|Schreinerei/.test(k.kennwert_beleg),'der Beleg nennt keine Herkunft aus anderen Projekten');
  const m=Z.kennwertAusPreis(preise[0],{name:'Parkett'},z,R,P);
  assert.equal(m.eingebaut,false);assert.match(m.hinweis,/Materialpreis/);
  assert.equal(K.leseZahl(k.kennwert),189.69,'der Text bleibt rechenbar');
});

test('Kennwert aus dem Datenpool: derselbe Wert in zwei Kostenberechnungen, fortgeschrieben',()=>{
  const z=Z.ziel({kobe:laufend});
  const eintraege=P.eintraege(instanzen,R);
  const gruppen=Z.poolGruppen(eintraege,P,{text:'Parkett Eiche'});
  assert.ok(gruppen.length>=1);
  const g=gruppen.find(x=>x.epCent===18000n);
  assert.equal(g.kopie,true);
  const k=Z.kennwertAusPool(g,z,R,P);
  assert.equal(k.kennwert,'214,52 €/m²');
  assert.match(k.kennwert_quelle,/^Datenpool: 180,00 €\/m² in 2 Kostenberechnungen, Kostenberechnung 990[12]/);
  assert.match(k.kennwert_quelle,/Kostenstand 3\. Quartal 2022; Baupreisindex 3\. Quartal 2022 → 4\. Quartal 2026 \(118,9 → 141,7\)/);
  assert.equal(k.kennwert_beleg,'Kennwert aus Kostenberechnungen des Büros (Kostenstand 3. Quartal 2022, fortgeschrieben auf 4. Quartal 2026)');
  assert.ok(!/990\d|Beispielhaus|Musterhof/.test(k.kennwert_beleg));
  assert.deepEqual(Z.poolGruppen(eintraege,P,{text:''}),[],'ohne Suchwort keine Treffer');
});

test('Menge und Kennwert aus der Kostenberechnung des Projekts',()=>{
  const liste=Z.positionen(laufend,R,P,'Parkett');
  assert.equal(liste[0].id,'a');
  assert.ok(!Z.positionen(laufend,R,P,'').some(x=>['c','d'].includes(x.id)),'keine Pauschalen, nichts Entfallenes');
  const m=Z.mengeAusPosition(liste[0],laufend,R);
  assert.deepEqual({menge:m.menge,quelle:m.menge_quelle,beleg:m.menge_beleg,ref:m.kobe_ref},
    {menge:'210 m²',quelle:'Kostenberechnung 9903, KG 352, Parkett Wohnräume, Archicad',beleg:'Kostenberechnung, KG 352',ref:'kobe-1:a'});
  const b=Z.mengeAusPosition(Z.positionen(laufend,R,P,'Fliesen')[0],laufend,R);
  assert.equal(b.menge,'38,5 m²');assert.equal(K.leseZahl(b.menge),38.5);
  const k=Z.kennwertAusPosition(liste[0],laufend,R);
  assert.equal(k.kennwert,'180,00 €/m²');
  assert.equal(k.kennwert_beleg,'Ansatz der Kostenberechnung, KG 352');
  assert.deepEqual(Z.positionen(null,R,P,'x'),[],'ohne Kostenberechnung nichts');
});

test('In die Variante: nur die Zahlen, Betrag wieder Kennwert × Menge, Einheiten passen',()=>{
  const o={id:'A',text:'Parkett',betrag:'40000',kosten:'günstiger'};
  const n=Z.setze(o,{kennwert:'214,52 €/m²',kennwert_quelle:'Datenpool …',menge:'210 m²',fremd:'x'});
  assert.equal(n.betrag,'');assert.equal(n.kosten,'günstiger');assert.equal(n.fremd,undefined);
  assert.deepEqual(K.betragVon(n),{cent:4504920n,berechnet:true},'214,52 × 210 = 45.049,20 €');
  assert.equal(Z.einheitPasst(n),true);
  assert.equal(Z.einheitPasst({kennwert:'12,00 €/m',menge:'210 m²'}),false);
  assert.equal(Z.setze(o,{produkt:'BO-01 · Parkett'}).betrag,'40000','nur das Produkt: der Betrag bleibt');
});

test('Romy wählt nur unter Kandidaten; unbekannte Verweise fallen weg',()=>{
  const z=Z.ziel({kobe:laufend});
  const produkte=[{id:'p1',name:'Parkett Eiche geölt',kategorie:'bodenbelag',status:'geprueft'}];
  const preise=[{id:'r2',produkt_id:'p1',art:'angebot_eingebaut',betrag:'185',einheit:'m²',stand:'2025-11-10'}];
  const optionen=[{id:'A',text:'Parkett Eiche, geölt'},{id:'B',text:'Naturstein Platten'}];
  const {liste,karte}=Z.kandidaten(optionen,{produkte,preise,pool:P.eintraege(instanzen,R),kobe:laufend,projektId:'proj-1',z,R,P});
  assert.equal(liste.produkte[0].ref,'p1');assert.equal(liste.produkte[0].preise[0].ref,'pr1');
  assert.ok(liste.pool.length>=2,'Parkett und Naturstein im Datenpool');
  assert.ok(liste.kobe.some(k=>k.bezeichnung==='Parkett Wohnräume'));
  const k1=liste.kobe.find(k=>k.bezeichnung==='Parkett Wohnräume').ref;
  const a=Z.aufloesen({produkt:'p1',kennwert:'pr1',menge:k1},{karte,instanz:laufend,R});
  assert.equal(a.produkt_id,'p1');assert.equal(a.kennwert,'189,69 €/m²');assert.equal(a.menge,'210 m²');assert.equal(a.kobe_ref,'kobe-1:a');
  const b=Z.aufloesen({produkt:'p77',kennwert:'erfunden',menge:'pr1'},{karte,instanz:laufend,R});
  assert.deepEqual(b,{},'nur echte Verweise, eine Menge nur aus der Kostenberechnung');
  const g=liste.pool.find(x=>/Naturstein/.test(x.bezeichnung)).ref;
  assert.equal(Z.aufloesen({kennwert:g},{karte,instanz:laufend,R}).kennwert,'238,35 €/m²','200 € fortgeschrieben');
});

test('Vorschläge ändern an den Varianten nur, was sie nennen; das Dokument nennt nur Belege',()=>{
  const alt=[{id:'A',text:'Parkett',kennwert:'214,52 €/m²',menge:'210 m²',kennwert_quelle:'Datenpool: 180,00 €/m², Kostenberechnung 9901 Beispielhaus',kennwert_beleg:'Kennwert aus Kostenberechnungen des Büros'},
    {id:'B',text:'Naturstein'},{id:'C',text:'Teppich'}];
  const neu=K.optionenZusammen(alt,[{id:'A',text:'Parkett Eiche, geölt',kosten:'Basis'},{id:'B',kennwert:'238,35 €/m²'}]);
  assert.equal(neu.length,3,'C bleibt');
  assert.equal(neu[0].kennwert,'214,52 €/m²','die Zahlen von A bleiben');
  assert.equal(neu[0].text,'Parkett Eiche, geölt');
  assert.equal(K.aenderungText('entscheidungsliste',{optionen:alt},{optionen:[{id:'B',kennwert:'238,35 €/m²'}]}),'Varianten: B: Kennwert – → 238,35 €/m²');
  const d={thema:'Bodenbelag',frage:'Welcher Belag?',optionen:neu.map(o=>o.id==='B'?{...o,menge:'210 m²',menge_beleg:'Kostenberechnung, KG 352'}:o),empfehlung:'A'};
  const inhalt=K.vorlageInhalt({nr:1,daten:{titel:'',punkte:['z1']}},[{id:'z1',nr:2,daten:d}],{projekt:{number:'9903',name:'Neubau Test'},stand:'2026-11-24'});
  const bl=K.vorlageBloecke(inhalt);
  const quellen=bl.find(b=>b.typ==='klein'&&/^Quellen:/.test(b.text)).text;
  assert.match(quellen,/A: Kennwert: Kennwert aus Kostenberechnungen des Büros/);
  assert.match(quellen,/B: Menge: Kostenberechnung, KG 352/);
  assert.ok(!/9901|Beispielhaus/.test(JSON.stringify(bl)),'keine anderen Projekte im Dokument');
  const tabelle=bl.find(b=>b.typ==='tabelle'&&b.varianten);
  assert.equal(tabelle.varianten,'z1');assert.deepEqual(tabelle.ids,['A','B','C']);
  assert.match(K.fundstellenText(alt[0]),/Kostenberechnung 9901 Beispielhaus/,'die Fundstelle bleibt im Büro');
});
