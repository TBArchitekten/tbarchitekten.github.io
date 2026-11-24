// Kostenberechnung im echten Chromium mit synthetischem Supabase (21.11.2026). Kein Netz, keine Produktion.
// Ablauf wie im Büro: Muster übernehmen → Mengen aus Archicad (Testexport) → Kennwert mit Herkunft →
// Regionalfaktor (Tippfehler wird abgefangen) → Rezept → Vergleich → Bericht und Stand festhalten.
// Dazu: Muster nur ansehen, Konflikt beim Speichern, und die Seite auf dem iPhone ohne Querscrollen.
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
const exportDatei=fileURLToPath(new URL('../fixtures/kosten-archicad-beispiel.xlsx',import.meta.url));
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
const foto=async(page,name)=>{if(FOTOS)await page.screenshot({path:path.join(FOTOS,name+'.png'),fullPage:true})};
const adresse=p=>`http://localhost:${server.address().port}/${p}`;

async function oeffne(viewport={width:1440,height:1000}){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await ctx.newPage();
  const fehler=[];
  page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co/,r=>r.abort());
  await page.goto(adresse('kostenberechnung.html'));
  await page.locator('h1',{hasText:'Kostenberechnungen'}).waitFor();
  return {ctx,page,fehler};
}
async function anlegen(page){
  await page.click('[data-act="neu"]');
  const dlg=page.locator('#kbNeu');await dlg.waitFor();
  await dlg.locator('button[type="submit"]').click();
  await page.waitForURL(/kostenberechnung\.html\?id=/);
  await page.locator('h1',{hasText:'Testhaus'}).waitFor();
}
const gespeichert=page=>page.waitForFunction(()=>/^gespeichert · Revision \d+$/.test(document.getElementById('kbSave')?.textContent||''));
const stand=page=>page.evaluate(()=>window.__fake.db.office_kosten_instances[0]);

test('Ablauf: anlegen, Mengen aus Archicad, Kennwert mit Herkunft, Vergleich, Bericht',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    // Liste: das Muster nur zur Ansicht; anlegen nur für aktive Projekte.
    assert.equal(await page.locator('.liste .card h2',{hasText:'Kostenberechnung LPH 3'}).count(),1);
    await foto(page,'1-liste');
    await page.click('[data-act="neu"]');
    const optionen=await page.locator('#kbNeu select[name="projekt"] option').allTextContents();
    assert.deepEqual(optionen,['T-01 · Testhaus'],'ein archiviertes Projekt wird zum Anlegen angeboten');
    await page.click('#kbNeu [data-dlg="zu"]');
    await anlegen(page);
    const angelegt=await stand(page);
    assert.equal(angelegt.owner_id,'11111111-1111-4111-8111-111111111111');
    assert.equal(angelegt.template_version,'1.0');
    assert.match(angelegt.state.kostenstand,/^\d{4}-Q[1-4]$/);

    // Übersicht: vier Karten, vorläufig, KG 300 aufgeklappt, was noch fehlt.
    assert.equal(await page.locator('.sum .card').count(),4);
    assert.equal(await page.locator('.sum .chip',{hasText:'vorläufig'}).count(),1);
    assert.ok(await page.locator('.row.sub',{hasText:'Gruppe 390'}).count()>=1,'KG 300 ist nicht aufgeklappt');
    assert.ok(await page.locator('.todo').count()>=5);
    await foto(page,'2-uebersicht-leer');

    // Mengen aus Archicad.
    await page.click('.kb-actions [data-act="import"]');
    await page.setInputFiles('#kbDatei',exportDatei);
    await page.locator('#kbVorschau tbody tr').nth(4).waitFor();
    assert.equal(await page.locator('#kbVorschau tbody tr').count(),5);
    assert.match(await page.locator('#kbVorschau').textContent(),/7 Zeilen gelesen, 5 Gruppen, 2 Zeilen ohne Kostengruppe übersprungen/);
    await foto(page,'3-import-vorschau');
    await page.click('#kbUebernehmen');
    await page.locator('.kb-banner',{hasText:'Import übernommen: 5 neue'}).waitFor();
    await gespeichert(page);
    let s=await stand(page);
    assert.equal(s.server_revision,2);
    assert.equal(s.state.positionen.find(p=>p.id==='ac:AW-01:331').menge,'238.75');
    assert.equal(s.state.positionen.find(p=>p.id==='ac:DE-01:351').menge,'182.4');

    // Kennwert aus dem BKI-Buch: brutto, Fundstelle, Herkunftskette.
    await page.click('.pos[data-id="ac:AW-01:331"] .mehr');
    const k='pos:ac:AW-01:331:';
    await page.selectOption(`.panel [data-key="${k}kennwert.art"]`,'bki');
    await page.fill(`.panel [data-key="${k}kennwert.wert"]`,'250');
    // Direkt auf den nächsten Knopf: der Klick darf nicht verloren gehen.
    await page.click(`.panel [data-key="${k}kennwert.fundstelle"]`);
    await page.fill(`.panel [data-key="${k}kennwert.fundstelle"]`,'BKI Bauelemente, S. 120');
    await page.click('.tab[data-tab="quellen"]');
    assert.equal(await page.locator('.tab[aria-selected="true"]').textContent(),'Quellen','der erste Klick nach der Eingabe ging verloren');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.positionen.find(p=>p.id==='ac:AW-01:331').kennwert.fundstelle==='BKI Bauelemente, S. 120');
    s=await stand(page);
    const kw=s.state.positionen.find(p=>p.id==='ac:AW-01:331').kennwert;
    assert.deepEqual([kw.art,kw.wert,kw.fundstelle],['bki','250','BKI Bauelemente, S. 120']);

    // Regionalfaktor: «1.045» wäre deutsch 1045 und wird abgefangen; «1,045» gilt.
    await page.fill('[data-key="st:regionalfaktor.wert"]','1.045');
    await page.press('[data-key="st:regionalfaktor.wert"]','Tab');
    await page.locator('.kb-banner',{hasText:'Den Regionalfaktor als Faktor eingeben'}).waitFor();
    assert.equal((await stand(page)).state.regionalfaktor.wert,'');
    await page.fill('[data-key="st:regionalfaktor.wert"]','1,045');
    await page.press('[data-key="st:regionalfaktor.wert"]','Tab');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.regionalfaktor.wert==='1.045');
    // Rezept für die Außenwand vorschlagen und neu einlesen: 331 bleibt mit Kennwert, 335 und 336 kommen dazu.
    await page.click('[data-act="rezept-vorschlag"][data-typ="AW-01"]');
    await page.locator('.kb-banner',{hasText:'Rezept für AW-01 angelegt'}).waitFor();
    await foto(page,'4-quellen');
    await page.click('.kb-actions [data-act="import"]');
    await page.setInputFiles('#kbDatei',exportDatei);
    await page.locator('#kbVorschau',{hasText:'Rezept: 331, 335, 336'}).waitFor();
    await page.click('#kbUebernehmen');
    await page.locator('.kb-banner',{hasText:'Import übernommen: 2 neue, 5 aktualisierte'}).waitFor();
    await gespeichert(page);
    s=await stand(page);
    assert.deepEqual(s.state.positionen.filter(p=>p.id.startsWith('ac:AW-01:')).map(p=>p.id).sort(),['ac:AW-01:331','ac:AW-01:335','ac:AW-01:336']);
    assert.equal(s.state.positionen.find(p=>p.id==='ac:AW-01:331').kennwert.wert,'250');

    // 238,75 m² × (250 ÷ 1,19 × 1,045 = 219,54 €/m²) = 52.415,18 €.
    await page.click('.pos[data-id="ac:AW-01:331"] .mehr');
    const panel=page.locator('.panel');
    assert.match(await panel.textContent(),/238,75 m² × 219,54 € = 52\.415,18 € netto/);
    assert.match(await panel.textContent(),/Herkunft des KennwertsBKI-Buch/);
    assert.match(await panel.textContent(),/ohne Umsatzsteuer÷ 1,19 = 210,08 €/);
    assert.match(await panel.textContent(),/Regionalfaktor× 1,045 = 219,54 €/);
    await foto(page,'5-positionen');

    // Vergleich: Kostenschätzung 300 eintragen; die Abweichung braucht eine Ursache.
    await page.click('.tab[data-tab="vergleich"]');
    await page.fill('[data-key="ks:300"]','40.000');
    await page.press('[data-key="ks:300"]','Tab');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.kostenschaetzung['300']==='40000');
    assert.match(await page.locator('.kb-table tbody tr',{hasText:'Gruppe 300'}).textContent(),/40\.000|\+|−/);
    await foto(page,'6-vergleich');
    await page.click('.tab[data-tab="uebersicht"]');
    assert.ok(await page.locator('.todo',{hasText:'Abweichung zur Kostenschätzung ohne Ursache'}).count()===1);
    assert.ok(await page.locator('.todo',{hasText:'Zuschlag'}).count()===0,'Zuschlag gemeldet, obwohl keine Heinze-Position');
    await foto(page,'7-uebersicht');

    // Bericht und Stand.
    await page.click('.kb-actions [data-tab="bericht"]');
    const bericht=page.locator('#kbBericht');
    for(const t of ['Kostenberechnung nach DIN 276:2018-12','Testhaus','Zusammenstellung, 1. Ebene','Positionen','Vergleich mit der Kostenschätzung','Quellen','BKI-Buch: BKI Bauelemente, S. 120'])
      assert.ok((await bericht.textContent()).includes(t),'fehlt im Bericht: '+t);
    await page.fill('#kbStand input[name="label"]','Stand zur Kostenbesprechung');
    await page.click('#kbStand button[type="submit"]');
    await page.locator('.mini',{hasText:'Stand zur Kostenbesprechung'}).waitFor();
    const version=await page.evaluate(()=>window.__fake.db.office_kosten_versions[0]);
    assert.equal(version.label,'Stand zur Kostenbesprechung');
    assert.equal(version.server_revision,(await stand(page)).server_revision);
    await foto(page,'8-bericht');
    assert.deepEqual(fehler,[],'Fehler auf der Seite');
  }finally{await ctx.close()}
});

test('Aus dem Reiter eines Projekts: ?neu= öffnet «Anlegen» mit diesem Projekt, ohne Hinweistext',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await ctx.newPage();const fehler=[];page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co/,r=>r.abort());
  try{
    await page.goto(adresse('kostenberechnung.html?neu=22222222-2222-4222-8222-222222222222'));
    const dlg=page.locator('#kbNeu');await dlg.waitFor();
    assert.equal(await dlg.locator('select[name="projekt"]').inputValue(),'22222222-2222-4222-8222-222222222222');
    assert.equal(await dlg.locator('p.meta',{hasText:'Ansehen kann'}).count(),0,'kein Hinweistext im Dialog (Gari, 24.11.2026)');
    assert.equal(new URL(page.url()).search,'','neu einmal: das Neuladen öffnet den Dialog nicht wieder');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Jede Kostengruppe bis zur 3. Ebene steht in der Liste und im Bericht',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    await anlegen(page);
    await page.click('.tab[data-tab="positionen"]');
    // KG 330: alle Kostengruppen der 3. Ebene, auch ohne Position.
    for(const kg of ['331','332','333','334','335','336','337','338','339'])
      assert.equal(await page.locator('.pos[data-kg="'+kg+'"]').count(),1,'KG '+kg+' fehlt in der Liste');
    assert.match(await page.locator('.pos[data-kg="339"]').textContent(),/optional/);
    assert.match(await page.locator('.pos[data-kg="331"]').textContent(),/ohne Ansatz/);
    // «Alle»: jedes Blatt der Gliederung als Zeile.
    await page.click('[data-act="filter"][data-kg=""]');
    const fehlend=await page.evaluate(()=>{
      const kat=window.__fake.db.office_kosten_instances[0].state.katalog.map(k=>k.kg);
      const hat=kg=>kat.some(x=>x!==kg&&((kg.endsWith('00')&&x[0]===kg[0])||(!kg.endsWith('00')&&kg.endsWith('0')&&x.slice(0,2)===kg.slice(0,2))));
      return kat.filter(kg=>!document.querySelector('.pos[data-kg="'+kg+'"]')&&!hat(kg)).length+kat.filter(kg=>hat(kg)&&!document.querySelector('.pos[data-kg="'+kg+'"]')).length;
    });
    assert.equal(fehlend,0,'Kostengruppen fehlen in «Alle»');
    // Übersicht: 330 aufklappen zeigt 331–339.
    await page.click('.tab[data-tab="uebersicht"]');
    await page.click('[data-act="aufklappen"][data-kg="330"]');
    assert.equal(await page.locator('.row.sub2').count(),9);
    // Bericht: Gliederung bis zur 3. Ebene, 370 entfällt ohne ihre Unter-KG.
    await page.click('.kb-actions [data-tab="bericht"]');
    const zeilen=await page.locator('#kbBericht table.gliederung tbody tr').allTextContents();
    assert.ok(zeilen.some(z=>/^337Gruppe 337ohne Ansatz/.test(z)),'337 fehlt im Bericht');
    assert.ok(zeilen.some(z=>/^370Gruppe 370entfällt/.test(z)));
    assert.ok(!zeilen.some(z=>/^371/.test(z)),'Unter-KG einer entfallenden Gruppe im Bericht');
    await foto(page,'10-bericht-ebene3');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Kostengruppen klären: Position anlegen, entfällt, Pauschale, Rest entfällt; Index, Gruppen, brutto',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    await anlegen(page);
    const db=()=>page.evaluate(()=>window.__fake.db.office_kosten_instances[0].state);
    // KG 211: Position anlegen. Die Vorgabe des Musters für KG 200 ist «Betrag».
    await page.click('.tab[data-tab="positionen"]');
    await page.click('[data-act="filter"][data-kg="200"]');
    await page.click('.pos[data-act="kg"][data-kg="211"] .bez-link');
    assert.match(await page.locator('.panel').textContent(),/Ohne Ansatz: noch nicht entschieden/);
    await page.click('.panel [data-act="pos-neu"]');
    await page.fill('.panel input[data-key$=":betrag"]','12.500');
    await page.press('.panel input[data-key$=":betrag"]','Tab');
    await page.selectOption('.panel select[data-key$=":kennwert.art"]','annahme');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.positionen.some(p=>p.kg==='211'&&p.betrag==='12500'&&p.modus==='betrag'&&p.kennwert.art==='annahme'));
    // KG 212 entfällt, mit Begründung.
    await page.click('.pos[data-act="kg"][data-kg="212"] .bez-link');
    await page.click('.panel [data-act="kg-entfaellt"]');
    await page.fill('[data-key="gruppe:212:notiz"]','kein Abbruch');
    await page.press('[data-key="gruppe:212:notiz"]','Tab');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.gruppen['212']?.notiz==='kein Abbruch');
    // Gruppe 210: die übrigen ohne Ansatz entfallen in einem Schritt; «Sonstiges» bleibt optional.
    await page.click('.pos[data-act="kg"][data-kg="210"] .bez-link');
    await page.click('.panel [data-act="kg-rest"]');
    await page.locator('.kb-banner',{hasText:'als «entfällt» markiert: 213, 214, 215, 216'}).waitFor();
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.gruppen['216']?.status==='entfaellt');
    let s=await db();
    assert.deepEqual(['213','214','215','216'].map(k=>s.gruppen[k]?.status),['entfaellt','entfaellt','entfaellt','entfaellt']);
    assert.equal(s.gruppen['219'],undefined);
    assert.match(await page.locator('.pos[data-kg="210"]').textContent(),/vollständig/);
    // KG 410 als Pauschale aus dem Kostenbeitrag: 411–419 gelten als enthalten.
    await page.click('[data-act="filter"][data-kg="400"]');
    await page.click('.pos[data-act="kg"][data-kg="410"] .bez-link');
    await page.click('.panel [data-act="pos-neu"]');
    assert.match(await page.locator('.panel').textContent(),/Gilt für die ganze KG 410/);
    await page.fill('.panel input[data-key$=":betrag"]','48.000');
    await page.press('.panel input[data-key$=":betrag"]','Tab');
    await page.fill('.panel input[data-key$=":kennwert.fundstelle"]','Kostenbeitrag HLS');
    await page.press('.panel input[data-key$=":kennwert.fundstelle"]','Tab');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.positionen.some(p=>p.kg==='410'&&p.betrag==='48000'&&p.kennwert.art==='fachplanung'));
    assert.match(await page.locator('.pos[data-kg="411"]').textContent(),/in der Pauschale von KG 410/);
    // Freie Position: ungültige Kostengruppe wird abgewiesen; entfällt, dann löschen.
    await page.click('.card-head [data-act="pos-neu"]');
    await page.fill('.panel input[data-key$=":kg"]','33');
    await page.press('.panel input[data-key$=":kg"]','Tab');
    await page.locator('.kb-banner',{hasText:'Die Kostengruppe hat drei Ziffern'}).waitFor();
    await page.fill('.panel input[data-key$=":kg"]','338');
    await page.press('.panel input[data-key$=":kg"]','Tab');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.positionen.some(p=>p.kg==='338'));
    await page.click('.panel [data-act="entfaellt"]');
    assert.match(await page.locator('.panel [data-act="entfaellt"]').textContent(),/Wieder aufnehmen/);
    await page.click('.panel [data-act="loeschen"]');
    assert.match(await page.locator('.panel [data-act="loeschen"]').textContent(),/Wirklich löschen\?/);
    await page.click('.panel [data-act="loeschen"]');
    await page.waitForFunction(()=>!window.__fake.db.office_kosten_instances[0].state.positionen.some(p=>p.kg==='338'));
    // Baupreisindex: Quartal anlegen und Wert setzen; doppeltes Quartal wird abgewiesen.
    await page.click('.tab[data-tab="quellen"]');
    await page.click('[data-act="index-neu"]');
    await page.click('[data-act="index-neu"]');
    await page.fill('[data-key="index:0:wert"]','131,4');
    await page.press('[data-key="index:0:wert"]','Tab');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.indizes[0]?.wert==='131.4');
    const q0=await page.locator('[data-key="index:0:quartal"]').inputValue();
    await page.selectOption('[data-key="index:1:quartal"]',q0);
    await page.locator('.kb-banner',{hasText:'gibt es schon einen Wert'}).waitFor();
    // In «Quellen» stehen die einzeln entfallenden Kostengruppen; eine wieder aufnehmen.
    assert.equal(await page.locator('[data-act="kg-wieder"][data-kg="212"]').count(),1);
    await page.click('[data-act="kg-wieder"][data-kg="216"]');
    await page.waitForFunction(()=>!window.__fake.db.office_kosten_instances[0].state.gruppen['216']);
    // KG 600 entfällt als Ganzes: zählt nicht mehr und nicht als offen.
    await page.check('[data-key="gruppe:600:status"]');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.gruppen['600']?.status==='entfaellt');
    await page.click('.tab[data-tab="uebersicht"]');
    assert.match(await page.locator('.row',{hasText:'Gruppe 600'}).first().textContent(),/entfällt/);
    assert.equal(await page.locator('.todo',{hasText:'KG 600'}).count(),0);
    // Netto und Brutto stehen nebeneinander wie im Büro-Excel; die Summe nennt beides.
    assert.match(await page.locator('.row.head').first().textContent(),/Netto.*Brutto.*Anteil/);
    assert.match(await page.locator('.sumrow').textContent(),/Summe netto.*brutto/);
    // Eine Gruppe der 2. Ebene führt zu ihren Kostengruppen.
    await page.click('[data-act="aufklappen"][data-kg="400"]');
    await page.click('.row.sub[data-kg="420"]');
    assert.equal(await page.locator('.tab[aria-selected="true"]').textContent(),'Positionen');
    assert.match(await page.locator('.card-head h2').first().textContent(),/KG 420/);
    assert.match(await page.locator('.panel h2').textContent(),/KG 420/);
    await foto(page,'11-kg-panel');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Muster: nur Ansicht, ohne Import und ohne Speichern',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    await page.click('.liste a[href*="muster="]');
    await page.locator('.kb-banner',{hasText:'Muster · nur Ansicht'}).waitFor();
    assert.equal(await page.locator('[data-act="import"]').count(),0);
    await page.click('.tab[data-tab="positionen"]');
    await page.click('.pos[data-act="kg"][data-kg="392"] .bez-link');
    assert.match(await page.locator('.panel').textContent(),/Gerüstfläche/);
    assert.equal(await page.locator('.panel [data-act="pos-neu"]').count(),0);
    assert.equal(await page.locator('.panel [data-act="kg-entfaellt"]').count(),0);
    // Die Klassifizierung für Archicad gibt es auch zur Ansicht: aus der Gliederung des Stands, ohne zu speichern.
    await page.click('.tab[data-tab="uebersicht"]');
    const [laden]=await Promise.all([page.waitForEvent('download'),page.click('[data-act="klassifizierung"]')]);
    assert.equal(laden.suggestedFilename(),'DIN276-2018_TBA_Archicad-Klassifizierung.xml');
    const xml=fs.readFileSync(await laden.path(),'utf8');
    assert.match(xml,/<Name>DIN 276:2018-12 \(TBA\)<\/Name>/);
    assert.match(xml,/<ID>330<\/ID>\n\t+<Name>Gruppe 330<\/Name>[\s\S]*?<Children>\n\t+<Item>\n\t+<ID>331<\/ID>/);
    assert.ok(!/<ID>[178]\d\d<\/ID>/.test(xml),'nur KG 200 bis 600');
    assert.equal(await page.evaluate(()=>window.__fake.aufrufe.filter(a=>a.op!=='select').length),0);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Konflikt: ein neuerer Stand auf dem Server wird nicht überschrieben',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    await anlegen(page);
    await page.evaluate(()=>{window.__fake.db.office_kosten_instances[0].server_revision=7;window.__fake.sichern()});
    await page.click('.tab[data-tab="quellen"]');
    await page.fill('[data-key="st:bezug.BGF"]','412,5');
    await page.press('[data-key="st:bezug.BGF"]','Tab');
    await page.locator('.kb-banner.warn',{hasText:'Nicht gespeichert'}).waitFor();
    assert.equal(await page.locator('.kb-banner.warn [data-act="sichern"]').count(),1);
    assert.equal(await page.locator('.kb-banner.warn [data-act="neuladen"]').count(),1);
    const s=await stand(page);
    assert.equal(s.server_revision,7);
    assert.equal(s.state.bezug.BGF,'','der neuere Stand wurde überschrieben');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('iPhone: Liste und Kostenberechnung ohne Querscrollen',async()=>{
  const {ctx,page,fehler}=await oeffne({width:390,height:844});
  try{
    const breit=()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(await breit()<=1,'Liste breiter als der Bildschirm');
    await anlegen(page);
    await foto(page,'9-iphone-uebersicht');
    for(const tab of ['uebersicht','positionen','quellen','vergleich','bericht']){
      await page.click(`.tab[data-tab="${tab}"]`);
      assert.ok(await breit()<=1,tab+' breiter als der Bildschirm');
    }
    // Die Anleitung mit Teil III: Schemata und Tabellen schieben sich in ihrem Rahmen, die Seite nicht.
    await page.goto(adresse('kostenberechnung-hilfe.html#archicad'));
    await page.locator('h2',{hasText:'So modellieren, dass die Mengen stimmen'}).waitFor();
    assert.ok(await breit()<=1,'Anleitung breiter als der Bildschirm');
    assert.equal(await page.locator('#archicad .abb-scroll svg').count(),6);
    assert.ok(await page.locator('#archicad .abb-scroll').first().evaluate(e=>e.scrollWidth>e.clientWidth),'Schema wird auf dem iPhone nur verkleinert');
    await foto(page,'10-iphone-anleitung-archicad');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Tabelle wie im Büro-Excel: Element mit Positionen, direkt in der Zeile, Enter, Gewerke, einzeilig, Details',async()=>{
  // Gari, 21.11.: volle Breite; Zeilen aufziehen wie in Excel; Spalten wie im Büro; unter jeder KG mehrere Elemente.
  const {ctx,page,fehler}=await oeffne({width:1900,height:1000});
  try{
    await anlegen(page);
    await page.click('.tab[data-tab="positionen"]');
    await page.click('[data-act="filter"][data-kg="330"]');
    assert.match(await page.locator('.ktab .pos.kopf').textContent(),/KG.*GW.*Bezeichnung.*Ort.*Menge.*EH.*EP netto.*Netto.*Brutto.*Quelle.*Kommentar/);
    // Kein Leerraum an den Seiten: die Tabelle nutzt die Breite.
    const breite=await page.locator('.tabelle-karte').evaluate(el=>el.getBoundingClientRect().width);
    assert.ok(breite>1700,'Tabelle nur '+breite+' px breit');
    // Element in KG 335, darin zwei Positionen direkt in der Zeile.
    await page.click('.pos.kgz[data-kg="335"] [data-act="el-neu"]');
    // Das neue Feld bekommt den Fokus nach dem Neuzeichnen; erst dann tippen (im CI ist der Rechner langsamer).
    await page.waitForFunction(()=>/^el:.*:titel$/.test(document.activeElement?.dataset?.key||''));
    await page.keyboard.type('WDVS Mineralwolle 160–200 mm + Putz');
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.elemente?.[0]?.titel==='WDVS Mineralwolle 160–200 mm + Putz');
    for(const [gw,bez,menge,ep] of [['wd','Wärmedämmung Mineralfaser 200 mm','638,94','130'],['PU','Putz Außenputz zweilagig, Besenstrich','638,94','150']]){
      const vorher=await page.locator('.pos.zeile.im-el').count();
      await page.locator('.pos.el').first().locator('[data-act="pos-neu"]').click();
      await page.waitForFunction(n=>document.querySelectorAll('.pos.zeile.im-el').length===n+1&&/^pos:.*:titel$/.test(document.activeElement?.dataset?.key||''),vorher);
      await page.keyboard.type(bez);
      const zeile=()=>page.locator('.pos.zeile.im-el').last();
      for(const [feld,wert] of [['gewerk',gw],['menge',menge],['kennwert.wert',ep]]){
        await zeile().locator(`[data-key$=":${feld}"]`).fill(wert);
        await zeile().locator(`[data-key$=":${feld}"]`).press('Tab');
        await page.waitForTimeout(60);
      }
    }
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.positionen.filter(p=>p.element).length===2&&
      window.__fake.db.office_kosten_instances[0].state.positionen.some(p=>p.gewerk==='WD'&&p.menge==='638.94'&&p.kennwert.wert==='130'));
    assert.match(await page.locator('.pos.el').first().textContent(),/178\.903,20/); // 83.062,20 + 95.841,00
    assert.match(await page.locator('.pos.kgz[data-kg="335"]').textContent(),/178\.903,20/);
    // Enter springt in dieselbe Spalte der nächsten Zeile.
    const mengen=page.locator('.pos.zeile.im-el [data-key$=":menge"]');
    await mengen.first().focus();
    await page.keyboard.press('Enter');
    const naechste=await mengen.nth(1).getAttribute('data-key');
    await page.waitForFunction(k=>document.activeElement?.dataset?.key===k,naechste);
    // Details zur Position: Quelle mit Fundstelle; Escape schließt.
    await page.locator('.pos.zeile.im-el').first().locator('.mehr').click();
    await page.selectOption('.panel select[data-key$=":kennwert.art"]','angebot');
    await page.fill('.panel input[data-key$=":kennwert.fundstelle"]','Angabe Sto');
    await page.press('.panel input[data-key$=":kennwert.fundstelle"]','Tab');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.positionen.some(p=>p.kennwert?.fundstelle==='Angabe Sto'));
    assert.match(await page.locator('.pos.zeile.im-el').first().locator('.chip.q').textContent(),/Angebot · Angabe Sto/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.inspektor:not(.assistent)').count(),0);
    // Dieselben Positionen nach Gewerken; die Summe bleibt dieselbe.
    await page.click('[data-act="sicht"][data-wert="gewerke"]');
    assert.match(await page.locator('.pos.grp',{hasText:'Gewerk WD'}).textContent(),/83\.062,20/);
    assert.match(await page.locator('.pos.summe').textContent(),/178\.903,20/);
    // Einzeilig wie in Excel; die Wahl bleibt im Browser.
    await page.click('[data-act="zeilen"][data-wert="kompakt"]');
    assert.equal(await page.locator('.ktab.einzeilig').count(),1);
    assert.match(await page.evaluate(()=>localStorage.getItem('tba.office.kostenberechnung.ansicht')),/"zeilen":"kompakt"/);
    // Bericht: Positionen mit GW, Element und Brutto; Zusammenstellung nach Gewerken.
    await page.click('.tab[data-tab="bericht"]');
    assert.match(await page.locator('.positionen-b').textContent(),/WDVS Mineralwolle 160–200 mm \+ Putz.*Wärmedämmung Mineralfaser 200 mm/);
    assert.match(await page.locator('#kbBericht').textContent(),/Zusammenstellung nach Gewerken/);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Assistent: Vorschlag aus einem Angebot prüfen, übernehmen und rückgängig machen; Details gehen vor',async()=>{
  // Gari, 21.11.: «Falta agregar el asistente (de Inteligencia artificial, como en el Terminplan …)». Die KI ist hier
  // ein Testersatz (fake-supabase-kosten.js): Status bereit, ein fester Vorschlag mit Element, zwei Positionen und «entfällt».
  const {ctx,page,fehler}=await oeffne();
  try{
    await anlegen(page);
    await page.click('.kb-actions [data-act="assistent"]');
    const as=page.locator('#kbAssistent');
    await as.waitFor({state:'visible'});
    await page.waitForFunction(()=>/test-modell/.test(document.getElementById('asModell')?.textContent||''));
    assert.equal(await page.locator('.kb-actions [data-act="assistent"]').getAttribute('aria-pressed'),'true');
    assert.ok(await page.evaluate(()=>document.getElementById('kb').classList.contains('mit-inspektor')),'die Seite rückt nicht zur Seite');
    assert.equal(await as.locator('.as-start').count(),5);
    // Ein Angebot als PDF anhängen (synthetisch) und fragen.
    await page.setInputFiles('#asDatei',{name:'angebot-test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n% Test\n')});
    await as.locator('.as-chip',{hasText:'angebot-test.pdf'}).waitFor();
    await page.fill('#asText','Werte das Angebot aus.');
    await page.click('#asSenden');
    const karte=as.locator('.as-karte');
    await karte.waitFor();
    const text=await karte.textContent();
    assert.match(text,/\+ 52\.800,00\s€/);                        // 412,5 m² × 128,00 €
    assert.match(text,/2 Positionen \(1 offen\) · 1 Element · 1 Kostengruppe entfällt/);
    assert.match(text,/WDVS Mineralwolle 160 mm \+ Putz/);
    assert.match(await as.locator('.as-hinweise summary').textContent(),/1 Hinweis der Prüfung/);
    // Quellen der Antwort als Links, die in einem neuen Fenster aufgehen.
    const link=as.locator('.as-links a',{hasText:'Hersteller Beispiel'});
    assert.equal(await link.getAttribute('href'),'https://hersteller.example/wdvs');
    assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
    // Die Anfrage: erwartete Revision, Anhang als data:-URL, keine Tabelle, nichts geschrieben.
    const anfrage=await page.evaluate(()=>window.__fake.anfragen.find(a=>a.body.action==='frage').body);
    assert.equal(anfrage.expected_revision,(await stand(page)).server_revision);
    assert.equal(anfrage.attachments.length,1);
    assert.match(anfrage.attachments[0].data,/^data:application\/pdf;base64,/);
    assert.equal(anfrage.tabelle,null);
    assert.equal((await stand(page)).state.positionen.length,0);
    // Prüfen und übernehmen: gespeichert wie jede Änderung, mit Quelle und Fundstelle.
    await karte.locator('[data-as="uebernehmen"]').click();
    await as.locator('.as-msg.ok',{hasText:'Übernommen: 2 Positionen, 1 Element, 1 Kostengruppe entfällt'}).waitFor();
    await gespeichert(page);
    const s=(await stand(page)).state;
    const neu=s.positionen.filter(p=>p.assistent);
    assert.equal(neu.length,2);
    assert.equal(s.elemente.length,1);
    assert.ok(neu.every(p=>p.element===s.elemente[0].id&&p.kg==='335'&&p.gewerk==='PU'));
    assert.deepEqual(neu[0].kennwert,{art:'angebot',wert:'128',fundstelle:'Angebot Test, Pos. 1'});
    assert.deepEqual(neu[1].kennwert,{});
    assert.equal(s.gruppen['394'].status,'entfaellt');
    await page.locator('.ktab .pos.el',{hasText:'WDVS Mineralwolle 160 mm + Putz'}).waitFor();
    assert.match(await page.locator('.ktab .pos.el').textContent(),/52\.800,00/);
    assert.equal(await page.locator('.ktab .pos.zeile.neu').count(),2,'übernommene Zeilen sind nicht hervorgehoben');
    // Details gehen vor: die Position öffnen zeigt die Details; Escape bringt den Assistenten zurück.
    await page.locator('.ktab .pos.zeile.im-el').first().locator('.mehr').click();
    await page.locator('.inspektor:not(.assistent) .panel').waitFor();
    assert.ok(await as.isHidden());
    assert.match(await page.locator('.inspektor:not(.assistent) .panel').textContent(),/Vom Assistenten vorgeschlagen, übernommen am/);
    await page.keyboard.press('Escape');
    await as.waitFor({state:'visible'});
    assert.match(await as.locator('#asBezug').textContent(),/Bezug: Position «Dämmung Mineralwolle 160 mm»/);
    // Rückgängig, solange nichts anderes geändert wurde.
    await as.locator('[data-as="rueckgaengig"]').click();
    await as.locator('.as-msg.ok',{hasText:'Rückgängig gemacht'}).waitFor();
    await gespeichert(page);
    const z=(await stand(page)).state;
    assert.equal(z.positionen.length,0);
    assert.equal((z.elemente||[]).length,0);
    assert.ok(!z.gruppen['394']);
    // Verlauf je Person und Kostenberechnung.
    const verlauf=await page.evaluate(()=>window.__fake.db.office_kosten_dialogue_messages.map(m=>m.role+':'+m.event_kind));
    assert.deepEqual(verlauf,['user:question','assistant:proposal','assistant:receipt','assistant:receipt']);
    // Schließen: die Tabelle hat wieder die volle Breite.
    await as.locator('[data-as="zu"]').click();
    assert.ok(await as.isHidden());
    assert.ok(!(await page.evaluate(()=>document.getElementById('kb').classList.contains('mit-inspektor'))));
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Assistent: altes Büro-Excel als Tabelle mit Zeilennummern; Fehler der KI ändern nichts',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    await anlegen(page);
    await page.evaluate(()=>{window.__fake.ki=async(name,body)=>body.action==='status'?{data:{ready:true,version:'office-kosten-ai-v2',model:'test-modell'},error:null}:
      {data:{error:'ai_timeout_or_network'},error:{message:'504'}}});
    await page.click('.kb-actions [data-act="assistent"]');
    await page.waitForFunction(()=>/test-modell/.test(document.getElementById('asModell')?.textContent||''));
    const csv='KG;Bezeichnung;Menge;EH;EP;Kommentar\n\n335;Dämmung;412,5;m²;128;BKI\n';
    const [wahl]=await Promise.all([page.waitForEvent('filechooser'),page.click('[data-as="start"][data-start="excel"]')]);
    await wahl.setFiles({name:'altes-buero-excel.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')});
    await page.locator('#kbAssistent .as-chip',{hasText:'altes-buero-excel.csv · 2 Zeilen'}).waitFor();
    assert.match(await page.inputValue('#asText'),/Übernimm die Positionen aus dem Büro-Excel/);
    await page.click('#asSenden');
    await page.locator('#kbAssistent .as-msg.warn',{hasText:'Die Anfrage hat zu lange gedauert'}).waitFor();
    const anfrage=await page.evaluate(()=>window.__fake.anfragen.filter(a=>a.body.action==='frage').pop().body);
    assert.equal(anfrage.tabelle.name,'altes-buero-excel.csv');
    assert.equal(anfrage.tabelle.text,'1\tKG\tBezeichnung\tMenge\tEH\tEP\tKommentar\n3\t335\tDämmung\t412,5\tm²\t128\tBKI');
    assert.equal(await page.locator('#kbAssistent .as-karte').count(),0);
    assert.equal((await stand(page)).state.positionen.length,0);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Assistent auf dem iPhone: von unten, ohne Querscrollen',async()=>{
  const {ctx,page,fehler}=await oeffne({width:390,height:844});
  try{
    await anlegen(page);
    await page.click('.kb-actions [data-act="assistent"]');
    const as=page.locator('#kbAssistent');
    await as.waitFor({state:'visible'});
    const box=await as.boundingBox();
    assert.ok(box.width<=390&&box.y>40,'kein Blatt von unten: '+JSON.stringify(box));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Querscrollen');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});
