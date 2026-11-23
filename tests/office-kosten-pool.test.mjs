// Datenpool der Kostenberechnung (23.11.2026): Kennwerte aus eigenen Projekten, mit Herkunft.
// Synthetische Kostenberechnungen, neutrale Titel, keine Projektdaten. Geprüft wird ohne Netz:
// Einträge und Herkunft, Suche mit verwandter KG und Filtern, gleiche Werte zählen einmal (Ursprung = ältester Stand),
// Spanne und Median mit Ausreißer, Fortschreiben über den Baupreisindex, Übernahme als «Eigenes Projekt»,
// Kostenarchiv (KG 300, je m² BGF, Herkunft), übernommene Ansätze und auffällige Werte.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const R=require('../kosten-rechnen.js'),P=require('../kosten-pool.js');

const kat=[{kg:'300',titel:'G3'},{kg:'320',titel:'G32'},{kg:'324',titel:'G324'},{kg:'330',titel:'G33'},{kg:'335',titel:'G335'},
  {kg:'340',titel:'G34'},{kg:'345',titel:'Gruppe Wand innen'},{kg:'350',titel:'G35'},{kg:'353',titel:'G353'}];
function inst(id,nr,{archiv=true,kostenstand='2022-Q3',meta={},positionen=[],bezug={}}={}){
  return {id,project_number:nr,project_name:'Ort '+nr,is_archived:archiv,state:{schema:R.SCHEMA,ustProzent:'19',kostenstand,indizes:[],
    katalog:kat,positionen,elemente:[],gruppen:{},bezug,regionalfaktor:{wert:''},zuschlag:{wert:''},
    archiv:archiv?{reifegrad:'berechnung',stand:'2022-09-19',dokumentKurz:'Prognose 19.09.2022',massnahme:'Neubau',...meta}:undefined}};
}
const pos=(id,kg,titel,menge,einheit,wert,{art='annahme',ks='',p={},kw={}}={})=>({id,kg,titel,modus:'menge',menge,einheit,
  mengenquelle:{art:'manuell'},kennwert:{art,wert,kostenstand:ks,fundstelle:art==='annahme'?'':'Zeile 1',...kw},...p});
const A=inst('a','T-11',{positionen:[
  pos('a1','353','Belag Holz Eiche','100','m²','180',{p:{archivZeile:10}}),
  pos('a2','324','Belag Holz','50','m²','180',{p:{archivZeile:11}}),
  pos('a3','335','Dämmplatte XPS 140 mm','75','m²','40',{p:{archivZeile:12,archivKommentar:'geschätzt'}}),
  pos('a4','335','Dämmplatte XPS 160 mm','50','m²','42',{p:{archivZeile:13}}),
  {id:'a5',kg:'335',titel:'Pauschale',modus:'betrag',betrag:'1000',kennwert:{art:'annahme'}},
  pos('a6','345','Wandfliese','20','m²','110',{art:'eigen',p:{archivZeile:15,archivAbgerechnet:true}})],bezug:{BGF:'100'}});
const B=inst('b','T-12',{kostenstand:'2026-Q4',meta:{reifegrad:'fortschreibung',stand:'2026-10-30',dokumentKurz:'Fortschreibung 30.10.2026'},positionen:[
  pos('b1','353','Belag Holz','110','m²','180',{p:{archivZeile:20}}),
  pos('b2','335','Dämmplatte XPS 140 mm','75','m²','188',{p:{archivZeile:21,status:'entfaellt',archivNichtInSumme:true}}),
  pos('b3','345','Gruppe Wand innen','15','m²','20',{p:{archivZeile:22,archivKommentar:'Fliesen Bad'}}),
  pos('b4','353','Zementestrich','120','m²','32',{art:'angebot',p:{archivZeile:23,archivKommentar:'nach Angebot'}})]});
const C=inst('c','T-13',{archiv:false,kostenstand:'2026-Q4',positionen:[
  pos('c1','353','Belag Holz, Diele','30','m²','238',{art:'bki',kw:{fundstelle:'BKI, S. 1'}})]});
const D=inst('d','T-14',{kostenstand:'2025-Q4',meta:{massnahme:'Bestand',stand:'2025-11-10',dokumentKurz:'Arbeitsstand 10.11.2025'},positionen:[
  pos('d1','353','Belag Holz Bestand ausbessern','40','m²','50',{p:{archivSeite:10}})]});
const ALLE=[A,B,C,D];
const E=P.eintraege(ALLE,R);

test('Einträge: nur Einheitspreise, netto, mit Herkunft und Reifegrad',()=>{
  assert.equal(E.length,11,'die Pauschale ist kein Kennwert');
  const e=id=>E.find(x=>x.position===id);
  assert.equal(e('c1').epCent,20000n,'BKI brutto 238 € ÷ 1,19 = 200 € netto');
  assert.equal(e('a1').herkunft,'ohne');assert.equal(e('a3').herkunft,'geschaetzt');assert.equal(e('b4').herkunft,'angebot');
  assert.equal(e('a6').herkunft,'abgerechnet');assert.equal(e('a6').reifegrad,'feststellung');assert.equal(e('c1').herkunft,'bki');
  assert.equal(e('b2').nichtInSumme,true);assert.equal(e('b1').reifegrad,'fortschreibung');assert.equal(e('c1').reifegrad,'laufend');
  assert.equal(e('a1').quelle,'Zeile 10');assert.equal(e('d1').quelle,'PDF S. 10');
  // Steht nur der Titel der Kostengruppe da, beschreibt der Kommentar die Leistung.
  assert.equal(e('b3').bez,'Fliesen Bad');assert.equal(e('a1').bez,'Belag Holz Eiche');
});

test('Suche: Kostengruppe, verwandte KG, Einheit, nur Angebote, nur Neubau',()=>{
  const ids=t=>t.map(x=>x.e.position).sort();
  assert.deepEqual(ids(P.suche(E,{text:'Holz',kg:'353',einheit:'m²'})),['a1','b1','c1','d1']);
  assert.deepEqual(ids(P.suche(E,{text:'Holz',kg:'353',verwandt:true,einheit:'m²'})),['a1','a2','b1','c1','d1']);
  assert.deepEqual(ids(P.suche(E,{text:'Holz',kg:'353',verwandt:true,einheit:'m²',nurNeubau:true})),['a1','a2','b1','c1']);
  assert.deepEqual(ids(P.suche(E,{text:'Holz',kg:'353',nurAngebote:true})),[]);
  assert.deepEqual(ids(P.suche(E,{text:'Estrich',kg:'353',nurAngebote:true})),['b4']);
  assert.deepEqual(ids(P.suche(E,{text:'Holz',kg:'353',einheit:'m²',ohneInstanz:'c'})),['a1','b1','d1'],'die eigene Kostenberechnung zählt nicht');
  assert.deepEqual(ids(P.suche(E,{text:'Holz',alleKg:true,einheit:'m²'})),['a1','a2','b1','c1','d1']);
  assert.deepEqual(ids(P.suche(E,{text:'Holz',kg:'353',einheit:'St'})),[],'andere Einheit nur auf Wunsch');
  assert.equal(P.suche(E,{text:'Holz',kg:'353',einheit:'St',andereEinheiten:true}).every(t=>t.passt===false),true);
});

test('Gleicher Wert in zwei Kostenberechnungen zählt einmal; Ursprung ist der älteste Stand',()=>{
  const g=P.gruppiere(P.suche(E,{text:'Holz',kg:'353',verwandt:true,einheit:'m²'}));
  const holz=g.find(x=>x.epCent===18000n);
  assert.equal(holz.vorkommen.length,3);assert.equal(holz.projekte.length,2);assert.equal(holz.kopie,true);
  assert.equal(holz.ursprung.instanz,'a');assert.equal(holz.ursprung.kostenstand,'2022-Q3');
  assert.equal(g.length,3,'drei unabhängige Werte: 180, 200, 50');
});

test('Spanne, Median, Ausreißer markiert; Fortschreiben nur mit Index',()=>{
  const g=P.gruppiere(P.suche(E,{text:'Holz',kg:'353',verwandt:true,einheit:'m²'}));
  const ohne=P.statistik(g,{schema:R.SCHEMA,kostenstand:'2026-Q4',indizes:[]},R);
  assert.equal(ohne.n,3);assert.equal(ohne.minCent,5000n);assert.equal(ohne.maxCent,20000n);assert.equal(ohne.medianCent,18000n);
  assert.equal(ohne.stand,'ohneIndex');
  assert.ok(ohne.auffaellig.has('m²|5000'),'50 € liegt unter Median ÷ 2,5');
  const mit=P.statistik(g,{schema:R.SCHEMA,kostenstand:'2026-Q4',indizes:[{quartal:'2022-Q3',wert:'100'},{quartal:'2025-Q4',wert:'115'},{quartal:'2026-Q4',wert:'120'}]},R);
  assert.equal(mit.stand,'fortgeschrieben');
  assert.equal(mit.maxCent,21600n,'180 € × 120/100 = 216 €');
  const n=P.normiere(18000n,'2022-Q3',{schema:R.SCHEMA,kostenstand:'2026-Q4',indizes:[{quartal:'2022-Q3',wert:'100'},{quartal:'2026-Q4',wert:'120'}]},R);
  assert.equal(n.cent,21600n);assert.equal(n.faktor,1.2);
});

test('Übernahme als Kennwert «Eigenes Projekt»: Fundstelle, Kostenstand des Ursprungs, Rechenkern schreibt fort',()=>{
  const g=P.gruppiere(P.suche(E,{text:'Holz',kg:'353',einheit:'m²'})).find(x=>x.epCent===18000n);
  const kw=P.uebernahme(g,R);
  assert.equal(kw.art,'eigen');assert.equal(kw.wert,'180');assert.equal(kw.kostenstand,'2022-Q3');
  assert.equal(kw.fundstelle,'Kostenberechnung T-11 Ort T-11, Zeile 10 (Prognose 19.09.2022) · gleicher Wert auch in T-12');
  assert.deepEqual(kw.pool,{instanz:'a',position:'a1'});
  const ziel={schema:R.SCHEMA,ustProzent:'19',kostenstand:'2026-Q4',indizes:[{quartal:'2022-Q3',wert:'100'},{quartal:'2026-Q4',wert:'120'}],
    katalog:kat,positionen:[{id:'z',kg:'353',titel:'Belag',modus:'menge',menge:'10',einheit:'m²',mengenquelle:{art:'archicad'},kennwert:kw}],regionalfaktor:{wert:''},zuschlag:{wert:''}};
  const r=R.berechne(ziel).positionen[0];
  assert.equal(r.status,'vollstaendig');assert.equal(r.kennwertCent,21600n);assert.equal(r.betragCent,216000n);
  // Herkunft im Original wird mitgenommen, wenn sie mehr ist als eine Annahme.
  const est=P.gruppiere(P.suche(E,{text:'Estrich',kg:'353'}))[0];
  assert.match(P.uebernahme(est,R).fundstelle,/· dort: Angebot$/);
});

test('Kostenarchiv: KG 300, je m² BGF und Herkunft der Preise',()=>{
  const z=P.archivZeilen([A,B,D],R);
  const a=z.find(x=>x.id==='a');
  const kg300=R.berechne(A.state).knoten.get('300').bekanntCent;
  assert.equal(a.kg300Cent,kg300);assert.equal(a.jeBgfCent,R.teile(kg300*1000000n,R.mikro('100')));
  assert.deepEqual(a.herkunft,{ohne:4,geschaetzt:1,abgerechnet:1},'auch die Pauschale hat eine Herkunft');
  assert.equal(a.positionen,6);assert.equal(z.find(x=>x.id==='b').inSumme,3);
  assert.equal(z.find(x=>x.id==='d').jeBgfCent,null,'ohne BGF keine Kennzahl');
  assert.deepEqual(z.map(x=>x.id),['b','d','a'],'neueste zuerst');
});

test('Übernommen statt neu ermittelt, und auffällige Werte (ein Paar nur einmal)',()=>{
  const u=P.uebernommen(E);
  const holz=u.find(x=>x.epCent===18000n);
  assert.ok(holz,'180 €/m² in zwei Kostenberechnungen');assert.deepEqual(holz.projekte.sort(),['T-11','T-12']);
  assert.equal(holz.vorkommen.length,3);assert.equal(holz.von,2022);assert.equal(holz.bis,2026);
  const a=P.auffaellig(E);
  const xps=a.filter(x=>x.e.titelText.includes('xps'));
  assert.equal(xps.length,1,'XPS 188 gegen 40 und 42: ein Fall');
  assert.equal(xps[0].e.position,'b2');assert.equal(xps[0].minCent,4000n);assert.equal(xps[0].maxCent,4200n);
  assert.deepEqual(xps[0].vergleich,['T-11']);
});
