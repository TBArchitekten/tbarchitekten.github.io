// Projektstart · Dokumente des Projekts im echten Chromium mit synthetischem Supabase (24.11.2026). Kein Netz, keine Produktion.
// Ablauf wie im Büro: Projekt wählen → Klärungsliste in der Zelle führen (Enter springt weiter) → Details mit Verlauf →
// gleichzeitige Änderung wird zusammengeführt → Aufgabe im Planner → Entscheidungspunkt wird Entscheidung →
// «entschieden» nur mit Datum, Entscheider und Entscheidung → Entscheidungsvorlage mit Varianten und Mehrkosten →
// Word, vorlegen, Stand → Excel im Aufbau der Bürovorlage → iPhone ohne Querscrollen.
// Bildschirmfotos nur, wenn DOKUMENTE_FOTOS auf einen Ordner zeigt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const fake=fs.readFileSync(new URL('./fixtures/fake-supabase-dokumente.js',import.meta.url),'utf8');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const file=path.join(root,p);
  if(!file.startsWith(root)){res.writeHead(403);res.end();return}
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end();return}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(b)});
}).listen(0);
const browser=await chromium.launch({headless:true});
test.after(async()=>{await geteilt?.schliessen();await browser.close();server.close()});
const FOTOS=process.env.DOKUMENTE_FOTOS||'';
const foto=async(page,name)=>{if(FOTOS)await page.screenshot({path:path.join(FOTOS,name+'.png'),fullPage:true})};
const adresse=p=>`http://localhost:${server.address().port}/${p}`;
// Office-Dateien werden unkomprimiert geschrieben; zum Prüfen reicht es, die lokalen Einträge zu lesen.
function entpacke(buf){
  const out={};let i=0;
  while(i<buf.length-4&&buf.readUInt32LE(i)===0x04034b50){
    const methode=buf.readUInt16LE(i+8),groesse=buf.readUInt32LE(i+18),nl=buf.readUInt16LE(i+26),el=buf.readUInt16LE(i+28);
    const name=buf.subarray(i+30,i+30+nl).toString('utf8'),start=i+30+nl+el;
    out[name]=methode===0?buf.subarray(start,start+groesse).toString('utf8'):null;i=start+groesse;
  }
  return out;
}
// Ein Tab für alle Schritte: die synthetischen Daten liegen im sessionStorage und bauen aufeinander auf.
let geteilt=null;
async function oeffne(){
  if(!geteilt){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true});
    const page=await ctx.newPage();
    const fehler=[];
    page.on('pageerror',e=>fehler.push(e.message));
    page.on('dialog',d=>void d.accept());
    await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
    await page.route(/supabase\.co/,r=>r.abort());
    geteilt={ctx:{close:async()=>{}},page,fehler,schliessen:()=>ctx.close()};
  }
  await geteilt.page.goto(adresse('projektdokumente.html'));
  await geteilt.page.locator('h1',{hasText:'Projektstart'}).waitFor();
  return geteilt;
}
const db=(page,t)=>page.evaluate(t=>window.__fake.db[t],t);
const zeilenVon=async(page,art)=>{
  const d=await page.evaluate(()=>window.__fake.db);
  const dok=d.office_projektdokumente.find(x=>x.art===art);
  return dok?d.office_projektdokument_zeilen.filter(z=>z.dokument_id===dok.id).sort((a,b)=>a.nr-b.nr):[];
};
const gespeichert=page=>page.waitForFunction(()=>document.querySelector('[data-speicher]')?.textContent==='gespeichert');
async function neueKlaerung(page,text){
  await page.locator('[data-neu]').fill(text);
  await page.locator('[data-neu]').press('Enter');
  await page.locator('[data-edit][data-k="verantwortlich"]').waitFor();
}

test('Projekt wählen, Klärungsliste in der Zelle führen, Details mit Verlauf',async()=>{
  const {ctx,page,fehler}=await oeffne();
  // Nur Projekte, in denen man Projektleitung oder Team ist.
  assert.equal(await page.locator('a.pd-wahl-projekt').count(),1);
  await page.locator('a.pd-wahl-projekt',{hasText:'Testhaus'}).click();
  await page.locator('h2',{hasText:'Listen'}).waitFor();
  assert.match(await page.locator('.pd-karte',{hasText:'Klärungsliste'}).innerText(),/Noch nicht angelegt/);
  await foto(page,'1-uebersicht');
  await page.locator('.pd-karte',{hasText:'Klärungsliste'}).locator('a',{hasText:'Anlegen'}).click();
  await page.locator('h1',{hasText:'Klärungsliste Koordination'}).waitFor();
  // Neue Zeile: Sachverhalt, Enter → verantwortlich (Auswahl, Tippen wählt), Enter → Frist, Enter → Status.
  await neueKlaerung(page,'Unterzug kreuzt die Lüftungstrasse; lichte Höhe unter 2,40 m');
  await page.keyboard.type('TWP');await page.keyboard.press('Enter');
  await page.locator('[data-edit][data-k="frist"]').waitFor();
  await page.keyboard.type('5.12.2026');await page.keyboard.press('Enter');
  await page.locator('[data-edit][data-k="status"]').waitFor();
  await page.keyboard.press('Escape');
  await gespeichert(page);
  let z=(await zeilenVon(page,'klaerungsliste'))[0];
  assert.equal(z.nr,1);
  assert.equal(z.daten.verantwortlich,'TWP');
  assert.equal(z.daten.frist,'2026-12-05');
  assert.equal(z.daten.runde,'01','neue Zeilen übernehmen die Runde der Liste');
  // Disziplinen als Kürzel; ein falsches Kürzel wird nicht übernommen.
  await page.locator('td[data-k="disziplinen"]').first().click();
  await page.keyboard.type('twp, hls, xyz');await page.keyboard.press('Enter');
  await page.locator('.pd-meldung.warn',{hasText:'Unbekannte Disziplin: XYZ'}).waitFor();
  await page.locator('[data-edit][data-k="disziplinen"]').fill('twp hls');await page.keyboard.press('Enter');
  await page.locator('[data-edit][data-k="ort"]').waitFor();
  await page.keyboard.type('1. OG, Achse C/3–4, Flur');await page.keyboard.press('Tab');
  await page.locator('[data-edit][data-k="sachverhalt"]').waitFor();
  await page.keyboard.press('Escape');
  // Ja/nein mit einem Klick; Status in der Zelle.
  await page.locator('td[data-k="ag"]').first().click();
  await page.locator('td[data-k="status"]').first().click();
  await page.locator('[data-edit][data-k="status"]').selectOption('in Klärung');
  await page.locator('h1').click();
  await gespeichert(page);
  z=(await zeilenVon(page,'klaerungsliste'))[0];
  assert.deepEqual(z.daten.disziplinen,['TWP','HLS']);
  assert.equal(z.daten.ort,'1. OG, Achse C/3–4, Flur');
  assert.equal(z.daten.ag,'ja');
  assert.equal(z.daten.status,'in Klärung');
  assert.match(await page.locator('.pd-head .meta').innerText(),/1 Punkt · 0 offen · 1 in Klärung · 0 überfällig · 1 Entscheidungspunkt/);
  // Zweite Zeile mit Frist in der Vergangenheit: überfällig, Filter zählen.
  await neueKlaerung(page,'Laibungsdämmung laut Bauphysik 60 mm, Ansicht zeigt 30 mm');
  await page.keyboard.press('Tab');
  await page.locator('[data-edit][data-k="frist"]').waitFor();
  await page.keyboard.type('01.11.2026');await page.keyboard.press('Escape');
  await page.locator('td[data-k="frist"]').nth(1).click();
  await page.locator('[data-edit][data-k="frist"]').fill('01.11.2026');await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await gespeichert(page);
  await page.locator('button.chip[data-f="ueberfaellig"]',{hasText:'Überfällig 1'}).click();
  assert.equal(await page.locator('tbody tr.pd-zeile').count(),1);
  assert.match(await page.locator('tbody tr.pd-zeile').innerText(),/überfällig/);
  await page.locator('button.chip[data-f="alle"]').click();
  // Alle Spalten wie in der Bürovorlage.
  await page.locator('[data-act="spalten"]').click();
  const koepfe=await page.locator('thead th').allInnerTexts();
  assert.equal(koepfe.length,17,'16 Spalten der Bürovorlage und die Auswahl');
  assert.deepEqual(koepfe.slice(1,5),['Nr','Runde','erfasst am','Disziplinen · Beteiligte']);
  await page.locator('[data-act="spalten"]').click();
  // Details mit Verlauf: Nummer öffnet.
  await page.locator('td[data-k="nr"]').first().click();
  await page.locator('.pd-detail h2',{hasText:'Punkt 1 · Details'}).waitFor();
  await page.locator('.pd-verlauf li',{hasText:'angelegt'}).waitFor();
  const verlauf=await page.locator('.pd-verlauf').innerText();
  assert.match(verlauf,/Status: in Klärung \(vorher offen\)/);
  assert.match(verlauf,/Test Leitung/);
  // Ein Feld in den Details: Lösungsvorschlag.
  await page.locator('#f-loesung').fill('Trasse in den nördlichen Flur verlegen oder Unterzug deckengleich ausbilden');
  await page.locator('#f-protokoll').click();
  await gespeichert(page);
  z=(await zeilenVon(page,'klaerungsliste'))[0];
  assert.match(z.daten.loesung,/nördlichen Flur/);
  await foto(page,'2-klaerungsliste-details');
  assert.deepEqual(fehler,[]);
  await ctx.close();
});

test('gleichzeitige Änderung: die Felder werden zusammengeführt, nichts geht verloren',async()=>{
  const {ctx,page,fehler}=await oeffne();
  await page.goto(adresse('projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=klaerungsliste'));
  await page.locator('h1',{hasText:'Klärungsliste'}).waitFor();
  const vorher=(await zeilenVon(page,'klaerungsliste'))[0];
  // Jemand anderes trägt den Plan ein, während hier die Folgen geschrieben werden.
  await page.evaluate(id=>window.__fake.fremd(id,'plan','GR 1. OG, Index A'),vorher.id);
  await page.locator('[data-act="spalten"]').click();
  await page.locator('td[data-k="folgen"]').first().click();
  await page.locator('[data-edit][data-k="folgen"]').fill('Deckengleicher Unterzug: Mehrkosten; keine Terminfolge');
  await page.keyboard.press('Enter');await page.keyboard.press('Escape');
  await gespeichert(page);
  const nachher=(await zeilenVon(page,'klaerungsliste'))[0];
  assert.equal(nachher.daten.plan,'GR 1. OG, Index A','die Änderung des anderen bleibt');
  assert.match(nachher.daten.folgen,/Deckengleicher Unterzug/,'die eigene Änderung ist gespeichert');
  assert.equal(nachher.server_revision,vorher.server_revision+2);
  assert.deepEqual(fehler,[]);
  await ctx.close();
});

test('Aufgabe im Planner und Entscheidungspunkt in die Entscheidungsliste',async()=>{
  const {ctx,page,fehler}=await oeffne();
  await page.goto(adresse('projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=klaerungsliste'));
  await page.locator('h1',{hasText:'Klärungsliste'}).waitFor();
  await page.locator('input[data-act="waehle"]').first().check();
  await page.locator('[data-act="aufgaben"]').click();
  await page.locator('.pd-meldung',{hasText:'Aufgabe im Planner angelegt.'}).waitFor();
  await gespeichert(page);
  const tasks=await db(page,'isabella_tasks');
  assert.equal(tasks.length,1);
  assert.match(tasks[0].title,/^Klärung Nr 1 · TWP: Unterzug kreuzt/);
  assert.equal(tasks[0].due_date,'2026-12-05');
  assert.equal(tasks[0].metadata.source,'klaerungsliste');
  assert.equal((await zeilenVon(page,'klaerungsliste'))[0].daten.aufgabe_id,tasks[0].id);
  assert.match(await page.locator('td[data-k="sachverhalt"]').first().innerText(),/Aufgabe im Planner/);
  // Entscheidungsliste: der Entscheidungspunkt wartet und wird mit einem Klick eine Entscheidung.
  await page.goto(adresse('projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=entscheidungsliste'));
  await page.locator('.pd-banner',{hasText:'In der Klärungsliste ist Nr 1'}).waitFor();
  await page.locator('[data-act="ep-uebernehmen"]',{hasText:'Als E-01 übernehmen'}).click();
  await page.locator('tbody tr.pd-zeile').first().waitFor();
  await gespeichert(page);
  const e=(await zeilenVon(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.herkunft,'Klärungsliste Nr 1');
  assert.equal(e.daten.status,'vorbereitet');
  assert.match(e.daten.optionen[0].text,/nördlichen Flur/,'der Lösungsvorschlag wird Variante A');
  const k=(await zeilenVon(page,'klaerungsliste'))[0];
  assert.equal(k.daten.entscheidung_id,e.id);
  assert.equal(await page.locator('.pd-banner',{hasText:'In der Klärungsliste ist Nr 1'}).count(),0);
  await foto(page,'3-entscheidungsliste');
  assert.deepEqual(fehler,[]);
  await ctx.close();
});

test('«entschieden» nur mit Datum, Entscheider und Entscheidung',async()=>{
  const {ctx,page,fehler}=await oeffne();
  await page.goto(adresse('projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=entscheidungsliste'));
  await page.locator('h1',{hasText:'Entscheidungsliste'}).waitFor();
  await page.locator('td[data-k="frage"]').first().click();
  await page.locator('[data-edit][data-k="frage"]').fill('Lüftungstrasse verlegen oder Unterzug deckengleich ausbilden?');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.locator('td[data-k="status"]').first().click();
  await page.locator('[data-edit][data-k="status"]').selectOption('entschieden');
  await page.locator('dialog[open] h2',{hasText:'Entscheidung eintragen'}).waitFor();
  await page.locator('dialog [data-wahl]').first().click();
  await page.locator('dialog input[name="wer"]').fill('');
  await page.locator('dialog button[type="submit"]').click();
  // Ohne Entscheider bleibt der Dialog offen (Pflichtfeld des Browsers oder Prüfung).
  assert.equal(await page.locator('dialog[open]').count(),1);
  await page.locator('dialog input[name="wer"]').fill('Auftraggeber, in der Besprechung M05');
  await page.locator('dialog button[type="submit"]').click();
  await page.locator('dialog[open]').waitFor({state:'detached'}).catch(()=>{});
  await gespeichert(page);
  const e=(await zeilenVon(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.status,'entschieden');
  assert.match(e.daten.entscheidung,/^A: /);
  assert.equal(e.daten.entscheider,'Auftraggeber, in der Besprechung M05');
  assert.match(await page.locator('td[data-k="entscheidung"]').first().innerText(),/Bestätigung in Textform fehlt/);
  // Zurück auf «vorgelegt», damit die Vorlage ihn vorlegen kann.
  await page.locator('td[data-k="status"]').first().click();
  await page.locator('[data-edit][data-k="status"]').selectOption('vorbereitet');
  await page.locator('h1').click();
  await gespeichert(page);
  assert.deepEqual(fehler,[]);
  await ctx.close();
});

test('Entscheidungsvorlage: Abschnitte, Varianten mit Mehrkosten, Word, vorlegen und Stand',async()=>{
  const {ctx,page,fehler}=await oeffne();
  await page.goto(adresse('projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=entscheidungsliste'));
  await page.locator('h1',{hasText:'Entscheidungsliste'}).waitFor();
  await page.locator('[data-act="vorlage-anlegen"]').first().click();
  await page.locator('h1',{hasText:'Entscheidungsvorlage 01'}).waitFor();
  const papier=page.locator('.pd-papier');
  for(const t of ['1 · Anlass','2 · Frage an den Auftraggeber','3 · Varianten und Kosten','4 · Folgen je Variante','5 · Empfehlung des Büros','6 · Was danach festliegt','7 · Entscheidung des Auftraggebers'])
    assert.equal(await papier.locator('h4',{hasText:t}).count(),1,'Abschnitt fehlt: '+t);
  // Text im Dokument schreiben.
  const e=(await zeilenVon(page,'entscheidungsliste'))[0];
  await page.locator('#v-'+e.id+'-festliegt').fill('Deckenhöhe im Flur, Trassenführung, Deckenspiegel');
  // Varianten mit Zahlen und Quelle in den Details.
  await page.locator('[data-act="punkt-details"]').first().click();
  await page.locator('.pd-detail').waitFor();
  await page.locator('#o-0-kennwert').fill('214,52 €/m²');
  await page.locator('#o-0-menge').fill('210 m²');
  await page.locator('#o-0-quelle').fill('Datenpool, Kostenstand 3. Quartal 2022, fortgeschrieben');
  await page.locator('#o-1-text').fill('Unterzug deckengleich');
  await page.locator('#o-1-betrag').fill('50.053,50');
  await page.locator('#o-1-quelle').fill('Angebot Test, Pos. 3');
  await page.locator('#f-empfehlung').selectOption('A');
  await page.locator('#f-kostenbezug').click();
  await gespeichert(page);
  await page.locator('[data-act="detail-zu"]').click();
  await papier.locator('text=Mehrkosten B gegenüber A: 5.004,30 € netto (5.955,12 € brutto)').waitFor();
  assert.match(await papier.innerText(),/45\.049,20 € \*/,'Kennwert × Menge ist als berechnet markiert');
  assert.match(await page.locator('.pd-quellen').innerText(),/Angebot Test, Pos\. 3/);
  await foto(page,'4-vorlage');
  // Word: Aufbau der Bürovorlage, Fußzeile mit Seitenzahl.
  const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('[data-act="word"]').click()]);
  assert.match(dl.suggestedFilename(),/^T-01_Entscheidungsvorlage_01_\d{4}-\d{2}-\d{2}\.docx$/);
  const docx=entpacke(fs.readFileSync(await dl.path()));
  assert.ok(docx['word/document.xml'].includes('Entscheidungsvorlage 01'));
  assert.ok(docx['word/document.xml'].includes('Mehrkosten B gegenüber A: 5.004,30 € netto'));
  assert.ok(docx['word/document.xml'].includes('Deckenhöhe im Flur'));
  assert.ok(docx['word/footer1.xml'].includes('NUMPAGES'));
  // Vorlegen: Stand festhalten, Entscheidung wird «vorgelegt».
  await page.locator('[data-act="vorlegen"]').click();
  await page.locator('dialog[open] h2',{hasText:'Vorlage 01 vorlegen'}).waitFor();
  await page.locator('dialog input[name="am"]').fill('22.11.2026');
  await page.locator('dialog button[type="submit"]').click();
  await page.locator('.pd-meldung',{hasText:'Vorgelegt; der Stand ist festgehalten.'}).waitFor();
  await page.locator('.pd-staende li').first().waitFor();
  const staende=await db(page,'office_projektdokument_staende');
  assert.equal(staende.length,1);
  assert.equal(staende[0].bezeichnung,'Vorlage 01 · vorgelegt am 22.11.2026');
  assert.match(staende[0].html,/Mehrkosten B gegenüber A/);
  const e2=(await zeilenVon(page,'entscheidungsliste'))[0];
  assert.equal(e2.daten.status,'vorgelegt');
  assert.equal(e2.daten.vorgelegt_am,'2026-11-22');
  // Danach geändert: der Stand bleibt, wie er war.
  await page.locator('#v-'+e.id+'-festliegt').fill('Etwas anderes');
  await page.locator('h1').click();
  await gespeichert(page);
  await page.locator('[data-act="stand"]').first().click();
  await page.locator('dialog[open] .pd-papier-stand').waitFor();
  assert.match(await page.locator('dialog .pd-papier-stand').innerText(),/Deckenhöhe im Flur/);
  assert.doesNotMatch(await page.locator('dialog .pd-papier-stand').innerText(),/Etwas anderes/);
  await page.locator('dialog [data-dlg="zu"]').click();
  // Übersicht: die Vorlage steht unter Texte.
  await page.locator('a.pd-back').click();
  await page.locator('a.pd-back',{hasText:'Projektstart'}).click();
  await page.locator('.pd-vorlagen li',{hasText:'vorgelegt am 22.11.'}).waitFor();
  assert.deepEqual(fehler,[]);
  await ctx.close();
});

test('Excel im Aufbau der Bürovorlage',async()=>{
  const {ctx,page,fehler}=await oeffne();
  await page.goto(adresse('projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=klaerungsliste'));
  await page.locator('h1',{hasText:'Klärungsliste'}).waitFor();
  const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('.pd-actions [data-act="excel"]').click()]);
  assert.match(dl.suggestedFilename(),/^T-01_Klarungsliste_\d{4}-\d{2}-\d{2}\.xlsx$/);
  const x=entpacke(fs.readFileSync(await dl.path()));
  const sheet=x['xl/worksheets/sheet1.xml'];
  assert.ok(Object.keys(x)[0]==='[Content_Types].xml');
  assert.ok(sheet.includes('<t xml:space="preserve">Sachverhalt · Konflikt</t>'));
  assert.ok(sheet.includes('<t xml:space="preserve">Unterzug kreuzt die Lüftungstrasse; lichte Höhe unter 2,40 m</t>'));
  // «überfällig» als Formel wie in der Bürovorlage, mit dem Wert von heute (für Programme, die nicht neu rechnen).
  const formel=r=>'<f>IF(OR(J'+r+'=&quot;&quot;,K'+r+'=&quot;gelöst&quot;,K'+r+'=&quot;entfällt&quot;),&quot;&quot;,IF(J'+r+'&lt;TODAY(),&quot;überfällig&quot;,&quot;&quot;))</f>';
  assert.ok(sheet.includes(formel(7)+'<v></v>'));
  assert.ok(sheet.includes(formel(8)+'<v>überfällig</v>'));
  assert.ok(sheet.includes('<pane xSplit="6" ySplit="6" topLeftCell="G7"'));
  assert.ok(sheet.includes('"offen,in Klärung,gelöst,Vorbehalt,Entscheidungspunkt,entfällt"'));
  // Datum als Excel-Datum: 05.12.2026 ist Tag 46361.
  assert.ok(sheet.includes('<c r="J7" s="3"><v>46361</v></c>'));
  assert.deepEqual(fehler,[]);
  await ctx.close();
});

test('KI: Vorschläge mit Fundstelle, nichts ändert sich ohne «Übernehmen», nie eine Entscheidung',async()=>{
  const {ctx,page,fehler}=await oeffne();
  await page.goto(adresse('projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=klaerungsliste'));
  await page.locator('[data-act="romy"]',{hasText:'KI fragen'}).waitFor();
  const vorher=(await zeilenVon(page,'klaerungsliste')).length;
  await page.locator('[data-act="romy"]').click();
  await page.locator('dialog[open] h2',{hasText:'Vorschläge aus einem Dokument'}).waitFor();
  await page.locator('dialog input[name="quelle"]').fill('Protokoll Koordination 02');
  await page.locator('dialog textarea[name="text"]').fill('TOP 3: Unterzug … TOP 4: Aussparung Steigschacht … TOP 7: Wärmepumpe …');
  await page.locator('dialog button[type="submit"]').click();
  await page.locator('.pd-banner.romy',{hasText:'Die KI hat in «Protokoll Koordination 02» 3 Vorschläge gemacht.'}).waitFor();
  assert.match(await page.locator('.pd-romy-antwort').innerText(),/zwei neue Klärungen[\s\S]*TOP 9 betrifft die Bemusterung/);
  assert.equal((await zeilenVon(page,'klaerungsliste')).length,vorher,'ein Vorschlag ändert die Liste nicht');
  assert.equal((await db(page,'office_projektdokument_vorschlaege')).filter(v=>v.status==='offen').length,3);
  const neue=page.locator('tr.pd-vorschlag:not(.pd-vs-aenderung)');
  assert.equal(await neue.count(),2);
  assert.match(await neue.first().innerText(),/Aussparung für den Steigschacht[\s\S]*Fundstelle: Protokoll Koordination 02, S\. 2, TOP 4/);
  assert.match(await page.locator('tr.pd-vs-aenderung').innerText(),/Die KI schlägt für 1 vor: Frist: 05\.12\. → 08\.12\./);
  await foto(page,'7-romy-vorschlaege');
  // Übernehmen: neue Zeile mit «R», Herkunft «romy»; Verwerfen: nichts.
  await neue.first().locator('[data-act="vs-ja"]').click();
  await page.locator('.pd-meldung',{hasText:'Übernommen.'}).waitFor();
  let z=await zeilenVon(page,'klaerungsliste');
  assert.equal(z.length,vorher+1);
  const neu=z[z.length-1];
  assert.equal(neu.quelle,'romy');
  assert.equal(neu.daten.fundstelle,'Protokoll Koordination 02, S. 2, TOP 4');
  assert.deepEqual(neu.daten.disziplinen,['HLS','TWP']);
  assert.equal(neu.daten.status,'offen','Vorgaben der Liste bleiben');
  assert.ok(await page.locator('tr[data-zeile="'+neu.id+'"] td.pd-romy').count()>=3,'übernommene Felder tragen «R»');
  await page.locator('tr.pd-vorschlag:not(.pd-vs-aenderung) [data-act="vs-nein"]').click();
  await page.locator('.pd-meldung',{hasText:'Verworfen.'}).waitFor();
  assert.equal((await zeilenVon(page,'klaerungsliste')).length,vorher+1);
  await page.locator('tr.pd-vs-aenderung [data-act="vs-ja"]').click();
  await page.locator('.pd-meldung',{hasText:'Übernommen.'}).waitFor();
  assert.equal((await zeilenVon(page,'klaerungsliste'))[0].daten.frist,'2026-12-08');
  const vs=await db(page,'office_projektdokument_vorschlaege');
  assert.deepEqual(vs.map(v=>v.status).sort(),['uebernommen','uebernommen','verworfen']);
  assert.equal(await page.locator('.pd-banner.romy').count(),0);
  // Verlauf: woher der Wert kam und wer ihn übernommen hat.
  await page.locator('td[data-k="nr"]').first().click();
  await page.locator('.pd-verlauf li',{hasText:'Vorschlag von der KI (Protokoll Koordination 02, S. 2, TOP 3), übernommen von Test Leitung'}).waitFor();
  await page.locator('[data-act="detail-zu"]').click();
  // Fristen mit dem Terminplan prüfen: ein Vorschlag mit Fundstelle im Terminplan.
  await page.locator('input[data-act="waehle"]').first().check();
  await page.locator('[data-act="romy-fristen"]').click();
  await page.locator('tr.pd-vs-aenderung',{hasText:'Fundstelle: Terminplan: Vorabzug TWP (04.12.2026)'}).waitFor();
  assert.equal(page.evaluate?((await page.evaluate(()=>window.__fake.anfragen.at(-1).body.zeilen_ids.length))):1,1);
  await page.locator('tr.pd-vs-aenderung [data-act="vs-nein"]').click();
  await page.locator('.pd-meldung',{hasText:'Verworfen.'}).waitFor();
  assert.equal((await zeilenVon(page,'klaerungsliste'))[0].daten.frist,'2026-12-08','verworfen ändert nichts');
  // Frage an die Fachplaner: Text zum Kopieren, keine Änderung.
  await page.locator('input[data-act="waehle"]').first().check();
  await page.locator('[data-act="romy-fachplaner"]').click();
  await page.locator('dialog[open] h2',{hasText:'Frage an die Fachplaner'}).waitFor();
  assert.match(await page.locator('dialog .pd-romy-ausgabe').inputValue(),/An TWP/);
  await page.locator('dialog [data-dlg="zu"]').click();
  // Entscheidungsliste: Romy schlägt eine Frage vor; «entschieden» und Entscheider kommen nicht mit.
  await page.goto(adresse('projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=entscheidungsliste'));
  await page.locator('[data-act="romy"]').click();
  await page.locator('dialog input[name="quelle"]').fill('Protokoll Bauherr 03');
  await page.locator('dialog textarea[name="text"]').fill('Fenster: Holz oder Holz-Aluminium, AG entscheidet.');
  await page.locator('dialog button[type="submit"]').click();
  await page.locator('.pd-banner.romy',{hasText:'1 Vorschlag'}).waitFor();
  const offen=(await db(page,'office_projektdokument_vorschlaege')).filter(v=>v.status==='offen');
  assert.equal(offen.length,1);
  assert.equal(offen[0].daten.status,undefined);
  assert.equal(offen[0].daten.entscheider,undefined);
  await page.locator('[data-act="vs-alle-ja"]').click();
  await page.locator('.pd-meldung',{hasText:'Übernommen.'}).waitFor();
  const e=await zeilenVon(page,'entscheidungsliste');
  assert.equal(e.at(-1).daten.thema,'Fenster, Material');
  assert.equal(e.at(-1).daten.status,'vorbereitet');
  // Vorlage: einen Abschnitt neu formulieren lassen; grün eingefügt, erst «Übernehmen» ändert den Text.
  const vorlage=(await zeilenVon(page,'entscheidungsvorlagen'))[0];
  await page.goto(adresse('projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&vorlage='+vorlage.id));
  await page.locator('#r-abschnitt').selectOption({index:0});
  await page.locator('#r-auftrag').fill('den Kostenunterschied nennen');
  await page.locator('[data-act="romy-abschnitt"]').click();
  await page.locator('.pd-diff ins',{hasText:'5.004,30 € netto'}).waitFor();
  const e1=(await zeilenVon(page,'entscheidungsliste'))[0];
  assert.doesNotMatch(e1.daten.anlass,/5\.004,30/,'vor dem Übernehmen unverändert');
  await foto(page,'8-romy-vorlage');
  await page.locator('.pd-vs-zeile [data-act="vs-ja"]').click();
  await page.locator('#v-'+e1.id+'-anlass').waitFor();
  assert.match(await page.locator('#v-'+e1.id+'-anlass').inputValue(),/5\.004,30 € netto/);
  const e1nach=(await zeilenVon(page,'entscheidungsliste'))[0];
  assert.match(e1nach.daten.anlass,/5\.004,30/);
  assert.equal(e1nach.quelle,'romy');
  assert.deepEqual(fehler,[]);
  await ctx.close();
});

// Abläufe (Gari, 27.11.2026): «Besprechung nachbereiten» liest das Protokoll einmal je Liste und führt durch Prüfen,
// Aufgaben im Planner, Fristen gegen den Terminplan und das Projektwissen.
test('Ablauf «Besprechung nachbereiten»: beide Listen, Aufgaben, Fristen, Projektwissen',async()=>{
  const {page,fehler}=await oeffne();
  const PID='22222222-2222-4222-8222-222222222222',Q='Protokoll Jour fixe 05';
  await page.goto(adresse('projektdokumente.html?projekt='+PID+'&ablauf=besprechung'));
  await page.locator('dialog[open] h2',{hasText:'Besprechung nachbereiten'}).waitFor();
  assert.doesNotMatch(page.url(),/ablauf=/,'der Dialog öffnet sich einmal');
  await page.locator('dialog input[name="quelle"]').fill(Q);
  await page.locator('dialog textarea[name="text"]').fill('TOP 4: Aussparung Steigschacht … TOP 7: Wärmepumpe … Fenster: Holz oder Holz-Aluminium?');
  await page.locator('dialog button[type="submit"]').click();
  const panel=page.locator('.pd-ablauf');
  await panel.waitFor();
  assert.match(await panel.innerText(),/Protokoll Jour fixe 05[\s\S]*KI: Im Protokoll stehen zwei neue Klärungen[\s\S]*Eine Frage an den Auftraggeber/);
  const gelesen=(await page.evaluate(()=>window.__fake.anfragen)).filter(a=>a.body.action==='vorschlaege'&&a.body.quelle===Q);
  assert.equal(gelesen.length,2,'einmal je Liste');
  const schritte=panel.locator('.pd-ablauf-schritt');
  assert.match(await schritte.nth(0).innerText(),/Offen: 3 in der Klärungsliste, 1 in der Entscheidungsliste/);
  // Prüfen: alle Vorschläge dieser Besprechung übernehmen (Klärungen, dann die Frage an den Auftraggeber).
  for(const art of ['klaerungsliste','entscheidungsliste']){
    await page.goto(adresse('projektdokumente.html?projekt='+PID+'&liste='+art));
    const zeile=()=>page.locator('tr.pd-vorschlag',{hasText:Q});
    await zeile().first().waitFor();
    while(await zeile().count()){const n=await zeile().count();await zeile().first().locator('[data-act="vs-ja"]').click();await page.waitForFunction(([q,n])=>
      [...document.querySelectorAll('tr.pd-vorschlag')].filter(t=>t.textContent.includes(q)).length<n,[Q,n])}
    await gespeichert(page);
  }
  await page.goto(adresse('projektdokumente.html?projekt='+PID));
  await panel.waitFor();
  assert.match(await schritte.nth(0).innerText(),/übernommen oder verworfen: 2 Klärungen und 1 Entscheidung aus dieser Besprechung/);
  assert.equal(await schritte.nth(0).getAttribute('class'),'pd-ablauf-schritt fertig');
  // Aufgaben: die zwei neuen Klärungen haben Verantwortliche und Frist.
  await schritte.nth(1).locator('[data-act="ablauf-aufgaben"]',{hasText:'Aufgaben anlegen (2)'}).click();
  await page.locator('.pd-meldung',{hasText:'2 Aufgaben im Planner angelegt.'}).waitFor();
  assert.equal((await db(page,'isabella_tasks')).filter(t=>/Aussparung für den Steigschacht|Außengerät der Wärmepumpe/.test(t.title)).length,2);
  // Fristen gegen den Terminplan: Romy prüft die Klärungen dieser Besprechung.
  await schritte.nth(2).locator('[data-act="ablauf-fristen"]').click();
  await page.waitForFunction(()=>/Geprüft/.test(document.querySelectorAll('.pd-ablauf-schritt')[2]?.textContent||''));
  const fristen=(await page.evaluate(()=>window.__fake.anfragen)).filter(a=>a.body.aufgabe==='fristen_terminplan').at(-1);
  // Die zwei neuen Klärungen dieser Besprechung und die, deren Frist sie geändert hat (Nr 1), sonst keine.
  const kl=await zeilenVon(page,'klaerungsliste'),neueZwei=kl.slice(-2).map(z=>z.id),eins=kl.find(z=>z.nr===1);
  assert.deepEqual([...fristen.body.zeilen_ids].sort(),[...neueZwei,...(eins&&!['gelöst','entfällt'].includes(eins.daten.status)?[eins.id]:[])].sort());
  // Ins Projektwissen: als Notiz über die Funktion des Wissens.
  await schritte.nth(3).locator('[data-act="ablauf-teilen"]').click();
  await page.locator('.pd-meldung',{hasText:'Im Projektwissen geteilt'}).waitFor();
  const rpc=(await page.evaluate(()=>window.__fake.rpc||[])).find(r=>r.name==='office_wissen_beitrag_teilen');
  assert.equal(rpc.args.p_titel,'Besprechung: Protokoll Jour fixe 05');assert.equal(rpc.args.p_art,'notiz');assert.equal(rpc.args.p_project,PID);
  assert.match(rpc.args.p_inhalt,/^Besprechung: Protokoll Jour fixe 05 \(nachbereitet am [\s\S]*Klärungen:\n- [\s\S]*Aussparung für den Steigschacht fehlt im Positionsplan · TWP · bis [\s\S]*Entscheidungen \(offen, bis der Bauherr entscheidet\):\n- [\s\S]*Fenster, Material/);
  assert.equal(await panel.locator('.pd-ablauf-schritt.fertig').count(),4);
  await page.locator('[data-act="ablauf-ende"]').click();
  assert.equal(await panel.count(),0);
  assert.equal(await page.locator('[data-act="ablauf-besprechung"]').count(),1,'wieder die Karte «Besprechung nachbereiten»');
  assert.deepEqual(fehler,[]);
});

// Weitere Listen (28.11.2026): mit den Zeilen der Bürovorlage anlegen, Termine aus dem Terminplan, in der Zelle führen,
// die Fragen an eine Fachplanung als Excel, die Schnittstellenmatrix und der Eingang mit ihrem berechneten Stand.
test('Weitere Listen: mit der Bürovorlage anlegen, Termine aus dem Terminplan, Excel je Fachplanung',async()=>{
  const {ctx,page,fehler}=await oeffne();
  await page.evaluate(()=>{const t=window.__fake.db.office_terminplan_instances[0].state.tasks;
    t.push({id:'m00a',name:'M00A · Erforderliche Fachplaner beauftragt',type:'milestone',start:'2026-11-20'},
      {id:'m01',name:'M01 · Vorläufige Planungsgrundlagen an beauftragte Fachplaner übermittelt',type:'milestone',start:'2026-12-04'},
      {id:'m02',name:'M02 · Kick-off Fachplaner',type:'milestone',start:'2026-12-11'},
      {id:'m03',name:'M03 · Zieltermin Fachplanungsbeiträge Arbeitsstand 01',type:'milestone',start:'2027-01-15'});window.__fake.sichern()});
  const PID='22222222-2222-4222-8222-222222222222';
  await page.goto(adresse('projektdokumente.html?projekt='+PID));
  await page.locator('h1',{hasText:'Projektstart'}).waitFor();
  const karte=page.locator('.pd-karte',{has:page.locator('h3',{hasText:/^Fragenliste$/})});
  assert.match(await karte.textContent(),/Noch nicht angelegt\.[\s\S]*mit M01 04\.12\. · beantwortet bis M02 11\.12\./);
  assert.equal(await page.locator('.pd-folgt-text').count(),2,'nur die beiden Texte folgen noch');
  // Fragenliste: die 85 Fragen der Vorlage, nummeriert in ihrer Reihenfolge.
  await karte.locator('a',{hasText:'Anlegen'}).click();
  await page.locator('h1',{hasText:'Fragenliste je Disziplin'}).waitFor();
  await page.locator('[data-act="anlegen-vorlage"]',{hasText:'Mit den 85 Fragen der Bürovorlage anlegen'}).click();
  await page.locator('td[data-k="frage"]').first().waitFor();
  const fragen=await zeilenVon(page,'fragenliste');
  assert.equal(fragen.length,85);
  assert.deepEqual(fragen.slice(0,3).map(z=>z.nr+':'+z.daten.code),['1:ALLE-01','2:ALLE-02','3:ALLE-03']);
  assert.match(await page.locator('.pd-head .meta').textContent(),/^85 Fragen · 85 offen · 0 beantwortet/);
  // Für die Tragwerksplanung: ihre Fragen und die an alle; die Zahlen an den Filtern gelten dafür.
  await page.locator('[data-act="disziplin"]').selectOption('TWP');
  const twp=fragen.filter(z=>['ALLE','TWP'].includes(z.daten.disziplin)).length;
  assert.equal(await page.locator('tr.pd-zeile').count(),twp);
  assert.equal(await page.locator('[data-act="filter"][data-f="alle"]').textContent(),'Alle '+twp);
  // Eine Antwort setzt die Frage auf «beantwortet», mit dem Datum von heute.
  await page.locator('td[data-z="'+fragen[0].id+'"][data-k="antwort"]').click();
  await page.locator('[data-edit][data-k="antwort"]').fill('Liegt bei, siehe Anlage');
  await page.locator('[data-edit][data-k="antwort"]').press('Enter');
  await gespeichert(page);
  const erste=(await zeilenVon(page,'fragenliste'))[0].daten;
  assert.equal(erste.status,'beantwortet');
  assert.match(erste.beantwortet_am,/^\d{4}-\d{2}-\d{2}$/);
  await page.keyboard.press('Escape');
  const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('.pd-actions [data-act="excel"]',{hasText:'Excel für TWP'}).click()]);
  assert.match(dl.suggestedFilename(),/^T-01_Fragenliste_TWP_\d{4}-\d{2}-\d{2}\.xlsx$/);
  const sheet=entpacke(fs.readFileSync(await dl.path()))['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('<t xml:space="preserve">gebraucht bis</t>')&&sheet.includes('<t xml:space="preserve">Datum</t>'));
  assert.ok(sheet.includes('<c r="I7" s="3"><v>46367</v></c>'),'M02 am 11.12.2026 als Datum neben dem Meilenstein');
  assert.ok(!sheet.includes('HLS-01'),'nur die Fragen an die TWP und an alle');
  // Schnittstellen: ELT wirkt bei der Beleuchtung nur mit, dann plant eine Stelle und die Zuständigkeit ist eindeutig.
  await page.goto(adresse('projektdokumente.html?projekt='+PID+'&liste=schnittstellen'));
  await page.locator('[data-act="anlegen-vorlage"]').click();
  await page.locator('tr.pd-gruppe',{hasText:'B · Themen und Bauteile'}).waitFor();
  assert.equal(await page.locator('tr.pd-gruppe').count(),3);
  assert.equal(await page.locator('[data-act="filter"][data-f="klaeren"]').textContent(),'Zuständigkeit klären 2');
  const licht=(await zeilenVon(page,'schnittstellen')).find(z=>z.daten.thema==='Beleuchtung und Lichtkonzept');
  await page.locator('td[data-z="'+licht.id+'"][data-k="z_elt"]').click();
  await page.locator('select[data-edit][data-k="z_elt"]').selectOption('M');
  await page.keyboard.press('Escape');
  await gespeichert(page);
  assert.equal(await page.locator('td[data-z="'+licht.id+'"][data-k="eindeutig"]').textContent(),'eindeutig');
  assert.equal(await page.locator('[data-act="filter"][data-f="klaeren"]').textContent(),'Zuständigkeit klären 1');
  // Eingang: Arbeitsstand 01 der TWP eingegangen, dann wartet der Endstand.
  await page.goto(adresse('projektdokumente.html?projekt='+PID+'&liste=eingang'));
  await page.locator('[data-act="anlegen-vorlage"]').click();
  const twpEingang=(await zeilenVon(page,'eingang')).find(z=>z.daten.disziplin==='TWP');
  await page.locator('td[data-z="'+twpEingang.id+'"][data-k="erwartet01"]').waitFor();
  assert.equal(await page.locator('td[data-z="'+twpEingang.id+'"][data-k="erwartet01"]').textContent(),'M03 15.01.2027');
  await page.locator('td[data-z="'+twpEingang.id+'"][data-k="eingang01"]').click();
  await page.locator('[data-edit][data-k="eingang01"]').fill('10.01.2027');
  await page.locator('[data-edit][data-k="eingang01"]').press('Enter');
  await gespeichert(page);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('td[data-z="'+twpEingang.id+'"][data-k="stand"]').textContent(),'Endstand ausstehend');
  // Fachplanerbedarf: «beauftragt? ja» setzt den Status.
  await page.goto(adresse('projektdokumente.html?projekt='+PID+'&liste=fachplanerbedarf'));
  await page.locator('[data-act="anlegen-vorlage"]').click();
  const tw=(await zeilenVon(page,'fachplanerbedarf'))[0];
  await page.locator('td[data-z="'+tw.id+'"][data-k="beauftragt"]').click();
  await page.locator('select[data-edit][data-k="beauftragt"]').selectOption('ja');
  await page.keyboard.press('Escape');
  await gespeichert(page);
  assert.equal((await zeilenVon(page,'fachplanerbedarf'))[0].daten.status,'beauftragt');
  await foto(page,'7-fachplanerbedarf');
  assert.deepEqual(fehler,[]);
  await ctx.close();
});

// Zweiter Teil (28.11.2026): Planliste mit Plannummer aus dem Kürzel, Index je Ausgabe; Ausgaben und Verteiler hängen daran.
test('Planliste: Kürzel, Index je Ausgabe; Ausgaben und Verteiler mit Datum und Anlass',async()=>{
  const {ctx,page,fehler}=await oeffne();
  const PID='22222222-2222-4222-8222-222222222222';
  for(const art of ['ausgaben','planliste','verteiler']){
    await page.goto(adresse('projektdokumente.html?projekt='+PID+'&liste='+art));
    await page.locator('[data-act="anlegen-vorlage"]').click();
    await page.locator('tr.pd-zeile').first().waitFor();
  }
  // Ausgabe 1 geht am 04.12. hinaus.
  await page.goto(adresse('projektdokumente.html?projekt='+PID+'&liste=ausgaben'));
  const aus=(await zeilenVon(page,'ausgaben'))[0];
  await page.locator('td[data-z="'+aus.id+'"][data-k="datum"]').click();
  await page.locator('[data-edit][data-k="datum"]').fill('04.12.2026');
  await page.locator('[data-edit][data-k="datum"]').press('Enter');
  await gespeichert(page);
  await page.keyboard.press('Escape');
  // Planliste: Kürzel des Projekts, dann Index A für zwei Pläne und «Aktuellen Index eintragen» in Ausgabe 1.
  await page.goto(adresse('projektdokumente.html?projekt='+PID+'&liste=planliste'));
  await page.locator('[data-act="kuerzel"]').fill('TST');
  await page.locator('[data-act="kuerzel"]').press('Tab');
  await page.waitForFunction(()=>window.__fake.db.office_projektdokumente.find(d=>d.art==='planliste')?.meta?.kuerzel==='TST');
  const plaene=await zeilenVon(page,'planliste');
  assert.equal(await page.locator('td[data-z="'+plaene[2].id+'"][data-k="plannummer"]').textContent(),'TST-3-GR-EG-01');
  assert.match(await page.locator('th.pd-t-ausgabe').first().textContent(),/^Ausgabe 104\.12\.$/);
  for(const z of plaene.slice(1,3)){
    await page.locator('td[data-z="'+z.id+'"][data-k="index"]').click();
    await page.locator('[data-edit][data-k="index"]').fill('A');
    await page.locator('[data-edit][data-k="index"]').press('Enter');
    await gespeichert(page);
    await page.keyboard.press('Escape');
  }
  for(const z of plaene.slice(1,4))await page.locator('input[data-act="waehle"][data-z="'+z.id+'"]').check();
  assert.equal(await page.locator('[data-act="ausgabe-ziel"]').inputValue(),'1','die zuletzt ausgegebene Ausgabe');
  await page.locator('[data-act="index-eintragen"]').click();
  await gespeichert(page);
  assert.match(await page.locator('[data-meldung]').textContent(),/^2 Pläne in Ausgabe 1 eingetragen\. Ohne Index: TST-3-GR-1OG-01\.$/);
  const nachher=await zeilenVon(page,'planliste');
  assert.deepEqual(nachher.slice(1,4).map(z=>z.daten.a1||''),['A','A','']);
  assert.match(nachher[1].daten.indexdatum,/^\d{4}-\d{2}-\d{2}$/,'ein neuer Index bekommt das Datum');
  // Die Ausgabe nennt ohne eigenen Eintrag die Pläne, die laut Planliste mit ihr hinausgingen.
  await page.goto(adresse('projektdokumente.html?projekt='+PID+'&liste=ausgaben'));
  assert.equal(await page.locator('td[data-z="'+aus.id+'"][data-k="inhalt"]').textContent(),'TST-3-GR-UG-01 A, TST-3-GR-EG-01 A');
  // Verteiler: die Spalten tragen Datum und Anlass der Ausgaben.
  await page.goto(adresse('projektdokumente.html?projekt='+PID+'&liste=verteiler'));
  assert.equal(await page.locator('th.pd-t-ausgabe').count(),8);
  assert.equal(await page.locator('th.pd-t-ausgabe span[title]').first().getAttribute('title'),'Planungsgrundlagen an die Fachplaner (vorläufig)');
  const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('.pd-actions [data-act="excel"]').click()]);
  const sheet=entpacke(fs.readFileSync(await dl.path()))['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('<row r="5"><c r="C5" s="7" t="inlineStr"><is><t xml:space="preserve">Planungsgrundlagen an die Fachplaner (vorläufig)</t>'),'Anlass über den Spalten');
  await foto(page,'8-verteiler');
  assert.deepEqual(fehler,[]);
  await ctx.close();
});

test('iPhone: Übersicht, Liste und Vorlage ohne Querscrollen der Seite',async()=>{
  const {ctx,page,fehler}=await oeffne();
  await page.setViewportSize({width:390,height:844});
  for(const ziel of ['projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222',
    'projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=klaerungsliste',
    'projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=entscheidungsliste',
    'projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=schnittstellen',
    'projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&liste=planliste']){
    await page.goto(adresse(ziel));
    await page.locator('h1').waitFor();
    await page.waitForTimeout(150);
    const breite=await page.evaluate(()=>document.documentElement.scrollWidth);
    assert.ok(breite<=390,'Querscrollen auf '+ziel+': '+breite);
  }
  await foto(page,'5-iphone-liste');
  const vorlage=(await zeilenVon(page,'entscheidungsvorlagen'))[0];
  await page.goto(adresse('projektdokumente.html?projekt=22222222-2222-4222-8222-222222222222&vorlage='+vorlage.id));
  await page.locator('h1',{hasText:'Entscheidungsvorlage 01'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=390);
  await foto(page,'6-iphone-vorlage');
  assert.deepEqual(fehler,[]);
  await ctx.close();
});
