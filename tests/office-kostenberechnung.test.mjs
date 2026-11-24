// Kostenberechnung LPH 3 als Werkzeug im Office (21.11.2026, Gari: «implementarlo ya como tool en Office»).
//
// Geprüft wird ohne Netz und ohne Produktion:
// - Rechenkern (kosten-rechnen.js): Cent als BigInt, kaufmännisch gerundet, fehlend ist nicht 0,
//   Herkunftskette (USt, Baupreisindex, Regionalfaktor, Zuschlag), was noch fehlt, Vergleich.
// - Zahlen lesen: gespeicherte Werte mit Punkt, Eingaben deutsch («1.045» im Stand ist 1,045).
// - Archicad-Import (kosten-import.js) mit einem synthetischen Export: Spalten, Summen, Rezepte, Abgleich.
// - Seite, Werkzeugkarte, Migration mit RLS, und dass das öffentliche Repository weder DIN-Titel
//   noch Projektdaten enthält (die Gliederung liegt als Muster in der Datenbank).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const url=p=>new URL('../'+p,import.meta.url);
const read=p=>readFileSync(url(p),'utf8');
const R=require('../kosten-rechnen.js'),I=require('../kosten-import.js');
const seite=read('kostenberechnung.html'),ui=read('kostenberechnung.js'),css=read('kostenberechnung.css');
const shell=read('app/shell.js'),projekte=read('app/office-projects.js'),index=read('app/index.html');
const MIGRATION='supabase/migrations/20261121100000_office_kostenberechnung_v1.sql';
const sql=read(MIGRATION),abnahme=read('tests/sql/office-kostenberechnung-rls-acceptance.sql');

const basis=(extra={})=>({schema:R.SCHEMA,ustProzent:'19',kostenstand:'2027-Q1',indizes:[],regionalfaktor:{wert:''},zuschlag:{wert:''},
  katalog:[{kg:'100',titel:'A'},{kg:'110',titel:'A1'},{kg:'300',titel:'B'},{kg:'330',titel:'B3'},{kg:'331',titel:'B31'},{kg:'335',titel:'B35'},
    {kg:'336',titel:'B36'},{kg:'400',titel:'C'},{kg:'410',titel:'C1'}],positionen:[],...extra});
const bki=(id,kg,menge,wert,mehr={})=>({id,kg,modus:'menge',menge,einheit:'m²',mengenquelle:{art:'archicad'},
  kennwert:{art:'bki',wert,fundstelle:'BKI, S. 1',...mehr}});

test('Herkunftskette: brutto → Baupreisindex → Regionalfaktor, auf den Cent',()=>{
  const st=basis({indizes:[{quartal:'2025-Q4',wert:'120'},{quartal:'2027-Q1',wert:'126'}],regionalfaktor:{wert:'1.045',fundstelle:'BKI'},
    positionen:[bki('a','331','238.75','250',{kostenstand:'2025-Q4'})]});
  const e=R.berechne(st),p=e.positionen[0];
  // 250 ÷ 1,19 = 210,084034 · × 126/120 = 220,588236 · × 1,045 = 230,514707 → 230,51 €/m²
  assert.deepEqual(p.kette.schritte.map(s=>s.art),['start','ust','index','region','ende']);
  assert.deepEqual(p.kette.schritte.map(s=>s.ergebnis),[250000000n,210084034n,220588236n,230514707n,230510000n]);
  assert.equal(p.kennwertCent,23051n);
  assert.equal(p.betragCent,5503426n);                      // 238,75 m² × 230,51 € = 55.034,2625 → 55.034,26 €
  assert.equal(e.ustCent,1045651n);                         // 19 % von 55.034,26 € = 10.456,5094 → 10.456,51 €
  assert.equal(e.bruttoCent,6549077n);
  assert.equal(R.euro(p.betragCent),'55.034\u202f€');            // schmales geschütztes Leerzeichen
  assert.equal(R.euro(p.betragCent,{nachkomma:true}),'55.034,26\u202f€');
});

test('Baupreisindex: ein noch nicht veröffentlichtes Quartal rechnet mit dem letzten Wert und sagt es',()=>{
  // Reihe bis 3. Quartal 2026 (Destatis veröffentlicht etwa sechs Wochen nach dem Berichtsmonat).
  const indizes=[{quartal:'2022-Q3',wert:'118.9'},{quartal:'2026-Q2',wert:'140.3'},{quartal:'2026-Q3',wert:'141.7'},{quartal:'2025-Q4',wert:''}];
  const st=basis({kostenstand:'2026-Q4',indizes,positionen:[bki('a','331','10','119',{kostenstand:'2022-Q3',brutto:false,regional:false})]});
  const e=R.berechne(st),p=e.positionen[0],idx=p.kette.schritte.find(s=>s.art==='index');
  // 119 × 141,7 / 118,9 = 141,82 €
  assert.equal(p.kennwertCent,14182n);
  assert.equal(idx.text,'Baupreisindex 3. Quartal 2022 → 4. Quartal 2026');
  assert.equal(idx.vorlaeufig,'2026-Q3');
  assert.equal(idx.detail,'4. Quartal 2026 noch nicht veröffentlicht: gerechnet mit dem letzten Wert, 3. Quartal 2026 (141,7)');
  assert.deepEqual(p.hinweise,['index_vorlaeufig']);
  assert.equal(p.status,'vollstaendig','vorläufig ist nicht offen');
  // In «Was fehlt» einmal, als Hinweis, nicht als offener Punkt.
  const g=e.fehlt.filter(f=>f.code==='index_vorlaeufig');
  assert.equal(g.length,1);assert.equal(g[0].schwere,'info');assert.equal(g[0].anzahl,1);
  assert.ok(!e.fehlt.some(f=>f.code==='index_fehlt'));
  // Liegt auch die Quelle hinter dem letzten Wert, ist der Faktor 1.
  const beide=R.kennwertKette({art:'eigen',wert:'100',kostenstand:'2026-Q4',fundstelle:'x'},{...st,kostenstand:'2027-Q1'});
  assert.equal(R.textAusMikro(beide.schritte.find(s=>s.art==='index').faktor),'1');
  assert.match(beide.schritte.find(s=>s.art==='index').detail,/^4\. Quartal 2026 und 1\. Quartal 2027 noch nicht veröffentlicht/);
  // Eine Lücke in der Reihe oder ein Quartal vor ihrem Anfang: weiter «fehlt», ohne Ersatzwert.
  for(const q of ['2024-Q1','2021-Q1','2025-Q4']){
    const k=R.kennwertKette({art:'eigen',wert:'100',kostenstand:q,fundstelle:'x'},st);
    assert.deepEqual(k.hinweise,['index_fehlt'],q);assert.ok(!k.schritte.some(s=>s.art==='index'),q);
  }
  // Der veröffentlichte Wert hat Vorrang: kein Hinweis, wenn das Quartal in der Reihe steht.
  const genau=R.kennwertKette({art:'eigen',wert:'100',kostenstand:'2022-Q3',fundstelle:'x'},{...st,kostenstand:'2026-Q2'});
  assert.deepEqual(genau.hinweise,[]);assert.equal(genau.schritte.find(s=>s.art==='index').vorlaeufig,undefined);
});

test('gespeicherte Zahlen mit Punkt, Eingaben deutsch',()=>{
  // Der Fehler, den diese Trennung verhindert: «1.045» im Stand als 1045 gelesen.
  assert.equal(R.dezimal('1.045'),'1.045');
  assert.equal(R.dezimal('5.125'),'5.125');
  assert.equal(R.dezimal('1.234,56'),'1234.56');
  assert.equal(R.eingabe('1.045'),'1045');
  assert.equal(R.eingabe('1,045'),'1.045');
  assert.equal(R.eingabe('1.250'),'1250');
  assert.equal(R.eingabe('1.234,56 €'),'1234.56');
  assert.equal(R.eingabe('12 m²'),'12');
  assert.equal(R.eingabe(',5'),'0.5');
  assert.equal(R.eingabe(''),null);
  assert.equal(R.eingabe('zwölf'),undefined);
  const st=basis({regionalfaktor:{wert:'1.045'},positionen:[bki('a','331','10','100')]});
  const region=R.berechne(st).positionen[0].kette.schritte.find(s=>s.art==='region');
  assert.equal(R.textAusMikro(region.faktor),'1.045');
  // Die Seite liest Eingaben deutsch und fängt Tippfehler beim Regionalfaktor ab.
  assert.match(ui,/const d=R\.eingabe\(wert\);if\(d===undefined\)/);
  assert.match(ui,/'regionalfaktor\.wert':\[0\.3,3,/);
  assert.ok(!/R\.dezimal\(wert\)/.test(ui),'eine Eingabe wird nicht deutsch gelesen');
});

test('kaufmännisch gerundet, und fehlend ist nicht 0',()=>{
  const rund=R.berechne(basis({positionen:[{id:'r',kg:'331',modus:'menge',menge:'1.005',einheit:'m²',mengenquelle:{art:'manuell'},
    kennwert:{art:'annahme',wert:'1'}}]})).positionen[0];
  assert.equal(rund.betragCent,101n);                       // 1,005 € → 1,01 €
  const offen=R.berechne(basis({positionen:[{id:'o',kg:'331',modus:'menge',menge:null,mengenquelle:{art:'archicad'},kennwert:{art:'annahme',wert:'80'}}]}));
  assert.equal(offen.positionen[0].betragCent,null);
  assert.equal(offen.positionen[0].status,'offen');
  assert.equal(offen.gesamt.vollstaendig,false);
  assert.equal(offen.gesamt.gesamtCent,null);
  const null0=R.berechne(basis({positionen:[{id:'n',kg:'331',modus:'menge',menge:'0',mengenquelle:{art:'manuell'},kennwert:{art:'annahme',wert:'80'}}]}));
  assert.equal(null0.positionen[0].betragCent,0n);
  assert.equal(null0.positionen[0].status,'vollstaendig');
  // Text der offenen Position: geordnet und in einem Satz.
  const t=R.berechne(basis({positionen:[{id:'t',kg:'331',modus:'menge',menge:null,kennwert:{}}]})).fehlt.find(f=>f.positionId==='t').text;
  assert.equal(t,'KG 331 B31: Menge, Kennwert, Herkunft der Menge und Quelle fehlen');
});

test('was entfällt, zählt weder zur Summe noch als offen',()=>{
  const st=basis({gruppen:{'100':{status:'entfaellt',notiz:'trägt der Bauherr'}},positionen:[
    {id:'g',kg:'110',modus:'betrag',betrag:'50000',kennwert:{art:'annahme'}},
    bki('a','331','100','200',{brutto:false}),{...bki('x','335','100','40'),status:'entfaellt'},bki('y','336','100','30',{brutto:false}),
    {id:'f',kg:'410',modus:'betrag',betrag:'12000',kennwert:{art:'fachplanung',fundstelle:'Kostenbeitrag HLS'}}]});
  const e=R.berechne(st);
  assert.equal(e.positionen.find(p=>p.id==='g').ausgeschlossen,true);
  assert.equal(e.knoten.get('100').status,'entfaellt');
  assert.equal(e.positionen.find(p=>p.id==='x').status,'entfaellt');
  assert.equal(e.gesamt.bekanntCent,2000000n+300000n+1200000n);
  assert.equal(e.knoten.get('300').bekanntCent,2300000n);
  assert.equal(e.knoten.get('330').anzahl,3);
  assert.equal(e.vollstaendigkeit.prozent,100);
});

test('was noch fehlt: Grundlagen einmal, Bekleidung, Bezugsfläche, Abweichung ohne Ursache',()=>{
  const st=basis({positionen:[bki('a','331','100','200',{brutto:false}),bki('b','331','50','210',{brutto:false})],kostenschaetzung:{'300':'25000'}});
  let e=R.berechne(st);
  const region=e.fehlt.filter(f=>f.code==='regionalfaktor_fehlt');
  assert.equal(region.length,1,'der fehlende Regionalfaktor steht je Position statt einmal');
  assert.equal(region[0].art,'grundlage');assert.equal(region[0].anzahl,2);assert.equal(region[0].schwere,'hoch');
  assert.match(region[0].text,/betrifft 2 Positionen$/);
  assert.ok(e.fehlt.some(f=>f.art==='paar'&&f.kg==='335'),'331 ohne 335/336 wird nicht bemerkt');
  assert.ok(e.fehlt.some(f=>f.art==='bezug'));
  // 300: Kostenschätzung 25.000 €, Kostenberechnung 30.500 € → +22 % ohne Ursache.
  const v=e.vergleich.find(x=>x.kg==='300');
  assert.equal(v.deltaCent,550000n);assert.equal(v.deltaProzent,22);
  assert.ok(e.fehlt.some(f=>f.art==='ursache'&&f.kg==='300'&&f.schwere==='hoch'));
  e=R.berechne({...st,ursachen:{'300':'Mehr Außenwandfläche nach Entwurfsänderung'},regionalfaktor:{wert:'1,02'}});
  assert.ok(!e.fehlt.some(f=>f.art==='ursache'));
  assert.ok(!e.fehlt.some(f=>f.code==='regionalfaktor_fehlt'));
  assert.equal(e.ksSummeCent,2500000n);
  assert.deepEqual(R.rezeptVorschlag('331').map(z=>z.kg),['331','335','336']);
});

test('3. Ebene: jede Kostengruppe hat einen Stand, «vorläufig» bis alle geklärt sind',()=>{
  // Gliederung wie im Muster: 1. bis 3. Ebene; «Sonstiges zur KG …» ist optional.
  const katalog=[['300','B'],['330','B3'],['331','a'],['332','b'],['333','c'],['339','So',true],['340','B4'],['341','d'],['349','So',true],
    ['400','C'],['410','C1'],['411','e'],['412','f'],['419','So',true],['600','D'],['610','D1'],['620','D2']].map(([kg,titel,optional])=>({kg,titel,...(optional?{optional}:{})}));
  const st={schema:R.SCHEMA,ustProzent:'19',katalog,gruppen:{'333':{status:'entfaellt',notiz:'keine Außenstützen'},'340':{status:'entfaellt'}},positionen:[
    {id:'a',kg:'331',modus:'betrag',betrag:'1000',kennwert:{art:'annahme'}},
    {id:'h',kg:'410',modus:'betrag',betrag:'5000',kennwert:{art:'fachplanung',fundstelle:'Kostenbeitrag HLS'}},
    {id:'x',kg:'341',modus:'betrag',betrag:'99',kennwert:{art:'annahme'}}]};
  let e=R.berechne(st);
  assert.deepEqual(Object.fromEntries(e.blaetter),{'331':'vollstaendig','332':'leer','333':'entfaellt','339':'frei','341':'entfaellt','349':'entfaellt',
    '411':'enthalten','412':'enthalten','419':'enthalten','610':'leer','620':'leer'});
  // Was in einer entfallenden Gruppe steht, zählt nicht.
  assert.equal(e.positionen.find(p=>p.id==='x').ausgeschlossen,true);
  assert.equal(e.gesamt.bekanntCent,600000n);
  assert.equal(e.knoten.get('330').zuKlaeren,1);assert.equal(e.knoten.get('330').status,'offen');
  assert.equal(e.knoten.get('340').status,'entfaellt');assert.equal(e.knoten.get('410').status,'vollstaendig');
  assert.deepEqual(e.vollstaendigkeit,{erledigt:7,gesamt:10,prozent:70,nachKg:true});
  assert.equal(e.gesamt.vollstaendig,false);assert.equal(e.gesamt.ohneAnsatz,3);
  // Offene Kostengruppen einmal je Eltern-KG, mit ihren Nummern.
  const leer=e.fehlt.filter(f=>f.art==='leer');
  assert.deepEqual(leer.map(f=>[f.kg,f.kgs]),[['330',['332']],['600',['610','620']]]);
  assert.equal(leer[1].text,'KG 600 D: 610, 620 ohne Ansatz');
  // Geklärt: 332 entfällt, 600 als Pauschale.
  st.gruppen['332']={status:'entfaellt'};
  st.positionen.push({id:'p6',kg:'600',modus:'betrag',betrag:'2000',kennwert:{art:'annahme'}});
  e=R.berechne(st);
  assert.equal(e.blaetter.get('610'),'enthalten');
  assert.equal(e.gesamt.vollstaendig,true);
  assert.equal(e.gesamt.gesamtCent,800000n);
  // Pauschale und Einzelposition in derselben KG: Warnung «doppelt».
  st.positionen.push({id:'d',kg:'411',modus:'betrag',betrag:'100',kennwert:{art:'annahme'}});
  e=R.berechne(st);
  assert.ok(e.fehlt.some(f=>f.art==='doppelt'&&f.kg==='410'));
  assert.equal(e.blaetter.get('411'),'vollstaendig');
  assert.deepEqual(R.kette('331'),['300','330','331']);
  assert.ok(R.liegtUnter('331','300')&&R.liegtUnter('331','330')&&!R.liegtUnter('341','330')&&!R.liegtUnter('330','330'));
});

test('die Seite zeigt jede Kostengruppe der Gliederung, nicht nur solche mit Positionen',()=>{
  // Gari, 21.11.: «para el KG 330 deben aparecer las posiciones del 331 … 339, lo mismo para todos los demás KG».
  assert.match(ui,/function zeilenKnoten\(k,ergebnis,nurOffen,mitKopf\)\{\s*const kinder=kinderVon\(k\.kg\);/);
  assert.match(ui,/for\(const c of kinder\)innen\+=zeilenKnoten\(c,ergebnis,nurOffen,R\.ebene\(c\.kg\)===2\);/);
  assert.match(ui,/for\(const y of kinderVon\(x\.kg\)\)zeilen\+=zeileUebersicht\(y,'sub2'/);
  assert.match(ui,/<h3>Kostenberechnung bis zur 3\. Ebene<\/h3>/);
  for(const t of ['ohne Ansatz','in Pauschale','Übrige ','Pauschale für die ganze KG','Position anlegen','Wieder aufnehmen','Kostengruppen geklärt'])
    assert.ok(ui.includes(t),'fehlt: '+t);
  // Die Gliederung kommt aus dem Stand; im Code steht keine Liste von Kostengruppen.
  assert.ok(!/['"]33[1-9]['"]\s*,\s*['"]33[1-9]['"]/.test(ui),'eine Liste von Kostengruppen im Code');
});

test('Archicad: der synthetische Export wird gelesen, summiert und mit Rezept verteilt',async()=>{
  const zeilen=await I.leseXlsx(readFileSync(url('tests/fixtures/kosten-archicad-beispiel.xlsx')));
  const spalten=I.erkenneSpalten(zeilen);
  assert.equal(spalten.kopfzeile,1);
  assert.equal(spalten.flaeche.length,2);
  const g=I.gruppiere(zeilen,spalten);
  assert.equal(g.gelesen,7);assert.equal(g.ohneKg,2);assert.equal(g.zahlformat,'punkt');
  const aw=g.gruppen.find(x=>x.schluessel==='331|AW-01');
  assert.deepEqual(aw.mengen,{flaeche:'238.75',laenge:'92.4',volumen:'41.78',anzahl:'8'});
  assert.equal(g.gruppen.find(x=>x.schluessel==='351|DE-01').mengen.volumen,'40.13');
  const st=basis({rezepte:{'AW-01':{einheit:'m²',zeilen:[{kg:'331',faktor:'1'},{kg:'335',faktor:'1'},{kg:'336',faktor:'1'}]}}});
  const erst=I.anwenden(st,g.gruppen,{datum:'2027-01-29',datei:'TBA Kosten Mengen.xlsx',zeilen:g.gelesen});
  assert.deepEqual(erst.bericht,{neu:7,aktualisiert:0,entfernt:0});
  for(const kg of ['331','335','336']){
    const p=erst.state.positionen.find(x=>x.id==='ac:AW-01:'+kg);
    assert.equal(p.menge,'238.75');assert.equal(p.einheit,'m²');assert.equal(p.mengenquelle.art,'archicad');
  }
  assert.equal(st.positionen.length,0,'der Import verändert den alten Stand');
  // Kennwert eintragen, Modell ändern, neu einlesen: der Kennwert bleibt, die Menge folgt dem Modell.
  const fe=erst.state.positionen.find(x=>x.id==='ac:FE-01:334');
  fe.kennwert={art:'angebot',wert:'780',fundstelle:'Richtpreis Fensterbauer'};
  const ohneDach=g.gruppen.filter(x=>x.kg!=='361').map(x=>x.schluessel==='334|FE-01'?{...x,mengen:{...x.mengen,flaeche:'21.5'}}:x);
  const zweit=I.anwenden(erst.state,ohneDach,{datum:'2027-02-05'});
  const fe2=zweit.state.positionen.find(x=>x.id==='ac:FE-01:334');
  assert.equal(fe2.menge,'21.5');assert.equal(fe2.kennwert.wert,'780');
  assert.equal(zweit.bericht.entfernt,1);
  assert.equal(zweit.state.positionen.find(x=>x.id==='ac:DA-01:361').ausImportEntfernt,true);
  assert.ok(R.berechne(zweit.state).fehlt.some(f=>f.code==='nicht_mehr_im_modell'&&f.kg==='361'));
  const vgl=I.vergleiche(erst.state.importe[0].gruppen,zweit.state.importe[0].gruppen);
  assert.deepEqual(vgl.find(x=>x.schluessel==='334|FE-01'),{schluessel:'334|FE-01',kg:'334',bauteiltyp:'FE-01',art:'geaendert',einheit:'m²',alt:'19.2',neu:'21.5',delta:'2.3'});
  assert.equal(vgl.find(x=>x.schluessel==='361|DA-01').art,'entfernt');
  assert.equal(zweit.state.importe.length,2);
});

test('Archicad als CSV: deutsche Zahlen werden erkannt',()=>{
  const de=I.leseCsv('Klassifizierung;TBA Bauteiltyp;Fläche;Volumen;Anzahl\n331 X;AW-01;1.234,50;5,125;2\n331 X;AW-01;10;1.000,5;1\n');
  const g=I.gruppiere(de,I.erkenneSpalten(de));
  assert.equal(g.zahlformat,'deutsch');
  assert.deepEqual(g.gruppen[0].mengen,{flaeche:'1244.5',laenge:null,volumen:'1005.625',anzahl:'3'});
  const en=I.leseCsv('Klassifizierung,TBA Bauteiltyp,Area,Volume\n331 X,AW-01,1234.5,5.125\n');
  const g2=I.gruppiere(en,I.erkenneSpalten(en));
  assert.equal(g2.zahlformat,'punkt');
  assert.equal(g2.gruppen[0].mengen.volumen,'5.125');
  assert.throws(()=>I.gruppiere([['Name','Fläche']],I.erkenneSpalten([['Name','Fläche']])),/keine Spalte mit der Kostengruppe/);
});

test('Archicad: die Spaltenköpfe der Anleitung (Teil III) werden erkannt',()=>{
  // Felder der Auswertung «TBA Kosten · Mengen», wie Archicad sie in die Kopfzeile schreibt; die ARCHICAD-Klassifizierung daneben stört nicht.
  const kopf=['ARCHICAD-Klassifizierung','DIN 276:2018-12 (TBA)','Bauteiltyp','Baustoff/Mehrschichtiger Aufbau/Profil','Elementtyp','Ausgangsgeschoss','Anzahl','Wandfläche netto','Oberfläche','Länge','Volumen netto'];
  const zeilen=[kopf,['Wand','331','AW-01','AW-01 KS 17,5 + WDVS 16','Wand','EG','2','120.5','','24','21.1'],['Rohbaudecke','351','DE-01','Stahlbeton 22','Decke','EG','1','','80','','17.6']];
  const s=I.erkenneSpalten(zeilen);
  assert.deepEqual([s.kg,s.bauteiltyp,s.aufbau,s.elementtyp,s.geschoss,s.anzahl,s.flaeche,s.laenge,s.volumen],[1,2,3,4,5,6,[7,8],9,10]);
  const g=I.gruppiere(zeilen,s).gruppen;
  assert.deepEqual(g.map(x=>[x.kg,x.bauteiltyp,x.mengen.flaeche]),[['331','AW-01','120.5'],['351','DE-01','80']]);
});

test('Klassifizierung für Archicad: Format des Klassifizierungs-Managers, Gliederung aus dem Stand',()=>{
  // Erfundene Bezeichnungen: die echten kommen aus dem Muster in der Datenbank.
  const katalog=[{kg:'100',titel:'Gruppe 100'},{kg:'200',titel:'Gruppe 200'},{kg:'210',titel:'Gruppe 210'},{kg:'212',titel:'Gruppe 212'},
    {kg:'300',titel:'Gruppe 300'},{kg:'330',titel:'Gruppe 330'},{kg:'331',titel:'Gruppe 331 & <Test>'},{kg:'335',titel:'Gruppe 335'},
    {kg:'349',titel:'Gruppe 349 ohne 340'},{kg:'600',titel:'Gruppe 600'},{kg:'700',titel:'Gruppe 700'},{kg:'800',titel:'Gruppe 800'},{kg:'331',titel:'doppelt'}];
  const xml=I.klassifizierungXml(katalog);
  assert.match(xml,/^<\?xml version="1\.0" encoding="UTF-8" standalone="no" \?>\n<BuildingInformation>\n\t<Classification>\n\t\t<System>\n\t\t\t<Name>DIN 276:2018-12 \(TBA\)<\/Name>/);
  assert.match(xml,/<EditionVersion>2018-12<\/EditionVersion>/);
  assert.equal(I.SYSTEM_NAME,'DIN 276:2018-12 (TBA)');
  // Nur 200 bis 600, jede Nummer einmal, in der Reihenfolge der Gliederung.
  assert.deepEqual([...xml.matchAll(/<ID>(\d+)<\/ID>/g)].map(m=>m[1]),['200','210','212','300','330','331','335','349','600']);
  assert.ok(xml.includes('<Name>Gruppe 331 &amp; &lt;Test&gt;</Name>'));
  assert.ok(!xml.includes('doppelt'));
  // Verschachtelt: 331 und 335 unter 330 unter 300; 349 ohne 340 hängt an 300; Blätter haben <Children/>.
  const block=kg=>{const i=xml.indexOf('<ID>'+kg+'</ID>');return xml.slice(xml.lastIndexOf('<Item>',i))};
  assert.match(block('330'),/^<Item>\n\t+<ID>330<\/ID>\n\t+<Name>Gruppe 330<\/Name>\n\t+<Description\/>\n\t+<Availability>ModelElement<\/Availability>\n\t+<Children>\n\t+<Item>\n\t+<ID>331<\/ID>/);
  const tiefe=kg=>xml.split('\n').find(l=>l.trim()==='<ID>'+kg+'</ID>').match(/^\t*/)[0].length-1;
  assert.deepEqual(['300','330','331','349'].map(tiefe),[4,6,8,6]);
  assert.match(block('335'),/^<Item>\n\t+<ID>335<\/ID>[\s\S]*?<Children\/>/);
  assert.equal((xml.match(/<Item>/g)||[]).length,(xml.match(/<\/Item>/g)||[]).length);
  assert.match(xml,/<\/Items>\n\t\t<\/System>\n\t<\/Classification>\n<\/BuildingInformation>\n$/);
  assert.throws(()=>I.klassifizierungXml([{kg:'100',titel:'nur 100'}]),/keine Gliederung/);
  // Die Oberfläche bietet die Datei an, auch nur zum Ansehen, und nennt die Anleitung.
  assert.match(ui,/data-act="klassifizierung">Klassifizierung für Archicad \(\.xml\)</);
  assert.match(ui,/if\(act==='klassifizierung'\)\{klassifizierungLaden\(\);return\}\n  if\(act==='neuladen'\)/);
  assert.match(ui,/a\.download='DIN276-2018_TBA_Archicad-Klassifizierung\.xml'/);
  assert.match(ui,/href="\.\/kostenberechnung-hilfe\.html#archicad"/);
});

test('die Werkzeuge führen zur Kostenberechnung, und sie zurück',()=>{
  assert.match(shell,/id="officeToolsKosten" aria-label="Kostenberechnung öffnen"/);
  assert.match(shell,/<strong>Kostenberechnung<\/strong><small>Nach DIN 276 bis zur 3\. Ebene/);
  assert.match(shell,/NAV_ICONS\.kosten='<svg /);
  assert.match(projekte,/getElementById\('officeToolsKosten'\)\?\.addEventListener\('click',\(\)=>\{\s*window\.location\.href='\.\.\/kostenberechnung\.html';/);
  assert.match(index,/\.\/shell\.js\?v=office52/);
  assert.match(index,/\.\/office-projects\.js\?v=office56/);
  assert.match(ui,/href="\.\/app\/#section=tools">‹ Werkzeuge/);
});

test('die Seite lädt den Office-Client wie der Terminplan, und die Module mit Version',()=>{
  assert.match(seite,/<html lang="de">/);
  assert.match(seite,/<meta name="robots" content="noindex">/);
  assert.match(seite,/@supabase\/supabase-js@2\.57\.0\/dist\/umd\/supabase\.min\.js/);
  for(const s of ['./office-config.js?v=1','./shared/supabase-client.js?v=office3','./kosten-rechnen.js?v=office5',
    './kosten-import.js?v=office3','./kosten-assistent.js?v=office2','./kosten-pool.js?v=office3','./kostenberechnung.js?v=office9','./kostenberechnung.css?v=office7'])
    assert.ok(seite.includes(s),'fehlt: '+s);
  assert.ok(seite.indexOf('kosten-rechnen.js')<seite.indexOf('kosten-import.js')&&seite.indexOf('kosten-import.js')<seite.indexOf('kosten-assistent.js')&&
    seite.indexOf('kosten-assistent.js')<seite.indexOf('kosten-pool.js')&&seite.indexOf('kosten-pool.js')<seite.indexOf('kostenberechnung.js?'));
  // In der App ohne Sitzung: anmelden über die App, nicht im Browser umleiten.
  assert.match(ui,/WINDOW_NATIVE\.call\('session\.signIn'\)/);
  assert.match(ui,/must_change_password/);
});

test('Speichern nur auf die erwartete Revision; das Muster bleibt unberührt',()=>{
  assert.match(ui,/update\(\{state:stand\}\)\.eq\('id',doc\.id\)\.eq\('server_revision',serverRevision\)\.select\('id,server_revision,updated_at'\)/);
  assert.match(ui,/if\(!data\|\|data\.length!==1\)throw/);
  assert.match(ui,/Meine Fassung als Datei sichern/);
  assert.match(ui,/addEventListener\('beforeunload'/);
  assert.ok(!/from\('office_kosten_templates'\)\.(insert|update|upsert|delete)/.test(ui),'die Seite schreibt ins Muster');
  assert.match(ui,/from\('office_kosten_instances'\)\.insert\(\{project_id:projekt\.id,template_id:muster\.id,template_version:muster\.version,/);
  assert.match(ui,/owner_id:nutzer\.id/);
  assert.match(ui,/from\('office_kosten_versions'\)\.insert\(\{instance_id:doc\.id,label:label\.slice\(0,160\),state:st,server_revision:serverRevision,created_by:nutzer\.id\}\)/);
  // Ein Klick direkt nach einer Eingabe geht nicht verloren.
  assert.match(ui,/function spaeterRendern\(\)\{if\(zeigerUnten\)\{renderSpaeter=true;return\}/);
  // Nutzertext immer maskiert.
  assert.match(ui,/const esc=s=>String\(s\?\?''\)\.replace\(\/\[&<>"'\]\/g/);
});

test('Migration: drei Tabellen mit RLS über die Office-Helfer, nichts Destruktives',()=>{
  for(const t of ['office_kosten_templates','office_kosten_instances','office_kosten_versions']){
    assert.match(sql,new RegExp('create table public\\.'+t+' \\('));
    assert.match(sql,new RegExp('alter table public\\.'+t+' enable row level security;'));
  }
  assert.match(sql,/revoke all on public\.office_kosten_templates, public\.office_kosten_instances, public\.office_kosten_versions\s+from public, anon, authenticated;/);
  assert.match(sql,/grant select on public\.office_kosten_templates to authenticated;/);
  assert.ok(!/grant (insert|update|delete)[^;]*office_kosten_templates/.test(sql),'das Muster ist über die API schreibbar');
  for(const h of ['office_is_member','office_leads_project','office_in_project_team','office_can_edit_plan'])
    assert.ok(sql.includes('private.'+h+'('),'Helfer fehlt: '+h);
  assert.match(sql,/execute function public\.office_terminplan_advance_revision\(\)/);
  assert.match(sql,/server_revision bigint not null default 1 check \(server_revision > 0\)/);
  assert.match(sql,/raise exception 'Projekt und Ersteller einer Kostenberechnung sind unveränderlich'/);
  assert.ok(!/\b(drop|truncate)\b|\bdelete\s+from\b/i.test(sql.replace(/--.*$/gm,'')),'destruktives SQL in der Migration');
  // Die Abnahme läuft in einer Transaktion, die zurückgerollt wird, prüft ihr Ergebnis selbst und läuft im CI.
  assert.match(abnahme,/^-- [^\n]*\n(?:--[^\n]*\n)*begin;\n/);
  assert.match(abnahme,/\nrollback;\n/);
  // Seit 23.11.2026 liest jedes Office-Mitglied (wie beim Terminplan); ändern, löschen, festhalten nur Ersteller, Leitung, Team.
  assert.match(abnahme,/C_sieht=1; C_update=0; C_delete=0; C_versions=1; '/);
  assert.match(abnahme,/C_insertP=verweigert; C_version=verweigert; /);
  assert.match(abnahme,/raise exception 'RLS Kostenberechnung weicht ab/);
  assert.match(abnahme,/Testdaten der Kostenberechnung sind nach dem Zurückrollen geblieben/);
  assert.match(read('.github/workflows/verify.yml'),/< tests\/sql\/office-kostenberechnung-rls-acceptance\.sql/);
});

test('öffentliches Repository: keine DIN-Titel, keine Projekte, keine Adressen',()=>{
  const dateien={'kosten-rechnen.js':read('kosten-rechnen.js'),'kosten-import.js':read('kosten-import.js'),'kostenberechnung.js':ui,
    'kostenberechnung.css':css,'kostenberechnung.html':seite,[MIGRATION]:sql,
    'kostenberechnung-hilfe.html':read('kostenberechnung-hilfe.html'),'terminplan-hilfe.html':read('terminplan-hilfe.html'),'anleitung.css':read('anleitung.css'),
    'kosten-assistent.js':read('kosten-assistent.js'),'kosten-pool.js':read('kosten-pool.js'),'Test Datenpool':read('tests/office-kosten-pool.test.mjs'),
    'office-kosten-ai/core.mjs':read('supabase/functions/office-kosten-ai/core.mjs'),
    'office-kosten-ai/index.ts':read('supabase/functions/office-kosten-ai/index.ts'),'Migration KI':read('supabase/migrations/20261121180000_office_kosten_ai_v1.sql'),
    'Abnahme KI':read('tests/sql/office-kosten-ai-rls-acceptance.sql'),'Testersatz':read('tests/browser/fixtures/fake-supabase-kosten.js'),
    'fixture':readFileSync(url('tests/fixtures/kosten-archicad-beispiel.xlsx')).toString('latin1')};
  // Kennzeichnende Titel der 2. und 3. Ebene; die Gliederung kommt aus dem Muster in der Datenbank.
  const TITEL=/Tragende Außenwände|Nichttragende Außenwände|Außenwandöffnungen|Außenwandbekleidungen|Deckenkonstruktionen|Deckenbeläge|Deckenbekleidungen|Dachkonstruktionen|Dachbeläge|Dachbekleidungen|Baugrube|\bGründung\b|Herrichten und Erschließen|Elementierte Außenwandkonstruktionen/;
  for(const [name,txt] of Object.entries(dateien)){
    assert.ok(!TITEL.test(txt),'DIN-276-Titel in '+name+': '+(txt.match(TITEL)||[])[0]);
    assert.ok(!/Bernried|Schwarz/.test(txt),name+' nennt ein Projekt');
    // Testadressen unter .invalid (RFC 2606, nie zustellbar) sind erlaubt.
    assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(txt.replace(/@supabase\/supabase-js@2\.57\.0/g,'').replace(/[\w.+-]+@[\w-]+\.invalid\b/g,'')),name+' enthält eine E-Mail-Adresse');
  }
  assert.match(read('kosten-rechnen.js'),/Die DIN-276-Gliederung kommt aus dem Stand \(Muster in der Datenbank\), nie aus diesem Code/);
});

test('deutsch, und ohne spanische Reste',()=>{
  for(const [name,txt] of [['kostenberechnung.js',ui],['kostenberechnung.html',seite],['kosten-rechnen.js',read('kosten-rechnen.js')],['kosten-import.js',read('kosten-import.js')],['kosten-pool.js',read('kosten-pool.js')]])
    assert.ok(!/\b(para|que|como|desde|proyecto|archivo|tarea|también|costos|cálculo|guardar)\b/i.test(txt),'spanische Wörter in '+name);
  for(const t of ['Kostenberechnungen','Muster · nur Ansicht','Mengen aus Archicad','Bericht für die Kostenbesprechung','Was noch fehlt',
    'Herkunft des Kennwerts','Stand festhalten','Kostenschätzung und Kostenberechnung','Kostenarchiv','Kennwert aus eigenen Projekten',
    'Als Kennwert übernehmen','Übernommen statt neu ermittelt','Auffällig, bitte prüfen','Archiv · nur lesen'])
    assert.ok(ui.includes(t),'fehlt in der Oberfläche: '+t);
});

test('Anleitungen: Kostenberechnung neu, Terminplan überarbeitet, beide im Stil des Office',()=>{
  const hilfe=read('kostenberechnung-hilfe.html'),tp=read('terminplan-hilfe.html'),stil=read('anleitung.css');
  for(const [name,html] of [['kostenberechnung-hilfe.html',hilfe],['terminplan-hilfe.html',tp]]){
    assert.match(html,/<html lang="de">/,name);
    assert.match(html,/<link rel="stylesheet" href="\.\/anleitung\.css\?v=office4">/,name);
    assert.ok(!/<style[\s>]/.test(html),'Stil gehört in anleitung.css: '+name);
    assert.ok(!/\b(para|que|como|desde|proyecto|archivo|tarea|también|costos|cálculo|guardar)\b/i.test(html),'spanische Wörter in '+name);
  }
  // Erreichbar aus dem Werkzeug, so wie die Anleitung zum Terminplan aus den Terminplänen.
  assert.match(ui,/href="\.\/kostenberechnung-hilfe\.html"/);
  assert.match(read('app/office-projects.js'),/Anleitung zum Terminplan · Werkzeug, Assistent, LPH 3 und LPH 5/);
  for(const id of ['ablauf','kostengruppen','archicad','kennwerte','bericht','assistent','quellen'])assert.match(hilfe,new RegExp('id="'+id+'"'));
  // Assistent (Teil VI): was er kann, prüfen und übernehmen, keine Preise ohne Herkunft, Daten und Grenzen.
  for(const t of ['Teil VI · Assistent','Altes Büro-Excel übernehmen','Prüfen und übernehmen','Rückgängig','auf Deutsch oder Spanisch',
    'Woher die Zahlen kommen','kommt der Preis als «Annahme KI», nicht als BKI oder Angebot','Er schreibt nie selbst in die Kostenberechnung',
    'Höchstens 80 Positionen je Vorschlag','nie der Projektname','Ein Tageslimit gibt es nicht; jede Anfrage wird gezählt.',
    '<tr><td>Internet</td>','<tr><td>Annahme KI</td>'])
    assert.ok(hilfe.includes(t),'fehlt im Kapitel Assistent: '+t);
  for(const t of ['25 Anfragen','sucht nicht im Internet','Regeln, die der Assistent nicht umgehen kann'])assert.ok(!hilfe.includes(t),'veraltet: '+t);
  assert.ok(!hilfe.includes('folgt als nächster Schritt'),'die Anleitung kündigt den Assistenten noch an');
  for(const t of ['3. Ebene','ohne Ansatz','in Pauschale','Entfällt','Rezept','Herkunftskette','219,54 €','52.415,18 €','5 % oder 10.000 €','Stand festhalten'])
    assert.ok(hilfe.includes(t),'fehlt in der Anleitung zur Kostenberechnung: '+t);
  // Archicad (Teil III): eine einzige Anleitung zum Modellieren und Einlesen (Gari, 22.11.2026), mit Seitenangaben der
  // Graphisoft-Richtlinien, eigenen Schemata statt Ausschnitten und der Klassifizierung als Datei aus dem Werkzeug.
  const teil3=hilfe.slice(hilfe.indexOf('id="archicad"'),hilfe.indexOf('id="kennwerte"'));
  for(const t of ['Teil III · Archicad','Drei Regeln','Welches Bauteil in welche Kostengruppe','Modellieren nach den Richtlinien','Flächen nach DIN 277',
    'Einrichten in Archicad 26 und Teamwork','Die zwei Auswertungen','«TBA Kosten · Mengen»','«TBA Kosten · Flächen DIN 277»','Erkannt am Spaltenkopf',
    'Klassifizierung für Archicad (.xml)','«DIN 276:2018-12 (TBA)»','«TBA Kosten»','Erster Test: ein Testmodell in 30 Minuten','Rezepte: ein Bauteil, mehrere Kostengruppen',
    'Fußbodenaufbau 353 (auf der Sohlplatte 324)','(S. 12)','(S. 17, 18)','(S. 30)','(S. 31)'])
    assert.ok(teil3.includes(t),'fehlt in Teil III: '+t);
  for(const id of ['ac-regeln','ac-zuordnung','ac-modellieren','ac-flaechen','ac-einrichten','ac-auswertungen','ac-einlesen','ac-rezepte','ac-test'])
    assert.ok(teil3.includes('id="'+id+'"')&&teil3.includes('href="#'+id+'"'),'Sprungmarke fehlt: '+id);
  assert.ok(!hilfe.includes('eigene, interne Anleitung'),'Teil III verweist noch auf eine zweite Anleitung');
  // Sechs eigene Schemata (SVG), keine Bilder oder Ausschnitte aus den Richtlinien.
  assert.equal((teil3.match(/<div class="abb-scroll"><svg viewBox="0 0 1000 \d+" role="img" aria-label="[^"]+">/g)||[]).length,6);
  assert.ok(!/<img\b|data:image|<image\b/.test(hilfe),'die Anleitung bettet Bilder ein');
  assert.equal((teil3.match(/Eigenes Schema nach Graphisoft, S\. /g)||[]).length,6);
  assert.deepEqual([...hilfe.matchAll(/Abbildung (\d+)\./g)].map(m=>Number(m[1])),[1,2,3,4,5,6,7,8,9,10,11]);
  assert.match(hilfe,/href="https:\/\/pub\.graphisoft\.de\/gsmucftp\/bim-modellierungsrichtlinien\/GRAPHISOFT-Literatur-BIM-Modellierungsrichtlinien-fur-ARCHICAD-28\.pdf"/);
  assert.match(hilfe,/Stand 09\/2023 \(GRA223294\)/);
  assert.match(hilfe,/CC BY-NC-SA 4\.0/);
  // Jede Kostengruppe in der Zuordnung gibt es in der Gliederung (3. Ebene, 2. Ebene bei 400 und 600).
  const kgs=[...teil3.matchAll(/<td class="kg">([^<]*)/g)].flatMap(m=>m[1].match(/\d{3}/g)||[]);
  assert.ok(kgs.length>=30);
  for(const kg of kgs)assert.match(kg,/^(3[2-9][1-9]|[46][1-9]0)$/,'KG '+kg);
  assert.match(stil,/\.a-sprung\{/);assert.match(stil,/@media\(max-width:760px\)\{\.abb-scroll svg\{min-width:720px\}\}/);
  // Terminplan: Assistent, Projektkalender mit Feiertagen, Muster-Planner v0.3.4, Weg zur Kostenberechnung.
  for(const t of ['id="assistent"','Prüfen und übernehmen','Was-wäre-wenn','Projektkalender','fünf folgenden Jahre','keine Notizen',
    'v0.3.4','53 Aufgaben','355 Prüfpunkte','Termine aus Terminplan','Bauteilkatalog','04.03','M08A','./kostenberechnung-hilfe.html','21.11.2026'])
    assert.ok(tp.includes(t),'fehlt in der Anleitung zum Terminplan: '+t);
  for(const alt of ['Masterplanner','jetzt <strong>vier','v0.2 umfasst','Behalten, Ändern, Streichen','Ein Predecessor','Handbuchstand: 12.11.2026'])
    assert.ok(!tp.includes(alt),'veraltet in der Anleitung zum Terminplan: '+alt);
  // Der Terminplan behauptet nicht mehr, er rechne ohne Feiertage.
  assert.ok(!read('terminplan.html').includes('ohne Feiertage oder Pufferzeiten'));
  assert.match(read('terminplan.html'),/abzüglich der arbeitsfreien Tage des Projektkalenders/);
  assert.match(stil,/--a-link:#355d99/);
});

test('Elemente und Gewerke: Summen über dieselben Positionen, die DIN-Gliederung bleibt die Rechengrundlage',()=>{
  // Gari, 21.11.: unter jeder KG mehrere Elemente wie im Büro-Excel (335: «WDVS Mineralwolle 160–200 mm + Putz» …), Spalte GW.
  const st={schema:R.SCHEMA,ustProzent:'19',kostenstand:'2026-Q4',
    katalog:[{kg:'300',titel:'A'},{kg:'330',titel:'B'},{kg:'335',titel:'C'},{kg:'336',titel:'D'},{kg:'600',titel:'E'},{kg:'610',titel:'F'}],
    gruppen:{'600':{status:'entfaellt',notiz:'x'}},
    elemente:[{id:'e:1',kg:'335',titel:'WDVS'}],
    positionen:[
      {id:'a',kg:'335',element:'e:1',gewerk:' wd ',modus:'menge',menge:'638.94',einheit:'m²',mengenquelle:{art:'manuell'},kennwert:{art:'angebot',wert:'130',fundstelle:'Sto'}},
      {id:'b',kg:'335',element:'e:1',gewerk:'PU',modus:'betrag',betrag:'35000',kennwert:{art:'angebot',fundstelle:'Sto'}},
      {id:'c',kg:'336',gewerk:'PU',modus:'menge',menge:'457.59',einheit:'m²',mengenquelle:{art:'manuell'},kennwert:{art:'eigen',wert:'40',fundstelle:'BV'}},
      {id:'d',kg:'336',element:'e:weg',gewerk:'',modus:'menge',menge:'10',einheit:'m²',mengenquelle:{art:'manuell'},kennwert:{}},
      {id:'f',kg:'610',gewerk:'PU',modus:'betrag',betrag:'999',kennwert:{art:'angebot',fundstelle:'x'}}]};
  const r=R.berechne(st);
  assert.equal(r.elemente.get('e:1').bekanntCent,11806220n); // 83.062,20 + 35.000,00
  assert.equal(r.elemente.get('e:1').anzahl,2);
  assert.equal(r.gewerke.get('WD').bekanntCent,8306220n);
  assert.equal(r.gewerke.get('PU').bekanntCent,5330360n); // ohne die entfallende KG 610
  assert.equal(r.gewerke.get('').offen,1);
  assert.equal(r.positionen.find(x=>x.id==='d').element,null,'unbekanntes Element zählt als direkte Position');
  const summeGewerke=[...r.gewerke.values()].reduce((s,x)=>s+x.bekanntCent,0n);
  assert.equal(summeGewerke,r.gesamt.bekanntCent,'beide Sichten ergeben dieselbe Summe');
  assert.equal(R.gewerkKurz(' ma '),'MA');
});

test('Tabelle wie im Büro-Excel: Spalten, Zeilenhöhe, Gewerke, Elemente, volle Breite',()=>{
  // Gari, 21.11.: Platz an den Seiten nutzen; Zeilen aufziehen wie in Excel; Spalten wie im Büro (KG · GW · … · Netto · Brutto · Kommentar).
  assert.match(ui,/const SPALTEN=\[\['kg','KG'\],\['gw','GW'\],\['bez','Bezeichnung'\],\['ort','Ort'\],\['menge','Menge'\],\['eh','EH'\],\['ep','EP netto'\],\['netto','Netto'\],\['brutto','Brutto'\],\['quelle','Quelle'\],\['kom','Kommentar'\]\];/);
  for(const t of ['Einzeilig','Ganzer Text','Gewerke','data-act="el-neu"','Element anlegen','Position im Element','Element auflösen','Mit Positionen löschen','Duplizieren','Zusammenstellung nach Gewerken','Details schließen'])
    assert.ok(ui.includes(t),'fehlt: '+t);
  // Enter springt wie in Excel in dieselbe Spalte der nächsten Zeile; Spaltenbreite ziehen; Ansicht je Browser gemerkt, ohne Speicher kein Fehler.
  assert.match(ui,/ev\.key==='Enter'&&!ev\.shiftKey/);
  assert.match(ui,/data-zieh/);
  assert.match(ui,/function ladePrefs\(\)\{try\{/);
  assert.match(ui,/function merkePrefs\(\)\{try\{/);
  assert.match(css,/\.kb-wrap\{max-width:2400px;margin:0 auto\}/);
  assert.doesNotMatch(css,/\.kb-wrap\{max-width:1240px/);
  assert.match(css,/\.ktab\.einzeilig textarea\.ci\{/);
  assert.match(css,/@page\{size:A4 landscape;margin:12mm\}/);
  // Netto und Brutto nebeneinander statt Umschalter.
  assert.doesNotMatch(ui,/data-act="brutto" data-wert="1"/);
});
