// KI-Assistent der Kostenberechnung (21.11.2026, Gari: ein Assistent wie beim Terminplan, aber für die Kosten;
// 22.11.2026, Gari: freier, mit Websuche und ohne Tageslimit). Geprüft ohne Netz und ohne Produktion:
// - Vertrag mit dem Modell (core.mjs): strenges Schema, Anweisungen für ein freies Gespräch, Kontext aus dem Stand,
//   Prüfung jeder Antwort: jeder Preis mit Herkunft (ohne Fundstelle als «Annahme KI», nie verworfen), nur
//   Kostengruppen aus der Gliederung, Elemente nur in der 3. Ebene, «entfällt» nie über vorhandene Kosten, Links.
// - Client (kosten-assistent.js): Tabelle mit Zeilennummern, bestes Blatt, Vorschlag prüfen, übernehmen, Vorschau.
// - Edge Function, Migration mit RLS, Abnahme in der CI, Einbindung in die Seite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {MODEL,VERSION,SCHEMA,anweisungen,validId,validMessage,validRevision,pruefeTabelle,pruefeAuswahl,toContext,pruefeAntwort,pruefeLinks,einheit,GRENZE,QUELLEN}
  from '../supabase/functions/office-kosten-ai/core.mjs';
import {MODEL as TERMINPLAN_MODEL} from '../supabase/functions/office-terminplan-ai/core.mjs';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const R=require('../kosten-rechnen.js'),I=require('../kosten-import.js'),A=require('../kosten-assistent.js');
const edge=read('supabase/functions/office-kosten-ai/index.ts');
const MIGRATION='supabase/migrations/20261121180000_office_kosten_ai_v1.sql',OHNE_LIMIT='supabase/migrations/20261122100000_office_ki_ohne_tageslimit.sql';
const sql=read(MIGRATION),ohneLimit=read(OHNE_LIMIT),abnahme=read('tests/sql/office-kosten-ai-rls-acceptance.sql');
const abnahmeTerminplan=read('tests/sql/office-terminplan-ai-ohne-limit-acceptance.sql');
const ui=read('kostenberechnung.js'),client=read('kosten-assistent.js');

const stand=(extra={})=>({schema:R.SCHEMA,ustProzent:'19',kostenstand:'2026-Q4',indizes:[],regionalfaktor:{wert:''},zuschlag:{wert:''},
  katalog:[{kg:'300',titel:'B'},{kg:'330',titel:'B3'},{kg:'331',titel:'B31'},{kg:'335',titel:'B35'},{kg:'336',titel:'B36'},
    {kg:'390',titel:'B9'},{kg:'394',titel:'B94'},{kg:'400',titel:'C'},{kg:'410',titel:'C1'},{kg:'411',titel:'C11'}],
  positionen:[{id:'p:alt',kg:'331',titel:'Wand KS 17,5',modus:'menge',menge:'100',einheit:'m²',mengenquelle:{art:'manuell'},
    kennwert:{art:'angebot',wert:'90',fundstelle:'Angebot A, Pos. 3'}}],elemente:[{id:'e:alt',kg:'335',titel:'WDVS alt',notiz:''}],gruppen:{},...extra});
const pos=(x={})=>({kg:'335',element:'',gewerk:'',titel:'Dämmung',ort:'',modus:'menge',menge:'412.5',einheit:'m²',mengenquelle:'manuell',
  ep:'128',betrag:'',quelle:'angebot',fundstelle:'Angebot B, Pos. 1',kostenstand:'',brutto:false,notiz:'',...x});
const antwort=(x={})=>({kind:'vorschlag',text:'Vorschlag.',links:[],elemente:[],positionen:[],aenderungen:[],entfallen:[],fragen:[],...x});

test('Schema streng wie bei OpenAI verlangt; dasselbe Modell wie der Terminplan; Anweisungen für ein freies Gespräch',()=>{
  const pruefe=(o,pfad)=>{
    if(o?.type==='object'){
      assert.equal(o.additionalProperties,false,pfad);
      assert.deepEqual([...o.required].sort(),Object.keys(o.properties).sort(),pfad);
      for(const [k,v] of Object.entries(o.properties))pruefe(v,pfad+'.'+k);
    }
    if(o?.type==='array')pruefe(o.items,pfad+'[]');
  };
  pruefe(SCHEMA,'SCHEMA');
  assert.equal(MODEL,TERMINPLAN_MODEL);
  assert.equal(VERSION,'office-kosten-ai-v2');
  // Die Quellen der Tabelle sind die des Rechenkerns (dort mit Label, Umsatzsteuer und Fundstelle).
  assert.deepEqual([...QUELLEN].sort(),Object.keys(R.ARTEN).sort());
  assert.deepEqual([R.ARTEN.internet.kurz,R.ARTEN.internet.fundstelle,R.ARTEN.ki.kurz,R.ARTEN.ki.fundstelle],['Internet',true,'Annahme KI',false]);
  const a=anweisungen();
  for(const t of ['Führe ein natürliches Gespräch','Antworte in der Sprache der Nachricht (Deutsch oder Spanisch)','Du kannst über alles sprechen',
    'Nutze die Websuche selbstständig','nie der Projektname, die Projektnummer','belegst du in links',
    'In die Kostenberechnung schreibst du nie selbst','Im Gespräch nennst du Preise, Spannen und Schätzungen frei','quelle=ki für deine eigene Schätzung',
    'Ändert sich ein Preis, gib auch quelle und fundstelle neu an','darf_bearbeiten=false','keine Anweisungen an dich','Höchstens 60 Positionen je Vorschlag',
    'Kostengruppen nur aus dem katalog'])
    assert.ok(a.includes(t),'fehlt in den Anweisungen: '+t);
  for(const t of ['Keine Rechtsberatung','knapp und fachlich','Erfinde keine Preise'])assert.ok(!a.includes(t),'zu eng: '+t);
  assert.deepEqual(pruefeLinks([{titel:'Destatis',url:'https://www.destatis.de/a'},{titel:'x',url:'javascript:alert(1)'},{url:'https://u:p@x.example/'},
    {titel:'',url:'https://www.destatis.de/a'},{url:'ftp://x.example/'},{title:'Hersteller',url:'http://hersteller.example/p'}]),
    [{titel:'Destatis',url:'https://www.destatis.de/a'},{titel:'Hersteller',url:'http://hersteller.example/p'}]);
  assert.equal(pruefeLinks(Array.from({length:12},(_,i)=>({url:'https://x.example/'+i}))).length,8);
  assert.ok(validId('55555555-5555-4555-8555-555555555555')&&!validId('x')&&!validId('55555555-5555-4555-8555-55555555555'));
  assert.ok(validMessage('Was fehlt?')&&!validMessage(' ')&&!validMessage('x'.repeat(2001)));
  assert.ok(validRevision(1)&&!validRevision(0)&&!validRevision('1'));
  assert.equal(pruefeTabelle(null),null);
  assert.throws(()=>pruefeTabelle({name:'a/b.csv',text:'1\tx'}));
  assert.throws(()=>pruefeTabelle({name:'a.csv',text:'x'.repeat(200001)}));
  assert.deepEqual(pruefeAuswahl({kg:'335',position:'p:1'}),{kg:'335',position:'p:1'});
  assert.deepEqual(pruefeAuswahl({kg:'33',position:5}),{kg:'',position:''});
  assert.equal(einheit('qm'),'m²');assert.equal(einheit('Stk.'),'St');assert.equal(einheit('lfm'),'m');assert.equal(einheit('Woche'),null);
});

test('Kontext: kompakt, mit ids und Netto, Auswahl und Recht; sehr große Berechnungen gekürzt',()=>{
  const k=toContext(stand(),R,{projekt:'T-01 · Testhaus',auswahl:{kg:'335'},darfBearbeiten:true});
  assert.equal(k.darf_bearbeiten,true);
  assert.deepEqual(k.auswahl,{kg:'335'});
  assert.deepEqual(k.positionen[0],{id:'p:alt',kg:'331',titel:'Wand KS 17,5',modus:'menge',menge:'100',einheit:'m²',ep:'90',quelle:'angebot',
    fundstelle:'Angebot A, Pos. 3',netto:'9000.00',stand:'vollstaendig'});
  assert.equal(k.summe.netto,'9000.00');
  assert.ok(k.katalog.some(x=>x.kg==='331'&&x.netto==='9000.00'));
  assert.ok(k.katalog.every(x=>!('hinweis' in x)),'leere Angaben gehören nicht in den Kontext');
  assert.equal(k.elemente[0].id,'e:alt');
  assert.equal(toContext(stand(),R).darf_bearbeiten,false);
  // 700 Positionen mit langen Texten: die der Auswahl (KG 4xx) ganz, der Rest nur als Summe.
  const viele=[];for(let i=0;i<700;i++)viele.push({id:'p:'+i,kg:i<400?'331':'411',titel:'Position '+i+' '+'x'.repeat(150),modus:'betrag',betrag:'10',kennwert:{art:'annahme'}});
  const g=toContext(stand({positionen:viele}),R,{auswahl:{kg:'411'}});
  assert.ok(JSON.stringify(g.positionen).length<=GRENZE.kontext);
  assert.ok(g.positionen.every(p=>p.kg==='411'));
  assert.match(g.weitere_positionen,/^\d+ weitere Positionen sind nur als Summe im katalog enthalten\.$/);
  assert.throws(()=>toContext(stand({positionen:Array.from({length:801},(_,i)=>({id:'p'+i,kg:'331'}))}),R),/too_large/);
});

test('Prüfung der Antwort: jeder Preis mit Herkunft (ohne Fundstelle «Annahme KI»), Gliederung, Elemente, Einheiten, Zahlen, Links',()=>{
  const r=pruefeAntwort(antwort({elemente:[{ref:'E1',kg:'335',titel:'WDVS neu',notiz:''},{ref:'E2',kg:'330',titel:'falsch',notiz:''}],positionen:[
    pos({element:'E1',gewerk:' pu ',einheit:'qm',menge:'1.234,56'}),
    pos({titel:'Putz',ep:'55',quelle:'',fundstelle:''}),                       // Preis ohne Quelle: Annahme KI
    pos({titel:'Kleber',ep:'12',quelle:'bki',fundstelle:'',notiz:'Ansatz'}),     // behauptetes BKI ohne Fundstelle: Annahme KI
    pos({titel:'Schätzung',ep:'20',quelle:'ki',fundstelle:'',notiz:'übliche Spanne 15–25 €/m²'}),
    pos({titel:'Annahme Büro',ep:'30',quelle:'annahme',fundstelle:'',notiz:'laut Gari'}),
    pos({titel:'Hersteller',ep:'42.9',quelle:'internet',fundstelle:'https://hersteller.example/wdvs, abgerufen 22.11.2026',brutto:true}),
    pos({titel:'Internet ohne Adresse',ep:'40',quelle:'internet',fundstelle:''}),
    pos({kg:'999',titel:'Fremd'}),
    pos({kg:'330',titel:'Kostenbeitrag',modus:'menge',ep:'35000',quelle:'fachplanung',fundstelle:'Beitrag TGA, S. 2'}), // KG mit Unter-KG: pauschal
    pos({titel:'Element einer anderen KG',element:'e:alt',kg:'331'}),
    pos({titel:'Einheit Woche',einheit:'Woche'}),
    pos({titel:'Negativ',menge:'-5'}),
    pos({titel:'Kostenstand',kostenstand:'2026-Q3'}),pos({titel:'Kostenstand falsch',kostenstand:'Q3 2026'})],
    links:[{titel:'Hersteller',url:'https://hersteller.example/wdvs'}]}),stand(),R,{zitate:[{title:'Destatis Baupreisindex',url:'https://www.destatis.de/baupreise'}]});
  assert.equal(r.kind,'vorschlag');
  const v=r.vorschlag,p=t=>v.positionen.find(x=>x.titel===t);
  assert.deepEqual(v.elemente,[{ref:'E1',kg:'335',titel:'WDVS neu',notiz:''}]);
  assert.deepEqual({...p('Dämmung')},{kg:'335',element:'E1',gewerk:'PU',titel:'Dämmung',ort:'',modus:'menge',menge:'1234.56',einheit:'m²',mengenquelle:'manuell',
    ep:'128',betrag:'',quelle:'angebot',fundstelle:'Angebot B, Pos. 1',kostenstand:'',brutto:false,notiz:''});
  // Kein Preis fällt heraus; ohne belegte Herkunft wird er «Annahme KI», die behauptete Quelle steht im Kommentar.
  assert.deepEqual([p('Putz').ep,p('Putz').quelle,p('Putz').fundstelle,p('Putz').notiz],['55','ki','','']);
  assert.deepEqual([p('Kleber').ep,p('Kleber').quelle,p('Kleber').notiz],['12','ki','laut Assistent BKI-Buch, ohne Fundstelle; Ansatz']);
  assert.deepEqual([p('Schätzung').ep,p('Schätzung').quelle,p('Schätzung').notiz],['20','ki','übliche Spanne 15–25 €/m²']);
  assert.deepEqual([p('Annahme Büro').quelle,p('Annahme Büro').ep],['annahme','30']);
  assert.deepEqual([p('Hersteller').quelle,p('Hersteller').fundstelle,p('Hersteller').brutto],['internet','https://hersteller.example/wdvs, abgerufen 22.11.2026',true]);
  assert.deepEqual([p('Internet ohne Adresse').quelle,p('Internet ohne Adresse').ep,p('Internet ohne Adresse').notiz],['ki','40','laut Assistent Internet (Hersteller, Händler, Index), ohne Fundstelle']);
  assert.deepEqual(r.links,[{titel:'Hersteller',url:'https://hersteller.example/wdvs'},{titel:'Destatis Baupreisindex',url:'https://www.destatis.de/baupreise'}]);
  assert.ok(!p('Fremd'));
  assert.deepEqual([p('Kostenbeitrag').modus,p('Kostenbeitrag').betrag,p('Kostenbeitrag').einheit,p('Kostenbeitrag').menge],['pauschal','35000','psch','']);
  assert.equal(p('Element einer anderen KG').element,'');
  assert.equal(p('Einheit Woche').einheit,'m²');
  assert.equal(p('Negativ').menge,'');
  assert.equal(p('Kostenstand').kostenstand,'2026-Q3');assert.equal(p('Kostenstand falsch').kostenstand,'');
  for(const h of ['KG 330 ist keine Kostengruppe der 3. Ebene','«Putz»: Preis ohne Quelle; als «Annahme KI» übernommen','«Kleber»: Preis ohne Fundstelle; als «Annahme KI» übernommen',
    'KG 999 steht nicht in der Gliederung','Element passt nicht zur KG 331','Einheit «Woche» unbekannt','«Negativ»: Menge nicht lesbar'])
    assert.ok(r.hinweise.some(x=>x.includes(h)),'Hinweis fehlt: '+h);
});

test('Prüfung der Antwort: Änderungen nur an vorhandenen Positionen, «entfällt» nie über Kosten, nur Ansicht, Grenzen',()=>{
  const r=pruefeAntwort(antwort({aenderungen:[
    {id:'p:alt',feld:'ep',wert:'95,50',grund:'Angebot B'},          // neuer Preis, aber ohne neue Fundstelle
    {id:'p:fehlt',feld:'ep',wert:'1',grund:''},
    {id:'p:alt',feld:'einheit',wert:'cbm',grund:''},
    {id:'p:alt',feld:'quelle',wert:'internetseite',grund:''}],
    entfallen:[{kg:'331',begruendung:'nicht vorhanden'},{kg:'394',begruendung:'kein Gerüst'},{kg:'394',begruendung:'doppelt'},{kg:'336',begruendung:''}]}),stand(),R);
  // Die alte Fundstelle (Angebot A) belegt den neuen Preis nicht: er wird «Annahme KI».
  assert.deepEqual(r.vorschlag.aenderungen,[{id:'p:alt',feld:'ep',wert:'95.5',grund:'Angebot B'},{id:'p:alt',feld:'einheit',wert:'m³',grund:''},
    {id:'p:alt',feld:'quelle',wert:'ki',grund:'neuer Preis ohne Fundstelle'},{id:'p:alt',feld:'fundstelle',wert:'',grund:'die alte Fundstelle belegt den neuen Preis nicht'}]);
  assert.ok(r.hinweise.some(h=>h.includes('Neuer Preis für «Wand KS 17,5» ohne Fundstelle; als «Annahme KI» gekennzeichnet.')));
  // Mit neuer Quelle und Fundstelle bleibt der Preis belegt.
  const belegt=pruefeAntwort(antwort({aenderungen:[{id:'p:alt',feld:'ep',wert:'97',grund:''},{id:'p:alt',feld:'quelle',wert:'internet',grund:''},
    {id:'p:alt',feld:'fundstelle',wert:'https://hersteller.example/ks',grund:''}]}),stand(),R);
  assert.deepEqual(belegt.vorschlag.aenderungen.map(a=>a.feld+'='+a.wert),['ep=97','quelle=internet','fundstelle=https://hersteller.example/ks']);
  assert.deepEqual(r.vorschlag.entfallen,[{kg:'394',begruendung:'kein Gerüst'}]);
  assert.ok(r.hinweise.some(h=>h.includes('KG 331 hat Positionen')));
  // Eine Schätzung bleibt eine Schätzung: neuer Preis an einer Position mit «Annahme KI» ändert nur den Preis.
  const ki=stand();ki.positionen[0].kennwert={art:'ki',wert:'90'};
  assert.deepEqual(pruefeAntwort(antwort({aenderungen:[{id:'p:alt',feld:'ep',wert:'95',grund:''}]}),ki,R).vorschlag.aenderungen,[{id:'p:alt',feld:'ep',wert:'95',grund:''}]);
  // Nur Ansicht: keine Vorschläge, nur die Antwort.
  const lesen=pruefeAntwort(antwort({positionen:[pos()]}),stand(),R,{darfBearbeiten:false});
  assert.equal(lesen.kind,'antwort');assert.equal(lesen.vorschlag,null);assert.ok(lesen.hinweise.includes('Nur Ansicht: Vorschläge sind ausgeblendet.'));
  // Leerer Vorschlag wird eine Antwort; Fragen höchstens vier; Grenze der Positionen.
  assert.equal(pruefeAntwort(antwort({positionen:[pos({kg:'999'})]}),stand(),R).kind,'antwort');
  assert.equal(pruefeAntwort(antwort({kind:'rueckfrage',text:'',fragen:['a','b','c','d','e']}),stand(),R).fragen.length,4);
  const viel=pruefeAntwort(antwort({positionen:Array.from({length:90},(_,i)=>pos({titel:'P'+i}))}),stand(),R);
  assert.equal(viel.vorschlag.positionen.length,GRENZE.positionen);
  assert.ok(viel.hinweise[0].includes('Nur die ersten 80 Positionen'));
  assert.throws(()=>pruefeAntwort(null,stand(),R));
});

test('Client: Tabelle mit Zeilennummern wie im Blatt; das Blatt mit den Kostengruppen',()=>{
  const z=[['KG','Bezeichnung','Menge',''],[],['335','Dämmung\tMineralwolle','412,5','','']];
  z[0].nr=4;z[2].nr=7;
  assert.deepEqual(A.tabelleText(z),{text:'4\tKG\tBezeichnung\tMenge\n7\t335\tDämmung Mineralwolle\t412,5',zeilen:2,gekuerzt:false});
  const lang=A.tabelleText(Array.from({length:50},(_,i)=>['335','x'.repeat(20)]),{max:200});
  assert.ok(lang.gekuerzt&&lang.text.length<=200&&lang.zeilen>0);
  const csv=I.leseCsv('KG;Text\n\n335;Dämmung\n');
  assert.deepEqual(csv.map(r=>r.nr),[1,3]);
  assert.equal(A.bestesBlatt([{name:'Deckblatt',zeilen:[['Projekt'],['Datum']]},{name:'KB',zeilen:[['KG'],['331 Wand'],['335']]}]).name,'KB');
  // Leere Zeilen mit Format (<row …/>) zählen mit, verschieben aber nichts.
  const blatt=I.zeilenAusBlatt('<row r="1"><c r="A1"><v>1</v></c></row><row r="2" ht="6" customHeight="1"/><row r="3"><c r="A3"><v>3</v></c></row>',[]);
  assert.deepEqual(blatt.map(r=>[r.nr,r[0]]),[[1,'1'],[3,'3']]);
});

test('Client: Vorschlag übernehmen wie «+ Position», mit Quelle, Fundstelle und Tag; Vorschau rechnet wie das Werkzeug',()=>{
  const v={elemente:[{ref:'E1',kg:'335',titel:'WDVS Mineralwolle 160 mm + Putz',notiz:''},{ref:'E2',kg:'330',titel:'falsch',notiz:''}],
    positionen:[pos({element:'E1',gewerk:'pu'}),pos({element:'E1',titel:'Oberputz',ep:'',quelle:'',fundstelle:''}),
      pos({kg:'394',titel:'Gerüst',modus:'pauschal',betrag:'5000',menge:'',einheit:'psch',ep:'',quelle:'bki',brutto:true,fundstelle:'BKI 2025, S. 9'}),
      pos({titel:'in altes Element',element:'e:alt',quelle:'heinze',brutto:true}),pos({kg:'999',titel:'weg'})],
    aenderungen:[{id:'p:alt',feld:'ep',wert:'95',grund:''},{id:'p:alt',feld:'betrag',wert:'1',grund:'passt nicht zu Menge × EP'},{id:'p:weg',feld:'ep',wert:'1',grund:''}],
    entfallen:[{kg:'336',begruendung:'nicht vorhanden'}]};
  const st=stand();let n=0;
  const vor=A.vorschau(v,st,R);
  assert.equal(vor.positionen,4);assert.equal(vor.elemente,1);assert.equal(vor.aenderungen,1);assert.equal(vor.entfallen,1);assert.equal(vor.weg,4);
  assert.equal(vor.offen,1);
  // 412,5 m² × 128,00 € = 52.800,00 €; die Pauschale für das Gerüst 5.000,00 €. Offen bleibt nur der Oberputz ohne Preis.
  assert.equal(vor.zeilen.find(z=>z.titel==='Dämmung').betragCent,5280000n);
  assert.equal(vor.zeilen.find(z=>z.titel==='Gerüst').betragCent,500000n);
  assert.equal(st.positionen.length,1,'die Vorschau ändert den Stand nicht');
  const r=A.wendeAn(st,v,R,{neueId:p=>p+'t'+(n++),heute:'2026-11-21'});
  assert.deepEqual([r.positionen,r.elemente,r.aenderungen,r.entfallen,r.weg],[4,1,1,1,4]);
  const neu=st.elemente.find(e=>e.titel.startsWith('WDVS Mineralwolle'));
  const d=st.positionen.find(p=>p.titel==='Dämmung');
  assert.deepEqual(d,{id:d.id,kg:'335',titel:'Dämmung',gewerk:'PU',ort:'',element:neu.id,bauteiltyp:'',notiz:'',modus:'menge',
    kennwert:{art:'angebot',wert:'128',fundstelle:'Angebot B, Pos. 1'},assistent:'2026-11-21',menge:'412.5',einheit:'m²',
    mengenquelle:{art:'manuell',text:'Angebot B, Pos. 1'}});
  assert.deepEqual(st.positionen.find(p=>p.titel==='Oberputz').kennwert,{});
  const g=st.positionen.find(p=>p.titel==='Gerüst');
  assert.deepEqual([g.modus,g.betrag,g.kennwert],['betrag','5000',{art:'bki',fundstelle:'BKI 2025, S. 9'}]); // BKI brutto ist die Annahme: nicht festgehalten
  assert.equal(st.positionen.find(p=>p.titel==='in altes Element').kennwert.brutto,true);           // Heinze ist sonst netto
  assert.equal(st.positionen.find(p=>p.titel==='in altes Element').element,'e:alt');
  assert.equal(st.positionen.find(p=>p.id==='p:alt').kennwert.wert,'95');
  assert.equal(st.positionen.find(p=>p.id==='p:alt').betrag,undefined);
  assert.deepEqual(st.gruppen['336'],{status:'entfaellt',notiz:'nicht vorhanden'});
  // Neue Positionen stehen bei ihrer KG und ihrem Element, nicht irgendwo.
  const kgs=st.positionen.map(p=>p.kg);
  assert.deepEqual(kgs.filter((k,i)=>kgs.indexOf(k)===i),kgs.filter((k,i,a)=>i===0||a[i-1]!==k),'Positionen einer KG liegen nicht beisammen');
  assert.ok(R.berechne(st).gesamt.bekanntCent>0n);
});

test('Edge Function: Anmeldung, Herkunft, RLS, Zählung vor dem Modell, kein Schreiben, Websuche ohne Anhänge, Zitate',()=>{
  assert.equal(read('supabase/functions/office-kosten-ai/kosten-rechnen.js'),read('kosten-rechnen.js'),'die Kopie des Rechenkerns weicht ab');
  assert.match(edge,/import "\.\/kosten-rechnen\.js";/);
  assert.match(edge,/from "\.\.\/office-terminplan-ai\/attachments\.mjs"/);
  assert.match(edge,/const ORIGIN="https:\/\/tbarchitekten\.github\.io";/);
  assert.match(edge,/if\(origin&&origin!==ORIGIN\)return respond\(403/);
  assert.match(edge,/if\(!token\)return respond\(401/);
  assert.match(edge,/createClient\(apiUrl,publicKey,\{global:\{headers:\{Authorization:authHeader\}\}/);
  assert.match(edge,/from\("office_members"\)[\s\S]*?\.eq\("is_active",true\)/);
  assert.match(edge,/from\("office_kosten_instances"\)\s*\.select\("id,project_id,project_number,project_name,owner_id,server_revision,state"\)/);
  assert.doesNotMatch(edge,/SERVICE_ROLE/);
  assert.doesNotMatch(edge,/office_kosten_instances"\)[^;]*\.(update|insert|upsert|delete)\(/);
  assert.match(edge,/if\(inst\.server_revision!==input\.expected_revision\)return respond\(409/);
  const zaehlung=edge.indexOf('rpc("office_kosten_ai_consume_request"'),modell=edge.indexOf('fetch("https://api.openai.com/v1/responses"');
  assert.ok(zaehlung>0&&modell>zaehlung,'jede Anfrage muss vor dem Modellaufruf gezählt werden');
  assert.match(edge,/if\(allowed!==true\)return respond\(403,\{error:"ai_request_not_allowed"\}\);/);
  assert.doesNotMatch(edge,/daily_ai_limit_reached|429/);
  assert.match(edge,/store:false/);
  // Websuche wie beim Terminplan: ohne Anhänge an, mit Anhängen aus; die Zitate des Anbieters werden zu Links.
  assert.match(edge,/tools:gross\?\[\]:\[\{type:"web_search",search_context_size:"medium"\}\]/);
  assert.match(edge,/a\?\.type==="url_citation"/);
  assert.match(edge,/strict:true,schema:SCHEMA/);
  assert.match(edge,/Deno\.env\.get\("TBA_OFFICE_OPENAI_API_KEY"\)/);
  assert.match(edge,/authority:"none"/);
  assert.match(edge,/pruefeAntwort\(JSON\.parse\(text\),inst\.state,R,\{darfBearbeiten:canEdit,zitate:zitate\(provider\)\}\)/);
  const cfg=read('supabase/config.toml');
  assert.match(cfg,/\[functions\.office-kosten-ai\]\nverify_jwt = true\nentrypoint = "\.\/functions\/office-kosten-ai\/index\.ts"/);
});

test('Migrationen: Verlauf und Zählung mit RLS; kein Tageslimit für Terminplan und Kosten; nichts Destruktives; Abnahmen in der CI',()=>{
  for(const m of [sql,ohneLimit])assert.doesNotMatch(m,/\bdrop\s+(table|policy|function|column|index|schema|view|trigger)\b|\bdelete\s+from\b|\btruncate\b|\bdrop\s+column\b/i);
  for(const t of ['office_kosten_dialogue_messages','office_kosten_ai_requests']){
    assert.match(sql,new RegExp('alter table public\\.'+t+' enable row level security'));
    assert.match(sql,new RegExp('revoke all on [^;]*public\\.'+t));
  }
  assert.match(sql,/user_id = \(select auth\.uid\(\)\)\s*and exists\(select 1 from public\.office_kosten_instances i\s*where i\.id = instance_id and \(select private\.office_can_read_kosten\(i\.owner_id, i\.project_id\)\)\)/);
  assert.match(sql,/create function public\.office_kosten_ai_consume_request\(p_instance_id uuid\) returns boolean\s*language plpgsql security invoker set search_path = ''/);
  assert.match(sql,/revoke all on function public\.office_kosten_ai_consume_request\(uuid\) from public, anon;/);
  // 22.11.2026, Gari: kein Tageslimit, weder beim Terminplan noch bei den Kosten; gezählt wird weiter.
  for(const [fn,tab] of [['office_ai_consume_request(p_plan_id uuid)','office_terminplan_ai_requests'],['office_kosten_ai_consume_request(p_instance_id uuid)','office_kosten_ai_requests']]){
    const i=ohneLimit.indexOf('create or replace function public.'+fn);
    assert.ok(i>=0,'fehlt: '+fn);
    const body=ohneLimit.slice(i,ohneLimit.indexOf('$$;',i));
    assert.match(body,/returns boolean\s*language plpgsql security invoker set search_path = ''/);
    assert.match(body,/private\.office_is_member\(\)/);
    assert.match(body,new RegExp('insert into public\\.'+tab));
    assert.doesNotMatch(body,/used|count\(|>=|advisory/i,'noch eine Begrenzung in '+fn);
  }
  assert.match(ohneLimit,/grant execute on function public\.office_ai_consume_request\(uuid\) to authenticated;/);
  assert.match(ohneLimit,/revoke all on function public\.office_kosten_ai_consume_request\(uuid\) from public, anon;/);
  assert.doesNotMatch(sql,/grant[^;]*(update|delete)[^;]*office_kosten_(dialogue_messages|ai_requests)/i);
  assert.match(abnahme,/^begin;$/m);assert.match(abnahme,/^rollback;$/m);
  assert.match(abnahme,/B_schreibt=ok; B_liest=1; B_kontingent=true; A_liest_B=0; A_schreibt=ok; C_schreibt=ok; C_kontingent=true; C_liest=1; /);
  // Seit dem 27.11.2026 (OK von Gari) speichern die Funktionen keine Anfrage mit Person mehr: gezählt werden 0.
  assert.match(abnahme,/B_fremd=verweigert; D_kontingent=false; anon=verweigert; B_ohne_limit=true; B_gezaehlt=0; /);
  assert.match(abnahmeTerminplan,/M_ohne_limit=true; M_gezaehlt=0; N_kontingent=false; fremder_plan=false; anon=verweigert; /);
  for(const a of [abnahme,abnahmeTerminplan]){assert.match(a,/^begin;$/m);assert.match(a,/^rollback;$/m);assert.match(a,/example\.invalid/)}
  const ci=read('.github/workflows/verify.yml');
  for(const f of ['tests/sql/office-kosten-ai-rls-acceptance.sql','tests/sql/office-terminplan-ai-ohne-limit-acceptance.sql'])
    assert.ok(ci.includes(f),'die Abnahme läuft nicht in der CI: '+f);
});

test('Seite: Fenster wie beim Terminplan, Details gehen vor, übernehmen nur über geaendert(), deutsch',()=>{
  // 24.11.2026 (Gari): ein Fenster für alle Assistenten; der eigene Knopf im Kopf entfällt, der Reiter öffnet.
  assert.doesNotMatch(ui,/data-act="assistent"|ICON_KI/);
  assert.match(client,/aside\.className='assistant-panel assistent'/);
  assert.match(client,/root\.TBA_ASSISTANT_WINDOW\?\.mount\(aside,\{key:'kostenberechnung',titel:'Kosten Assistent',/);
  assert.match(ui,/verfuegbar:\(\)=>!!doc&&!istMuster&&!istArchiv,/);
  assert.match(ui,/assistent\?\.sync\(\);/);
  assert.match(ui,/darfBearbeiten:\(\)=>kannBearbeiten&&!istMuster/);
  assert.match(ui,/delete k\.assistent;/);
  assert.match(ui,/Vom Assistenten vorgeschlagen, übernommen am/);
  assert.match(client,/const details=!!b\.root\.querySelector\('\.inspektor:not\(\.assistent\)'\);/);
  assert.match(client,/aside\.hidden=details\|\|!b\.doc\(\)\?\.id\|\|!\(b\.verfuegbar\?\.\(\)\?\?true\);/);
  assert.doesNotMatch(client,/mit-inspektor/,'die Tabelle rückt für den Assistenten nicht zur Seite');
  assert.match(client,/b\.geaendert\(\);b\.zeige\(/);
  assert.match(client,/await b\.speichernJetzt\(\);/);
  assert.match(client,/expected_revision:b\.revision\(\)/);
  assert.doesNotMatch(client,/\.from\('office_kosten_instances'\)/);
  assert.doesNotMatch(client,/localStorage/);
  for(const t of ['Prüfen und übernehmen','Verwerfen','Rückgängig','Altes Büro-Excel übernehmen','Was fehlt noch?','Frag, was du willst: zu dieser Kostenberechnung',
    'Für Aktuelles sucht der Assistent im Internet','nie der Projektname','«Annahme KI»','class="as-links"','rel="noopener noreferrer"'])
    assert.ok(client.includes(t),'fehlt: '+t);
  assert.ok(!client.includes('willst, auf Deutsch oder Spanisch'),'keine Sprachen im Einstieg (Gari, 24.11.2026)');
  assert.doesNotMatch(client,/25 Anfragen|daily_ai_limit_reached/);
  assert.match(client,/const VERSION='office-kosten-ai-v2';/);
  for(const [name,txt] of [['kosten-assistent.js',client],['core.mjs',read('supabase/functions/office-kosten-ai/core.mjs')],['index.ts',edge]])
    assert.ok(!/\b(para|que|como|desde|proyecto|archivo|tarea|también|costos|cálculo|guardar)\b/i.test(txt),'spanische Wörter in '+name);
});
