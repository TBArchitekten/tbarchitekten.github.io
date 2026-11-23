// Kostenarchiv und Datenpool im echten Chromium mit synthetischem Supabase (23.11.2026). Kein Netz, keine Produktion,
// neutrale Daten. Ablauf: alte Kostenberechnungen im Archiv (Tabelle, übernommene Ansätze, Auffälliges) → in einer
// laufenden Kostenberechnung «Kennwert aus eigenen Projekten» → Werte mit Herkunft, gleiche zählen einmal → übernehmen
// als «Eigenes Projekt» mit Fundstelle und Kostenstand des Ursprungs. Archiv: nur lesen, ohne Übernahme. iPhone ohne Querscrollen.
// Bildschirmfotos nur, wenn KOSTEN_FOTOS auf einen Ordner zeigt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const fake=fs.readFileSync(new URL('./fixtures/fake-supabase-kosten.js',import.meta.url),'utf8');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const file=path.join(root,p);
  if(!file.startsWith(root)){res.writeHead(403);res.end();return}
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end();return}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(b)});
}).listen(0);
const browser=await chromium.launch({headless:true});
test.after(async()=>{await browser.close();server.close()});
const FOTOS=process.env.KOSTEN_FOTOS||'';
const foto=async(page,name,voll=true)=>{if(FOTOS)await page.screenshot({path:path.join(FOTOS,name+'.png'),fullPage:voll})};
const adresse=p=>`http://localhost:${server.address().port}/${p}`;
const X1='55555555-5555-4555-8555-555555555551',X2='55555555-5555-4555-8555-555555555552',Y='55555555-5555-4555-8555-555555555553';

// Zwei alte Kostenberechnungen im Archiv und eine laufende mit einer Position ohne Kennwert.
function daten({X1,X2,Y}){
  const db=window.__fake.db,muster=db.office_kosten_templates[0].state,k=JSON.parse(JSON.stringify(muster));
  const pos=(id,kg,titel,menge,wert,mehr={})=>({id,kg,titel,modus:'menge',menge,einheit:'m²',mengenquelle:{art:'manuell',text:'Test'},
    kennwert:{art:'annahme',wert,kostenstand:mehr.ks||'',fundstelle:'Zeile '+(mehr.zeile||1)},archivZeile:mehr.zeile,...(mehr.p||{})});
  const st=(ks,positionen,archiv,bezug={})=>({...JSON.parse(JSON.stringify(k)),kostenstand:ks,positionen,bezug:{BGF:'',BRI:'',NUF:'',AF:'',...bezug},archiv});
  db.office_projects.push({id:'66666666-6666-4666-8666-666666666666',number:'T-03',name:'Archiv B',status:'archiviert',projektleiter_id:null});
  const zeile=(id,project_id,nr,name,state,is_archived)=>({id,project_id,template_id:window.__fake.TID,template_version:'1.0',project_number:nr,project_name:name,
    phase:'LPH3',owner_id:window.__fake.UID,state,is_archived,server_revision:1,created_at:'2026-11-01T10:00:00Z',updated_at:'2026-11-01T10:00:00Z'});
  db.office_kosten_instances.push(
    zeile(X1,'44444444-4444-4444-8444-444444444444','T-02','Archiv',st('2022-Q3',[
      pos('a1','353','Belag Holz','100','180',{zeile:10,ks:'2022-Q3'}),
      pos('a2','335','Dämmplatte XPS 140 mm','75','40',{zeile:11,ks:'2022-Q3'}),
      pos('a3','335','Dämmplatte XPS 160 mm','50','42',{zeile:12,ks:'2022-Q3'})],
      {dokument:'Kostenberechnung (Prognose)',dokumentKurz:'Prognose 19.09.2022',stand:'2022-09-19',reifegrad:'berechnung',gebaeude:'Testhaus A',
        bauweise:'Massivbau',massnahme:'Neubau',quelle:'Excel (Test)',hinweise:['Summen wie im Original geprüft.']},{BGF:'200'}),true),
    zeile(X2,'66666666-6666-4666-8666-666666666666','T-03','Archiv B',st('2026-Q4',[
      pos('b1','353','Belag Holz Diele','50','180',{zeile:20,ks:'2026-Q4'}),
      pos('b2','335','Dämmplatte XPS 140 mm','60','188',{zeile:21,ks:'2026-Q4',p:{status:'entfaellt',archivNichtInSumme:true}})],
      {dokument:'Kostenfortschreibung',dokumentKurz:'Fortschreibung 30.10.2026',stand:'2026-10-30',reifegrad:'fortschreibung',gebaeude:'Testhaus B',
        bauweise:'Holzbau',massnahme:'Neubau',quelle:'Excel (Test)'}),true),
    zeile(Y,window.__fake.PID,'T-01','Testhaus',st('2026-Q4',[{id:'y1',kg:'353',titel:'Belag Holz',modus:'menge',menge:'80',einheit:'m²',
      mengenquelle:{art:'archicad',text:''},kennwert:{}}]),false));
  window.__fake.sichern();
}
async function oeffne(viewport={width:1440,height:1000}){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await ctx.newPage();
  const fehler=[];
  page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co/,r=>r.abort());
  await page.goto(adresse('kostenberechnung.html'));
  await page.locator('h1',{hasText:'Kostenberechnungen'}).waitFor();
  await page.evaluate(daten,{X1,X2,Y});
  await page.reload();
  await page.locator('#kostenarchiv').waitFor();
  return {ctx,page,fehler};
}
const instanz=(page,id)=>page.evaluate(i=>window.__fake.db.office_kosten_instances.find(x=>x.id===i),id);
const gespeichert=page=>page.waitForFunction(()=>/^gespeichert · Revision \d+$/.test(document.getElementById('kbSave')?.textContent||''));

test('Kostenarchiv: Tabelle, je m² BGF, übernommene Ansätze und Auffälliges',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    const zeilen=page.locator('.archiv-tab tbody tr');
    assert.equal(await zeilen.count(),2);
    const erste=await zeilen.first().textContent();
    assert.match(erste,/T-03/);assert.match(erste,/Fortschreibung 30\.10\.2026/);assert.match(erste,/Kostenfortschreibung, keine Abrechnung/);
    const zweite=await zeilen.nth(1).textContent();
    // KG 300: 100 × 180 + 75 × 40 + 50 × 42 = 23.100 €; je m² BGF (200 m²) 115,50 €
    assert.match(zweite,/23\.100\s€/);assert.match(zweite,/116\s€/);assert.match(zweite,/ohne Angabe 3/);
    assert.match(await zeilen.first().textContent(),/1 in der Summe/,'die Position, die entfällt, zählt nicht');
    const kopien=await page.locator('.archiv-k',{hasText:'Übernommen statt neu ermittelt'}).textContent();
    assert.match(kopien,/Belag Holz/);assert.match(kopien,/180,00\s€\/m²/);assert.match(kopien,/T-02, T-03|T-03, T-02/);
    const auff=await page.locator('.archiv-k',{hasText:'Auffällig, bitte prüfen'}).textContent();
    assert.match(auff,/T-03 · Dämmplatte XPS 140 mm: 188,00\s€\/m² für 60 m² \(nicht in der Summe\)\. In T-02 dieselbe Leistung 40,00\s€ bis 42,00\s€\/m²/);
    assert.match(auff,/Der Fall betrifft eine Zeile, die im Original nicht in der Summe steht\./);
    // Laufende Kostenberechnungen bleiben, wie sie sind; das Archiv steht darunter.
    assert.equal(await page.locator('.liste .card h2',{hasText:'Testhaus'}).count(),1);
    assert.equal(await page.locator('.liste .card h2',{hasText:'Archiv'}).count(),0);
    await foto(page,'archiv-1-liste');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Datenpool: Kennwert aus eigenen Projekten suchen, prüfen und übernehmen',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    await page.goto(adresse('kostenberechnung.html?id='+Y+'#tab=positionen'));
    await page.locator('h1',{hasText:'Testhaus'}).waitFor();
    await page.locator('.pos.zeile[data-id="y1"] .mehr').click();
    await page.locator('.inspektor [data-act="pool"]').click();
    const pool=page.locator('.inspektor .pool');
    await pool.locator('.pool-gruppe').first().waitFor();
    assert.equal(await page.inputValue('[data-pool="suche"]'),'Belag Holz');
    const gruppe=pool.locator('.pool-gruppe').first();
    assert.match(await gruppe.textContent(),/180,00\s€\/m²/);
    assert.match(await gruppe.textContent(),/gleich in 2 Kostenberechnungen/);
    assert.match(await gruppe.textContent(),/vermutlich übernommen, zählt als eine Quelle, ohne Angebot/);
    assert.match(await gruppe.textContent(),/Stand 3\. Quartal 2022 · ohne Baupreisindex unverändert/);
    assert.match(await pool.locator('.pool-sum').textContent(),/2 Werte aus 2 Kostenberechnungen · 1 unabhängig/);
    await foto(page,'archiv-2-pool',false);
    // Suchen: in KG 353 gibt es kein XPS; in allen Kostengruppen drei Werte, einer auffällig.
    await page.fill('[data-pool="suche"]','XPS');
    await pool.locator('text=Nichts gefunden in KG 353').waitFor();
    await pool.locator('[data-act="pool-filter"][data-f="kg"]').first().click();
    await pool.locator('.pool-gruppe.auffaellig').waitFor();
    assert.equal(await pool.locator('.pool-gruppe').count(),3);
    assert.match(await pool.locator('.pool-gruppe.auffaellig').textContent(),/188,00\s€\/m²[\s\S]*auffällig[\s\S]*nicht in der Summe/);
    assert.match(await pool.locator('.pool-sum').textContent(),/Spanne 40,00\s€ bis 188,00\s€\/m² · Median 42,00\s€\/m²/);
    // Zurück zu «Belag Holz» und übernehmen.
    await page.fill('[data-pool="suche"]','Belag Holz');
    await pool.locator('.pool-gruppe',{hasText:'180,00'}).waitFor();
    await pool.locator('.pool-gruppe',{hasText:'180,00'}).locator('[data-act="pool-nehmen"]').click();
    await page.locator('.kb-banner',{hasText:'Kennwert übernommen: 180,00'}).waitFor();
    assert.match(await page.locator('.kb-banner',{hasText:'Kennwert übernommen'}).textContent(),/aus T-02, Zeile 10 \(Kostenstand 3\. Quartal 2022\)/);
    await gespeichert(page);
    const kw=(await instanz(page,Y)).state.positionen[0].kennwert;
    assert.deepEqual(kw,{art:'eigen',wert:'180',kostenstand:'2022-Q3',
      fundstelle:'Kostenberechnung T-02 Archiv, Zeile 10 (Prognose 19.09.2022) · gleicher Wert auch in T-03',pool:{instanz:X1,position:'a1'}});
    // Ohne Baupreisindex bleibt der Wert, die Herkunft zeigt den Kostenstand; die Position ist vollständig.
    await page.locator('.pos.zeile[data-id="y1"] .mehr').click();
    assert.match(await page.locator('.inspektor .panel').textContent(),/80\sm² × 180,00\s€ = 14\.400,00\s€ netto/);
    assert.match(await page.locator('.pos.zeile[data-id="y1"] .chip.q').textContent(),/Eigenes Projekt/);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Archiv: nur lesen, Datenpool zum Vergleichen, nichts wird gespeichert',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    await page.goto(adresse('kostenberechnung.html?id='+X1+'#tab=positionen'));
    await page.locator('h1',{hasText:'Archiv'}).waitFor();
    assert.match(await page.locator('.kicker').first().textContent(),/Office · Kostenberechnung · Archiv/);
    assert.match(await page.locator('.kb-intro').textContent(),/T-02 · Prognose 19\.09\.2022/);
    const banner=await page.locator('.kb-banner.archiv').textContent();
    assert.match(banner,/Archiv · nur lesen\. Kostenberechnung \(Prognose\) vom 19\.09\.2022 · Excel \(Test\)\. Testhaus A · Massivbau · Neubau\. Reifegrad: Kostenberechnung, keine Abrechnung\./);
    assert.match(banner,/Summen wie im Original geprüft\./);
    assert.equal(await page.locator('#kbSave').textContent(),'Archiv · nur lesen');
    assert.equal(await page.locator('.kb-actions [data-act="import"]').count(),0);
    assert.equal(await page.locator('.kb-actions [data-act="assistent"]').count(),0);
    const vorher=await page.evaluate(()=>window.__fake.aufrufe.filter(a=>a.op==='update').length);
    await page.locator('.pos.zeile[data-id="a1"]').click();
    assert.equal(await page.locator('.inspektor input[data-key$=":menge"]').getAttribute('readonly'),'');
    await page.locator('.inspektor [data-act="pool"]').click();
    const pool=page.locator('.inspektor .pool');
    await pool.locator('.pool-gruppe').first().waitFor();
    const text=await pool.textContent();
    assert.match(text,/T-03/);assert.ok(!/T-02 Archiv · Zeile 10/.test(text),'die eigene Kostenberechnung steht nicht im Vergleich');
    assert.equal(await pool.locator('[data-act="pool-nehmen"]').count(),0,'im Archiv wird nichts übernommen');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>window.__fake.aufrufe.filter(a=>a.op==='update').length),vorher);
    await page.click('[data-act="tab"][data-tab="uebersicht"]');
    assert.match(await page.locator('.row',{hasText:'Gruppe 100'}).first().textContent(),/–/);
    await foto(page,'archiv-3-nur-lesen');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('iPhone: Kostenarchiv und Datenpool ohne Querscrollen',async()=>{
  const {ctx,page,fehler}=await oeffne({width:390,height:844});
  try{
    const breit=()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(await breit()<=1,'Liste mit Kostenarchiv: '+await breit());
    await page.goto(adresse('kostenberechnung.html?id='+Y+'#tab=positionen'));
    await page.locator('h1',{hasText:'Testhaus'}).waitFor();
    await page.locator('.pos.zeile[data-id="y1"] [data-act="waehle"]').first().click();
    await page.locator('.inspektor [data-act="pool"]').click();
    await page.locator('.inspektor .pool .pool-gruppe').first().waitFor();
    assert.ok(await breit()<=1,'Datenpool: '+await breit());
    await foto(page,'archiv-4-iphone');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});
