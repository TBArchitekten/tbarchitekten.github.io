// Herstellerkatalog im echten Chromium mit synthetischem Supabase (24.11.2026). Kein Netz, keine Produktion.
// Abläufe wie im Büro: Katalog mit Kontakt und den Projekten, in denen jemand schon Kontakt hatte; Suche, Kategorie,
// Typ und Projekt; Firmenblatt mit Produkten der Bibliothek; Kontakt eintragen; Firma anlegen (doppelt geht nicht);
// die Produktkarte der Bibliothek zeigt den Kontakt ihrer Firma, ?hersteller= zeigt deren Produkte; iPhone ohne
// Querscrollen. Bildschirmfotos nur mit HERSTELLER_FOTOS.
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
const FOTOS=process.env.HERSTELLER_FOTOS||'';
const foto=async(page,name)=>{if(FOTOS)await page.screenshot({path:path.join(FOTOS,name+'.png'),fullPage:true})};
const adresse=p=>`http://localhost:${server.address().port}/${p}`;

async function oeffne(ziel='herstellerkatalog.html',viewport={width:1440,height:1000}){
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
const karte=(page,name)=>page.locator('.hk-karte',{has:page.locator('h2',{hasText:name})});
const ohneQuerscrollen=page=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);

test('Katalog: Kontakt, Projekte, Suche und Filter; Archiv getrennt',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    assert.equal(await page.locator('h1').textContent(),'Herstellerkatalog');
    assert.match(await page.locator('[data-zahl]').textContent(),/^2 Firmen$/,'die archivierte Firma fehlt im Katalog');
    const b=karte(page,'Hersteller B');
    assert.match(await b.locator('.meta').first().textContent(),/^Hersteller · Bodenbeläge$/);
    assert.equal(await b.locator('a[href^="tel:"]').getAttribute('href'),'tel:+4900012340');
    assert.equal(await b.locator('a[href^="mailto:"]').getAttribute('href'),'mailto:info@hersteller-b.invalid');
    assert.equal(await b.locator('.hk-projekte .chip').textContent(),'T-01 · Testhaus · Andere Person','wer im Büro in welchem Projekt Kontakt hatte');
    assert.equal(await b.locator('a[href*="produktbibliothek.html?hersteller="]').textContent(),'1 Produkt in der Bibliothek');
    assert.equal(await karte(page,'Werkstatt Terrazzo').locator('.hk-projekte .chip').textContent(),'Wettbewerb 2025','auch ein Projekt außerhalb des Office');
    // Suche über Produkt und Ansprechpartner, Typ und Projekt.
    await page.locator('#hkSuche').fill('ortterrazzo');
    assert.match(await page.locator('[data-zahl]').textContent(),/^1 Firma$/);
    await page.locator('#hkSuche').fill('frau muster');
    assert.equal(await page.locator('.hk-karte h2').textContent(),'Hersteller B');
    await page.locator('#hkSuche').fill('');
    await page.locator('#hkTyp').selectOption('ausfuehrender');
    assert.equal(await page.locator('.hk-karte h2').textContent(),'Werkstatt Terrazzo');
    await page.locator('#hkTyp').selectOption('alle');
    await page.locator('#hkProjekt').selectOption({label:'T-01 · Testhaus'});
    assert.match(await page.locator('[data-zahl]').textContent(),/^1 Firma · mit Kontakt in T-01 · Testhaus$/);
    await page.locator('#hkProjekt').selectOption('alle');
    await page.locator('[data-archiv]').click();
    assert.equal(await page.locator('.hk-karte h2').textContent(),'Alte Firma');
    await foto(page,'katalog');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Firmenblatt: Produkte der Bibliothek, Kontakt eintragen, bearbeiten',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    const H1=await page.evaluate(()=>window.__fake.H1);
    await karte(page,'Hersteller B').locator('h2 a').click();
    await page.locator('h1',{hasText:'Hersteller B'}).waitFor();
    assert.match(page.url(),new RegExp('herstellerkatalog\\.html\\?id='+H1+'$'));
    assert.match(await page.locator('.pb-box',{hasText:'In der Produktbibliothek'}).textContent(),/Kalkstein, geschliffen/);
    assert.match((await page.locator('.pb-box',{hasText:'Kontakt in Projekten'}).locator('tbody').textContent()).replace(/\s+/g,' '),/T-01 · Testhaus ?Andere Person ?Angebot ?08\.11\.2026 ?Richtpreis erhalten/);
    // Kontakt eintragen: aktives Projekt, wer im Büro, Art, Datum.
    await page.locator('[data-kontakt-neu]').click();
    await page.locator('#hkDialog select[name="art"]').selectOption('muster');
    await page.locator('#hkDialog input[name="notiz"]').fill('Musterplatte bestellt');
    await page.locator('#hkDialog button[value="speichern"]').click();
    await page.locator('[data-meldung]',{hasText:'Kontakt eingetragen.'}).waitFor();
    const neu=(await db(page)).office_hersteller_kontakte.find(k=>k.notiz==='Musterplatte bestellt');
    assert.equal(neu.hersteller_id,H1);assert.equal(neu.art,'muster');
    assert.equal(neu.person_id,await page.evaluate(()=>window.__fake.UID),'vorbelegt: wer einträgt');
    assert.equal(neu.projekt_id,await page.evaluate(()=>window.__fake.P1));
    // Anderes Projekt frei benennen.
    await page.locator('[data-kontakt-neu]').click();
    await page.locator('#hkDialog select[name="projekt"]').selectOption('');
    await page.locator('#hkDialog input[name="bezeichnung"]').fill('Wettbewerb 2026');
    await page.locator('#hkDialog button[value="speichern"]').click();
    await page.locator('[data-meldung]',{hasText:'Kontakt eingetragen.'}).waitFor();
    assert.ok((await db(page)).office_hersteller_kontakte.some(k=>k.projekt_bezeichnung==='Wettbewerb 2026'&&k.projekt_id===null));
    // Bearbeiten: Website ohne https bekommt es.
    await page.locator('[data-bearbeiten]').click();
    await page.locator('#hkDialog input[name="website"]').fill('www.hersteller-b.invalid');
    await page.locator('#hkDialog button[value="speichern"]').click();
    await page.locator('[data-meldung]',{hasText:'Gespeichert.'}).waitFor();
    assert.equal((await db(page)).office_hersteller.find(h=>h.id===H1).website,'https://www.hersteller-b.invalid');
    await foto(page,'firmenblatt');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Firma anlegen: mit Kategorien; dieselbe Firma geht nicht zweimal',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    await page.locator('[data-neu]').click();
    await page.locator('#hkDialog input[name="firma"]').fill('hersteller b');
    await page.locator('#hkDialog button[value="speichern"]').click();
    await page.locator('#hkDialog [data-dialog-fehler]',{hasText:'Diese Firma steht schon im Katalog.'}).waitFor();
    await page.locator('#hkDialog input[name="firma"]').fill('Leuchten Muster GmbH');
    await page.locator('#hkDialog select[name="typ"]').selectOption('hersteller');
    await page.locator('#hkDialog input[value="licht"]').check();
    await page.locator('#hkDialog input[name="telefon"]').fill('+49 000 55 66');
    await page.locator('#hkDialog button[value="speichern"]').click();
    await page.locator('h1',{hasText:'Leuchten Muster GmbH'}).waitFor();
    const f=(await db(page)).office_hersteller.find(h=>h.firma==='Leuchten Muster GmbH');
    assert.deepEqual(f.kategorien,['licht']);assert.equal(f.typ,'hersteller');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Produktbibliothek: Karte und Produktblatt zeigen den Kontakt der Firma; ?hersteller= filtert',async()=>{
  const {ctx,page,fehler}=await oeffne('produktbibliothek.html');
  try{
    const kalk=page.locator('.pb-karte',{has:page.locator('h2',{hasText:'Kalkstein, geschliffen'})});
    assert.equal(await kalk.locator('.pb-hersteller a[href^="tel:"]').textContent(),'+49 000 1234-0');
    assert.equal(await kalk.locator('.pb-hersteller a[href^="mailto:"]').textContent(),'info@hersteller-b.invalid');
    assert.match(await kalk.locator('.pb-hersteller a',{hasText:'Kontakt'}).getAttribute('href'),/herstellerkatalog\.html\?id=f1111111-/);
    assert.equal(await page.locator('.pb-karte',{has:page.locator('h2',{hasText:'Parkett, vollflächig geklebt'})}).locator('.pb-hersteller').count(),0,'Leistung ohne Firma: kein Kontakt');
    await kalk.locator('h2 a').click();
    const box=page.locator('.pb-box',{has:page.locator('h2',{hasText:'Hersteller'})});
    await box.waitFor();
    assert.match(await box.textContent(),/Hersteller B.*Musterweg 1, 00000 Musterstadt.*\+49 000 1234-0.*info@hersteller-b\.invalid.*hersteller-b\.invalid.*Frau Muster \(Vertrieb\)/);
    // Aus dem Katalog: nur die Produkte der Firma, über alle Kategorien.
    const H1=await page.evaluate(()=>window.__fake.H1);
    await page.goto(adresse('produktbibliothek.html?hersteller='+H1));
    await page.locator('[data-zahl]').waitFor();
    assert.match(await page.locator('[data-zahl]').textContent(),/^1 Eintrag von Hersteller B/);
    // Von Hand anlegen: der Name aus dem Katalog verknüpft die Firma.
    await page.goto(adresse('produktbibliothek.html?neu=hand'));
    await page.locator('#pbFormular').waitFor();
    assert.equal(await page.locator('#pbFirmen option').count(),2,'nur Firmen, die nicht archiviert sind');
    await page.locator('#pbFormular input[name="name"]').fill('Werkstein-Stufe');
    await page.locator('#pbFormular input[name="hersteller"]').fill('Werkstatt Terrazzo');
    await page.locator('#pbFormular button[type="submit"]').click();
    await page.waitForFunction(()=>window.__fake.db.office_produkte.some(p=>p.name==='Werkstein-Stufe'));
    const neu=(await db(page)).office_produkte.find(p=>p.name==='Werkstein-Stufe');
    assert.equal(neu.hersteller_id,await page.evaluate(()=>window.__fake.H2));
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('iPhone: Katalog und Firmenblatt ohne Querscrollen',async()=>{
  const {ctx,page,fehler}=await oeffne('herstellerkatalog.html',{width:390,height:844});
  try{
    assert.ok(await ohneQuerscrollen(page));
    await karte(page,'Hersteller B').locator('h2 a').click();
    await page.locator('h1',{hasText:'Hersteller B'}).waitFor();
    assert.ok(await ohneQuerscrollen(page));
    await foto(page,'iphone-firmenblatt');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

// Reiter «Produkte» und «Hersteller» eines Projekts in Work (Gari, 25.11.2026): nur was für das Projekt ausgewählt ist
// und die Firmen dazu; jeder Link zwischen Bibliothek und Katalog bleibt im Projekt; im Rahmen ohne Rücksprung in die App.
const P1='22222222-2222-4222-8222-222222222222';
test('Im Projekt: Produkte und Hersteller nur des Projekts, Links bleiben im Projekt',async()=>{
  const {ctx,page,fehler}=await oeffne('herstellerkatalog.html?projekt='+P1);
  try{
    // Hersteller: H1 hat Kontakt im Projekt und das ausgewählte Produkt; H2 nur einen Kontakt in einem anderen Vorhaben.
    assert.equal(await page.locator('h1').textContent(),'T-01 · Testhaus');
    assert.match(await page.locator('.pb-head .kicker').textContent(),/Herstellerkatalog · Firmen im Projekt/);
    assert.deepEqual(await page.locator('.hk-karte h2').allTextContents(),['Hersteller B']);
    assert.equal(await page.locator('#hkProjekt').count(),0,'kein zweiter Projektfilter');
    assert.match(await page.locator('[data-zahl]').textContent(),/^1 Firma im Projekt/);
    assert.match(await karte(page,'Hersteller B').locator('.hk-im-projekt').textContent(),/^BO-01 · Kalkstein, geschliffen · bemustert$/);
    // Firmenblatt: zurück zu den Firmen des Projekts; ein neuer Kontakt ist schon dem Projekt zugeordnet.
    await karte(page,'Hersteller B').locator('h2 a').click();
    await page.locator('h1',{hasText:'Hersteller B'}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('projekt'),P1);
    assert.equal(await page.locator('a.pb-back').textContent(),'‹ Firmen des Projekts');
    await page.locator('[data-kontakt-neu]').click();
    assert.equal(await page.locator('#hkDialog select[name="projekt"]').inputValue(),P1);
    await page.locator('#hkDialog button[value="abbrechen"]').click();
    // Produkt der Firma: das Produktblatt bleibt im Projekt und führt zur Auswahl des Projekts zurück.
    await page.locator('.hk-liste a',{hasText:'Kalkstein, geschliffen'}).click();
    await page.locator('h1',{hasText:'Kalkstein, geschliffen'}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('projekt'),P1);
    assert.equal(await page.locator('a.pb-back').textContent(),'‹ Auswahl des Projekts');
    await page.locator('a.pb-back').click();
    await page.locator('[data-zahl]').waitFor();
    assert.match(await page.locator('[data-zahl]').textContent(),/^1 Eintrag ausgewählt für T-01 · Testhaus/);
    assert.deepEqual(await page.locator('.pb-karte h2').allTextContents(),['Kalkstein, geschliffen']);
    assert.equal(await page.locator('#pbProjekt').count(),0);
    assert.equal(await page.locator('.pb-karte [data-zu-projekt]').count(),0,'schon im Projekt: kein «Zu Projekt» auf der Karte');
    assert.equal(await page.locator('.pb-verwendung').textContent(),'BO-01 · bemustert');
    assert.deepEqual(await page.locator('.pb-pills .pill').allTextContents(),['Bodenbeläge · 1','Alle']);
    assert.equal(await page.locator('#pbSort option[value="zuletzt"]').textContent(),'Code im Projekt');
    assert.equal(await page.locator('a.pb-back').textContent(),'‹ Produktbibliothek');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Im Rahmen (Reiter in Work): kein Rücksprung, keine zweite Überschrift, die ganze Bibliothek als ganze Seite',async()=>{
  const ctx=await browser.newContext({viewport:{width:1320,height:940},deviceScaleFactor:1});
  const page=await ctx.newPage();const fehler=[];page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co/,r=>r.abort());
  await page.route(/\/__rahmen__\.html$/,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="de"><body style="margin:0">'+
    '<iframe id="p" style="width:1300px;height:440px;border:0" src="/produktbibliothek.html?projekt='+P1+'"></iframe>'+
    '<iframe id="h" style="width:1300px;height:440px;border:0" src="/herstellerkatalog.html?projekt='+P1+'"></iframe></body></html>'}));
  try{
    await page.goto(adresse('__rahmen__.html'));
    for(const [id,ziel,karten,name] of [['#p','./produktbibliothek.html','.pb-karte h2','Kalkstein, geschliffen'],['#h','./herstellerkatalog.html','.hk-karte h2','Hersteller B']]){
      const f=page.frameLocator(id);
      await f.locator(karten,{hasText:name}).waitFor();
      assert.equal(await f.locator('html').evaluate(h=>h.classList.contains('im-reiter')),true);
      assert.equal(await f.locator('a.pb-back').count(),0,'kein Rücksprung im Rahmen');
      assert.equal(await f.locator('.pb-head h1').count(),0,'Work nennt das Projekt schon');
      const ganz=f.locator('.pb-actions a.btn');
      assert.deepEqual([await ganz.getAttribute('href'),await ganz.getAttribute('target')],[ziel,'_top']);
      assert.equal(await f.locator('a[href^="./app/"]').count(),0);
    }
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});
