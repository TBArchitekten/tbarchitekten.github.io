// Mustermappe im echten Chromium mit synthetischem Supabase (24.11.2026). Kein Netz, keine Produktion.
// Ablauf wie im Büro: Mappe je Themenpaket anlegen → Position mit Code aus dem Plan → Kandidaten aus der Produktbibliothek
// (Musterliste «vorgeschlagen») → Texte auf der Seite → Fotos wählen → Materialseite → neuer Stand der Bibliothek erst nach
// «Übernehmen» → freie Seite mit Bild und mit PDF → PDF A3 quer ohne Fundstelle und ohne Unterschrift → vorlegen, Stand
// → Übersicht und Entscheidungsliste → iPhone ohne Querscrollen. Bildschirmfotos nur, wenn DOKUMENTE_FOTOS gesetzt ist.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const fake=fs.readFileSync(new URL('./fixtures/fake-supabase-dokumente.js',import.meta.url),'utf8');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const file=path.join(root,p);
  if(!file.startsWith(root)){res.writeHead(403);res.end();return}
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end();return}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(b)});
}).listen(0);
// pdf.js kommt im Büro vom CDN; hier aus dem lokal installierten Paket, sonst wird der PDF-Teil übersprungen.
let pdfjsOrdner='';
try{pdfjsOrdner=path.join(path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),'legacy','build')}catch{}
if(pdfjsOrdner&&!fs.existsSync(path.join(pdfjsOrdner,'pdf.min.mjs')))pdfjsOrdner='';
const browser=await chromium.launch({headless:true});
let geteilt=null;
test.after(async()=>{await geteilt?.ctx.close();await browser.close();server.close()});
const FOTOS=process.env.DOKUMENTE_FOTOS||'';
const foto=async(page,name)=>{if(FOTOS)await page.screenshot({path:path.join(FOTOS,name+'.png'),fullPage:true})};
const adresse=p=>`http://localhost:${server.address().port}/${p}`;
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
// Ein kleines PDF mit zwei Seiten, von Hand geschrieben (Seite 2 trägt den Text «Plan OG»).
function pdfDatei(){
  const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 297] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>',
    null,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 297] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>',null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const strom=t=>{const s='BT /F1 24 Tf 40 140 Td ('+t+') Tj ET';return '<< /Length '+s.length+' >>\nstream\n'+s+'\nendstream'};
  objs[3]=strom('Plan EG');objs[5]=strom('Plan OG');
  let out='%PDF-1.4\n';const off=[];
  objs.forEach((o,i)=>{off.push(out.length);out+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});
  const x=out.length;
  out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'+off.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+
    'trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+x+'\n%%EOF\n';
  return Buffer.from(out,'latin1');
}
async function oeffne(){
  if(!geteilt){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
    const page=await ctx.newPage();
    const fehler=[];
    page.on('pageerror',e=>fehler.push(e.message));
    page.on('dialog',d=>void d.accept());
    await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
    await page.route(/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@[^/]+\/legacy\/build\/(pdf(\.worker)?\.min\.mjs)/,async r=>{
      if(!pdfjsOrdner){await r.abort();return}
      const datei=/build\/(.*)$/.exec(r.request().url())[1];
      // Wie jsDelivr: Module von einer anderen Herkunft brauchen CORS.
      await r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(path.join(pdfjsOrdner,datei))});
    });
    await page.route(/supabase\.co/,r=>r.abort());
    geteilt={ctx,page,fehler};
  }
  return geteilt;
}
const db=page=>page.evaluate(()=>window.__fake.db);
const gespeichert=page=>page.waitForFunction(()=>document.querySelector('[data-speicher]')?.textContent==='gespeichert');
async function zeilen(page,art){
  const d=await db(page),dok=d.office_projektdokumente.find(x=>x.art===art);
  return dok?d.office_projektdokument_zeilen.filter(z=>z.dokument_id===dok.id).sort((a,b)=>a.nr-b.nr):[];
}
const seiteWaehlen=(page,text)=>page.locator('.mm-seitenliste button',{hasText:text}).click();

test('Mappe anlegen, Position mit Code, Kandidaten aus der Bibliothek, Texte auf der Seite',async()=>{
  const {page,fehler}=await oeffne();
  // Tools › Mustermappe (Gari, 25.11.2026): eigenes Werkzeug, erst das Projekt, dann die Mappen des Projekts.
  await page.goto(adresse('projektdokumente.html?werkzeug=mustermappe'));
  await page.locator('h1',{hasText:'Mustermappe'}).waitFor();
  await page.locator('a.pd-wahl-projekt',{hasText:'Testhaus'}).click();
  await page.locator('h1',{hasText:'Mustermappen'}).waitFor();
  assert.match(new URL(page.url()).search,/werkzeug=mustermappe/);
  assert.match(await page.locator('.pd-wrap').innerText(),/Für dieses Projekt gibt es noch keine Mustermappe\./);
  assert.equal(await page.title(),'TBA Office · Mustermappe');
  await page.locator('.pd-head button[data-act="mm-neu"]',{hasText:'Neue Mustermappe'}).click();
  await page.locator('#pdDialog select[name="paket"]').selectOption('Bodenbeläge');
  await page.locator('#pdDialog input[name="termin"]').fill('03.12.2026');
  await page.locator('#pdDialog button[type="submit"]').click();
  await page.locator('h1',{hasText:'Mustermappe Bodenbeläge'}).waitFor();
  assert.deepEqual(await page.locator('.mm-seitenliste button').allInnerTexts(),['1\nDeckblatt','2\nÜbersicht']);
  assert.match(await page.locator('.mm-buehne').innerText(),/Vorlage zur Bemusterung am 03\.12\.2026/);
  // Position B2: steht als Entscheidung in der Entscheidungsliste, mit Code, Thema und der Mappe als Vorlage.
  await page.locator('.mm-nav button',{hasText:'Position hinzufügen'}).click();
  await page.locator('#pdDialog input[name="code"]').fill('B2');
  await page.locator('#pdDialog input[name="bez"]').fill('Holz – Eiche');
  await page.locator('#pdDialog select[name="strategie"]').selectOption('A');
  await page.locator('#pdDialog button[type="submit"]').click();
  await page.locator('.mm-seitenliste .active',{hasText:'B2 Holz – Eiche · Vergleich'}).waitFor();
  await gespeichert(page);
  const mappe=(await zeilen(page,'entscheidungsvorlagen'))[0];
  let e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(mappe.daten.form,'mustermappe');
  assert.deepEqual(mappe.daten.punkte,[e.id]);
  assert.equal(e.daten.thema,'B2 · Holz – Eiche');assert.equal(e.daten.muster.code,'B2');assert.equal(e.daten.muster.strategie,'A');
  assert.equal(e.daten.vorlage_id,mappe.id);assert.equal(e.daten.herkunft,'Mustermappe Bodenbeläge');
  // Zwei Kandidaten aus der Bibliothek; jeder steht danach in der Musterliste des Projekts.
  const wahl=page.locator('select[data-act="mm-kandidat"]');
  await wahl.waitFor();
  await wahl.selectOption({label:'Parkett Eiche geölt · Holz AG'});
  await page.locator('.pd-meldung',{hasText:'Parkett Eiche geölt ist Kandidat'}).waitFor();
  await page.locator('select[data-act="mm-kandidat"]').selectOption({label:'Naturstein Jura · Stein GmbH'});
  await page.locator('.pd-meldung',{hasText:'Naturstein Jura ist Kandidat'}).waitFor();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.deepEqual(e.daten.optionen.map(o=>o.id+':'+o.text),['A:Parkett Eiche geölt','B:Naturstein Jura']);
  assert.equal(e.daten.optionen[0].muster_produkt.stand,'2026-11-20T10:00:00.000Z');
  assert.deepEqual(e.daten.optionen[0].muster_produkt.merkmale.map(m=>m.feld),['Aufbau','Brandverhalten']);
  const d=await db(page);
  assert.deepEqual(d.office_produkt_verwendungen.filter(v=>v.projekt_id===d.office_projects[0].id).map(v=>v.status+':'+v.code).sort(),['vorgeschlagen:BO-01','vorgeschlagen:BO-02']);
  const buehne=page.locator('.mm-buehne');
  // Seit 26.11.2026 stehen Name und Kennwerte auf der Seite wie im PDF; geschrieben wird direkt darin (für diese Mappe).
  assert.match(await buehne.innerText(),/A ·/);
  assert.equal(await page.locator('#mm-'+e.id+'-A-name').innerText(),'Parkett Eiche geölt');
  assert.match(await page.locator('.mm-buehne table[data-mmkwtab="'+e.id+'|A"]').innerText(),/Aufbau\s+massiv 16 mm/);
  assert.equal(await page.locator('.mm-buehne textarea').count(),0,'keine Eingabefelder auf der Seite');
  assert.equal(await page.locator('.mm-buehne .mm-geaendert').count(),0,'nichts geändert: nichts markiert');
  // Texte auf der Seite und Angaben der Position rechts.
  await page.locator('#mm-'+e.id+'-frage').fill('Welcher Belag für das Obergeschoss?');
  await page.locator('#mf-'+e.id+'-zonen').fill('Ausstellung 537 m²');await page.locator('#mf-'+e.id+'-zonen').press('Tab');
  await page.locator('#mf-'+e.id+'-empfehlung').selectOption('A');
  await page.locator('.mm-buehne',{hasText:'Empfehlung: Variante A.'}).waitFor();
  await page.locator('#mm-'+e.id+'-begruendung').fill('Passt in den Deckel des Bodentanks.');
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.frage,'Welcher Belag für das Obergeschoss?');assert.equal(e.daten.muster.zonen,'Ausstellung 537 m²');
  assert.equal(e.daten.empfehlung,'A');assert.equal(e.daten.begruendung,'Passt in den Deckel des Bodentanks.');
  assert.match(await buehne.innerText(),/Ausstellung 537 m²/);
  // Nur im Büro: was im Datenblatt fehlt, steht neben der Seite, nicht auf ihr.
  assert.match(await page.locator('.mm-intern').innerText(),/nicht im Datenblatt: R-Gruppe/);
  assert.doesNotMatch(await buehne.innerText(),/R-Gruppe/);
  // Foto wählen, Materialseite anlegen.
  await page.locator('button[data-act="mm-foto"][data-o="A"]').first().click();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.optionen[0].muster_fotos.length,1);
  await page.locator('button[data-act="mm-material"][data-o="A"]').click();
  await page.locator('.mm-seitenliste .active',{hasText:'B2 · Parkett Eiche geölt · Material'}).waitFor();
  // Seit 26.11.2026 steht das Foto in einem Rahmen (Ausschnitt); das Bild darin.
  assert.ok(await page.locator('.mm-buehne .mm-foto-gross img').count(),'großes Foto auf der Materialseite');
  await page.locator('[data-mmopt="'+e.id+'|A"]').fill('Eiche natur, geölt; Muster liegt vor.');
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.optionen[0].muster_text,'Eiche natur, geölt; Muster liegt vor.');
  await foto(page,'mappe-1-material');
  assert.deepEqual(fehler,[]);
});

test('Neuer Stand der Bibliothek erst nach «Übernehmen»; Kennwert nur mit Beleg im PDF',async()=>{
  const {page,fehler}=await oeffne();
  // Die Bibliothek ändert sich; die Variante A bekommt einen Kennwert mit Fundstelle aus einem anderen Projekt.
  await page.evaluate(()=>{
    const d=window.__fake.db,p=d.office_produkte.find(x=>x.name==='Parkett Eiche geölt');
    p.updated_at='2026-11-24T09:00:00.000Z';p.merkmale=[...p.merkmale,{feld:'Rutschhemmung',wert:'R9',seite:6}];
    const dok=d.office_projektdokumente.find(x=>x.art==='entscheidungsliste'),z=d.office_projektdokument_zeilen.find(x=>x.dokument_id===dok.id);
    z.daten.optionen[0]={...z.daten.optionen[0],kennwert:'189,69 €/m²',kennwert_quelle:'Kostenberechnung T-90 Altbau, Zeile 12',kennwert_beleg:'Angebot 2025, fortgeschrieben'};
    z.server_revision++;window.__fake.sichern();
  });
  await page.reload();
  await page.locator('h1',{hasText:'Mustermappe Bodenbeläge'}).waitFor();
  await seiteWaehlen(page,'B2 Holz – Eiche · Vergleich');
  const hinweis=page.locator('.mm-intern',{hasText:'neuer Stand in der Bibliothek'});
  await hinweis.waitFor();
  const kennA=page.locator('.mm-buehne table[data-mmkwtab$="|A"]');
  assert.doesNotMatch(await kennA.innerText(),/R9/,'die Seite bleibt beim übernommenen Stand');
  await hinweis.locator('button',{hasText:'Übernehmen'}).click();
  await page.waitForFunction(()=>/Rutschhemmung\s+R9/.test(document.querySelector('.mm-buehne table[data-mmkwtab$="|A"]')?.innerText||''));
  assert.equal(await page.locator('.mm-buehne .mm-geaendert').count(),0,'der neue Stand ist keine Anpassung');
  await gespeichert(page);
  const e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.optionen[0].muster_produkt.stand,'2026-11-24T09:00:00.000Z');
  // Schrift in Millimetern des Blatts: der Titel hat 20 pt (7,056 mm), wie groß die Seite auch gezeigt wird.
  const mmGroesse=sel=>page.evaluate(sel=>{const e=document.querySelector(sel);
    return Math.round(parseFloat(getComputedStyle(e).fontSize)/(e.closest('.mm-seite').getBoundingClientRect().width/420)*100)/100},sel);
  assert.equal(await mmGroesse('.mm-buehne h2.mm-t-titel'),7.06,'nicht die 19 px der Überschriften der App');
  // PDF: A3 quer, alle Seiten, Beleg ja, Fundstelle nein, keine Eingabefelder, keine Unterschrift.
  await page.evaluate(()=>{window.__gedruckt=null;window.print=()=>{window.__gedruckt={html:document.querySelector('.mm-druck').innerHTML,
    klasse:document.documentElement.className,stil:[...document.querySelectorAll('style')].map(s=>s.textContent).join('\n')}}});
  await page.locator('button[data-act="mm-pdf"]').click();
  await page.waitForFunction(()=>window.__gedruckt);
  const g=await page.evaluate(()=>window.__gedruckt);
  assert.match(g.stil,/@page\{size:A3 landscape;margin:0\}/);assert.match(g.klasse,/mm-drucken/);
  assert.equal((g.html.match(/class="mm-blatt"/g)||[]).length,4);
  assert.match(g.html,/Angebot 2025, fortgeschrieben/);assert.match(g.html,/189,69 €\/m²/);
  assert.doesNotMatch(g.html,/T-90|Altbau|Zeile 12/);assert.doesNotMatch(g.html,/<textarea|contenteditable|mm-raster/);assert.doesNotMatch(g.html,/Unterschrift/);
  assert.match(g.html,/<img class="mm-foto/);
  // Im Druck dieselbe Schrift (Titel 20 pt, Deckblatt 40 pt) und kein Abstand unter den Absätzen (alles auf der Grundlinie).
  await page.emulateMedia({media:'print'});
  assert.equal(await mmGroesse('.mm-druck h2.mm-t-titel'),7.06);
  assert.equal(await mmGroesse('.mm-druck h2.mm-t-gross'),14.11);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.mm-druck .mm-seite :is(p,h2)')].map(e=>getComputedStyle(e).marginBottom).filter(x=>x!=='0px')),[]);
  if(FOTOS){
    // Nur zum Ansehen: das PDF so, wie der Druck es setzt (A3 quer).
    await page.pdf({path:path.join(FOTOS,'mappe-druck.pdf'),preferCSSPageSize:true,printBackground:true});
  }
  await page.emulateMedia({media:null});
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  assert.doesNotMatch(await page.evaluate(()=>document.documentElement.className),/mm-drucken/);
  assert.deepEqual(fehler,[]);
});

test('Freie Seite mit Bild und mit einer Seite aus einem PDF',async t=>{
  const {page,fehler}=await oeffne();
  await page.locator('select[data-act="mm-neue-seite"]').selectOption('frei');
  await page.locator('.mm-seitenliste .active',{hasText:'Freie Seite'}).waitFor();
  await page.locator('input[data-act="mm-datei"]').setInputFiles({name:'Plan EG.png',mimeType:'image/png',buffer:PNG});
  await page.locator('.pd-meldung',{hasText:'Das Bild steht auf der Seite.'}).waitFor();
  await gespeichert(page);
  let d=await db(page);
  const vorlagen=d.office_projektdokumente.find(x=>x.art==='entscheidungsvorlagen');
  const pfade=Object.keys(d.storage).filter(k=>k.startsWith('office-projektdokumente/'));
  assert.equal(pfade.length,1);
  assert.match(pfade[0],new RegExp('^office-projektdokumente/'+vorlagen.id+'/'+d.office_members[0].user_id+'/[0-9a-f-]{36}\\.png$'));
  let mappe=(await zeilen(page,'entscheidungsvorlagen'))[0],frei=mappe.daten.seiten.find(x=>x.typ==='frei');
  assert.equal(frei.titel,'Plan EG');
  assert.ok(await page.locator('.mm-buehne img.mm-foto-frei').count());
  if(!pdfjsOrdner){t.diagnostic('pdfjs-dist nicht installiert: PDF übersprungen');return}
  // Ein PDF: die gewählte Seite wird ein Bild auf der Seite.
  await page.locator('select[data-act="mm-neue-seite"]').selectOption('frei');
  await page.locator('input[data-act="mm-pdf-seite"]').fill('2');await page.locator('input[data-act="mm-pdf-seite"]').press('Tab');
  await page.locator('input[data-act="mm-datei"]').setInputFiles({name:'Plaene.pdf',mimeType:'application/pdf',buffer:pdfDatei()});
  // Fertig ist es mit der Bestätigung oder einer Meldung; die Meldung steht dann in der Prüfung.
  await page.waitForFunction(()=>{const t=document.querySelector('.pd-meldung')?.textContent||'';return !!t&&!/PDF wird gelesen/.test(t)},null,{timeout:30000});
  assert.match(await page.locator('.pd-meldung').innerText(),/Das Bild steht auf der Seite\./);
  await gespeichert(page);
  d=await db(page);
  const jpg=Object.entries(d.storage).filter(([k])=>k.endsWith('.jpg'));
  assert.equal(jpg.length,1);assert.equal(jpg[0][1].typ,'image/jpeg');
  mappe=(await zeilen(page,'entscheidungsvorlagen'))[0];
  assert.equal(mappe.daten.seiten.filter(x=>x.typ==='frei')[1].titel,'Plaene · Seite 2 von 2');
  assert.deepEqual(fehler,[]);
});

test('Vorlegen hält den Stand fest; Übersicht, Entscheidungsliste und iPhone',async()=>{
  const {page,fehler}=await oeffne();
  await page.locator('button[data-act="vorlegen"]').click();
  await page.locator('#pdDialog',{hasText:'Entschieden wird im Bemusterungstermin'}).waitFor();
  await page.locator('#pdDialog button[type="submit"]').click();
  await page.locator('.pd-meldung',{hasText:'Vorgelegt; der Stand ist festgehalten.'}).waitFor();
  await gespeichert(page);
  const d=await db(page);
  assert.equal(d.office_projektdokument_staende.length,1);
  const st=d.office_projektdokument_staende[0];
  assert.equal(st.inhalt.schema,'tba.office.mustermappe.v1');assert.match(st.bezeichnung,/^Mustermappe Bodenbeläge · vorgelegt am /);
  assert.equal(st.inhalt.punkte[0].optionen[0].kennwert,'189,69 €/m²');
  assert.doesNotMatch(JSON.stringify(st.inhalt),/T-90|Altbau/,'auch der Stand ohne Fundstelle');
  assert.equal((await zeilen(page,'entscheidungsliste'))[0].daten.status,'vorgelegt');
  await page.locator('[data-staende] button[data-act="stand"]').click();
  await page.locator('#pdDialog .mm-stand .mm-blatt').first().waitFor();
  assert.equal(await page.locator('#pdDialog .mm-stand textarea').count(),0);
  assert.match(await page.locator('#pdDialog').innerText(),/dieser Stand ändert sich nicht/);
  await page.locator('#pdDialog [data-dlg="zu"]').click();
  // Zurück zu den Mappen des Projekts: eine Karte je Mappe mit Positionen, Seiten, Termin und Stand.
  await page.locator('a.pd-back',{hasText:'Mustermappen'}).click();
  const karte=page.locator('.mm-karte',{hasText:'Mustermappe Bodenbeläge'});
  await karte.waitFor();
  assert.match(await karte.innerText(),/1 Position · \d+ Seiten/);
  assert.match(await karte.innerText(),/Bemusterung am 03\.12\.2026 · vorgelegt am/);
  // Der Projektstart zeigt keine Mappen mehr, auch nicht unter den Entscheidungsvorlagen.
  await page.goto(adresse('projektdokumente.html?projekt='+d.office_projects[0].id));
  await page.locator('.pd-karte',{hasText:'Entscheidungsvorlagen'}).waitFor();
  assert.equal(await page.locator('.pd-karte',{hasText:'Mustermappen'}).count(),0);
  assert.doesNotMatch(await page.locator('.pd-karte',{hasText:'Entscheidungsvorlagen'}).innerText(),/Mustermappe/);
  // In der Entscheidungsliste steht die Position mit Herkunft und Vorlage.
  await page.locator('.pd-karte',{hasText:'Entscheidungsliste'}).locator('a',{hasText:'Öffnen'}).click();
  await page.locator('td',{hasText:'B2 · Holz – Eiche'}).first().waitFor();
  // iPhone: die Mappe ohne Querscrollen.
  await page.setViewportSize({width:390,height:844});
  await page.goto(adresse('projektdokumente.html?projekt='+d.office_projects[0].id+'&vorlage='+(await zeilen(page,'entscheidungsvorlagen'))[0].id));
  await page.locator('h1',{hasText:'Mustermappe Bodenbeläge'}).waitFor();
  const breit=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(breit<=1,'kein Querscrollen: '+breit);
  await foto(page,'mappe-2-iphone');
  assert.deepEqual(fehler,[]);
});

test('Präsentieren im Termin: Entscheidung je Position, danach in der Produktbibliothek freigeben',async()=>{
  const {page,fehler}=await oeffne();
  await page.setViewportSize({width:1440,height:1000});
  await page.reload();
  await page.locator('h1',{hasText:'Mustermappe Bodenbeläge'}).waitFor();
  assert.match(await page.locator('.card',{hasText:'Entschieden wird im Termin'}).innerText(),/Präsentieren/);
  await page.locator('button[data-act="mm-praes"]').click();
  const praes=page.locator('.mm-praes');
  await praes.waitFor();
  assert.match(await praes.innerText(),/Entschieden: 0 von 1/);
  assert.equal(await praes.locator('textarea').count(),0,'im Termin keine Eingabefelder auf der Seite');
  // Mit der Pfeiltaste bis zur ersten Seite von B2.
  for(let i=0;i<8&&!(await praes.locator('[data-praes="panel"]').count());i++)await page.keyboard.press('ArrowRight');
  assert.match(await praes.locator('.mm-praes-pos').innerText(),/B2 · Holz – Eiche/);
  await praes.locator('[data-praes="panel"]').click();
  const form=praes.locator('form[data-praes-form]');
  await form.waitFor();
  assert.equal(await form.locator('input[name="wahl"]:checked').inputValue(),'A','die Empfehlung ist vorgewählt');
  assert.equal(await form.locator('input[name="am"]').inputValue(),'03.12.2026','das Datum des Termins');
  await form.locator('input[name="wer"]').fill('Bauherr');
  await form.locator('textarea[name="bem"]').fill('Muster Eiche natur, geölt');
  await form.locator('button[type="submit"]').click();
  await praes.locator('.mm-praes-zahl',{hasText:'Entschieden: 1 von 1'}).waitFor();
  await gespeichert(page);
  let e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.status,'entschieden');
  assert.equal(e.daten.entscheidung,'A: Parkett Eiche geölt – Muster Eiche natur, geölt');
  assert.equal(e.daten.entschieden_am,'2026-12-03');assert.equal(e.daten.entscheider,'Bauherr');
  assert.equal(e.daten.fundstelle,'Bemusterungstermin am 03.12.2026');
  assert.match(await praes.innerText(),/Entschieden am 03\.12\.2026 von Bauherr: A · Parkett Eiche geölt/);
  // Vertagt: die Entscheidung fällt weg, die Bemerkung wird zur Annahme; dann doch A.
  await praes.locator('[data-praes="panel"]').click();
  await form.locator('input[name="wahl"][value="vertagt"]').check();
  await form.locator('textarea[name="bem"]').fill('Bis zum Muster wird mit A weitergeplant.');
  await form.locator('button[type="submit"]').click();
  await praes.locator('.mm-praes-zahl',{hasText:'Entschieden: 0 von 1'}).waitFor();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.status,'vertagt');assert.equal(e.daten.annahme,'Bis zum Muster wird mit A weitergeplant.');
  assert.ok(!('entscheidung' in e.daten)&&!('entschieden_am' in e.daten));
  await praes.locator('[data-praes="panel"]').click();
  await form.locator('input[name="wahl"][value="A"]').check();
  await form.locator('textarea[name="bem"]').fill('');
  await form.locator('button[type="submit"]').click();
  await praes.locator('.mm-praes-zahl',{hasText:'Entschieden: 1 von 1'}).waitFor();
  await foto(page,'mappe-3-praesentieren');
  await praes.locator('[data-praes="ende"]').click();
  await praes.waitFor({state:'detached'});
  // Nach dem Termin: die gewählten Produkte freigeben, die übrigen Kandidaten verworfen.
  const karte=page.locator('.card',{hasText:'Entscheidungen der Bemusterung'});
  await karte.waitFor();
  await karte.locator('button',{hasText:'In der Produktbibliothek freigeben (1)'}).click();
  await page.locator('.pd-meldung',{hasText:'In der Produktbibliothek freigegeben: 1 Position.'}).waitFor();
  const d=await db(page),pid=d.office_projects[0].id;
  const st=Object.fromEntries(d.office_produkt_verwendungen.filter(v=>v.projekt_id===pid).map(v=>[d.office_produkte.find(p=>p.id===v.produkt_id).name,v.status]));
  assert.deepEqual(st,{'Parkett Eiche geölt':'freigegeben','Naturstein Jura':'verworfen'});
  await page.locator('.card',{hasText:'Entscheidungen der Bemusterung'}).locator('.chip-ok',{hasText:'freigegeben'}).waitFor();
  assert.deepEqual(fehler,[]);
});

// Als Reiter «Mustermappe» in Work (Gari, 25.11.2026): die Seite läuft in einem Rahmen der App. Ohne Rücksprung in die
// App und ohne zweite Projektzeile; ?neu=1 öffnet nur den Dialog, Abbrechen meldet die Seite, die neue Mappe öffnet sie
// über die Adresse; Work liest die Revision der Mappe und lässt vor dem Schließen speichern.
test('Als Reiter in Work: kein Rücksprung, Anlegen und Abbrechen gemeldet, Revision und Speichern für Work',async()=>{
  const ctx=await browser.newContext({viewport:{width:1320,height:940},deviceScaleFactor:1});
  const page=await ctx.newPage();const fehler=[];page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co/,r=>r.abort());
  const PID='22222222-2222-4222-8222-222222222222';
  await page.route(/\/__rahmen__\.html$/,r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="de"><body style="margin:0"><script>
window.__nachrichten=[];addEventListener('message',e=>{if(e.origin===location.origin)window.__nachrichten.push(e.data)});
</script><iframe id="f" allow="fullscreen" style="width:1300px;height:900px;border:0" src="/projektdokumente.html?projekt=${PID}&werkzeug=mustermappe&neu=1"></iframe></body></html>`}));
  try{
    await page.goto(adresse('__rahmen__.html'));
    const f=page.frameLocator('#f'),rahmen=()=>page.frames().find(x=>/projektdokumente\.html/.test(x.url()));
    await f.locator('#pdDialog select[name="paket"]').waitFor();
    assert.equal(await rahmen().evaluate(()=>document.documentElement.classList.contains('im-reiter')),true);
    assert.equal(await f.locator('.pd-karte').count(),0,'hinter dem Dialog keine Liste der Mappen');
    assert.doesNotMatch(rahmen().url(),/neu=1/,'neu einmal: das Neuladen öffnet den Dialog nicht wieder');
    await f.locator('#pdDialog [data-dlg="abbrechen"]').click();
    await page.waitForFunction(()=>window.__nachrichten.length===1);
    assert.deepEqual(await page.evaluate(()=>window.__nachrichten),[{tbaOfficeTool:'abgebrochen'}]);
    // Anlegen: die neue Mappe öffnet sich über die Adresse der Seite (Work übernimmt sie beim Laden des Rahmens).
    await rahmen().evaluate(p=>location.assign('/projektdokumente.html?projekt='+p+'&werkzeug=mustermappe&neu=1'),PID);
    await f.locator('#pdDialog select[name="paket"]').waitFor();
    await f.locator('#pdDialog select[name="paket"]').selectOption('Bäder');
    await f.locator('#pdDialog button[type="submit"]').click();
    await f.locator('.pd-mappe-wrap>.mm-zeile').waitFor();
    const url=new URL(rahmen().url());
    assert.equal(url.searchParams.get('projekt'),PID);assert.ok(url.searchParams.get('vorlage'),'die Mappe steht in der Adresse');
    assert.deepEqual(await page.evaluate(()=>window.__nachrichten),[{tbaOfficeTool:'abgebrochen'}],'Anlegen ist kein Abbruch');
    // Eine Werkzeugzeile (B2, 27.11.2026): kein Rücksprung, keine Überschrift, keine zweite Leiste; welche Mappe offen
    // ist, zeigt Work. Am Ende der Zeile «gespeichert», «Präsentieren», «PDF», «Vorlegen» und «•••» mit dem Raster.
    assert.equal(await f.locator('.pd-back, .pd-head, h1').count(),0);
    assert.equal(await f.locator('.mm-mitte .mm-werkzeug').count(),0,'keine zweite Leiste über der Bühne');
    assert.deepEqual(await f.locator('.mm-zeile .mm-aktionen button').allInnerTexts(),['Präsentieren','PDF','Vorlegen']);
    assert.equal(await f.locator('.mm-zeile [data-speicher]').innerText(),'gespeichert');
    assert.match(await f.locator('.mm-zeile-stand').getAttribute('title'),/^Vorlage zur Bemusterung.* · Entwurf$/);
    assert.equal(await f.locator('.mm-zeile>[data-act="mm-raster"]').count(),0);
    assert.equal(await f.locator('.mm-mehr-menue [data-act="mm-raster"]').count(),1);
    assert.ok((await f.locator('.mm-zeile').evaluate(z=>z.getBoundingClientRect().height))<=44,'eine Zeile');
    // Für Work: Revision der Mappe, nichts offen; eine Änderung steht aus, flush speichert sie.
    const rev=await rahmen().evaluate(()=>[window.TBA_OFFICE_TOOL.kind,window.TBA_OFFICE_TOOL.revision(),window.TBA_OFFICE_TOOL.pending()]);
    assert.equal(rev[0],'mustermappe');assert.ok(rev[1]>=1);assert.equal(rev[2],false);
    await f.locator('.mm-nav button',{hasText:'Position hinzufügen'}).click();
    await f.locator('#pdDialog input[name="code"]').fill('S1');
    await f.locator('#pdDialog input[name="bez"]').fill('Waschtisch');
    await f.locator('#pdDialog button[type="submit"]').click();
    await f.locator('.mm-seitenliste .active',{hasText:'S1 Waschtisch · Vergleich'}).waitFor();
    await rahmen().evaluate(()=>window.TBA_OFFICE_TOOL.flush());
    const nach=await rahmen().evaluate(()=>[window.TBA_OFFICE_TOOL.revision(),window.TBA_OFFICE_TOOL.pending()]);
    assert.ok(nach[0]>rev[1],'gespeichert: neue Revision');assert.equal(nach[1],false);
    // Im Rahmen führt kein Link in die App.
    assert.equal(await f.locator('a[href^="./app/"]:visible').count(),0);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

// Eine Werkzeugzeile je Reiter (B2, Gari, 27.11.2026): auch in einem schmalen Reiter (1040 px) bleibt die Leiste eine
// Zeile, Seiten, Bühne und Eigenschaften stehen nebeneinander. «•••» schließt mit Esc und mit einem Klick daneben, der
// Schalter darin lässt es offen. Passt ein Text nicht in seinen Rahmen, erscheint «1 Übersatz» in derselben Zeile (die
// Zeile bricht nicht um); ein Klick zeigt die Eigenschaften und wählt den Rahmen.
test('Reiter: eine Zeile, «•••» mit Raster, Übersatz als Hinweis in der Leiste',async()=>{
  const ctx=await browser.newContext({viewport:{width:1060,height:900},deviceScaleFactor:1});
  const page=await ctx.newPage();const fehler=[];page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co/,r=>r.abort());
  const PID='22222222-2222-4222-8222-222222222222';
  await page.route(/\/__rahmen__\.html$/,r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="de"><body style="margin:0">
<iframe id="f" style="width:1040px;height:860px;border:0" src="/projektdokumente.html?projekt=${PID}&werkzeug=mustermappe&neu=1"></iframe></body></html>`}));
  try{
    await page.goto(adresse('__rahmen__.html'));
    const f=page.frameLocator('#f');
    await f.locator('#pdDialog select[name="paket"]').selectOption('Bäder');
    await f.locator('#pdDialog button[type="submit"]').click();
    const zeile=f.locator('.pd-mappe-wrap>.mm-zeile');await zeile.waitFor();
    const hoehe=()=>zeile.evaluate(z=>z.getBoundingClientRect().height);
    assert.ok(await hoehe()<=44,'eine Zeile bei 1040 px');
    const spalten=await f.locator('.mm').evaluate(m=>[m.querySelector('.mm-nav'),m.querySelector('.mm-mitte'),m.querySelector('.mm-rechts')]
      .map(x=>Math.round(x.getBoundingClientRect().top)));
    assert.equal(new Set(spalten).size,1,'Seiten, Bühne und Eigenschaften nebeneinander: '+spalten);
    // «•••»: Raster schalten (das Menü bleibt offen), Esc schließt, ein Klick daneben auch.
    const mehr=f.locator('[data-act="mm-mehr"]'),menue=f.locator('.mm-mehr-menue');
    await mehr.click();assert.equal(await menue.isVisible(),true);assert.equal(await mehr.getAttribute('aria-expanded'),'true');
    await menue.locator('[data-act="mm-raster"]').click();
    assert.equal(await f.locator('.mm-buehne').evaluate(b=>b.classList.contains('raster')),true);
    assert.equal(await menue.isVisible(),true,'der Schalter lässt das Menü offen');
    await page.keyboard.press('Escape');
    assert.equal(await menue.isVisible(),false);assert.equal(await mehr.getAttribute('aria-expanded'),'false');
    await mehr.click();await f.locator('.mm-buehne').click({position:{x:4,y:4}});
    assert.equal(await menue.isVisible(),false,'ein Klick daneben schließt');
    // Übersatz: zu viel Text im Deckblatt, Eigenschaften vorher ausgeblendet.
    const pille=f.locator('[data-mm-pille]');
    assert.equal(await pille.isVisible(),false);
    await f.locator('[data-act="mm-rechts"]').click();
    await f.locator('.mm-buehne .mm-ed').first().click();
    for(let k=0;k<26;k++){await page.keyboard.type('Zeile '+k);await page.keyboard.press('Enter')}
    await pille.waitFor();
    assert.equal(await pille.innerText(),'1 Übersatz');
    assert.equal(await pille.getAttribute('title'),'Passt nicht ganz in den Rahmen: Deckblatt-Text');
    assert.ok(await hoehe()<=44,'mit dem Hinweis bleibt es eine Zeile');
    await pille.click();
    assert.equal(await f.locator('.mm').evaluate(m=>m.classList.contains('ohne-rechts')),false,'Eigenschaften wieder da');
    assert.equal(await f.locator('[data-act="mm-rechts"]').getAttribute('aria-pressed'),'true');
    await f.locator('.mm-rechts .mm-uebersatz-liste',{hasText:'Deckblatt-Text'}).waitFor();
    assert.match(await f.locator('[data-mm-kontext]').innerText(),/^Deckblatt-Text · /,'der Rahmen ist gewählt');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

// Gari, 26.11.2026: die Seiten nach dem Erzeugen bearbeiten. Texte der Variante nur für diese Mappe (markiert, mit
// «zurücksetzen»), jedes Foto ersetzen (eigenes Bild bleibt in der Mappe, oder aus der Bibliothek), zuschneiden, «+ Bild»
// und entfernen. Die Bibliothek bleibt, wie sie ist; das Raster der Seite auch.
test('Bearbeiten nach dem Erzeugen: Texte für diese Mappe, Bild ersetzen, zuschneiden, hinzufügen',async()=>{
  const {page,fehler}=await oeffne();
  const PID='22222222-2222-4222-8222-222222222222';
  const mappe=(await zeilen(page,'entscheidungsvorlagen')).find(v=>v.daten.form==='mustermappe');
  await page.goto(adresse('projektdokumente.html?projekt='+PID+'&vorlage='+mappe.id));
  await page.locator('h1',{hasText:'Mustermappe Bodenbeläge'}).waitFor();
  await seiteWaehlen(page,'B2 Holz – Eiche · Vergleich');
  let e=(await zeilen(page,'entscheidungsliste'))[0];
  const produktVorher=JSON.stringify((await db(page)).office_produkte);
  // Name und Kennwerte nur für diese Mappe, direkt auf der Seite; markiert, rechts «zurücksetzen».
  const name=page.locator('#mm-'+e.id+'-A-name');
  assert.equal(await name.innerText(),'Parkett Eiche geölt');
  assert.equal(await name.evaluate(t=>t.classList.contains('mm-geaendert')),false);
  await name.fill('Eiche Landhausdiele, geölt');
  await name.press('Enter');
  await gespeichert(page);
  assert.equal(await name.evaluate(t=>t.classList.contains('mm-geaendert')),true);
  // Kennwerte in der Tabelle: Wert ändern, Enter springt zur nächsten Zeile; die letzte Zeile ersetzen.
  const zellen=()=>page.locator('.mm-buehne table[data-mmkwtab="'+e.id+'|A"] tbody tr');
  const n0=await zellen().count();
  await page.locator('#mm-'+e.id+'-A-kw0w').fill('21 mm Landhausdiele');
  for(let i=1;i<n0;i++){await page.locator('#mm-'+e.id+'-A-kw'+i+'f').fill('');await page.locator('#mm-'+e.id+'-A-kw'+i+'w').fill('')}
  await page.locator('#mm-'+e.id+'-A-kw1f').fill('Oberfläche');await page.locator('#mm-'+e.id+'-A-kw1w').fill('geölt');
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.optionen[0].muster_name,'Eiche Landhausdiele, geölt');
  assert.deepEqual(e.daten.optionen[0].muster_merkmale,[{feld:'Aufbau',wert:'21 mm Landhausdiele'},{feld:'Oberfläche',wert:'geölt'}]);
  // Beim Verlassen des Rahmens fallen leere Zeilen weg.
  await page.locator('#mm-'+e.id+'-frage').click();
  await page.waitForFunction(id=>document.querySelectorAll('.mm-buehne table[data-mmkwtab="'+id+'|A"] tbody tr').length===2,e.id);
  // «+ Kennwert» hängt eine leere Zeile an; Enter im Feld springt zum Wert; leer fällt sie beim Verlassen wieder weg.
  await page.locator('.mm-buehne [data-act="mm-kw-neu"][data-o="A"]').click({force:true});
  await page.locator('#mm-'+e.id+'-A-kw2f').waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'mm-'+e.id+'-A-kw2f');
  await page.keyboard.type('Format');await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'mm-'+e.id+'-A-kw2w');
  await page.keyboard.type('1200 × 200 mm');
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.deepEqual(e.daten.optionen[0].muster_merkmale.at(-1),{feld:'Format',wert:'1200 × 200 mm'});
  await page.locator('#mm-'+e.id+'-A-kw2f').fill('');await page.locator('#mm-'+e.id+'-A-kw2w').fill('');
  await page.locator('#mm-'+e.id+'-frage').click();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.deepEqual(e.daten.optionen[0].muster_merkmale,[{feld:'Aufbau',wert:'21 mm Landhausdiele'},{feld:'Oberfläche',wert:'geölt'}]);
  assert.equal(e.daten.optionen[0].muster_produkt.name,'Parkett Eiche geölt','der Auszug der Bibliothek bleibt');
  const hinweis=page.locator('.mm-intern .mm-geaendert-zeile',{hasText:'A: in dieser Mappe geändert.'});
  await hinweis.waitFor();
  // Unter der Seite nur, was sie zeigt: die Beschreibung (Materialseite) steht hier nicht.
  assert.deepEqual(await hinweis.locator('button').allInnerTexts(),['Name zurücksetzen','Kennwerte zurücksetzen']);
  await foto(page,'mappe-bearbeiten-text');
  // Im PDF steht, was die Mappe sagt, ohne Felder.
  await page.evaluate(()=>{window.__gedruckt=null;window.print=()=>{window.__gedruckt=document.querySelector('.mm-druck').innerHTML}});
  await page.locator('button[data-act="mm-pdf"]').click();
  await page.waitForFunction(()=>window.__gedruckt);
  let druck=await page.evaluate(()=>window.__gedruckt);
  assert.match(druck,/<b>A · <\/b><b>Eiche Landhausdiele, geölt<\/b>/);assert.match(druck,/<th scope="row">Oberfläche<\/th><td>geölt<\/td>/);
  assert.doesNotMatch(druck,/<textarea|contenteditable|mm-bild-knopf|data-bildplatz/);
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  // Zurücksetzen: wieder der Name aus der Bibliothek, die Kennwerte bleiben geändert.
  await hinweis.locator('button',{hasText:'Name zurücksetzen'}).click();
  await page.locator('.pd-meldung',{hasText:'Name von A wieder wie in der Produktbibliothek.'}).waitFor();
  assert.equal(await page.locator('#mm-'+e.id+'-A-name').innerText(),'Parkett Eiche geölt');
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.optionen[0].muster_name,undefined);assert.ok(Array.isArray(e.daten.optionen[0].muster_merkmale));
  // Bild ändern auf der Seite: eigenes Bild hochladen; es liegt im Speicher der Mappe, nicht in der Bibliothek.
  await page.locator('[data-bildplatz="'+e.id+'|A|0"] button',{hasText:'Bild ändern'}).click();
  const dlg=page.locator('#pdDialog .mm-bild-dlg');
  await dlg.waitFor();
  assert.match(await dlg.locator('h2').innerText(),/Bild · Variante A, großes Bild/);
  // Ein Bild im Querformat (3:2), damit der Ausschnitt etwas zu tun hat.
  const BILD=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=800;const g=c.getContext('2d');
    for(let k=0;k<24;k++){g.fillStyle=k%2?'#b9a27e':'#a68a62';g.fillRect(k*50,0,50,800)}
    g.fillStyle='#3d3226';g.beginPath();g.arc(300,400,120,0,7);g.fill();return c.toDataURL('image/png').split(',')[1]}),'base64');
  await dlg.locator('input[data-bd="datei"]').setInputFiles({name:'Muster Eiche.png',mimeType:'image/png',buffer:BILD});
  await page.locator('.pd-meldung',{hasText:'Das Bild steht auf der Seite; es bleibt in dieser Mappe.'}).waitFor();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  let f=e.daten.optionen[0].muster_fotos;
  assert.equal(f[0].quelle,'mappe');assert.equal(f[0].name,'Muster Eiche.png');assert.match(f[0].id,/^m-/);
  const vorlagenDok=(await db(page)).office_projektdokumente.find(x=>x.art==='entscheidungsvorlagen');
  assert.ok((await db(page)).storage['office-projektdokumente/'+f[0].pfad],'im Speicher der Mappe');
  assert.ok(f[0].pfad.startsWith(vorlagenDok.id+'/'),'Pfad wie die Policy: Dokument, Person, Datei');
  // Zuschneiden: vergrößern und ziehen; die Seite zeigt den Ausschnitt.
  const feld=dlg.locator('.mm-ausschnitt');
  await feld.waitFor();
  // Die Vorschau hat das Seitenverhältnis des Fotos im PDF (auf dem Raster seit 26.11.2026 gleich wie auf der Bühne: 6 × 4 Felder).
  const verh=await page.evaluate(()=>{
    const d=document.querySelector('.mm-druck');d.style.display='block';
    const r=[...d.querySelectorAll('.mm-blatt .mm-typ-vergleich [data-mmfoto="A|0"]')][0].getBoundingClientRect();
    d.style.display='';
    const v=document.querySelector('#pdDialog .mm-ausschnitt').getBoundingClientRect(),b=document.querySelector('.mm-buehne [data-mmfoto="A|0"]').getBoundingClientRect();
    return {pdf:r.width/r.height,vorschau:v.width/v.height,buehne:b.width/b.height};
  });
  assert.ok(Math.abs(verh.vorschau/verh.pdf-1)<0.02,'wie im PDF: '+JSON.stringify(verh));
  assert.ok(Math.abs(verh.buehne/verh.pdf-1)<0.01,'die Bühne wie das PDF: '+JSON.stringify(verh));
  assert.ok(Math.abs(verh.pdf-188/124)<0.01,'6 × 4 Felder: '+JSON.stringify(verh));
  await dlg.locator('input[data-bd="zoom"]').evaluate(r=>{r.value='2';r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))});
  await gespeichert(page);
  const b=await dlg.locator('.mm-ausschnitt').boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  await page.mouse.move(b.x+b.width/2+b.width/4,b.y+b.height/2,{steps:4});await page.mouse.up();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  const a=e.daten.optionen[0].muster_fotos[0].ausschnitt;
  assert.equal(a.z,2);assert.ok(a.x<50&&a.x>30,'nach rechts gezogen: der Ausschnitt rückt nach links ('+a.x+')');assert.equal(a.y,50);
  assert.match(await page.locator('.mm-buehne [data-bildplatz="'+e.id+'|A|0"] img').getAttribute('style'),/transform:\s*scale\(2\)/);
  await foto(page,'mappe-bild-dialog');
  // Wieder ein Foto der Bibliothek: der Ausschnitt gehört zum Bild und fällt mit ihm weg.
  await dlg.locator('button[data-bd="bib"]').first().click();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  f=e.daten.optionen[0].muster_fotos;
  assert.equal(f.length,1);assert.equal(f[0].quelle,undefined);assert.match(f[0].pfad,/eiche\.jpg$/);assert.equal(f[0].ausschnitt,undefined);
  await dlg.locator('[data-bd="zu"]').last().click();
  await dlg.waitFor({state:'detached'}).catch(()=>{});
  // Materialseite: «+ Bild» fügt ein zweites hinzu; entfernen nimmt es wieder weg. Das Raster bleibt.
  await page.locator('button[data-act="mm-material"][data-o="A"]').click();
  await page.locator('.mm-seitenliste .active',{hasText:'Material'}).waitFor();
  await page.locator('[data-bildplatz="'+e.id+'|A|0"] button',{hasText:'+ Bild'}).click();
  await dlg.waitFor();
  assert.match(await dlg.locator('h2').innerText(),/Bild · Variante A, Bild 2/);
  await dlg.locator('input[data-bd="datei"]').setInputFiles({name:'Detail.png',mimeType:'image/png',buffer:PNG});
  await page.locator('.mm-buehne .mm-foto-klein img').waitFor();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.optionen[0].muster_fotos.length,2);
  await dlg.locator('button[data-bd="weg"]').click();
  await page.locator('.pd-meldung',{hasText:'Bild entfernt.'}).waitFor();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.optionen[0].muster_fotos.length,1);
  // Das letzte Bild entfernen: die Seite zeigt wieder das erste Foto der Bibliothek; das lässt sich ersetzen, nicht entfernen.
  await page.locator('[data-bildplatz="'+e.id+'|A|0"] button',{hasText:'Bild ändern'}).click();
  await dlg.locator('button[data-bd="weg"]').click();
  await page.locator('.pd-meldung',{hasText:'Bild entfernt. Die Seite zeigt wieder das erste Foto aus der Produktbibliothek.'}).waitFor();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.deepEqual(e.daten.optionen[0].muster_fotos,[]);
  assert.match(await page.locator('.mm-buehne [data-bildplatz="'+e.id+'|A|0"] img').getAttribute('data-pfad'),/eiche\.jpg$/);
  await page.locator('[data-bildplatz="'+e.id+'|A|0"] button',{hasText:'Bild ändern'}).click();
  await dlg.waitFor();
  assert.equal(await dlg.locator('button[data-bd="weg"]').count(),0);
  assert.match(await dlg.innerText(),/Das erste Foto aus der Produktbibliothek, solange kein anderes gewählt ist\./);
  await dlg.locator('[data-bd="zu"]').last().click();
  assert.equal(JSON.stringify((await db(page)).office_produkte),produktVorher,'die Produktbibliothek bleibt, wie sie ist');
  await foto(page,'mappe-bearbeiten');
  assert.deepEqual(fehler,[]);
});

// Etappe 2 (Gari, 26.11.2026): Rahmen Feld für Feld verschieben und in der Größe ändern (am Griff, an den Anfassern,
// ein Foto an sich selbst, mit den Pfeiltasten), Rückgängig und Wiederholen, Zuschneiden mit Doppelklick auf der Seite,
// Fotos aus der Bibliothek und vom Schreibtisch auf die Seite ziehen. Das Layout gilt auch im PDF.
test('Etappe 2: Rahmen auf dem Raster, Rückgängig, Zuschneiden auf der Seite, Fotos auf die Seite ziehen',async()=>{
  const {page,fehler}=await oeffne();
  const PID='22222222-2222-4222-8222-222222222222';
  let mappe=(await zeilen(page,'entscheidungsvorlagen')).find(v=>v.daten.form==='mustermappe');
  await page.goto(adresse('projektdokumente.html?projekt='+PID+'&vorlage='+mappe.id));
  await page.locator('h1',{hasText:'Mustermappe Bodenbeläge'}).waitFor();
  await seiteWaehlen(page,'B2 Holz – Eiche · Vergleich');
  let e=(await zeilen(page,'entscheidungsliste'))[0];
  const seiteId=await page.locator('.mm-buehne .mm-blatt').getAttribute('data-seite');
  const layout=async()=>{await gespeichert(page);mappe=(await zeilen(page,'entscheidungsvorlagen')).find(v=>v.id===mappe.id);return mappe.daten.seiten.find(x=>x.id===seiteId)?.layout};
  const proMm=()=>page.evaluate(()=>document.querySelector('.mm-buehne .mm-seite').getBoundingClientRect().width/420);
  const feld=32*await proMm();
  const foto1=page.locator('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-1"]');
  const geo=l=>l.getAttribute('data-mmr-g');
  assert.equal(await geo(foto1),'1,2,6,4','Vorlage: zwei Varianten, Foto 6 × 4');
  const knopf=page.locator('[data-act="mm-zurueck"]');
  assert.equal(await knopf.isDisabled(),true,'noch nichts rückgängig zu machen');
  // Unter dem Zeiger: Umriss und Griff mit dem Namen des Rahmens.
  await page.locator('.mm-buehne .mm-satz>.mm-r[data-mmr="kopf"]').hover();
  await page.locator('.mm-ebene .mm-rw-hover .mm-rw-griff',{hasText:'Kopf'}).waitFor();
  // Anklicken wählt: acht Anfasser, in der Leiste Name und Größe, rechts die Karte «Layout».
  await foto1.click({position:{x:20,y:20}});
  await page.locator('.mm-ebene .mm-rw-wahl .mm-rw-h').first().waitFor();
  assert.equal(await page.locator('.mm-ebene .mm-rw-wahl .mm-rw-h').count(),8);
  assert.equal(await page.locator('[data-mm-kontext]').innerText(),'Foto A · 6 × 4 Felder · 188 × 124 mm · 3:2');
  assert.match(await page.locator('.mm-layout-karte').innerText(),/Foto A · 6 × 4 Felder\s+188 × 124 mm · 3:2\s+Spalte 1–6, Zeile 2–5 · wie die Vorlage/);
  // Am unteren Anfasser eine Zeile tiefer ziehen: 6 × 5 Felder; die Felder erscheinen beim Ziehen.
  const s=await page.locator('.mm-ebene .mm-rw-wahl .mm-rw-h[data-h="s"]').boundingBox();
  await page.mouse.move(s.x+s.width/2,s.y+s.height/2);await page.mouse.down();
  await page.mouse.move(s.x+s.width/2,s.y+s.height/2+feld*0.6,{steps:4});
  assert.ok(await page.locator('.mm-buehne.zieht').count(),'beim Ziehen sind die Felder zu sehen');
  assert.match(await page.locator('.mm-ebene .mm-rw-mass').innerText(),/6 × 5 Felder · 188 × 156 mm/);
  await page.mouse.move(s.x+s.width/2,s.y+s.height/2+feld*1.1,{steps:3});await page.mouse.up();
  assert.deepEqual(await layout(),{'vergleich-2':{'foto-1':{c:1,r:2,w:6,h:5}}});
  assert.equal(await geo(foto1),'1,2,6,5');
  assert.match(await page.locator('.mm-layout-karte').innerText(),/angepasst \(Vorlage: 6 × 4 Felder\)[\s\S]*Überlappt Text A; Text liegt über Fotos\./);
  assert.match(await knopf.getAttribute('title'),/^Rückgängig: Rahmen «Foto A» in der Größe geändert \(Strg\+Z\)$/);
  // Das Foto selbst ziehen: eine Spalte nach rechts (rastet am nächsten Feld ein).
  const b=await foto1.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  await page.mouse.move(b.x+b.width/2+feld*0.8,b.y+b.height/2+feld*0.2,{steps:5});await page.mouse.up();
  assert.deepEqual((await layout())['vergleich-2']['foto-1'],{c:2,r:2,w:6,h:5});
  // Pfeiltasten: ein Feld weiter, mit Umschalt kleiner; mehrere Tasten kurz hintereinander sind ein Schritt.
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>document.querySelector('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-1"]')?.dataset.mmrG==='1,2,6,5');
  await page.keyboard.press('Shift+ArrowLeft');await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForFunction(()=>document.querySelector('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-1"]')?.dataset.mmrG==='1,2,4,5');
  assert.deepEqual((await layout())['vergleich-2']['foto-1'],{c:1,r:2,w:4,h:5});
  // Im PDF steht das Foto, wo es auf der Seite steht.
  assert.match(await page.locator('.mm-druck .mm-blatt[data-seite="'+seiteId+'"] .mm-r-foto').first().getAttribute('style'),/grid-column:1 \/ span 4;grid-row:2 \/ span 5/);
  // Rückgängig (Strg+Z): die beiden Größen-Schritte als einer, dann die Taste, das Ziehen, der Anfasser; Wiederholen (Strg+Y).
  await page.keyboard.press('Control+z');
  await page.waitForFunction(()=>document.querySelector('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-1"]')?.dataset.mmrG==='1,2,6,5');
  await page.locator('.pd-meldung',{hasText:'Rückgängig: Rahmen «Foto A» in der Größe geändert.'}).waitFor();
  await page.keyboard.press('Control+z');await page.keyboard.press('Control+z');
  await page.waitForFunction(()=>document.querySelector('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-1"]')?.dataset.mmrG==='1,2,6,5');
  await knopf.click();
  await page.waitForFunction(()=>document.querySelector('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-1"]')?.dataset.mmrG==='1,2,6,4');
  assert.equal(await layout(),undefined,'wieder wie die Vorlage: kein Layout gespeichert');
  assert.equal(await knopf.isDisabled(),true);
  await page.keyboard.press('Control+y');
  await page.waitForFunction(()=>document.querySelector('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-1"]')?.dataset.mmrG==='1,2,6,5');
  assert.deepEqual(await layout(),{'vergleich-2':{'foto-1':{c:1,r:2,w:6,h:5}}});
  // Am Griff verschieben: der Kopf eine Zeile tiefer, dann «Wie die Vorlage» und rückgängig.
  await page.locator('.mm-buehne .mm-satz>.mm-r[data-mmr="kopf"]').hover();
  const g=await page.locator('.mm-ebene .mm-rw-hover .mm-rw-griff').boundingBox();
  await page.mouse.move(g.x+10,g.y+g.height/2);await page.mouse.down();
  await page.mouse.move(g.x+10,g.y+g.height/2+feld,{steps:4});await page.mouse.up();
  assert.deepEqual((await layout())['vergleich-2'].kopf,{c:1,r:2,w:6,h:1});
  await page.locator('.mm-layout-karte button[data-act="mm-rahmen-vorlage"]').click();
  await page.waitForFunction(()=>document.querySelector('.mm-buehne .mm-satz>.mm-r[data-mmr="kopf"]')?.dataset.mmrG==='1,1,6,1');
  assert.equal((await layout())['vergleich-2'].kopf,undefined);
  // Ausblenden und wieder einblenden (rechts unter «Layout»).
  await page.locator('.mm-buehne .mm-satz>.mm-r[data-mmr="zonen"]').click();
  await page.locator('.mm-layout-karte button[data-act="mm-rahmen-aus"]').click();
  await page.locator('.mm-layout-karte button',{hasText:'Zonen einblenden'}).waitFor();
  assert.equal(await page.locator('.mm-buehne [data-mmr="zonen"]').count(),0);
  assert.deepEqual((await layout())['vergleich-2'].zonen,{aus:true});
  assert.doesNotMatch(await page.locator('.mm-druck .mm-blatt[data-seite="'+seiteId+'"]').innerHTML(),/Ausstellung 537/,'ausgeblendet auch im PDF');
  await page.locator('.mm-layout-karte button',{hasText:'Zonen einblenden'}).click();
  await page.locator('.mm-buehne [data-mmr="zonen"]').waitFor();
  // Ein Text ist nach dem Verlassen ein Schritt im Verlauf.
  const frage=page.locator('#mm-'+e.id+'-frage'),vorherFrage=await frage.innerText();
  await frage.fill('Welcher Belag oben?');
  // Beim Schreiben: Umriss und Griff, keine Anfasser (am Rand beginnt der Text); Esc verlässt den Text, der Rahmen bleibt.
  await page.locator('.mm-ebene .mm-rw-wahl .mm-rw-griff',{hasText:'Kopf'}).waitFor();
  assert.equal(await page.locator('.mm-ebene .mm-rw-wahl .mm-rw-h').count(),0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelectorAll('.mm-ebene .mm-rw-wahl .mm-rw-h').length===8);
  assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'mm-'+e.id+'-frage');
  await page.locator('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-2"]').click();
  await gespeichert(page);
  assert.equal((await zeilen(page,'entscheidungsliste'))[0].daten.frage,'Welcher Belag oben?');
  assert.match(await knopf.getAttribute('title'),/Rückgängig: Text in «Kopf»/);
  await page.keyboard.press('Control+z');
  await page.waitForFunction(([id,t])=>document.getElementById('mm-'+id+'-frage')?.innerText===t,[e.id,vorherFrage]);
  await gespeichert(page);
  assert.equal((await zeilen(page,'entscheidungsliste'))[0].daten.frage,vorherFrage);
  await foto(page,'mappe-etappe2-rahmen');
  // Zuschneiden: Doppelklick auf das Foto; ringsum das ganze Bild hell, in der Leiste die Regler.
  e=(await zeilen(page,'entscheidungsliste'))[0];
  const fotosVorher=e.daten.optionen[0].muster_fotos;
  const platz=page.locator('.mm-buehne [data-bildplatz="'+e.id+'|A|0"]');
  const vorDoppel=await platz.boundingBox();
  await platz.locator('img').dblclick();
  await page.locator('[data-mm-zs] .mm-zs-leiste').waitFor();
  assert.deepEqual(await platz.boundingBox(),vorDoppel,'die Seite bleibt beim Zuschneiden, wo sie ist (die Leiste schwebt)');
  await page.waitForFunction(()=>{const g=document.querySelector('.mm-ebene .mm-zs-geist');return g&&parseFloat(g.style.width)>0});
  await page.locator('[data-act="mm-zs-zoom"]').evaluate(r=>{r.value='2';r.dispatchEvent(new Event('input',{bubbles:true}))});
  assert.match(await platz.locator('img').getAttribute('style'),/scale\(2\)/);
  const pb=await platz.boundingBox();
  await page.mouse.move(pb.x+pb.width/2,pb.y+pb.height/2);await page.mouse.down();
  await page.mouse.move(pb.x+pb.width/2+pb.width/8,pb.y+pb.height/2,{steps:4});await page.mouse.up();
  await foto(page,'mappe-etappe2-zuschneiden');
  await page.keyboard.press('Enter');
  await page.locator('.pd-meldung',{hasText:'Ausschnitt übernommen'}).waitFor();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  const a=e.daten.optionen[0].muster_fotos[0].ausschnitt;
  assert.equal(a.z,2);assert.ok(a.x<50&&a.x>0,'nach rechts gezogen: der Punkt rückt nach links ('+a.x+')');assert.equal(a.y,50);
  assert.equal(await page.locator('[data-mm-zs] .mm-zs-leiste').count(),0,'die Leiste zum Zuschneiden ist wieder weg');
  // Esc bricht ab: nichts geändert.
  await platz.locator('img').dblclick();
  await page.locator('[data-mm-zs] .mm-zs-leiste').waitFor();
  await page.mouse.move(pb.x+pb.width/2,pb.y+pb.height/2);await page.mouse.down();
  await page.mouse.move(pb.x+pb.width/2-pb.width/6,pb.y+pb.height/2,{steps:3});await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('[data-mm-zs] .mm-zs-leiste'));
  await gespeichert(page);
  assert.deepEqual((await zeilen(page,'entscheidungsliste'))[0].daten.optionen[0].muster_fotos[0].ausschnitt,a);
  // Rückgängig nimmt den Ausschnitt zurück.
  await page.keyboard.press('Control+z');
  await gespeichert(page);
  assert.deepEqual((await zeilen(page,'entscheidungsliste'))[0].daten.optionen[0].muster_fotos,fotosVorher);
  // Materialseite: ein eigenes Bild vom Schreibtisch auf das große Foto, dann ein Foto der Bibliothek auf den Platz für
  // Bild 2 (erscheint beim Ziehen). Die Bibliothek bleibt, wie sie ist.
  const produktVorher=JSON.stringify((await db(page)).office_produkte);
  await page.locator('button[data-act="mm-material"][data-o="A"]').click();
  await page.locator('.mm-seitenliste .active',{hasText:'Material'}).waitFor();
  const datei=async(sel,name)=>page.evaluate(async([sel,name,b64])=>{
    const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),dt=new DataTransfer();
    dt.items.add(new File([bytes],name,{type:'image/png'}));
    const el=document.querySelector(sel);
    el.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  },[sel,name,PNG.toString('base64')]);
  await datei('.mm-buehne [data-bildplatz="'+e.id+'|A|0"]','Probe Eiche.png');
  await page.locator('.pd-meldung',{hasText:'Das Bild steht auf der Seite; es bleibt in dieser Mappe.'}).waitFor();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.deepEqual(e.daten.optionen[0].muster_fotos.map(f=>(f.quelle||'bibliothek')+':'+(f.name||'')),['mappe:Probe Eiche.png']);
  const ziel='.mm-buehne [data-bildplatz="'+e.id+'|A|1"]';
  assert.equal(await page.locator(ziel).isVisible(),false,'der Platz für Bild 2 nur beim Ziehen');
  await page.evaluate(([zid,ziel])=>{
    const t=document.querySelector('.mm-thumb[data-act="mm-foto"][data-z="'+zid+'"][data-o="A"]'),dt=new DataTransfer();
    t.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));
    window.__sichtbar=getComputedStyle(document.querySelector(ziel).closest('.mm-r')).display;
    const el=document.querySelector(ziel);
    el.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
    t.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));
  },[e.id,ziel]);
  assert.equal(await page.evaluate(()=>window.__sichtbar),'block','beim Ziehen ist der Platz für Bild 2 zu sehen');
  await page.locator('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-2"] img').waitFor();
  await gespeichert(page);
  e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.deepEqual(e.daten.optionen[0].muster_fotos.map(f=>f.quelle||f.pfad.split('/').pop()),['mappe','eiche.jpg']);
  assert.equal(await page.locator('.mm-buehne .mm-ablage-ziel').count(),0,'nach dem Ablegen keine Markierung mehr');
  await foto(page,'mappe-etappe2-material');
  // Rückgängig und Wiederholen auch hier.
  await page.keyboard.press('Control+z');
  await page.waitForFunction(()=>!document.querySelector('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-2"]'));
  await page.keyboard.press('Control+Shift+z');
  await page.locator('.mm-buehne .mm-satz>.mm-r[data-mmr="foto-2"] img').waitFor();
  await gespeichert(page);
  assert.equal((await zeilen(page,'entscheidungsliste'))[0].daten.optionen[0].muster_fotos.length,2);
  // Eine Datei neben die Fotos: nichts passiert, der Browser öffnet sie nicht.
  await datei('.mm-buehne .mm-satz>.mm-r[data-mmr="kopf"]','daneben.png');
  await page.locator('.pd-meldung',{hasText:'Zum Ablegen auf ein Foto der Seite ziehen'}).waitFor();
  assert.equal(JSON.stringify((await db(page)).office_produkte),produktVorher,'die Produktbibliothek bleibt, wie sie ist');
  assert.deepEqual(fehler,[]);
});
