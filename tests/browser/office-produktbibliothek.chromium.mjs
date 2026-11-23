// Produktbibliothek im echten Chromium mit synthetischem Supabase (23.11.2026). Kein Netz, keine Produktion.
// Abläufe wie im Büro: Bibliothek mit Herkunft der Preise (übernommener Ansatz zählt als eine Quelle, Spanne,
// Listenpreis ist kein eingebauter Preis), Suche und Filter; Datenblatt lesen lassen, prüfen, erst dann speichern;
// Zu Projekt mit Code je Projekt; Preis eintragen; Entfernen nur nach Rückfrage (Esc zählt nie als «ja»);
// von Hand anlegen; Leser nicht erreichbar; iPhone ohne Querscrollen. Bildschirmfotos nur mit PRODUKTE_FOTOS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const fake=fs.readFileSync(new URL('./fixtures/fake-supabase-produkte.js',import.meta.url),'utf8');
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
const FOTOS=process.env.PRODUKTE_FOTOS||'';
const foto=async(page,name)=>{if(FOTOS)await page.screenshot({path:path.join(FOTOS,name+'.png'),fullPage:true})};
const adresse=p=>`http://localhost:${server.address().port}/${p}`;
const PDF={name:'Datenblatt Diele.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n% Test\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')};

async function oeffne(ziel='produktbibliothek.html',viewport={width:1440,height:1000}){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await ctx.newPage();
  const fehler=[];
  page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co/,r=>r.abort());
  await page.goto(adresse(ziel));
  await page.locator('h1').waitFor();
  return {ctx,page,fehler};
}
const db=page=>page.evaluate(()=>window.__fake.db);
const karte=(page,name)=>page.locator('.pb-karte',{has:page.locator('h2',{hasText:name})});
const ohneQuerscrollen=page=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);

test('Bibliothek: Preise mit Herkunft, Suche, Filter und Archiv',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    await page.locator('.pill[aria-pressed="true"]',{hasText:'Bodenbeläge · 3'}).waitFor();
    assert.match(await page.locator('[data-zahl]').textContent(),/3 Einträge · Bodenbeläge · .*auf der Bodenplatte KG 324, auf Decken KG 353/);
    assert.match(await page.locator('.pb-banner.info').textContent(),/aus 4 Kostenberechnungen \(2022–2026\): Schätzungen, keine Angebote/);
    // Derselbe Ansatz in drei Kostenberechnungen: übernommen, zählt als eine Quelle.
    const parkett=karte(page,'Parkett, vollflächig geklebt');
    assert.match(await parkett.locator('.pb-preis').textContent(),/^180 €\/m² eingebaut$/);
    const pt=await parkett.textContent();
    assert.equal(await parkett.locator('.meta').first().textContent(),'Leistung, kein Produkt','die Familie wiederholt nicht den Namen');
    assert.match(pt,/Ansatz in 3 Kostenberechnungen, kein Angebot/);
    assert.match(pt,/seit 2022 unverändert übernommen/);
    assert.match(pt,/1 Quelle/);
    assert.ok(!/Datenblatt/.test(pt),'eine Leistung braucht kein Datenblatt');
    // Spanne × 2,5 in den Ansätzen: Umfang prüfen.
    const estrich=karte(page,'Heizestrich, schwimmend');
    assert.match(await estrich.locator('.pb-preis').textContent(),/^38–95 €\/m² eingebaut$/);
    assert.match(await estrich.textContent(),/Spanne × 2,5: Umfang prüfen/);
    // Ein Listenpreis ist Material, nicht eingebaut.
    const stein=karte(page,'Kalkstein, geschliffen');
    assert.match(await stein.locator('.pb-preis').textContent(),/^120 €\/m² Material$/);
    const st=await stein.textContent();
    assert.match(st,/Listenpreis, ohne Verlegung/);
    assert.match(st,/Datenblatt geprüft/);
    assert.match(st,/Testhaus · BO-01 · bemustert/);
    await foto(page,'1-bibliothek');
    // Suche über Merkmale; das Suchfeld behält den Fokus.
    await page.fill('#pbSuche','r10');
    await page.waitForFunction(()=>document.querySelectorAll('.pb-karte').length===1);
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'pbSuche');
    assert.equal(await karte(page,'Kalkstein, geschliffen').count(),1);
    await page.fill('#pbSuche','');
    // Herkunft: nur Datenblatt-Listenpreise, dann nur ohne Preis.
    await page.selectOption('#pbHerkunft','liste');
    await page.waitForFunction(()=>document.querySelectorAll('.pb-karte').length===1);
    await page.selectOption('#pbHerkunft','ohne');
    await page.locator('.pb-leer',{hasText:'Nichts gefunden'}).waitFor();
    await page.selectOption('#pbHerkunft','alle');
    // Sortieren nach Preis eingebaut: das Günstigste zuerst, ohne eingebauten Preis zuletzt.
    await page.selectOption('#pbSort','preis');
    assert.deepEqual(await page.locator('.pb-karte h2').allTextContents(),['Heizestrich, schwimmend','Parkett, vollflächig geklebt','Kalkstein, geschliffen']);
    // Archiv: Archiviertes erscheint nur dort.
    await page.click('[data-archiv]');
    await page.locator('.pb-karte h2',{hasText:'Teppich, alt'}).waitFor();
    assert.equal(await page.locator('.pb-karte').count(),1);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Datenblatt: Romy liest, die Person prüft, gespeichert wird erst danach',async()=>{
  const {ctx,page,fehler}=await oeffne('produktbibliothek.html?neu=datenblatt');
  try{
    const lesen=page.locator('[data-lesen]');
    assert.equal(await lesen.isDisabled(),true);
    await page.setInputFiles('#pbLeserDatei',PDF);
    await lesen.click();
    await page.locator('h1',{hasText:'Romy hat das Dokument gelesen'}).waitFor();
    // Noch nichts gespeichert, nur gelesen.
    assert.equal((await db(page)).office_produkte.length,4);
    const anfrage=await page.evaluate(()=>window.__fake.anfragen[0]);
    assert.equal(anfrage.name,'office-produkt-ai');
    assert.equal(anfrage.body.action,'lesen');
    assert.equal(anfrage.body.kategorie,'bodenbelag');
    assert.equal(anfrage.body.attachments.length,1);
    assert.equal(anfrage.body.attachments[0].name,'Datenblatt Diele.pdf');
    assert.equal(anfrage.body.attachments[0].size,PDF.buffer.length);
    assert.ok(anfrage.body.attachments[0].data.startsWith('data:application/pdf;base64,'));
    // Vier Angaben mit Seite; eine passt nicht und wird abgewählt.
    assert.equal(await page.locator('.pb-merkmal-liste .pb-merkmal').count(),4);
    assert.equal(await page.locator('.pb-merkmal-liste [data-zeige-seite="2"]').count(),2);
    await page.uncheck('#mk3');
    assert.match(await page.locator('.pb-fehlt-box').textContent(),/Rutschhemmung · Emissionen/);
    assert.equal(await page.inputValue('[name="pr_betrag_0"]'),'62,5');
    assert.match(await page.locator('.pb-preiszeile').textContent(),/S\. 4 · Sortierung Natur/);
    // Zuordnung: Name korrigieren; Projekte nur, wo die Person im Team ist und das Projekt aktiv.
    assert.equal(await page.inputValue('[name="name"]'),'Landhausdiele Eiche 15 mm');
    await page.fill('[name="name"]','Landhausdiele Eiche 15 mm, geölt');
    assert.deepEqual(await page.locator('[name="projekt"] option').allTextContents(),['kein Projekt','T-01 · Testhaus']);
    const ids=await page.evaluate(()=>({P1:window.__fake.P1,UID:window.__fake.UID}));
    await page.selectOption('[name="projekt"]',ids.P1);
    assert.equal(await page.inputValue('[name="code"]'),'BO-02','nächster freier Code im Projekt');
    await foto(page,'2-pruefen');
    await page.click('#pbPruefen button[type="submit"]');
    await page.waitForURL(/produktbibliothek\.html\?id=/);
    await page.locator('h1',{hasText:'Landhausdiele Eiche 15 mm, geölt'}).waitFor();
    const d=await db(page);
    const neu=d.office_produkte.find(p=>p.name==='Landhausdiele Eiche 15 mm, geölt');
    assert.equal(neu.status,'geprueft');
    assert.equal(neu.geprueft_von,ids.UID);
    assert.equal(neu.familie,'Parkett, vollflächig geklebt');
    assert.deepEqual(neu.merkmale.map(m=>m.feld),['Format','Stärke','Brandverhalten']);
    assert.deepEqual(neu.fehlend,['Rutschhemmung','Emissionen']);
    const dok=d.office_produkt_dokumente.find(x=>x.produkt_id===neu.id);
    assert.match(dok.storage_path,new RegExp('^'+ids.UID+'/'+neu.id+'/[0-9a-f-]{36}\\.pdf$'));
    assert.equal(dok.art,'datenblatt');assert.equal(dok.seiten,4);assert.ok(dok.gelesen_am);
    assert.ok(d.__dateien[dok.storage_path],'die Datei liegt im Speicher');
    assert.ok(neu.merkmale.every(m=>m.dokument_id===dok.id),'jede Angabe verweist auf das Datenblatt');
    const preis=d.office_produkt_preise.find(x=>x.produkt_id===neu.id);
    assert.deepEqual({art:preis.art,betrag:preis.betrag,einheit:preis.einheit,stand:preis.stand,seite:preis.seite,dokument_id:preis.dokument_id,
      quelle:preis.quelle,kommentar:preis.kommentar},
      {art:'listenpreis_material',betrag:62.5,einheit:'m²',stand:'2026-01-01',seite:4,dokument_id:dok.id,
        quelle:'Datenblatt Diele.pdf',kommentar:'Sortierung Natur, 1900 × 190 mm'});
    assert.match(await page.locator('.pb-tabelle tr',{hasText:'Listenpreis Material'}).textContent(),/Datenblatt Diele\.pdf · S\. 4(?! · S\.)/,'die Seite steht einmal');
    const v=d.office_produkt_verwendungen.find(x=>x.produkt_id===neu.id);
    assert.equal(v.projekt_id,ids.P1);assert.equal(v.code,'BO-02');
    // Produktblatt: Seiten, was fehlt, Listenpreis mit Hinweis, Preise der Familie, Verwendung mit Stand.
    assert.equal(await page.locator('.pb-merkmale [data-seite="2"]').count(),2);
    assert.match(await page.locator('.pb-fehlt').textContent(),/Nicht im Datenblatt: Rutschhemmung · Emissionen/);
    const preise=await page.locator('.pb-main').textContent();
    assert.match(preise,/Listenpreis Material/);
    assert.match(preise,/Ein Listenpreis ist kein eingebauter Preis/);
    assert.match(preise,/Preise der Familie «Parkett, vollflächig geklebt»/);
    assert.match(preise,/seit 2022 unverändert übernommen/,'die eigenen Preise ersetzen nicht den Blick auf die Familie');
    assert.equal(await page.locator('select[data-status]').count(),1);
    await foto(page,'3-produktblatt');
    // «S. 2» öffnet das Datenblatt auf Seite 2.
    const [fenster]=await Promise.all([page.waitForEvent('popup'),page.locator('.pb-merkmale [data-seite="2"]').first().click()]);
    await fenster.waitForURL(/#page=2$/);
    await fenster.close();
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Zu Projekt, Preis eintragen, Stand ändern und Entfernen nur nach Rückfrage',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    const ids=await page.evaluate(()=>({P1:window.__fake.P1,S1:window.__fake.S1,D1:window.__fake.D1}));
    await karte(page,'Heizestrich, schwimmend').locator('[data-zu-projekt]').click();
    const dlg=page.locator('#pbDialog');
    await dlg.locator('h2',{hasText:'Zu Projekt'}).waitFor();
    assert.deepEqual(await dlg.locator('[name="projekt"] option').allTextContents(),['T-01 · Testhaus']);
    assert.equal(await dlg.locator('[name="code"]').inputValue(),'BO-02');
    await dlg.locator('[name="code"]').fill('BO-01');
    await dlg.locator('button[value="speichern"]').click();
    await dlg.locator('[data-dialog-fehler]',{hasText:'Diesen Code gibt es im Projekt schon.'}).waitFor();
    await dlg.locator('[name="code"]').fill('bo-03');
    await dlg.locator('[name="raeume"]').fill('Wohnen, Essen');
    await dlg.locator('button[value="speichern"]').click();
    await page.locator('.pb-banner.info',{hasText:'Zum Projekt hinzugefügt: T-01 · Testhaus · BO-03.'}).waitFor();
    assert.match(await karte(page,'Heizestrich, schwimmend').locator('.pb-verwendung').textContent(),/Testhaus · BO-03 · vorgeschlagen/);
    const v=(await db(page)).office_produkt_verwendungen.find(x=>x.code==='BO-03');
    assert.equal(v.projekt_id,ids.P1);assert.equal(v.raeume,'Wohnen, Essen');

    await page.goto(adresse('produktbibliothek.html?id='+ids.S1));
    await page.locator('h1',{hasText:'Kalkstein, geschliffen'}).waitFor();
    // Preis eintragen: deutsche Zahl, Tippfehler wird abgefangen.
    await page.click('[data-preis-neu]');
    await dlg.locator('[name="art"]').selectOption('angebot_eingebaut');
    await dlg.locator('[name="betrag"]').fill('abc');
    await dlg.locator('button[value="speichern"]').click();
    await dlg.locator('[data-dialog-fehler]',{hasText:'Bitte Betrag, Menge und KG als Zahl angeben.'}).waitFor();
    await dlg.locator('[name="betrag"]').fill('1.234,50');
    await dlg.locator('[name="kg"]').fill('353');
    await dlg.locator('[name="quelle"]').fill('Angebot Test, Pos. 3');
    await dlg.locator('button[value="speichern"]').click();
    await page.locator('.pb-banner.info',{hasText:'Preis eingetragen.'}).waitFor();
    const angebot=(await db(page)).office_produkt_preise.find(x=>x.art==='angebot_eingebaut');
    assert.equal(angebot.betrag,1234.5);assert.equal(angebot.kg,'353');assert.equal(angebot.produkt_id,ids.S1);
    // Dokument entfernen: Rückfrage mit «Entfernen».
    await page.locator('[data-dok-weg="'+ids.D1+'"]').click();
    await dlg.locator('button[value="ja"]').click();
    await page.waitForFunction(id=>!window.__fake.db.office_produkt_dokumente.some(d=>d.id===id),ids.D1);
    assert.equal(Object.keys((await db(page)).__dateien).length,0,'die Datei ist auch aus dem Speicher entfernt');
    // Danach Esc beim Entfernen eines Preises: das alte «ja» zählt nicht.
    const zeile=page.locator('.pb-tabelle tr',{hasText:'1.234,5'});
    await zeile.locator('[data-preis-weg]').click();
    await dlg.locator('h2',{hasText:'Preis entfernen?'}).waitFor();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    assert.ok((await db(page)).office_produkt_preise.some(x=>x.id===angebot.id),'Esc hat den Preis nicht entfernt');
    await page.locator('.pb-tabelle tr',{hasText:'1.234,5'}).locator('[data-preis-weg]').click();
    await dlg.locator('button[value="ja"]').click();
    await page.waitForFunction(id=>!window.__fake.db.office_produkt_preise.some(x=>x.id===id),angebot.id);
    // Stand der Bemusterung ändert das Projektteam.
    await page.locator('select[data-status]').selectOption('freigegeben');
    await page.locator('.pb-banner.info',{hasText:'Stand geändert: freigegeben.'}).waitFor();
    assert.equal((await db(page)).office_produkt_verwendungen.find(x=>x.code==='BO-01').status,'freigegeben');
    // Archivieren mit Rückfrage; danach steht der Eintrag nur im Archiv.
    await page.click('[data-archivieren]');
    await dlg.locator('button[value="ja"]').click();
    await page.locator('.kicker',{hasText:'archiviert'}).waitFor();
    assert.equal((await db(page)).office_produkte.find(x=>x.id===ids.S1).archiviert,true);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Von Hand: Leistung im Bestand anlegen, dann als geprüft markieren',async()=>{
  const {ctx,page,fehler}=await oeffne('produktbibliothek.html?neu=hand');
  try{
    await page.selectOption('[name="typ"]','leistung');
    await page.fill('[name="name"]','Bestandsboden abschleifen und ölen');
    await page.fill('[name="familie"]','Parkett, Bestand');
    await page.check('[name="bestand"]');
    await page.fill('#mf0','Fläche');await page.fill('#mw0','ca. 120 m²');await page.check('#mk0');
    await page.click('#pbFormular button[type="submit"]');
    await page.waitForURL(/produktbibliothek\.html\?id=/);
    await page.locator('.kicker',{hasText:'Leistung · Bodenbelag · Bestand'}).waitFor();
    let e=(await db(page)).office_produkte.find(x=>x.name==='Bestandsboden abschleifen und ölen');
    assert.equal(e.typ,'leistung');assert.equal(e.bestand,true);assert.equal(e.status,'entwurf');
    assert.deepEqual(e.merkmale.map(m=>[m.feld,m.wert]),[['Fläche','ca. 120 m²']]);
    await page.click('a[href*="bearbeiten="]');
    await page.locator('h1',{hasText:'Eintrag bearbeiten'}).waitFor();
    await page.selectOption('[name="status"]','geprueft');
    await page.click('#pbFormular button[type="submit"]');
    await page.waitForURL(/produktbibliothek\.html\?id=/);
    await page.locator('.pb-intro',{hasText:'geprüft am'}).waitFor();
    e=(await db(page)).office_produkte.find(x=>x.id===e.id);
    assert.equal(e.status,'geprueft');assert.ok(e.geprueft_am);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Leser nicht erreichbar: klare Meldung, das Dokument kommt trotzdem von Hand dazu',async()=>{
  const {ctx,page,fehler}=await oeffne('produktbibliothek.html?neu=datenblatt');
  try{
    await page.evaluate(()=>{window.__fake.leser=()=>({data:null,error:{message:'Edge Function returned a non-2xx status code',
      context:new Response(JSON.stringify({error:'ai_timeout_or_network'}),{status:504,headers:{'content-type':'application/json'}})}})});
    await page.setInputFiles('#pbLeserDatei',PDF);
    await page.click('[data-lesen]');
    await page.locator('.pb-banner.warn',{hasText:'Der Leser hat nicht rechtzeitig geantwortet. Du kannst das Dokument trotzdem von Hand übernehmen.'}).waitFor();
    assert.equal(await page.locator('[data-ohne-lesen]').isDisabled(),false);
    await page.click('[data-ohne-lesen]');
    await page.locator('h1',{hasText:'Dokument von Hand übernehmen'}).waitFor();
    await page.fill('[name="name"]','Diele ohne Lesung');
    await page.click('#pbPruefen button[type="submit"]');
    await page.waitForURL(/produktbibliothek\.html\?id=/);
    const d=await db(page),e=d.office_produkte.find(x=>x.name==='Diele ohne Lesung');
    const dok=d.office_produkt_dokumente.find(x=>x.produkt_id===e.id);
    assert.equal(dok.gelesen_am,null);
    // Nachträglich lesen lassen: neue Angaben kommen zum Eintrag dazu.
    await page.evaluate(()=>{window.__fake.leser=null});
    await page.click('[data-dok-lesen="'+dok.id+'"]');
    await page.locator('h1',{hasText:'Romy hat das Dokument gelesen'}).waitFor();
    assert.equal(await page.locator('[name="name"]').count(),0,'beim Nachlesen bleibt der Eintrag, wie er ist');
    await page.click('#pbPruefen button[type="submit"]');
    await page.waitForURL(/produktbibliothek\.html\?id=/);
    const d2=await db(page),e2=d2.office_produkte.find(x=>x.id===e.id);
    assert.equal(e2.name,'Diele ohne Lesung');
    assert.ok(e2.merkmale.some(m=>m.feld==='Format'&&m.dokument_id===dok.id));
    assert.ok(d2.office_produkt_dokumente.find(x=>x.id===dok.id).gelesen_am);
    assert.equal(d2.office_produkt_dokumente.filter(x=>x.produkt_id===e.id).length,1,'kein zweites Dokument');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('iPhone: Bibliothek, Produktblatt und Prüfen ohne Querscrollen',async()=>{
  const {ctx,page,fehler}=await oeffne('produktbibliothek.html',{width:390,height:844});
  try{
    assert.ok(await ohneQuerscrollen(page),'Bibliothek scrollt quer');
    await foto(page,'4-iphone-bibliothek');
    const S1=await page.evaluate(()=>window.__fake.S1);
    await page.goto(adresse('produktbibliothek.html?id='+S1));
    await page.locator('h1',{hasText:'Kalkstein, geschliffen'}).waitFor();
    assert.ok(await ohneQuerscrollen(page),'Produktblatt scrollt quer');
    await page.goto(adresse('produktbibliothek.html?neu=datenblatt'));
    await page.setInputFiles('#pbLeserDatei',PDF);
    await page.click('[data-lesen]');
    await page.locator('h1',{hasText:'Romy hat das Dokument gelesen'}).waitFor();
    assert.ok(await ohneQuerscrollen(page),'Prüfen scrollt quer');
    await foto(page,'5-iphone-pruefen');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});
