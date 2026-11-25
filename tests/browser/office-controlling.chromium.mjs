// Controlling im echten Chromium mit synthetischem Supabase (25.11.2026). Kein Netz, keine Produktion, erfundene Zahlen.
// Abläufe wie im Büro: Übersicht mit zwei Balken je Paket (Stunden gegen Budget mit der Marke des Leistungsstands,
// Honorar mit bezahlt und erarbeitet); Projektblatt mit Kennzahlen, Ständen und Zahlungen; als Admin einen Stand mit
// Stunden je Person erfassen, eine Zahlung aus dem Bruttobetrag erfassen und das Paket ändern; als Mitglied des Teams
// alles sehen außer Personen, Sätzen und Gehältern; Sätze und Gehälter nur für Admins; im Rahmen von Work ohne Weg zur
// Übersicht; iPhone ohne Querscrollen. Seit 25.11.2026 nachmittags: die Lage auf einen Blick, der vertrauliche Teil mit
// «So gerechnet», Wochenstunden, Selbstkosten mit einem erfundenen Gemeinkostenfaktor und «Zu klären». Abends: «So
// gerechnet» auf Knopfdruck, die Stunden grün, orange oder rot, die Jahresstunden aus dem Kalender und PDF (Druck).
// Bildschirmfotos nur mit CONTROLLING_FOTOS.
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
const merkmal=(page,gruppe,feld)=>page.locator('#ct .ct-gruppe',{has:page.locator('h3',{hasText:gruppe})}).locator('.pb-merkmale div',{has:page.locator('dt',{hasText:new RegExp('^'+feld+'$')})}).locator('dd');
// Drucken ohne Dialog: festhalten, was gedruckt würde.
const druckFangen=page=>page.evaluate(()=>{window.__druck=[];window.print=()=>window.__druck.push({titel:document.title,
  html:document.getElementById('ctDruck').innerHTML,quer:[...document.head.querySelectorAll('style')].some(s=>s.textContent.includes('landscape')),
  klasse:document.documentElement.className})});
const gedruckt=page=>page.evaluate(()=>window.__druck.at(-1));
const fuellung=(l)=>l.evaluate(e=>getComputedStyle(e).backgroundColor);
const vertraulich=(page,zeile)=>page.locator('[data-vertraulich-zeile="'+zeile+'"]');
const kachel=(page,name)=>page.locator('[data-kachel="'+name+'"]');
const ohneQuerscrollen=page=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);

test('Übersicht: Karten mit Stunden- und Honorarbalken, laufende Pakete zuerst',async()=>{
  const {ctx,page,fehler}=await oeffne();
  try{
    assert.equal(await page.locator('h1').textContent(),'Controlling');
    // Fett das Projekt, darunter das Paket (Gari, 25.11.2026).
    assert.deepEqual(await page.locator('.ct-karte [data-titel]').allTextContents(),['Testhaus','Nachbarhaus'],'nach Projektnummer (Gari, 25.11.2026)');
    const k1=karte(page,'Testhaus');
    assert.equal(await text(k1.locator('.ct-nummer')),'T-01');
    assert.equal(await text(k1.locator('.ct-paket')),'LPH 3 · Entwurfsplanung');
    assert.equal(await text(k1.locator('h2 a')),'Testhaus · LPH 3','der Link nennt Projekt und Paket');
    // Die Lage zuerst, mit Zeichen und Wort (Gari, 25.11.2026): −16.250 € sind 16,3 % des Honorars, deutlich über Budget.
    assert.deepEqual(await k1.locator('.chip').allTextContents(),['deutlich über Budget','beauftragt','vorläufig','Stand 01.11.2026']);
    assert.equal(await k1.locator('.ct-lage-chip svg').count(),1);
    // 100.000 € ÷ 80 €/h = 1.250 h; 300 + 250 h; Soll bei 40 %: 500 h – darüber.
    const stunden=k1.locator('.ct-balken-block').first();
    assert.deepEqual(await stunden.locator('.ct-balken-kopf>span').allTextContents(),['Stunden','550 h von 1.250 h']);
    assert.equal(await text(stunden.locator('.meta')),'Soll beim Leistungsstand 40 %: 500 h · darüber');
    assert.equal(await stunden.locator('.ct-balken').getAttribute('class'),'ct-balken ueber lage-kritisch');
    assert.equal(await fuellung(stunden.locator('.ct-fuellung')),'rgb(168, 50, 63)','rot: deutlich über Budget');
    assert.equal(await stunden.locator('.ct-marke').getAttribute('style'),'left:40.00%');
    // Honorar: 21.000 € netto mit 5 % Nebenkosten → 20.000 € Honorar bezahlt; erarbeitet 40 % von 100.000 €.
    const honorar=k1.locator('.ct-balken-block').nth(1);
    assert.equal(await text(honorar.locator('.meta')),'bezahlt 20.000 € netto · erarbeitet 40.000 € netto');
    assert.equal(await honorar.locator('.ct-bezahlt').getAttribute('style'),'width:20.00%');
    // Wert: 300 h × 80 € (eigener Satz fehlt) + 250 h × 90 € = 46.500 €; Prognose 100.000 − 46.500 ÷ 0,4 = −16.250 €.
    assert.equal(await text(k1.locator('[data-ergebnis]')),'− 16.250 €');
    assert.equal(await k1.locator('[data-ergebnis]').getAttribute('class'),'ct-minus');
    assert.equal(await text(k1.locator('.ct-zahlen div').nth(1).locator('dd')),'73 €/h','40.000 € erarbeitet ÷ 550 h');
    assert.equal(await text(k1.locator('.ct-zahlen div').nth(2).locator('dd')),'20.000 €');
    // Dieselben Begriffe wie im Projektblatt (Gari, 25.11.2026).
    assert.deepEqual(await k1.locator('.ct-zahlen dt').allTextContents(),['Ergebnis am Ende netto','Honorar je Stunde netto','Erarbeitet, nicht bezahlt netto']);
    // Abgeschlossen: Leistungsstand 100 %, 400 h × 80 € = 32.000 € gegen 50.000 € → + 18.000 €; keine Zahlungen erfasst.
    const k2=karte(page,'Nachbarhaus');
    assert.equal(await text(k2.locator('[data-ergebnis]')),'+ 18.000 €');
    assert.equal(await k2.locator('.ct-zahlen dt').first().textContent(),'Ergebnis netto');
    assert.equal(await text(k2.locator('.ct-lage-chip')),'im Budget');
    assert.equal(await fuellung(k2.locator('.ct-balken-block').first().locator('.ct-fuellung')),'rgb(47, 154, 99)','grün: im Budget (Gari, 25.11.2026)');
    // Übersicht als PDF: quer, alle Pakete, mit vollem Zugang auf Wunsch mit Gewinn.
    await druckFangen(page);
    await page.locator('[data-pdf-uebersicht]').click();
    await page.locator('#ctDialog [name="gewinn"]').check();
    await page.locator('#ctDialog button[value="drucken"]').click();
    const ue=await gedruckt(page);
    assert.match(ue.titel,/^Controlling – Übersicht – \d{4}-\d{2}-\d{2} – vertraulich$/);
    assert.equal(ue.quer,true);
    assert.match(ue.html,/Testhaus[\s\S]*Nachbarhaus/,'wie die Karten geordnet');
    assert.match(ue.html,/Gewinn am Ende netto/);
    assert.equal(await text(k2.locator('.ct-zahlen div').nth(1).locator('dd')),'125 €/h');
    assert.equal(await text(k2.locator('.ct-zahlen div').nth(2).locator('dd.ct-klein')),'keine Zahlungen erfasst');
    assert.match(await text(k2.locator('.ct-balken-block').nth(1).locator('.meta')),/^Zahlungen noch nicht erfasst · erarbeitet 50\.000 € netto$/);
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
    assert.equal(await text(merkmal(page,'Vertrag','Kalkulationssatz netto')),'80 €/h');
    assert.equal(await text(merkmal(page,'Stand 01.11.2026','Wert der Stunden netto')),'46.500 €');
    assert.equal(await text(merkmal(page,'Stand 01.11.2026','Ergebnis bisher netto')),'− 6.500 €');
    assert.equal(await text(merkmal(page,'Stand 01.11.2026','Honorar je Stunde netto')),'72,73 €/h');
    assert.equal(await text(merkmal(page,'Prognose am Ende','Stunden am Ende')),'1.375 h');
    assert.equal(await text(merkmal(page,'Prognose am Ende','Ergebnis am Ende netto')),'− 16.250 €');
    assert.equal(await text(merkmal(page,'Zahlungen','Erarbeitet, nicht bezahlt netto')),'20.000 €');
    // Lage auf einen Blick (Gari, 25.11.2026): Stufe mit Zeichen und Wort, ein Satz, drei Balken auf einer Skala, Kacheln.
    const lage=page.locator('.ct-lage');
    assert.equal(await lage.getAttribute('data-lage'),'kritisch');
    assert.equal(await text(lage.locator('.ct-lage-titel')),'Deutlich über Budget');
    assert.equal(await text(lage.locator('.ct-lage-satz')),'Im bisherigen Takt braucht das Paket 1.375 h statt 1.250 h; am Ende fehlen 16.250 € gegenüber der Kalkulation (16,3 % des Honorars).');
    assert.deepEqual(await lage.locator('.ct-meter-zahl').allTextContents(),['40 % erledigt','44 % · 550 h von 1.250 h','20 % · 20.000 € von 100.000 €']);
    assert.equal(await lage.locator('[data-meter="stunden"] .ct-meter-spur').getAttribute('class'),'ct-meter-spur kritisch');
    assert.equal(await fuellung(lage.locator('[data-meter="stunden"] .ct-meter-fuellung')),'rgb(168, 50, 63)');
    assert.equal(await fuellung(lage.locator('[data-meter="leistung"] .ct-meter-fuellung')),'rgb(96, 99, 106)','Leistung bleibt grau');
    assert.deepEqual(await lage.locator('.ct-meter-marke').evaluateAll(l=>l.map(m=>m.style.left)),['40%','40%'],'der Leistungsstand als Strich bei Stunden und Bezahlt');
    assert.deepEqual([await text(kachel(page,'ergebnis').locator('strong')),await text(kachel(page,'rest').locator('strong')),await text(kachel(page,'rest').locator('.ct-kachel-unter')),
      await text(kachel(page,'offen').locator('strong')),await text(kachel(page,'offen').locator('.ct-kachel-unter'))],
      ['− 16.250 €','700 h','im bisherigen Takt nötig: 825 h','20.000 €','kann abgerechnet werden']);
    // Gewinn mit dem erfundenen Faktor 2: 300 h × 60 €/h + 250 h × 72 €/h = 36.000 € → am Ende 100.000 − 36.000 ÷ 40 %.
    assert.equal(await text(kachel(page,'gewinn').locator('strong')),'+ 10.000 €');
    assert.equal(await text(kachel(page,'gewinn').locator('.ct-kachel-unter')),'nach Gehältern und Bürokosten · Annahmen vorläufig');
    // Im Kopf des Pakets keine zweite Lage.
    assert.deepEqual(await page.locator('.ct-kopf-rechts .chip').allTextContents(),['beauftragt','vorläufig','Stand 01.11.2026']);
    // Klickbar heißt blau, auch «Paket bearbeiten» (Gari, 25.11.2026).
    assert.equal(await page.locator('[data-paket-bearbeiten]').evaluate(b=>getComputedStyle(b).color),'rgb(0, 98, 204)');
    // Gari: bei jedem Betrag sagen, ob netto oder brutto.
    assert.equal(await text(page.locator('.ct-netto')),'Alle Beträge in Euro netto, ohne MwSt; das Honorar ohne Nebenkosten.');
    assert.deepEqual(await page.locator('.ct-gruppe').first().locator('dt').allTextContents(),['Honorar netto','Nebenkosten netto (5 %)','Kalkulationssatz netto','Stundenbudget']);
    // So wird gerechnet: jeder Wert mit Herkunft und den Zahlen des Pakets.
    await page.locator('[data-rechenweg]').click();
    const rw=page.locator('#ctDialog .ct-rw');
    await rw.waitFor();
    const zeile=t=>rw.locator('li',{has:page.locator('strong',{hasText:new RegExp('^'+t+'$')})}).locator('.ct-rw-wert');
    assert.equal(await text(zeile('Stundenbudget')),'100.000 € ÷ 80 €/h = 1.250 h');
    assert.equal(await text(zeile('Wert der Stunden netto')),'Summe je Person = 46.500 €','zwei Sätze: nicht als eine Multiplikation');
    assert.equal(await text(zeile('Erarbeitet netto')),'100.000 € × 40 % = 40.000 €');
    assert.equal(await text(zeile('Ergebnis bisher netto')),'40.000 € − 46.500 € = − 6.500 €');
    assert.equal(await text(zeile('Prognose am Ende')),'550 h ÷ 40 % = 1.375 h · 100.000 € − 46.500 € ÷ 40 % = − 16.250 €');
    assert.equal(await text(zeile('Bezahlt netto')),'20.000 €');
    assert.equal(await rw.locator('li strong',{hasText:'Zum Gehalt (vertraulich)'}).count(),1);
    assert.equal(await text(zeile('Die Lage')),'− 16.250 € = − 16,3 % des Honorars → deutlich über Budget');
    assert.equal(await text(zeile('Erarbeitet, nicht bezahlt netto')),'40.000 € − 20.000 € = 20.000 €');
    await foto(page,'rechenweg');
    await page.locator('#ctDialog button[value="abbrechen"]').click();
    // Zum Gehalt (vertraulich), neben jedem Wert, wie er gerechnet ist (Gari, 25.11.2026). Person B arbeitet 25 von 40 h:
    // 3.000 € × 12 × 1,21 ÷ 1.000 h = 43,56 €/h; Test Admin in Vollzeit 4.000 € → 36,30 €/h. 300 h × 36,30 + 250 h × 43,56 = 21.780 €.
    assert.match(await text(page.locator('[data-vertraulich] h3')),/^Zum Gehalt vertraulich$/);
    // «So gerechnet» erst auf Knopfdruck (Gari, 25.11.2026: braucht sonst zu viel Platz).
    const so=page.locator('[data-so-gerechnet]');
    assert.equal(await so.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('[data-vertraulich] td.ct-so').first().isVisible(),false);
    await so.click();
    assert.equal(await so.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('[data-vertraulich] td.ct-so').first().isVisible(),true);
    assert.match(await text(page.locator('.ct-so-hinweis')),/^Gerechnet beim Öffnen der Seite/);
    const spalten=async z=>(await vertraulich(page,z).locator('td.num').allTextContents()).map(t=>t.replace(/\s+/g,' ').trim());
    assert.deepEqual(await spalten('personalkosten'),['21.780 €','54.450 €']);
    assert.deepEqual(await vertraulich(page,'personalkosten').locator('.ct-so-teil').allTextContents(),
      ['Test Admin: 300 h × 36,30 €/h','Person B: 250 h × 43,56 €/h','am Ende ÷ 40 % Leistungsstand']);
    assert.deepEqual(await spalten('ergebnis-gehalt'),['+ 18.220 €','+ 45.550 €']);
    assert.equal(await text(vertraulich(page,'ergebnis-gehalt').locator('.ct-so')),'Erarbeitet 40.000 € − 21.780 €am Ende: Honorar 100.000 € − 54.450 €');
    // Selbstkosten mit dem Faktor auf das Bruttogehalt allein: 4.000 × 12 × 2 ÷ 1.600 = 60 €/h; 3.000 × 12 × 2 ÷ 1.000 = 72 €/h.
    assert.equal(await text(vertraulich(page,'selbstkosten').locator('th .ct-einheit')),'Bruttogehalt × 2,00');
    assert.deepEqual(await spalten('selbstkosten'),['36.000 €','90.000 €']);
    assert.deepEqual(await vertraulich(page,'selbstkosten').locator('[data-so-person]').allTextContents(),['Test Admin: 300 h × 60,00 €/h','Person B: 250 h × 72,00 €/h']);
    assert.deepEqual(await spalten('gewinn'),['+ 4.000 €','+ 10.000 €']);
    assert.match(await text(page.locator('[data-annahmen-hinweis]')),/^Annahmen: 21 % Arbeitgeberanteil, 1\.600 Jahresstunden bei 40 h in der Woche, Gemeinkostenfaktor 2,00 auf das Bruttogehalt\. Noch nicht bestätigt\./);
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
    assert.equal(await text(merkmal(page,'Stand 20.11.2026','Wert der Stunden netto')),'50.500 €');
    assert.equal(await page.locator('.ct-tabelle tbody tr').count(),2);
    // Personalkosten je Stand aus der Bewertung je Person: + 50 h × 36,30 €/h = 23.595 €. Die Lage folgt: 600 h bei 50 %.
    assert.equal(await text(page.locator('.ct-tabelle tbody tr').first().locator('td').nth(6)),'23.595 €');
    assert.equal(await page.locator('.ct-lage').getAttribute('data-lage'),'achtung');
    assert.equal(await text(page.locator('.ct-lage-titel')),'Leicht über Budget');
    assert.equal(await fuellung(page.locator('[data-meter="stunden"] .ct-meter-fuellung')),'rgb(212, 105, 15)','orange: leicht über Budget');
    assert.equal(await page.locator('[data-so-gerechnet]').getAttribute('aria-expanded'),'true','bleibt nach dem Speichern offen');
    const neu=(await db(page)).office_controlling_stunden.filter(h=>h.stand_id!=='c1111111-1111-4111-8111-111111111111'&&h.stand_id!=='c2222222-2222-4222-8222-222222222222');
    assert.deepEqual(neu.map(h=>h.stunden).sort((a,b)=>a-b),[250,350]);
    // Derselbe Tag noch einmal: abgelehnt, mit Erklärung.
    await page.locator('[data-stand-neu]').click();
    await d.locator('[name="stichtag"]').fill('2026-11-20');
    await d.locator('button[value="speichern"]').click();
    assert.equal(await text(d.locator('[data-dialog-fehler]')),'Für diesen Tag gibt es schon einen Stand.');
    await d.locator('button[value="abbrechen"]').click();

    // Zahlung wie die Rechnung des Büros: Abschlag 18.388,36 € zzgl. 5 % Nebenkosten 919,42 € = 19.307,78 € netto,
    // zzgl. 19 % MwSt 3.668,48 € = 22.976,26 € brutto. Jeder Eingang rechnet den Rest; die MwSt folgt dem Netto.
    await page.locator('[data-reiter="zahlungen"]').click();
    assert.match(page.url(),/reiter=zahlungen/);
    assert.deepEqual(await page.locator('.ct-tabelle thead th').allTextContents(),
      ['Datum','Bezeichnung','Abschlag (AZ)Honorar netto','zzgl. 5 % Nebenkosten','Nettoinkl. Nebenkosten','MwSt','Brutto','Status','']);
    await page.locator('[data-zahlung-neu]').click();
    const werte=()=>d.locator('[name="abschlag"],[name="netto"],[name="mwst"],[name="brutto"]').evaluateAll(l=>l.map(i=>i.value));
    await d.locator('[name="abschlag"]').fill('18.388,36');
    assert.deepEqual(await werte(),['18.388,36','19.307,78','3.668,48','22.976,26']);
    assert.equal(await text(d.locator('[data-nk]')),'919,42 €');
    await d.locator('[name="netto"]').fill('19.307,78');
    assert.deepEqual(await werte(),['18.388,36','19.307,78','3.668,48','22.976,26'],'aus dem Netto dieselbe Rechnung');
    await d.locator('[name="netto"]').fill('21.000');
    assert.equal(await d.locator('[name="mwst"]').inputValue(),'3.990','die MwSt folgt dem Netto');
    await d.locator('[name="bezeichnung"]').fill('2. Abschlag');
    await d.locator('[name="brutto"]').fill('25.000');
    assert.deepEqual(await werte(),['20.008','21.008,4','3.991,6','25.000']);
    assert.equal(await text(d.locator('[data-nk]')),'1.000,40 €');
    await d.locator('[name="vorlaeufig"]').check();
    await d.locator('button[value="speichern"]').click();
    await page.locator('[data-meldung]:not([hidden])').waitFor();
    const z=(await db(page)).office_controlling_zahlungen.find(x=>x.bezeichnung==='2. Abschlag');
    assert.deepEqual([z.netto,z.mwst,z.status,z.vorlaeufig],[21008.4,3991.6,'bezahlt',true]);
    assert.equal(await page.locator('.ct-tabelle tbody tr').count(),2);
    assert.deepEqual(await page.locator('.ct-tabelle tfoot td').allTextContents(),['Summe','40.008,00 €','2.000,40 €','42.008,40 €','7.981,60 €','49.990,00 €','','']);
    assert.equal(await text(merkmal(page,'Zahlungen','Bezahlt netto \\(Abschläge\\)')),'40.008 €');
    // Zahlungen als PDF (Gari, 25.11.2026): wie die Tabelle, dazu Honorar, erarbeitet, bezahlt und offen; Dateiname aus dem Titel.
    await druckFangen(page);
    await page.locator('[data-pdf-zahlungen]').click();
    const za=await gedruckt(page);
    assert.match(za.titel,/^T-01 – Testhaus – LPH 3 – Zahlungen – \d{4}-\d{2}-\d{2}$/);
    assert.match(za.klasse,/ct-drucken/);
    assert.equal(za.quer,false);
    assert.match(za.html,/<h1>Zahlungsübersicht<\/h1>/);
    assert.match(za.html,/Summe<\/td><td class="num">40\.008,00 €<\/td><td class="num">2\.000,40 €<\/td><td class="num">42\.008,40 €<\/td>/);
    assert.match(za.html,/Erarbeitet, nicht bezahlt netto<\/dt><dd>/);
    assert.doesNotMatch(za.html,/Personalkosten|Gewinn/,'nichts Vertrauliches');
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('#ct').isVisible(),false);
    assert.equal(await page.locator('#ctDruck').isVisible(),true);
    await page.emulateMedia({media:'screen'});
    // Bericht als PDF: Teile wählbar, Vertrauliches nur auf Wunsch.
    await page.locator('[data-pdf-bericht]').click();
    assert.deepEqual(await page.locator('#ctDialog input[type="checkbox"]').evaluateAll(l=>l.map(i=>i.name+':'+i.checked)),
      ['lage:true','staende:true','zahlungen:true','vertraulich:false']);
    await page.locator('#ctDialog button[value="drucken"]').click();
    const be=await gedruckt(page);
    assert.match(be.titel,/^T-01 – Testhaus – LPH 3 – Controlling – /);
    assert.match(be.html,/Controlling-Bericht[\s\S]*Lage und Kennzahlen[\s\S]*Stände und Stunden[\s\S]*Zahlungen/);
    assert.doesNotMatch(be.html,/Personalkosten|Gewinn|Test Admin 350 h/,'ohne «vertraulich» keine Gehälter, kein Gewinn, keine Stunden je Person');
    await page.locator('[data-pdf-bericht]').click();
    await page.locator('#ctDialog [name="vertraulich"]').check();
    await page.locator('#ctDialog [name="zahlungen"]').uncheck();
    await page.locator('#ctDialog button[value="drucken"]').click();
    const bv=await gedruckt(page);
    assert.match(bv.titel,/ – Controlling vertraulich – /);
    assert.match(bv.html,/TBA Office · Controlling · <strong>vertraulich<\/strong>/);
    assert.match(bv.html,/Gewinn nach Bürokosten netto[\s\S]*Test Admin 350 h/);
    assert.doesNotMatch(bv.html,/<h2>Zahlungen<\/h2>/);

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
    assert.equal(await text(merkmal(page,'Stand 01.11.2026','Ergebnis bisher netto')),'− 6.500 €');
    // Die Lage sieht das ganze Team; Gewinn, Personal- und Selbstkosten nicht.
    assert.equal(await page.locator('.ct-lage').getAttribute('data-lage'),'kritisch');
    assert.equal(await page.locator('[data-vertraulich],[data-kachel="gewinn"],.ct-nur-admin').count(),0);
    assert.equal(await page.locator('[data-je-person]').count(),0);
    assert.equal(await page.locator('[data-stand-neu],[data-stand],[data-paket-bearbeiten],[data-paket-neu]').count(),0);
    assert.match(await page.locator('.ct-tabelle thead').textContent(),/^(?!.*Gehalt)/);
    await druckFangen(page);
    await page.locator('[data-pdf-bericht]').click();
    assert.deepEqual(await page.locator('#ctDialog input[type="checkbox"]').evaluateAll(l=>l.map(i=>i.name)),['lage','staende','zahlungen'],'ohne «vertraulich»');
    await page.locator('#ctDialog button[value="drucken"]').click();
    assert.doesNotMatch((await gedruckt(page)).html,/Personalkosten|Gewinn|vertraulich/);
    await page.locator('[data-reiter="zahlungen"]').click();
    assert.equal(await page.locator('.ct-tabelle tbody tr').count(),1);
    assert.equal(await page.locator('[data-zahlung-neu],[data-zahlung]').count(),0);
    assert.equal(await page.locator('[data-pdf-zahlungen]').count(),1,'Zahlungen als PDF auch für das Team');
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
    assert.equal(await text(vertraulich(page,'personalkosten').locator('td.num').first()),'21.780 €');
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

test('Admin ohne Eintrag auf der Liste: keine Sätze, keine Gehälter, keine Stunden je Person (Gari, 25.11.2026)',async()=>{
  const {ctx,page,fehler}=await oeffne('controlling.html?projekt='+P1,{rolle:'admin-ohne-liste'});
  try{
    assert.equal(await text(merkmal(page,'Stand 01.11.2026','Stunden')),'550 h');
    assert.equal(await page.locator('[data-vertraulich],[data-kachel="gewinn"]').count(),0);
    assert.equal(await page.locator('[data-je-person],[data-stand-neu],[data-paket-bearbeiten]').count(),0);
    const tabellen=await page.evaluate(()=>window.__fake.aufrufe.map(a=>a.table));
    for(const t of ['office_controlling_stunden','office_controlling_saetze','office_controlling_einstellungen'])assert.ok(!tabellen.includes(t),t);
    await page.goto(adresse('controlling.html?ansicht=saetze'));
    await page.locator('.pb-banner.warn').waitFor();
    assert.equal(await text(page.locator('.pb-banner.warn')),'Sätze und Gehälter sind nur mit vollem Zugang zum Controlling sichtbar.');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Sätze und Gehälter: Wochenstunden, Stundensatz und Selbstkostensatz, neuer Satz ab Datum, Annahmen mit Erklärung und «Zu klären»',async()=>{
  const {ctx,page,fehler}=await oeffne('controlling.html?ansicht=saetze');
  try{
    assert.equal(await page.locator('h1').textContent(),'Sätze und Gehälter');
    const reihe=name=>page.locator('tbody tr',{has:page.locator('td',{hasText:new RegExp('^'+name)})});
    const zellen=async name=>(await reihe(name).locator('td').allTextContents()).slice(1,9);
    // Person B: 90 €/h; 25 von 40 h → 1.000 Jahresstunden: 3.000 € × 12 × 1,21 ÷ 1.000 = 43,56 €/h; × 2 statt × 1,21: 72,00 €/h.
    assert.deepEqual(await zellen('Person B'),['90 €/h','3.000 €','25 h','wie das Büro','1.000 h','43,56 €/h','72,00 €/h','01.01.2026']);
    assert.deepEqual(await zellen('Test Admin'),['Satz des Pakets','4.000 €','Vollzeit','wie das Büro','1.600 h','36,30 €/h','60,00 €/h','01.01.2026']);
    // Die Annahmen mit Erklärung je Feld und einem Beispiel (Gari, 25.11.2026).
    const an=page.locator('[data-annahmen]');
    assert.equal(await text(an.locator('h2')),'Annahmen für den Stundensatz aus dem Gehalt');
    assert.match(await text(an.locator('.ct-erklaerung')),/Bruttogehalt × 12 × \(1 \+ Arbeitgeberanteil\) ÷ Jahresstunden der Person/);
    assert.equal(await text(an.locator('[data-beispiel]')),'Beispiel: 4.000 € brutto bei 40 h in der Woche → 36,30 €/h Personalkosten, 60,00 €/h Selbstkosten. Halbe Stelle mit halbem Gehalt: dieselben Sätze.');
    assert.equal(await an.locator('.ct-feld>.ct-feld-hilfe').count(),5);
    assert.equal(await an.locator('[name="faktor"]').getAttribute('aria-describedby'),'an-faktor-hilfe');
    // Zu klären: acht Fragen, je mit Warum und dem, was jetzt angenommen ist.
    const fragen=page.locator('[data-zu-klaeren] li');
    assert.equal(await fragen.count(),8);
    assert.equal(await text(fragen.first().locator('strong')),'Wird der Gemeinkostenfaktor 2,00 auf das Bruttogehalt allein gerechnet oder auf Bruttogehalt plus Arbeitgeberanteil?');
    assert.equal(await text(fragen.first().locator('span').nth(1)),'Jetzt angenommen: auf das Bruttogehalt allein (Festlegung vom 25.11.2026).');
    assert.match(await text(page.locator('[data-frage="wochenstunden"]')),/\(1 Person mit Gehalt ohne Wochenstunden\)\.$/);
    assert.match(await text(page.locator('[data-frage="kalkulationssatz"]')),/bis zu einem Bruttogehalt von rund 5\.667 € im Monat \(Vollzeit\)/);
    // Neuer Satz mit Wochenstunden: 3.200 € bei 20 h → 800 Jahresstunden.
    await reihe('Person C').locator('[data-person]').click();
    const d=page.locator('#ctDialog');
    await d.locator('[name="ab"]').fill('2026-11-01');
    await d.locator('[name="satz"]').fill('95');
    await d.locator('[name="gehalt"]').fill('3.200');
    await d.locator('[name="woche"]').fill('20');
    assert.equal(await text(d.locator('[data-vorschau]')),'Stundensatz aus Gehalt 58,08 €/h, Selbstkostensatz 96,00 €/h (800 Jahresstunden, 21 % Arbeitgeberanteil, Faktor 2,00)');
    await d.locator('button[value="speichern"]').click();
    await page.locator('[data-meldung]:not([hidden])').waitFor();
    assert.deepEqual(await zellen('Person C'),['95 €/h','3.200 €','20 h','wie das Büro','800 h','58,08 €/h','96,00 €/h','01.11.2026']);
    assert.equal((await db(page)).office_controlling_saetze.find(x=>x.monatsgehalt===3200).wochenstunden,20);
    // Annahmen ändern: Faktor außerhalb von 1 bis 5 abgelehnt; 1.500 Jahresstunden und Faktor 2,5, bestätigt, mit Notiz.
    await an.locator('[name="faktor"]').fill('0,5');
    await an.locator('[data-einstellungen] button.btn-primary').click();
    await page.locator('.pb-banner.warn:not([hidden])').waitFor();
    assert.match(await text(page.locator('[data-meldung]')),/^Gemeinkostenfaktor zwischen 1 und 5/);
    await an.locator('[name="h"]').fill('1.500');
    await an.locator('[name="faktor"]').fill('2,5');
    assert.equal(await text(an.locator('[data-beispiel]')),'Beispiel: 4.000 € brutto bei 40 h in der Woche → 38,72 €/h Personalkosten, 80,00 €/h Selbstkosten. Halbe Stelle mit halbem Gehalt: dieselben Sätze.');
    await an.locator('[name="bestaetigt"]').fill('2026-11-26');
    await an.locator('[name="notiz"]').fill('Mit der Büroleitung geklärt');
    await an.locator('[data-einstellungen] button.btn-primary').click();
    await page.locator('[data-meldung]:not([hidden])',{hasText:'Gespeichert.'}).waitFor();
    // Person B: 1.500 × 25 ÷ 40 = 937,5 h → 43.560 ÷ 937,5 = 46,46 €/h; 3.000 × 12 × 2,5 ÷ 937,5 = 96,00 €/h.
    assert.deepEqual((await zellen('Person B')).slice(5,7),['46,46 €/h','96,00 €/h']);
    const e=(await db(page)).office_controlling_einstellungen[0];
    assert.deepEqual([e.jahresstunden,e.gemeinkostenfaktor,e.vollzeit_wochenstunden,e.annahmen_bestaetigt,e.annahmen_notiz],[1500,2.5,40,'2026-11-26','Mit der Büroleitung geklärt']);
    // Bestätigt: der Gewinn im Projektblatt ist nicht mehr vorläufig.
    await page.goto(adresse('controlling.html?projekt='+P1));
    await page.locator('[data-kachel="gewinn"]').waitFor();
    assert.equal(await text(kachel(page,'gewinn').locator('.ct-kachel-unter')),'nach Gehältern und Bürokosten');
    assert.match(await text(page.locator('[data-annahmen-hinweis]')),/Bestätigt am 26\.11\.2026\./);
    await page.goto(adresse('controlling.html?ansicht=saetze'));
    await page.locator('[data-zugang]').waitFor();
    // Voller Zugang (nur Admins vergeben ihn): Person C bekommt ihn und verliert ihn wieder.
    const zugang=page.locator('[data-zugang]');
    // Nur die Liste zählt: der Admin steht darauf (seit der Migration), sich selbst entfernt er hier nicht.
    assert.deepEqual(await zugang.locator('li').allTextContents(),['Test Admin Admindu']);
    assert.deepEqual(await zugang.locator('[data-zugang-person] option').allTextContents(),['Person B','Person C']);
    await zugang.locator('[data-zugang-person]').selectOption({label:'Person C'});
    await zugang.locator('[data-zugang-geben]').click();
    await page.locator('[data-meldung]:not([hidden])',{hasText:'Person C hat jetzt vollen Zugang zum Controlling.'}).waitFor();
    assert.equal(await page.locator('[data-zugang] [data-zugang-weg]').count(),1);
    assert.deepEqual((await db(page)).office_controlling_zugang.map(z=>z.user_id),await page.evaluate(()=>[window.__fake.UID,window.__fake.C]));
    await foto(page,'saetze');
    const weg=page.locator('[data-zugang] [data-zugang-weg]');
    await weg.click();assert.equal(await weg.textContent(),'Wirklich entfernen?');await weg.click();
    await page.locator('[data-meldung]:not([hidden])',{hasText:'Zugang entfernt.'}).waitFor();
    assert.equal((await db(page)).office_controlling_zugang.length,1);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Jahresstunden aus dem Kalender: Feiertage in Augsburg, Urlaub, Krankheit, weitere Tage; übernehmen und speichern',async()=>{
  const {ctx,page,fehler}=await oeffne('controlling.html?ansicht=saetze');
  try{
    const h=page.locator('[data-herleitung]');
    assert.equal(await h.evaluate(d=>d.open),false,'zu, bis man es öffnet');
    // Schon zu: Werktage, Feiertage und Arbeitstage des Jahres (rechnet der Kern; hier gegengeprüft).
    const erwartet=await page.evaluate(()=>{const K=window.TBA_CONTROLLING,j=new Date().getFullYear(),r=K.jahresstundenAusKalender({jahr:j});
      return j+' in Augsburg: '+r.werktage.toLocaleString('de-DE')+' Werktage − '+r.feiertage+' Feiertage = '+r.arbeitstage.toLocaleString('de-DE')+' Arbeitstage'});
    assert.equal(await text(h.locator('summary')),'Jahresstunden aus dem Kalender herleiten · '+erwartet);
    await h.locator('summary').click();
    // 2026 fest gewählt: 261 Werktage, 9 Feiertage auf Werktagen, 5 am Wochenende.
    await h.locator('[name="jahr"]').selectOption({label:'2026'}).catch(()=>{});
    const jahr=await h.locator('[name="jahr"]').inputValue();
    if(jahr==='2026')assert.match(await text(h.locator('[data-kalender]')),/^2026: 261 Werktage \(Mo–Fr\), davon 9 Feiertage in Augsburg: Neujahr 01\.01\., .*; am Wochenende: Augsburger Friedensfest, Mariä Himmelfahrt, Tag der Deutschen Einheit, Allerheiligen, 2\. Weihnachtstag\.$/);
    assert.equal(await h.locator('[data-herleitung-uebernehmen]').isDisabled(),true,'ohne Urlaubstage kein Ergebnis');
    await h.locator('[name="urlaub"]').fill('30');
    await h.locator('[name="krank"]').fill('15');
    await h.locator('[name="weitere"]').fill('3');
    const soll=await page.evaluate(j=>window.TBA_CONTROLLING.jahresstundenAusKalender({jahr:Number(j),urlaubstage:30,krankheitstage:15,weitereTage:3,wochenstunden:40}),jahr);
    assert.equal(await text(h.locator('[data-herleitung-ergebnis]')),'('+soll.arbeitstage+' Arbeitstage − 30 Urlaub − 15 Krankheit − 3 weitere) = '+soll.tage+' Tage × 8 h × 100 % = '+
      soll.jahresstunden.toLocaleString('de-DE')+' h (eingetragen: 1.600 h)');
    if(jahr==='2026')assert.equal(soll.jahresstunden,1632);
    await h.locator('[data-herleitung-uebernehmen]').click();
    assert.equal(await page.locator('[data-einstellungen] [name="h"]').inputValue(),soll.jahresstunden.toLocaleString('de-DE'));
    // Grenzen: mehr als 60 Urlaubstage nicht.
    await h.locator('[name="urlaub"]').fill('70');
    await page.locator('[data-einstellungen] button.btn-primary').click();
    await page.locator('.pb-banner.warn:not([hidden])').waitFor();
    await h.locator('[name="urlaub"]').fill('30');
    await page.locator('[data-einstellungen] button.btn-primary').click();
    await page.locator('[data-meldung]:not([hidden])',{hasText:'Gespeichert.'}).waitFor();
    const e=(await db(page)).office_controlling_einstellungen[0];
    assert.deepEqual([e.jahresstunden,e.urlaubstage,e.krankheitstage,e.weitere_tage,e.projektanteil_prozent],[soll.jahresstunden,30,15,3,null]);
    // Die Frage zu den Jahresstunden nennt jetzt die Herleitung.
    assert.match(await text(page.locator('[data-frage="jahresstunden"]')),new RegExp('aus dem Kalender '+soll.jahresstunden.toLocaleString('de-DE').replace('.','\\.')+' h\\.$'));
    // Urlaub je Person (Gari, 25.11.2026): Person B (25 h) bekommt 25 statt der 30 Tage des Büros → 25 h mehr im Jahr.
    const reihe=name=>page.locator('tbody tr',{has:page.locator('td',{hasText:new RegExp('^'+name)})});
    await reihe('Person B').locator('[data-person]').click();
    const d=page.locator('#ctDialog');
    assert.equal(await d.locator('[name="woche"]').inputValue(),'25','Wochenstunden aus dem letzten Eintrag');
    await d.locator('[name="ab"]').fill('2026-11-02');
    await d.locator('[name="gehalt"]').fill('3.000');
    await d.locator('[name="urlaub"]').fill('25');
    const jb=await page.evaluate(j=>Math.round(j*25/40+25),soll.jahresstunden);
    assert.match(await text(d.locator('[data-vorschau]')),new RegExp('\\('+jb.toLocaleString('de-DE').replace('.','\\.')+' Jahresstunden, 21 % Arbeitgeberanteil'));
    await d.locator('[name="urlaub"]').fill('70');
    await d.locator('button[value="speichern"]').click();
    assert.match(await text(d.locator('[data-dialog-fehler]')),/^Urlaubstage 0 bis 60/);
    await d.locator('[name="urlaub"]').fill('25');
    await d.locator('button[value="speichern"]').click();
    await page.locator('[data-meldung]:not([hidden])',{hasText:'Eingetragen.'}).waitFor();
    const zeile=await reihe('Person B').locator('td').allTextContents();
    assert.deepEqual([zeile[4],zeile[5]],['25 Tage',jb.toLocaleString('de-DE')+' h']);
    assert.equal((await db(page)).office_controlling_saetze.find(x=>x.gueltig_ab==='2026-11-02').urlaubstage,25);
    assert.match(await text(page.locator('[data-urlaub-hinweis]')),/^Jahresstunden der Person: /);
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
  for(const ziel of ['controlling.html','controlling.html?projekt='+P1,'controlling.html?ansicht=saetze']){
    const {ctx:c,page:p,fehler:fe}=await oeffne(ziel,{viewport:{width:390,height:844}});
    try{
      assert.equal(await ohneQuerscrollen(p),true,ziel);
      if(ziel.includes('projekt')){await p.locator('[data-reiter="zahlungen"]').click();assert.equal(await ohneQuerscrollen(p),true,ziel+' Zahlungen')}
      await foto(p,'iphone-'+(ziel.includes('projekt')?'blatt':ziel.includes('saetze')?'saetze':'uebersicht'));
      assert.deepEqual(fe,[]);
    }finally{await c.close()}
  }
  assert.deepEqual(fehler,[]);
});
