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

test('die Werkzeuge führen zur Kostenberechnung, und sie zurück',()=>{
  assert.match(shell,/id="officeToolsKosten" aria-label="Kostenberechnung öffnen"/);
  assert.match(shell,/<strong>Kostenberechnung<\/strong><small>Nach DIN 276 bis zur 3\. Ebene/);
  assert.match(shell,/NAV_ICONS\.kosten='<svg /);
  assert.match(projekte,/getElementById\('officeToolsKosten'\)\?\.addEventListener\('click',\(\)=>\{\s*window\.location\.href='\.\.\/kostenberechnung\.html';/);
  assert.match(index,/\.\/shell\.js\?v=office49/);
  assert.match(index,/\.\/office-projects\.js\?v=office52/);
  assert.match(ui,/href="\.\/app\/#section=tools">‹ Werkzeuge/);
});

test('die Seite lädt den Office-Client wie der Terminplan, und die Module mit Version',()=>{
  assert.match(seite,/<html lang="de">/);
  assert.match(seite,/<meta name="robots" content="noindex">/);
  assert.match(seite,/@supabase\/supabase-js@2\.57\.0\/dist\/umd\/supabase\.min\.js/);
  for(const s of ['./office-config.js?v=1','./shared/supabase-client.js?v=office3','./kosten-rechnen.js?v=office1',
    './kosten-import.js?v=office1','./kostenberechnung.js?v=office1','./kostenberechnung.css?v=office1'])
    assert.ok(seite.includes(s),'fehlt: '+s);
  assert.ok(seite.indexOf('kosten-rechnen.js')<seite.indexOf('kosten-import.js')&&seite.indexOf('kosten-import.js')<seite.indexOf('kostenberechnung.js?'));
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
  assert.match(abnahme,/C_sieht=0; C_update=0; C_delete=0; C_versions=0; '/);
  assert.match(abnahme,/raise exception 'RLS Kostenberechnung weicht ab/);
  assert.match(abnahme,/Testdaten der Kostenberechnung sind nach dem Zurückrollen geblieben/);
  assert.match(read('.github/workflows/verify.yml'),/< tests\/sql\/office-kostenberechnung-rls-acceptance\.sql/);
});

test('öffentliches Repository: keine DIN-Titel, keine Projekte, keine Adressen',()=>{
  const dateien={'kosten-rechnen.js':read('kosten-rechnen.js'),'kosten-import.js':read('kosten-import.js'),'kostenberechnung.js':ui,
    'kostenberechnung.css':css,'kostenberechnung.html':seite,[MIGRATION]:sql,
    'fixture':readFileSync(url('tests/fixtures/kosten-archicad-beispiel.xlsx')).toString('latin1')};
  // Kennzeichnende Titel der 2. und 3. Ebene; die Gliederung kommt aus dem Muster in der Datenbank.
  const TITEL=/Tragende Außenwände|Nichttragende Außenwände|Außenwandöffnungen|Außenwandbekleidungen|Deckenkonstruktionen|Deckenbeläge|Deckenbekleidungen|Dachkonstruktionen|Dachbeläge|Dachbekleidungen|Baugrube|\bGründung\b|Herrichten und Erschließen|Elementierte Außenwandkonstruktionen/;
  for(const [name,txt] of Object.entries(dateien)){
    assert.ok(!TITEL.test(txt),'DIN-276-Titel in '+name+': '+(txt.match(TITEL)||[])[0]);
    assert.ok(!/Bernried|Schwarz/.test(txt),name+' nennt ein Projekt');
    assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(txt.replace(/@supabase\/supabase-js@2\.57\.0/g,'')),name+' enthält eine E-Mail-Adresse');
  }
  assert.match(read('kosten-rechnen.js'),/Die DIN-276-Gliederung kommt aus dem Stand \(Muster in der Datenbank\), nie aus diesem Code/);
});

test('deutsch, und ohne spanische Reste',()=>{
  for(const [name,txt] of [['kostenberechnung.js',ui],['kostenberechnung.html',seite],['kosten-rechnen.js',read('kosten-rechnen.js')],['kosten-import.js',read('kosten-import.js')]])
    assert.ok(!/\b(para|que|como|desde|proyecto|archivo|tarea|también|costos|cálculo|guardar)\b/i.test(txt),'spanische Wörter in '+name);
  for(const t of ['Kostenberechnungen','Muster · nur Ansicht','Mengen aus Archicad','Bericht für die Kostenbesprechung','Was noch fehlt',
    'Herkunft des Kennwerts','Stand festhalten','Kostenschätzung und Kostenberechnung'])
    assert.ok(ui.includes(t),'fehlt in der Oberfläche: '+t);
});
