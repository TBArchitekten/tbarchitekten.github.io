// Controlling im echten Chromium mit synthetischem Supabase (25.11.2026). Kein Netz, keine Produktion, erfundene Zahlen.
// Abläufe wie im Büro: Übersicht mit zwei Balken je Paket (Stunden gegen Budget mit der Marke des Leistungsstands,
// Honorar mit bezahlt und erarbeitet); Projektblatt mit Kennzahlen, Ständen und Zahlungen; als Admin einen Stand mit
// Stunden je Person erfassen, eine Zahlung aus dem Bruttobetrag erfassen und das Paket ändern; als Mitglied des Teams
// alles sehen außer Personen, Sätzen und Gehältern; Sätze und Gehälter nur für Admins; im Rahmen von Work ohne Weg zur
// Übersicht; iPhone ohne Querscrollen. Bildschirmfotos nur mit CONTROLLING_FOTOS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const fake=fs.readFileSync(new URL('./fixtures/fake-supabase-controlling.js',import.meta.url),'utf8');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  if(p==='/rahmen.html'){res.writeHead(200,{'content-type':'text/html'});
    res.end('<!doctype html><title>Work</title><iframe id="f" style="width:1200px;height:900px" src="/controlling.html?projekt=a1111111-1111-4111-8111-111111111111"></iframe>');return}
  const file=path.join(root,p);
  if(!file.startsWith(root)){res.writeHead(403);res.end();return}
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end();return}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(b)});
}).listen(0);
const browser=await chromium.launch({headless:true});
test.after(async()=>{await browser.close();server.close()});
const FOTOS=process.env.CONTROLLING_FOTOS||'';
const foto=async(page,name)=>{if(FOTOS)await page.screenshot({path:path.join(FOTOS,name+'.png'),fullPage:true})};
const adresse=p=>`http://localhost:${server.address().port}/${p}`;
const P1='a1111111-1111-4111-8111-111111111111',K1='b1111111-1111-4111-8111-111111111111';

async function oeffne(ziel='controlling.html',{rolle='admin',viewport={width:1440,height:1000}}={}){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1});
  await ctx.addInitScript(r=>{window.__ctRolle=r},rolle);
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
const karte=(page,name)=>page.locator('.ct-karte',{has:page.locator('[data-titel]',{hasText:name})});
const text=async l=>(await l.textContent()).replace(/\s+/g,' ').trim();
const merkmal=(page,gruppe,feld)=>page.locator('.ct-gruppe',{has:page.locator('h3',{hasText:gruppe})}).locator('.pb-merkmale div',{has:page.locator('dt',{hasText:new RegExp('^'+feld+'$')})}).locator('dd');
const ohneQuerscrollen=page=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);

test('Übersicht: Karten mit Stunden- und Honorarbalken, laufende Pakete zuerst',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    assert.equal(await page.locator('h1').textContent(),'Controlling');
    // Fett das Projekt, darunter das Paket (Gari, 25.11.2026).
    assert.deepEqual(await page.locator('.ct-karte [data-titel]').allTextContents(),['Testhaus','Nachbarhaus'],'beauftragt vor abgeschlossen');
    const k1=karte(page,'Testhaus');
    assert.equal(await text(k1.locator('.ct-nummer')),'T-01');
    assert.equal(await text(k1.locator('.ct-paket')),'LPH 3 · Entwurfsplanung');
    assert.equal(await text(k1.locator('h2 a')),'Testhaus · LPH 3','der Link nennt Projekt und Paket');
    assert.deepEqual(await k1.locator('.chip').allTextContents(),['beauftragt','vorläufig','Stand 01.11.2026']);
    // 100.000 € ÷ 80 €/h = 1.250 h; 300 + 250 h; Soll bei 40 %: 500 h – darüber.
    const stunden=k1.locator('.ct-balken-block').first();
    assert.deepEqual(await stunden.locator('.ct-balken-kopf>span').allTextContents(),['Stunden','550 h von 1.250 h']);
    assert.equal(await text(stunden.locator('.meta')),'Soll beim Leistungsstand 40 %: 500 h · darüber');
    assert.equal(await stunden.locator('.ct-balken').getAttribute('class'),'ct-balken ueber');
    assert.equal(await stunden.locator('.ct-marke').getAttribute('style'),'left:40.00%');
    // Honorar: 21.000 € netto mit 5 % Nebenkosten → 20.000 € Honorar bezahlt; erarbeitet 40 % von 100.000 €.
    const honorar=k1.locator('.ct-balken-block').nth(1);
    assert.equal(await text(honorar.locator('.meta')),'bezahlt 20.000 € · erarbeitet 40.000 €');
    assert.equal(await honorar.locator('.ct-bezahlt').getAttribute('style'),'width:20.00%');
    // Wert: 300 h × 80 € (eigener Satz fehlt) + 250 h × 90 € = 46.500 €; Prognose 100.000 − 46.500 ÷ 0,4 = −16.250 €.
    assert.equal(await text(k1.locator('[data-ergebnis]')),'− 16.250 €');
    assert.equal(await k1.locator('[data-ergebnis]').getAttribute('class'),'ct-minus');
    assert.equal(await text(k1.locator('.ct-zahlen div').nth(1).locator('dd')),'73 €/h','40.000 € erarbeitet ÷ 550 h');
    assert.equal(await text(k1.locator('.ct-zahlen div').nth(2).locator('dd')),'20.000 €');
    // Abgeschlossen: Leistungsstand 100 %, 400 h × 80 € = 32.000 € gegen 50.000 € → + 18.000 €; keine Zahlungen erfasst.
    const k2=karte(page,'Nachbarhaus');
    assert.equal(await text(k2.locator('[data-ergebnis]')),'+ 18.000 €');
    assert.equal(await k2.locator('.ct-zahlen dt').first().textContent(),'Ergebnis');
    assert.equal(await text(k2.locator('.ct-zahlen div').nth(1).locator('dd')),'125 €/h');
    assert.equal(await text(k2.locator('.ct-zahlen div').nth(2).locator('dd.ct-klein')),'keine Zahlungen erfasst');
    assert.match(await text(k2.locator('.ct-balken-block').nth(1).locator('.meta')),/^Zahlungen noch nicht erfasst · erarbeitet 50\.000 €$/);
    // Admin: Sätze und Gehälter, neues Paket, Projekte ohne Honorar.
    assert.equal(await page.locator('a[href="./controlling.html?ansicht=saetze"]').textContent(),'Sätze und Gehälter');
    assert.equal(await page.locator('[data-paket-neu]').textContent(),'Neues Honorarpaket');
    assert.equal(await text(page.locator('.ct-ohne')),'Noch ohne Honorar: T-03 · Studie');
    await foto(page,'uebersicht');
    // Die ganze Karte öffnet das Projektblatt, auch ein Klick auf den Balken.
    const balken=await k2.locator('.ct-balken').first().boundingBox();
    await page.mouse.click(balken.x+balken.width/2,balken.y+balken.height/2);
    await page.waitForURL(/controlling\.html\?projekt=a2222222-2222-4222-8222-222222222222&paket=b2222222-2222-4222-8222-222222222222$/);
    await page.locator('h1',{hasText:'T-02 · Nachbarhaus'}).waitFor();
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Projektblatt als Admin: Kennzahlen, Stände mit Personen, Zahlungen; Stand, Zahlung und Paket bearbeiten',async()=>{
  const {ctx,page,fehler}=await oeffne('controlling.html?projekt='+P1);
  try{
    assert.equal(await page.locator('h1').textContent(),'T-01 · Testhaus');
    assert.equal(await text(merkmal(page,'Vertrag','Stundenbudget')),'1.250 h');
    assert.equal(await text(merkmal(page,'Vertrag','Kalkulationssatz')),'80 €/h');
    assert.equal(await text(merkmal(page,'Stand 01.11.2026','Wert der Stunden')),'46.500 €');
    assert.equal(await text(merkmal(page,'Stand 01.11.2026','Ergebnis bisher')),'− 6.500 €');
    assert.equal(await text(merkmal(page,'Stand 01.11.2026','Honorar je Stunde')),'72,73 €/h');
    assert.equal(await text(merkmal(page,'Prognose am Ende','Stunden')),'1.375 h');
    assert.equal(await text(merkmal(page,'Zahlungen','Erarbeitet, nicht bezahlt')),'20.000 €');
    // Zum Gehalt (vertraulich): 300 h × 36,30 €/h + 250 h × 27,225 €/h = 17.696,25 € → Ergebnis 40.000 − 17.696 €.
    assert.match(await text(page.locator('.ct-gruppe h3',{hasText:'Zum Gehalt'})),/vertraulich/);
    assert.equal(await text(merkmal(page,'Zum Gehalt','Wert der Stunden')),'17.696 €');
    assert.equal(await text(merkmal(page,'Zum Gehalt','Ergebnis bisher')),'+ 22.304 €');
    assert.equal(await text(page.locator('[data-je-person]')),'Test Admin 300 h · Person B 250 h');
    await foto(page,'projektblatt');

    // Neuer Stand: die Personen des letzten Stands stehen schon da; Test Admin jetzt 350 h, Leistungsstand 50 %.
    await page.locator('[data-stand-neu]').click();
    const d=page.locator('#ctDialog');
    assert.deepEqual(await d.locator('[name="stunden"]').evaluateAll(l=>l.map(i=>i.value)),['300','250']);
    assert.equal(await d.locator('[name="ls"]').inputValue(),'40');
    await d.locator('[name="stichtag"]').fill('2026-11-20');
    await d.locator('[name="ls"]').fill('50');
    await d.locator('[name="stunden"]').first().fill('350');
    assert.equal(await text(d.locator('[data-summe]')),'zusammen 600 h');
    await d.locator('button[value="speichern"]').click();
    await page.locator('[data-meldung]:not([hidden])').waitFor();
    assert.equal(await text(page.locator('[data-meldung]')),'Stand angelegt.');
    assert.equal(await text(merkmal(page,'Stand 20.11.2026','Stunden')),'600 h');
    // Nur der Zuwachs zählt neu: 50 h × 80 € dazu → 50.500 €.
    assert.equal(await text(merkmal(page,'Stand 20.11.2026','Wert der Stunden')),'50.500 €');
    assert.equal(await page.locator('.ct-tabelle tbody tr').count(),2);
    const neu=(await db(page)).office_controlling_stunden.filter(h=>h.stand_id!=='c1111111-1111-4111-8111-111111111111'&&h.stand_id!=='c2222222-2222-4222-8222-222222222222');
    assert.deepEqual(neu.map(h=>h.stunden).sort((a,b)=>a-b),[250,350]);
    // Derselbe Tag noch einmal: abgelehnt, mit Erklärung.
    await page.locator('[data-stand-neu]').click();
    await d.locator('[name="stichtag"]').fill('2026-11-20');
    await d.locator('button[value="speichern"]').click();
    assert.equal(await text(d.locator('[data-dialog-fehler]')),'Für diesen Tag gibt es schon einen Stand.');
    await d.locator('button[value="abbrechen"]').click();

    // Zahlung aus dem Bruttobetrag: 25.000 € → 21.008,40 € netto und 3.991,60 € MwSt.
    await page.locator('[data-reiter="zahlungen"]').click();
    assert.match(page.url(),/reiter=zahlungen/);
    await page.locator('[data-zahlung-neu]').click();
    await d.locator('[name="bezeichnung"]').fill('2. Abschlag');
    await d.locator('[name="brutto"]').fill('25.000');
    assert.equal(await d.locator('[name="netto"]').inputValue(),'21.008,4');
    assert.equal(await d.locator('[name="mwst"]').inputValue(),'3.991,6');
    assert.equal(await text(d.locator('[data-vorschau]')),'davon Honorar 20.008,00 € · Nebenkosten 1.000,40 € · brutto 25.000,00 €');
    await d.locator('[name="vorlaeufig"]').check();
    await d.locator('button[value="speichern"]').click();
    await page.locator('[data-meldung]:not([hidden])').waitFor();
    const z=(await db(page)).office_controlling_zahlungen.find(x=>x.bezeichnung==='2. Abschlag');
    assert.deepEqual([z.netto,z.mwst,z.status,z.vorlaeufig],[21008.4,3991.6,'bezahlt',true]);
    assert.equal(await page.locator('.ct-tabelle tbody tr').count(),2);
    assert.equal(await text(page.locator('.ct-tabelle tfoot td').nth(2)),'40.008,00 €','Honoraranteil beider Zahlungen');
    assert.equal(await text(merkmal(page,'Zahlungen','Bezahlt \\(Honorar\\)')),'40.008 €');

    // Paket bearbeiten: Honorar 120.000 € → Budget 1.500 h.
    await page.locator('[data-paket-bearbeiten]').click();
    await d.locator('[name="honorar"]').fill('120.000');
    assert.equal(await text(d.locator('[data-vorschau]')),'Stundenbudget 1.500 h · Nebenkosten 6.000 €');
    await d.locator('button[value="speichern"]').click();
    await page.locator('[data-meldung]:not([hidden])').waitFor();
    assert.equal(await text(merkmal(page,'Vertrag','Stundenbudget')),'1.500 h');
    assert.equal((await db(page)).office_controlling_pakete.find(p=>p.id===K1).honorar_netto,120000);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Als Mitglied: Honorar, Stunden, Zahlungen und Ergebnis ja; Personen, Sätze und Gehälter nein',async()=>{
  const {ctx,page,fehler}=await oeffne('controlling.html?projekt='+P1,{rolle:'member'});
  try{
    assert.equal(await text(merkmal(page,'Stand 01.11.2026','Stunden')),'550 h');
    assert.equal(await text(merkmal(page,'Stand 01.11.2026','Ergebnis bisher')),'− 6.500 €');
    assert.equal(await page.locator('.ct-gruppe h3',{hasText:'Zum Gehalt'}).count(),0);
    assert.equal(await page.locator('[data-je-person]').count(),0);
    assert.equal(await page.locator('[data-stand-neu],[data-stand],[data-paket-bearbeiten],[data-paket-neu]').count(),0);
    assert.match(await page.locator('.ct-tabelle thead').textContent(),/^(?!.*Gehalt)/);
    await page.locator('[data-reiter="zahlungen"]').click();
    assert.equal(await page.locator('.ct-tabelle tbody tr').count(),1);
    assert.equal(await page.locator('[data-zahlung-neu],[data-zahlung]').count(),0);
    // Die Seite fragt nicht einmal nach Personen, Sätzen oder Einstellungen.
    const tabellen=await page.evaluate(()=>window.__fake.aufrufe.map(a=>a.table));
    for(const t of ['office_controlling_stunden','office_controlling_saetze','office_controlling_einstellungen'])assert.ok(!tabellen.includes(t),t);
    await page.goto(adresse('controlling.html?ansicht=saetze'));
    await page.locator('.pb-banner.warn').waitFor();
    assert.equal(await text(page.locator('.pb-banner.warn')),'Sätze und Gehälter sind nur mit vollem Zugang zum Controlling sichtbar.');
    await page.goto(adresse('controlling.html'));
    await page.locator('.ct-karte').first().waitFor();
    assert.equal(await page.locator('a[href="./controlling.html?ansicht=saetze"],[data-paket-neu],.ct-ohne').count(),0);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Buchhaltung mit vollem Zugang: alle Projekte, Personen und Gehalt, eintragen; den Zugang vergibt sie nicht',async()=>{
  const {ctx,page,fehler}=await oeffne('controlling.html',{rolle:'buchhaltung'});
  try{
    // Nicht im Team und keine Projektleitung, trotzdem beide Pakete und die Projekte ohne Honorar.
    assert.deepEqual(await page.locator('.ct-karte [data-titel]').allTextContents(),['Testhaus','Nachbarhaus']);
    assert.equal(await page.locator('a[href="./controlling.html?ansicht=saetze"]').count(),1);
    await page.goto(adresse('controlling.html?projekt='+P1));
    await page.locator('h1',{hasText:'T-01 · Testhaus'}).waitFor();
    assert.equal(await text(page.locator('[data-je-person]')),'Test Admin 300 h · Person B 250 h');
    assert.equal(await text(merkmal(page,'Zum Gehalt','Wert der Stunden')),'17.696 €');
    await page.locator('[data-reiter="zahlungen"]').click();
    await page.locator('[data-zahlung-neu]').click();
    const d=page.locator('#ctDialog');
    await d.locator('[name="brutto"]').fill('1.190');
    await d.locator('button[value="speichern"]').click();
    await page.locator('[data-meldung]:not([hidden])',{hasText:'Zahlung erfasst.'}).waitFor();
    assert.equal((await db(page)).office_controlling_zahlungen.filter(z=>z.netto===1000&&z.mwst===190).length,1);
    // Sätze und Gehälter ja, den Zugang vergeben nein.
    await page.goto(adresse('controlling.html?ansicht=saetze'));
    await page.locator('h1',{hasText:'Sätze und Gehälter'}).waitFor();
    assert.equal(await page.locator('[data-zugang]').count(),0);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Sätze und Gehälter: Stundensatz aus dem Gehalt, neuer Satz ab Datum, Annahmen',async()=>{
  const {ctx,page,fehler}=await oeffne('controlling.html?ansicht=saetze');
  try{
    assert.equal(await page.locator('h1').textContent(),'Sätze und Gehälter');
    const reihe=name=>page.locator('tbody tr',{has:page.locator('td',{hasText:new RegExp('^'+name)})});
    // Person B: 90 €/h; 3.000 € × 12 × 1,21 ÷ 1.600 h = 27,23 €/h.
    assert.deepEqual((await reihe('Person B').locator('td').allTextContents()).slice(1,5),['90 €/h','3.000 €','27,23 €/h','01.01.2026']);
    assert.equal(await text(reihe('Test Admin').locator('td').nth(1)),'Satz des Pakets');
    await reihe('Person C').locator('[data-person]').click();
    const d=page.locator('#ctDialog');
    await d.locator('[name="ab"]').fill('2026-11-01');
    await d.locator('[name="satz"]').fill('95');
    await d.locator('[name="gehalt"]').fill('3.200');
    assert.equal(await text(d.locator('[data-vorschau]')),'Stundensatz aus Gehalt 29,04 €/h (mit 21 % Arbeitgeberanteil und 1.600 Jahresstunden)');
    await d.locator('button[value="speichern"]').click();
    await page.locator('[data-meldung]:not([hidden])').waitFor();
    assert.equal(await text(reihe('Person C').locator('td').nth(1)),'95 €/h');
    // Annahmen ändern: 1.500 Jahresstunden → Person B 29,04 €/h.
    await page.locator('[name="h"]').fill('1.500');
    await page.locator('[data-einstellungen] button').click();
    await page.locator('[data-meldung]:not([hidden])').waitFor();
    assert.equal(await text(reihe('Person B').locator('td').nth(3)),'29,04 €/h');
    // Voller Zugang (nur Admins vergeben ihn): Person C bekommt ihn und verliert ihn wieder.
    const zugang=page.locator('[data-zugang]');
    assert.deepEqual(await zugang.locator('li').allTextContents(),['Test AdminAdmin, immer']);
    assert.deepEqual(await zugang.locator('[data-zugang-person] option').allTextContents(),['Person B','Person C']);
    await zugang.locator('[data-zugang-person]').selectOption({label:'Person C'});
    await zugang.locator('[data-zugang-geben]').click();
    await page.locator('[data-meldung]:not([hidden])',{hasText:'Person C hat jetzt vollen Zugang zum Controlling.'}).waitFor();
    assert.equal(await page.locator('[data-zugang] [data-zugang-weg]').count(),1);
    assert.deepEqual((await db(page)).office_controlling_zugang.map(z=>z.user_id),[await page.evaluate(()=>window.__fake.C)]);
    await foto(page,'saetze');
    const weg=page.locator('[data-zugang] [data-zugang-weg]');
    await weg.click();assert.equal(await weg.textContent(),'Wirklich entfernen?');await weg.click();
    await page.locator('[data-meldung]:not([hidden])',{hasText:'Zugang entfernt.'}).waitFor();
    assert.equal((await db(page)).office_controlling_zugang.length,0);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Im Rahmen von Work: kein Weg zur Übersicht; iPhone ohne Querscrollen',async()=>{
  const ctx=await browser.newContext({viewport:{width:1300,height:1000}});
  await ctx.addInitScript(()=>{window.__ctRolle='admin'});
  const page=await ctx.newPage();
  const fehler=[];page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  try{
    await page.goto(adresse('rahmen.html'));
    const f=page.frameLocator('#f');
    await f.locator('h1').waitFor();
    assert.equal(await f.locator('h1').textContent(),'T-01 · Testhaus');
    assert.equal(await f.locator('.ct-zur-uebersicht').isVisible(),false);
    assert.equal(await page.frames()[1].evaluate(()=>document.documentElement.classList.contains('im-reiter')&&window.TBA_OFFICE_TOOL.kind),'controlling');
    // Paket und Reiter wechseln bleibt im Rahmen und in der Adresse.
    await f.locator('[data-reiter="zahlungen"]').click();
    assert.match(page.frames()[1].url(),/\/controlling\.html\?projekt=a1111111-1111-4111-8111-111111111111&paket=b1111111-1111-4111-8111-111111111111&reiter=zahlungen$/);
  }finally{await ctx.close()}
  for(const ziel of ['controlling.html','controlling.html?projekt='+P1]){
    const {ctx:c,page:p,fehler:fe}=await oeffne(ziel,{viewport:{width:390,height:844}});
    try{
      assert.equal(await ohneQuerscrollen(p),true,ziel);
      if(ziel.includes('projekt')){await p.locator('[data-reiter="zahlungen"]').click();assert.equal(await ohneQuerscrollen(p),true,ziel+' Zahlungen')}
      await foto(p,'iphone-'+(ziel.includes('projekt')?'blatt':'uebersicht'));
      assert.deepEqual(fe,[]);
    }finally{await c.close()}
  }
  assert.deepEqual(fehler,[]);
});
