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
    await page.click('.pos[data-id="ac:AW-01:331"]');
    const k='pos:ac:AW-01:331:';
    await page.selectOption(`[data-key="${k}kennwert.art"]`,'bki');
    await page.fill(`[data-key="${k}kennwert.wert"]`,'250');
    // Direkt auf den nächsten Knopf: der Klick darf nicht verloren gehen.
    await page.click(`[data-key="${k}kennwert.fundstelle"]`);
    await page.fill(`[data-key="${k}kennwert.fundstelle"]`,'BKI Bauelemente, S. 120');
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
    await page.click('.pos[data-id="ac:AW-01:331"]');
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
    await page.click('.pos[data-act="kg"][data-kg="211"]');
    assert.match(await page.locator('.panel').textContent(),/Ohne Ansatz: noch nicht entschieden/);
    await page.click('.panel [data-act="pos-neu"]');
    await page.fill('.panel input[data-key$=":betrag"]','12.500');
    await page.press('.panel input[data-key$=":betrag"]','Tab');
    await page.selectOption('.panel select[data-key$=":kennwert.art"]','annahme');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.positionen.some(p=>p.kg==='211'&&p.betrag==='12500'&&p.modus==='betrag'&&p.kennwert.art==='annahme'));
    // KG 212 entfällt, mit Begründung.
    await page.click('.pos[data-act="kg"][data-kg="212"]');
    await page.click('.panel [data-act="kg-entfaellt"]');
    await page.fill('[data-key="gruppe:212:notiz"]','kein Abbruch');
    await page.press('[data-key="gruppe:212:notiz"]','Tab');
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.gruppen['212']?.notiz==='kein Abbruch');
    // Gruppe 210: die übrigen ohne Ansatz entfallen in einem Schritt; «Sonstiges» bleibt optional.
    await page.click('.pos[data-act="kg"][data-kg="210"]');
    await page.click('.panel [data-act="kg-rest"]');
    await page.locator('.kb-banner',{hasText:'als «entfällt» markiert: 213, 214, 215, 216'}).waitFor();
    await page.waitForFunction(()=>window.__fake.db.office_kosten_instances[0].state.gruppen['216']?.status==='entfaellt');
    let s=await db();
    assert.deepEqual(['213','214','215','216'].map(k=>s.gruppen[k]?.status),['entfaellt','entfaellt','entfaellt','entfaellt']);
    assert.equal(s.gruppen['219'],undefined);
    assert.match(await page.locator('.pos[data-kg="210"]').textContent(),/vollständig/);
    // KG 410 als Pauschale aus dem Kostenbeitrag: 411–419 gelten als enthalten.
    await page.click('[data-act="filter"][data-kg="400"]');
    await page.click('.pos[data-act="kg"][data-kg="410"]');
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
    // brutto zeigt die Summe mit Umsatzsteuer.
    await page.click('.seg [data-act="brutto"][data-wert="1"]');
    assert.match(await page.locator('.sumrow').textContent(),/Summe brutto/);
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
    await page.click('.pos[data-act="kg"][data-kg="392"]');
    assert.match(await page.locator('.panel').textContent(),/Gerüstfläche/);
    assert.equal(await page.locator('.panel [data-act="pos-neu"]').count(),0);
    assert.equal(await page.locator('.panel [data-act="kg-entfaellt"]').count(),0);
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
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});
