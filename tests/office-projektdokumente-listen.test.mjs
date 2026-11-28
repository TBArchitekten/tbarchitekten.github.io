// Projektstart · weitere Listen der Bürovorlage (28.11.2026): Fachplanerbedarf, Schnittstellen, Fragenliste, Eingang;
// zweiter Teil Planliste, Dokumente, Ausgaben, Verteiler, Austausch, Ablage.
// Gari: die Listen des Projektstarts im Projekt bearbeiten wie die Entscheidungsliste, statt ein Excel herunterzuladen,
// das kein lebendes Dokument ist. Geprüft ohne Netz:
// Spalten und Auswahllisten wie in scripts/muster-lph3/build_xlsx.py, die Vorbelegung aus der Bürovorlage, Termine als
// Meilenstein oder Datum, «Zuständigkeit eindeutig?» und «Stand» wie die Formeln der Vorlage, Zählen und Filtern, das
// Excel im Aufbau der Vorlage, die Migration (nur die Prüfregel der Art, erweitert) und die Seite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const K=require('../projektdokumente-kern.js'),X=require('../projektdokumente-export.js'),I=require('../kosten-import.js');
const V=require('../projektdokumente-vorlagen.js');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const HEUTE='2026-11-28';
const zeile=(id,nr,daten)=>({id,nr,daten});
const TERMINE={M00:'2026-11-10',M00A:'2026-11-20',M01:'2026-12-04',M02:'2026-12-11',M03:'2027-01-15',M07:'2027-02-26'};

// Kopf (Zeile 6) und Spaltenbreiten eines Blatts der Bürovorlage, gelesen aus der Datei in muster/lph3.
async function blatt(datei,name){
  const b=readFileSync(new URL('../muster/lph3/'+datei,import.meta.url));
  const zip=await I.zipDateien(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  const wb=await zip.text('xl/workbook.xml'),rels=await zip.text('xl/_rels/workbook.xml.rels');
  const rid=new RegExp('<sheet\\b[^>]*name="'+name+'"[^>]*r:id="([^"]+)"').exec(wb)[1];
  const rel=[...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map(m=>m[1]).find(a=>a.includes('Id="'+rid+'"'));
  const xml=await zip.text(/Target="\/?(?:xl\/)?([^"]+)"/.exec(rel)[1].replace(/^/,'xl/'));
  const kopf=I.zeilenAusBlatt(xml,I.geteilteTexte(await zip.text('xl/sharedStrings.xml'))).find(z=>z.nr===6);
  const breiten=[];
  for(const m of xml.matchAll(/<col\b([^>]*)\/>/g)){
    const a=k=>Number(new RegExp('\\b'+k+'="([^"]+)"').exec(m[1])?.[1]);
    for(let i=a('min');i<=a('max');i++)breiten[i-1]=a('width');
  }
  return {koepfe:[...kopf].filter((x,i)=>i<kopf.length&&x!==''),breiten:breiten.slice(0,kopf.length)};
}
const BLAETTER={fachplanerbedarf:['LPH3_3_Koordination.xlsx','Fachplanerbedarf'],schnittstellen:['LPH3_3_Koordination.xlsx','Schnittstellen'],
  fragenliste:['LPH3_3_Koordination.xlsx','Fragenliste'],eingang:['LPH3_3_Koordination.xlsx','Eingang'],planliste:['LPH3_2_Planliste.xlsx','Planliste'],
  dokumente:['LPH3_2_Planliste.xlsx','Dokumente'],ausgaben:['LPH3_2_Planliste.xlsx','Ausgaben'],verteiler:['LPH3_2_Planliste.xlsx','Verteiler'],
  austausch:['LPH3_2_Planliste.xlsx','Austausch'],ablage:['LPH3_2_Planliste.xlsx','Ablage']};

test('Spalten und Auswahllisten sind die der Bürovorlage; Excel hat genau ihre Spalten',async()=>{
  const py=read('scripts/muster-lph3/build_xlsx.py');
  const liste=name=>JSON.parse(new RegExp('"'+name.replace(/[/?]/g,'\\$&')+'": (\\[[^\\]]*\\])').exec(py)[1]);
  assert.deepEqual(K.ZUSTAENDIGKEIT,liste('Zuständigkeit'));
  assert.deepEqual(K.JA_NEIN_PRUEFEN,liste('ja/nein/prüfen'));
  assert.deepEqual(K.BEAUFTRAGT,liste('Beauftragt'));
  assert.deepEqual(K.STATUS_FACHPLANER,liste('Status Fachplaner'));
  assert.deepEqual(K.STATUS_SCHNITTSTELLE,liste('Status Schnittstelle'));
  assert.deepEqual(K.STATUS_FRAGE,liste('Status Frage'));
  assert.deepEqual(K.WER_FRAGT,liste('Wer fragt'));
  assert.deepEqual(K.BESTAETIGUNG,liste('Bestätigung'));
  assert.deepEqual(K.PLANARTEN.map(p=>p[0]),liste('Planart'));
  assert.deepEqual(K.STATUS_PLAN,liste('Status Plan'));
  assert.deepEqual(K.UEBERGABE,liste('Übergabe'));
  assert.deepEqual(K.FORMATE,JSON.parse(/"Format": (\[[^\]]*\])/.exec(py.slice(py.indexOf('"Planart"')))[1]));
  assert.deepEqual(Object.keys(BLAETTER),K.WEITERE);
  for(const art of K.WEITERE){
    const b=await blatt(...BLAETTER[art]);
    assert.equal(b.koepfe.length,b.breiten.length,art);
    // Im Office steht ein Termin in einer Spalte (Meilenstein oder Datum); die Vorlage hat dazu die Spalte «Datum».
    const ohneDatum=b.koepfe.map((k,i)=>[k,b.breiten[i]]).filter(([k],i)=>!(k==='Datum'&&K.SPALTEN[art].some(sp=>sp.datumSpalte&&sp.kopf===b.koepfe[i-1])));
    assert.deepEqual(K.SPALTEN[art].map(sp=>sp.kopf),ohneDatum.map(x=>x[0]),art);
    assert.deepEqual(K.SPALTEN[art].map(sp=>sp.breite),ohneDatum.map(x=>x[1]),art);
    const x=X.listenBlatt(K,art,[],{heute:HEUTE});
    assert.deepEqual(x.koepfe,b.koepfe,'Excel '+art);
    assert.deepEqual(x.breiten,b.breiten,'Excel '+art);
    assert.ok(K.FELDER[art].length>=K.SPALTEN[art].length-2,art);
    assert.ok(K.SPALTEN[art].every(sp=>sp.key==='nr'||sp.typ==='berechnet'||K.FELDER[art].includes(sp.key)),'jede Spalte ist ein Feld: '+art);
    assert.ok(K.DOKUMENTE[art].titel&&K.DOKUMENTE[art].untertitel,art);
  }
  // Die Meilensteine sind die des Blatts «Projekt».
  const ms=[...py.matchAll(/\("(M\d{2}A?)", "([^"]+)"/g)].map(m=>[m[1],m[2]]);
  assert.deepEqual(K.MEILENSTEINE,ms);
});

test('Vorbelegung aus der Bürovorlage, ohne Fußnoten und ohne Formeln',()=>{
  assert.deepEqual(Object.fromEntries(Object.entries(V).map(([k,v])=>[k,v.length])),
    {fragenliste:85,fachplanerbedarf:12,schnittstellen:25,eingang:6,planliste:18,dokumente:23,ausgaben:8,verteiler:9,austausch:8,ablage:12});
  for(const art of K.WEITERE)for(const z of V[art])for(const k of Object.keys(z))assert.ok(K.FELDER[art].includes(k)||k==='eindeutig','Feld '+art+'.'+k);
  const js=read('projektdokumente-vorlagen.js');
  assert.match(js,/Erzeugt von\n {3}scripts\/projektdokumente-vorlagen\.py/);
  assert.doesNotMatch(js,/"=/,'keine Formel aus der Vorlage');
  const codes=new Set(K.MEILENSTEINE.map(m=>m[0])),diszi=new Set(K.DISZIPLINEN.map(d=>d[0]));
  for(const z of V.fragenliste){
    assert.match(z.code,/^[A-Z]+-\d{2}$/);assert.ok(diszi.has(z.disziplin),z.code);assert.ok(K.WER_FRAGT.includes(z.wer),z.code);
    assert.ok(codes.has(z.bis),z.code+' '+z.bis);assert.equal(z.status,'offen');assert.ok(z.frage.length>10);
  }
  assert.equal(new Set(V.fragenliste.map(z=>z.code)).size,85,'jeder Code einmal');
  for(const z of V.fachplanerbedarf){assert.ok(z.kuerzel&&z.disziplin&&z.regel,z.disziplin);assert.equal(z.bis,'M00A');assert.equal(z.erforderlich,'')}
  assert.ok(!V.fachplanerbedarf.some(z=>/Spalte O/.test(z.disziplin)),'die Fußnote ist keine Zeile');
  for(const z of V.schnittstellen){
    for(const [k] of K.MATRIX)assert.ok(z[k]===''||K.ZUSTAENDIGKEIT.includes(z[k]),z.thema+' '+k+' '+z[k]);
    assert.match(z.gruppe,/^[ABC] · /);assert.ok(codes.has(z.lieferung1),z.thema);
  }
  assert.deepEqual(V.eingang.map(z=>z.disziplin),['TWP','HLS','ELT','BPH','BRS','FRA']);
  for(const z of V.eingang){assert.equal(z.erwartet01,'M03');assert.equal(z.erwartet_end,'M07')}
  // Planliste: Planart und Status aus den Auswahllisten, keine Fußnote; Verteiler je Ausgabe ein Format.
  for(const z of V.planliste){assert.ok(K.PLANARTEN.some(p=>p[0]===z.planart),z.titel);assert.ok(K.STATUS_PLAN.includes(z.status),z.titel)}
  assert.ok(!V.planliste.some(z=>/Vorschlag für eine typische/.test(z.titel)),'die Fußnote ist keine Zeile');
  assert.ok(!V.ausgaben.some(z=>/ersten zehn Ausgaben/.test(z.anlass)),'die Fußnote ist keine Zeile');
  for(const z of V.verteiler)for(let i=1;i<=K.AUSGABEN_VERTEILER;i++)assert.ok(K.UEBERGABE.includes(z['a'+i]),z.empfaenger+' a'+i);
  assert.deepEqual(V.ablage.map(z=>z.office).filter(x=>x==='nein').length,2);
  // Grundlagen und Zuarbeit prüft die Vorlage nicht auf «eindeutig» (dort steht «–»).
  assert.deepEqual(V.schnittstellen.filter(z=>z.eindeutig==='–').map(z=>z.gruppe[0]).join(''),'AAACCCC');
});

test('Termine: Meilenstein oder Datum, das Datum aus dem Terminplan',()=>{
  K.setzeTermine({});
  assert.equal(K.leseTermin('m3',HEUTE),'M03');
  assert.equal(K.leseTermin('M00a',HEUTE),'M00A');
  assert.equal(K.leseTermin('M03 · Zieltermin Fachplanungsbeiträge',HEUTE),'M03','ein Eintrag der Vorschlagsliste');
  assert.equal(K.leseTermin('15.1.',HEUTE),'2027-01-15');
  assert.equal(K.leseTermin('',HEUTE),'');
  assert.equal(K.leseTermin('bald',HEUTE),null);
  assert.equal(K.terminVon('M03'),'','ohne Terminplan kein Datum');
  assert.equal(K.terminFehlt('M03'),'Datum fehlt');
  assert.equal(K.terminFehlt('M15'),'Meilenstein?');
  K.setzeTermine({...TERMINE,X1:'2026-01-01',M09:'kein Datum'});
  assert.deepEqual(K.termine(),TERMINE,'nur Codes mit gültigem Datum');
  assert.equal(K.terminVon('M03'),'2027-01-15');
  assert.equal(K.terminVon('2026-12-24'),'2026-12-24');
  assert.equal(K.terminText('M01',HEUTE),'M01 · 04.12.');
  assert.equal(K.terminText('M03',HEUTE),'M03 · 15.01.2027');
  assert.equal(K.zellText('fragenliste','bis',{bis:'M02'},{heute:HEUTE}),'M02 · 11.12.2026');
  assert.equal(K.meilensteinName('M00A'),'Erforderliche Fachplaner beauftragt');
  K.setzeTermine({});
});

test('«Zuständigkeit eindeutig?» und «Stand» wie die Formeln der Vorlage',()=>{
  const z=t=>K.zustaendigkeit(Object.fromEntries(Object.entries(t)));
  assert.equal(z({}),'');
  assert.equal(z({z_arch:'K',z_twp:'G',z_hls:'M'}),'eindeutig');
  assert.equal(z({z_arch:'G/K',z_twp:'M'}),'eindeutig','G/K zählt als eine planende Stelle');
  assert.equal(z({z_arch:'K',z_hls:'?',z_elt:'?'}),'offen – im Kick-off klären');
  assert.equal(z({z_ag:'V',z_beh:'F',z_arch:'K'}),'keine planende Stelle');
  assert.equal(z({z_arch:'G',z_elt:'G'}),'mehrere planende Stellen – abgrenzen');
  assert.equal(z({z_arch:'K',z_fra:'B',z_twp:'G'}),'mehrere planende Stellen – abgrenzen','B plant auch');
  assert.equal(z({eindeutig:'–',z_arch:'G',z_elt:'G'}),'–','wo die Vorlage «–» setzt');
  K.setzeTermine(TERMINE);
  const st=d=>K.eingangStand({disziplin:'TWP',erwartet01:'M03',erwartet_end:'M07',...d},HEUTE);
  assert.equal(K.eingangStand({},HEUTE),'');
  assert.equal(st({}),'Arbeitsstand 01 ausstehend');
  assert.equal(K.eingangStand({disziplin:'TWP',erwartet01:'M00'},HEUTE),'Arbeitsstand 01 überfällig');
  assert.equal(st({eingang01:'2027-01-10',vollstaendig:'nein'}),'Arbeitsstand 01 unvollständig');
  assert.equal(st({eingang01:'2027-01-10'}),'Endstand ausstehend');
  assert.equal(K.eingangStand({disziplin:'TWP',eingang01:'2026-11-01',erwartet_end:'2026-11-20'},HEUTE),'Endstand überfällig');
  assert.equal(st({eingang01:'2027-01-10',eingang_end:'2027-02-20'}),'Rückmeldung ausstehend');
  assert.equal(st({eingang01:'2027-01-10',eingang_end:'2027-02-20',rueckmeldung:'stimmt überein'}),'bestätigt');
  assert.equal(st({eingang01:'2027-01-10',eingang_end:'2027-02-20',rueckmeldung:'Vorbehalt'}),'Vorbehalt');
  K.setzeTermine({});
});

test('Zählen, Filtern und «überfällig» der weiteren Listen',()=>{
  K.setzeTermine(TERMINE);
  // Fragenliste: überfällig ist eine offene Frage nach ihrem Termin; der Filter «Disziplin» zeigt dazu die Fragen an alle.
  const f=[zeile('a',1,{code:'ALLE-01',disziplin:'ALLE',bis:'M00',status:'offen',frage:'A'}),zeile('b',2,{code:'TWP-01',disziplin:'TWP',bis:'M00',status:'Termin vereinbart'}),
    zeile('c',3,{code:'TWP-02',disziplin:'TWP',bis:'M03',status:'offen'}),zeile('d',4,{code:'HLS-01',disziplin:'HLS',bis:'2026-11-01',status:'beantwortet'}),
    zeile('e',5,{code:'HLS-02',disziplin:'HLS',bis:'M00',status:'entfällt'})];
  assert.deepEqual(f.map(z=>K.ueberfaellig('fragenliste',z.daten,HEUTE)),[true,false,false,false,false]);
  assert.equal(K.zusammenfassung('fragenliste',K.zaehle('fragenliste',f,HEUTE)),'5 Fragen · 2 offen · 1 mit Termin · 1 beantwortet · 1 entfällt · 1 überfällig');
  assert.deepEqual(K.filtere('fragenliste',f,{disziplin:'TWP',heute:HEUTE}).map(z=>z.id),['a','b','c']);
  assert.deepEqual(K.filtere('fragenliste',f,{filter:'ueberfaellig',heute:HEUTE}).map(z=>z.id),['a']);
  assert.deepEqual(K.zaehleFilter('fragenliste',f,HEUTE),{alle:5,offen:2,ueberfaellig:1,'Termin vereinbart':1,beantwortet:1,'entfällt':1});
  assert.equal(K.nummer('fragenliste',7,{code:'TWP-02'}),'TWP-02');
  assert.equal(K.nummer('fragenliste',7,{}),'7');
  assert.equal(K.naechsterCode(f,'twp'),'TWP-03');
  assert.equal(K.naechsterCode(f,'GEO'),'GEO-01');
  // Fachplanerbedarf: überfällig, solange erforderlich sein kann und nicht beauftragt ist.
  const p=[zeile('a',1,{kuerzel:'TWP',erforderlich:'ja',beauftragt:'ja',bis:'M00A',status:'beauftragt'}),zeile('b',2,{kuerzel:'HLS',erforderlich:'ja',beauftragt:'angefragt',bis:'M00A',status:'angefragt'}),
    zeile('c',3,{kuerzel:'BRS',erforderlich:'prüfen',bis:'M01',status:'offen'}),zeile('d',4,{kuerzel:'GEO',erforderlich:'nein',bis:'M00A',status:'entfällt'}),
    zeile('e',5,{kuerzel:'VER',erforderlich:'',bis:'M00A',status:'offen'})];
  assert.deepEqual(p.map(z=>K.ueberfaellig('fachplanerbedarf',z.daten,HEUTE)),[false,true,false,false,true]);
  assert.equal(K.zusammenfassung('fachplanerbedarf',K.zaehle('fachplanerbedarf',p,HEUTE)),
    '5 Disziplinen · 1 noch nicht beurteilt · 2 erforderlich, davon 1 noch nicht beauftragt · 1 zu prüfen · 2 überfällig');
  assert.deepEqual(K.zaehleFilter('fachplanerbedarf',p,HEUTE),{alle:5,nicht_beurteilt:1,erforderlich:2,nicht_beauftragt:1,pruefen:1,beauftragt:1,ueberfaellig:2});
  assert.equal(K.erledigt('fachplanerbedarf',p[3].daten),true,'nicht erforderlich ist erledigt');
  // Schnittstellen: der Filter «Disziplin» zeigt die Themen, in denen sie eingetragen ist; nie überfällig.
  const s=V.schnittstellen.map((d,i)=>zeile('s'+i,i+1,d));
  assert.equal(K.zusammenfassung('schnittstellen',K.zaehle('schnittstellen',s,HEUTE)),'25 Schnittstellen · 2 Zuständigkeiten offen oder doppelt · 25 Vorschlag v0 · 0 abgestimmt v1');
  assert.deepEqual(K.filtere('schnittstellen',s,{filter:'klaeren'}).map(z=>z.daten.thema),['Aufzug und Förderanlagen','Beleuchtung und Lichtkonzept']);
  assert.equal(K.filtere('schnittstellen',s,{disziplin:'GEO'}).length,s.filter(z=>z.daten.z_geo).length);
  assert.equal(K.filtere('schnittstellen',s,{suche:'Grundlagen'}).length,3,'die Suche findet die Gruppe');
  assert.ok(s.every(z=>!K.ueberfaellig('schnittstellen',z.daten,HEUTE)));
  // Eingang: überfällig nach dem erwarteten Termin des noch fehlenden Beitrags.
  const e=[zeile('a',1,{disziplin:'TWP',erwartet01:'M00',erwartet_end:'M07'}),zeile('b',2,{disziplin:'HLS',erwartet01:'M00',eingang01:'2026-11-05',vollstaendig:'nein',erwartet_end:'M00A'}),
    zeile('c',3,{disziplin:'ELT',eingang01:'2026-11-05',eingang_end:'2026-11-20',rueckmeldung:'stimmt überein'})];
  assert.deepEqual(e.map(z=>K.ueberfaellig('eingang',z.daten,HEUTE)),[true,false,false]);
  assert.equal(K.zusammenfassung('eingang',K.zaehle('eingang',e,HEUTE)),'3 Disziplinen · Arbeitsstand 01 von 2 eingegangen · Endstand von 1 eingegangen · 1 bestätigt · 1 überfällig');
  assert.equal(K.nummer('eingang',1,{disziplin:'TWP'}),'TWP');
  K.setzeTermine({});
});

test('Excel im Aufbau der Vorlage: Termin mit Datum daneben, Gruppen, Auswahllisten',async()=>{
  K.setzeTermine(TERMINE);
  const f=[zeile('a',1,{...V.fragenliste[0],antwort:'Liegt bei <Anlage>',status:'beantwortet',beantwortet_am:'2026-11-27'}),zeile('b',2,{...V.fragenliste[1],bis:'M15'})];
  const lies=async bl=>{const b=X.xlsx(bl,new Date('2026-11-28T08:00:00Z'));return (await I.leseXlsxBlaetter(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)))[0]};
  const fl=await lies(X.listenBlatt(K,'fragenliste',f,{projekt:'T-01 · Testhaus',heute:HEUTE}));
  assert.equal(fl.name,'Fragenliste');
  const kopf=fl.zeilen.find(r=>r.includes('Frage · benötigte Angabe'));
  const r1=fl.zeilen[fl.zeilen.indexOf(kopf)+1],r2=fl.zeilen[fl.zeilen.indexOf(kopf)+2];
  assert.equal(r1[0],'ALLE-01');assert.equal(r1[7],'M02');
  assert.equal(String(r1[8]),String(K.excelTag('2026-12-11')),'das Datum des Meilensteins');
  assert.equal(r1[9],'Liegt bei <Anlage>');
  assert.equal(r2[8],'Meilenstein?','unbekannter Meilenstein wie in der Vorlage');
  const sx=X.listenBlatt(K,'schnittstellen',V.schnittstellen.map((d,i)=>zeile('s'+i,i+1,d)),{heute:HEUTE});
  assert.deepEqual(sx.zeilen.filter(r=>r.length===1).map(r=>r[0]),['A · Grundlagen','B · Themen und Bauteile','C · Zuarbeit zu den Ergebnissen der Objektplanung']);
  assert.ok(sx.hinweis.includes('V Verantwortung · G plant (Grundleistung)'),'die Legende');
  assert.deepEqual(sx.auswahl.map(a=>a.spalte),['D','E','F','G','H','I','J','K','L','M','N','R','T','X'],'wie die Auswahllisten der Vorlage');
  assert.deepEqual(X.listenBlatt(K,'fachplanerbedarf',[],{heute:HEUTE}).auswahl.map(a=>a.spalte),['F','H','P']);
  assert.deepEqual(X.listenBlatt(K,'eingang',[],{heute:HEUTE}).fixiert,{spalten:1,zeilen:6});
  K.setzeTermine({});
});

test('Planliste: Plannummer aus dem Planschlüssel, Ausgaben als Spalten, Zählen',async()=>{
  K.setzePlanschluessel({});
  const p=V.planliste.map((d,i)=>zeile('p'+i,i+1,d));
  // Wie die Formel der Vorlage: Kürzel – LPH – Planart – Geschoss – lfd. Nr (zweistellig); ohne Geschoss bei «–».
  assert.equal(K.plannummer(p[0].daten),'(Kürzel)-3-LP-01');
  assert.equal(K.plannummer(p[2].daten),'(Kürzel)-3-GR-EG-01');
  K.setzePlanschluessel({kuerzel:'ABC',trenn:'_'});
  assert.equal(K.plannummer(p[2].daten),'ABC_3_GR_EG_01');
  assert.equal(K.plannummer({...p[2].daten,plannummer:'A-100'}),'A-100','eine eigene Nummer gilt vor');
  assert.equal(K.plannummer({...p[2].daten,titel:''}),'','ohne Plantitel keine Nummer');
  assert.equal(K.plannummer({...p[2].daten,lfd:'12'}),'ABC_3_GR_EG_12');
  K.setzePlanschluessel({kuerzel:'ABC'});
  assert.deepEqual(K.planschluessel(),{kuerzel:'ABC',lph:'3',trenn:'-'});
  const q=[zeile('a',1,{...p[2].daten,status:'Arbeitsstand 01',index:'A',a1:'A'}),zeile('b',2,{...p[3].daten,status:'entfällt'}),zeile('c',3,p[4].daten)];
  assert.equal(K.zusammenfassung('planliste',K.zaehle('planliste',q,HEUTE)),'2 Pläne · 1 in Bearbeitung · 1 Arbeitsstand 01 · 1 schon ausgegeben · 1 ersetzt oder entfallen');
  assert.deepEqual(K.zaehleFilter('planliste',q,HEUTE),{alle:3,'in Bearbeitung':1,'Teilstand (vorläufig)':0,'Arbeitsstand 01':1,'Stand 02':0,'Endstand LPH 3':0,nie_ausgegeben:1,weg:1});
  assert.equal(K.erledigt('planliste',q[1].daten),true,'entfällt ist grau');
  assert.deepEqual(K.filtere('planliste',p,{disziplin:'AN'}).map(z=>z.daten.titel),['Ansicht Nord','Ansicht Ost','Ansicht Süd','Ansicht West'],'Filter nach Planart');
  assert.equal(K.zellText('planliste','plannummer',q[0].daten,{nr:1}),'ABC-3-GR-EG-01');
  // Excel: Datum und Anlass der Ausgaben über den Spalten, die Plannummer gerechnet, der Index je Ausgabe.
  const aus=[zeile('x',1,{...V.ausgaben[0],datum:'2026-12-04'}),zeile('y',2,V.ausgaben[1])];
  const bl=X.listenBlatt(K,'planliste',q,{heute:HEUTE,ausgaben:aus});
  assert.deepEqual(bl.ueberKopf[4],[[13,'Datum der Ausgabe →'],[14,{datum:K.excelTag('2026-12-04')}]]);
  assert.deepEqual(bl.ueberKopf[5],[[13,'Anlass →'],[14,V.ausgaben[0].anlass],[15,V.ausgaben[1].anlass]]);
  assert.deepEqual(bl.zeilen[0].slice(0,3),[1,'ABC-3-GR-EG-01','GR']);
  assert.equal(bl.zeilen[0][14],'A');
  assert.deepEqual(bl.auswahl.map(a=>a.spalte),['C','H','J']);
  const b=X.xlsx(bl,new Date('2026-11-28T08:00:00Z'));
  const gelesen=(await I.leseXlsxBlaetter(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)))[0].zeilen;
  assert.equal(gelesen.find(z=>z.nr===5)[14],V.ausgaben[0].anlass);
  assert.equal(gelesen.find(z=>z.nr===4)[13],'Datum der Ausgabe →');
  const vt=X.listenBlatt(K,'verteiler',V.verteiler.map((d,i)=>zeile('v'+i,i+1,d)),{heute:HEUTE,ausgaben:aus});
  assert.deepEqual(vt.ueberKopf[5],[[2,V.ausgaben[0].anlass],[3,V.ausgaben[1].anlass]]);
  assert.deepEqual(vt.auswahl.map(a=>a.spalte),['C','D','E','F','G','H','I','J']);
  K.setzePlanschluessel({});
});

test('Dokumente, Ausgaben, Verteiler, Austausch, Ablage: Name der Zeile, Zählen, Filtern',()=>{
  const z=a=>V[a].map((d,i)=>zeile(a+i,i+1,d));
  assert.equal(K.nummer('dokumente',1,V.dokumente[0]),'PSV');
  assert.equal(K.nummer('verteiler',1,V.verteiler[0]),'Auftraggeber');
  assert.equal(K.nummer('austausch',1,V.austausch[0]),'Architektur (Bezug für alle)');
  assert.equal(K.nummer('ablage',1,V.ablage[0]),'01_Grundlagen');
  assert.equal(K.nummer('ausgaben',3,V.ausgaben[2]),'3');
  const d=z('dokumente');d[0].daten={...d[0].daten,stand:'1: Vermerk mit Projektparametern'};
  assert.equal(K.zusammenfassung('dokumente',K.zaehle('dokumente',d,HEUTE)),'23 Ergebnisse · 1 mit Stand · 22 noch ohne');
  const a=z('ausgaben');a[0].daten={...a[0].daten,datum:'2026-11-20'};a[1].daten={...a[1].daten,datum:'2026-12-20'};
  assert.equal(K.zusammenfassung('ausgaben',K.zaehle('ausgaben',a,HEUTE)),'8 Ausgaben · 1 ausgegeben · 7 geplant','ein späteres Datum ist geplant');
  assert.deepEqual(K.filtere('ausgaben',a,{filter:'ausgegeben',heute:HEUTE}).map(x=>x.nr),[1]);
  assert.equal(K.zusammenfassung('verteiler',K.zaehle('verteiler',z('verteiler'),HEUTE)),'9 Empfänger · 8 Ausgaben als Spalten');
  const t=z('austausch');t[0].daten={...t[0].daten,vereinbart_am:'2026-12-11'};
  assert.equal(K.zusammenfassung('austausch',K.zaehle('austausch',t,HEUTE)),'8 Fachplanungen · 1 vereinbart · 7 noch offen');
  assert.equal(K.zusammenfassung('ablage',K.zaehle('ablage',z('ablage'),HEUTE)),'12 Ordner · 10 ins Office · 2 nicht ins Office');
  assert.deepEqual(K.filtere('ablage',z('ablage'),{filter:'nicht_ins_office'}).map(x=>x.daten.ordner),['02_Planung_Architektur/Arbeitsstand','10_Vertrag_Honorar']);
  for(const art of ['dokumente','ausgaben','verteiler','austausch','ablage'])assert.ok(z(art).every(x=>!K.ueberfaellig(art,x.daten,HEUTE)&&!K.erledigt(art,x.daten)),art);
  assert.deepEqual(K.leereZeile('ablage'),{ordner:'',inhalt:'',regel:'',office:'ja'});
});

test('Migration: nur die Prüfregel der Art, erweitert; nichts gelöscht, Rechte unverändert',()=>{
  const datei=readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(f=>/_office_projektdokumente_weitere_listen\.sql$/.test(f));
  assert.ok(datei,'Migration fehlt');
  const sql=read('supabase/migrations/'+datei),ohne=sql.replace(/--.*$/gm,'');
  assert.equal((ohne.match(/drop constraint/g)||[]).length,1);
  assert.match(ohne,/alter table public\.office_projektdokumente drop constraint office_projektdokumente_art_check;/);
  assert.doesNotMatch(ohne,/\b(delete|update|truncate|drop table|drop column|drop policy|grant|revoke|policy)\b/i);
  const neu=JSON.parse('['+/check \(art in \(([\s\S]*?)\)\);/.exec(ohne)[1].replace(/'/g,'"')+']');
  for(const a of ['klaerungsliste','entscheidungsliste','entscheidungsvorlagen'])assert.ok(neu.includes(a),'bisherige Art bleibt: '+a);
  for(const a of K.ARTEN)assert.ok(neu.includes(a),'Art des Kerns erlaubt: '+a);
  assert.match(sql,/OK von Gari am 28\.11\.2026 für\n-- genau diese Änderung/);
  const ci=read('.github/workflows/verify.yml');
  assert.ok(ci.includes('tests/sql/office-projektdokumente-listen-acceptance.sql'));
  assert.match(read('tests/sql/office-projektdokumente-listen-acceptance.sql'),/B_vorlage=1,2,3/);
});

test('Seite: Vorbelegung geladen, alle Listen bearbeitbar, Romy nur bei Klärungen und Entscheidungen',()=>{
  const html=read('projektdokumente.html'),js=read('projektdokumente.js');
  const v=html.indexOf('projektdokumente-vorlagen.js?v='),seite=html.indexOf('projektdokumente.js?v=');
  assert.ok(v>0&&v<seite,'die Vorbelegung vor der Seite');
  assert.match(js,/const LISTEN=\['klaerungsliste','entscheidungsliste',\.\.\.K\.WEITERE\];/);
  assert.match(js,/const MIT_ROMY=\['klaerungsliste','entscheidungsliste'\];/);
  assert.match(js,/mitRomy=romy\.bereit&&MIT_ROMY\.includes\(art\)/);
  // Anlegen mit der Vorlage: eine Anweisung für alle Zeilen; die Daten der Meilensteine aus dem Terminplan.
  assert.match(js,/insert\(reihen\)\.select\(ZEILE\)/);
  assert.match(js,/from\('office_terminplan_instances'\)\.select\('phase,state,updated_at'\)\.eq\('project_id',projekt\.id\)/);
  assert.match(js,/K\.setzeTermine\(liste\)/);
  assert.ok(!js.includes("folgt('Fachplanerbedarf und Schnittstellen'"),'keine Karte «Noch nicht gebaut» mehr für die Koordination');
  assert.ok(!js.includes("folgt('Planliste'"),'keine Karte «Noch nicht gebaut» mehr für die Planliste');
  // Planliste: das Kürzel steht beim Dokument; «Aktuellen Index eintragen» schreibt den Index in die Spalte der Ausgabe.
  assert.match(js,/setzeMeta\('planliste',\{kuerzel:k\}\)/);
  assert.match(js,/function indexEintragen\(liste,n\)\{\n  const key='a'\+n;/);
  assert.match(js,/X\.listenBlatt\(K,art,liste,\{projekt:[^}]*,ausgaben:zeilen\.ausgaben\}\)/);
  for(const name of ['projektdokumente-vorlagen.js','scripts/projektdokumente-vorlagen.py','tests/sql/office-projektdokumente-listen-acceptance.sql']){
    const txt=read(name);
    assert.ok(!/Bernried|Schwarz/.test(txt),name+' nennt ein Projekt');
    const mails=(txt.match(/[\w.+-]+@[\w-]+\.[a-z.]{2,}/gi)||[]).filter(m=>!/\.invalid$/.test(m));
    assert.deepEqual(mails,[],'E-Mail-Adresse in '+name);
    const kommentare=(txt.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|--[^\n]*|#[^\n]*|"""[\s\S]*?"""/g)||[]).join('\n');
    assert.ok(!/\b(para|que|como|desde|proyecto|archivo|tarea|también|costos|cálculo|guardar|porque)\b/i.test(kommentare),'spanische Wörter in '+name);
  }
  // Die Texte der Vorbelegung stammen aus der Bürovorlage, die schon im Repository steht (build_xlsx.py); Wörter wie
  // «Gründung» stehen dort als Fachbegriff in Fragen, nicht als Titel der DIN 276.
  const py=read('scripts/muster-lph3/build_xlsx.py');
  for(const z of V.fragenliste.slice(0,20))assert.ok(py.includes(z.frage.slice(0,40).replace(/"/g,'\\"'))||py.includes(z.frage.slice(0,40)),'aus der Vorlage: '+z.code);
});
