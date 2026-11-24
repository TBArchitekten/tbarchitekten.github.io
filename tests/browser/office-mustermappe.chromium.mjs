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
try{pdfjsOrdner=path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/build/pdf.min.mjs'))}catch{}
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
    await page.route(/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@[^/]+\/build\/(pdf(\.worker)?\.min\.mjs)/,async r=>{
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
  await page.goto(adresse('projektdokumente.html'));
  await page.locator('a.pd-wahl-projekt',{hasText:'Testhaus'}).click();
  const karte=page.locator('.pd-karte',{hasText:'Mustermappen'});
  await karte.waitFor();
  assert.match(await karte.innerText(),/L3\.MAP\.1/);
  await karte.locator('button',{hasText:'Neue Mustermappe'}).click();
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
  assert.match(await buehne.innerText(),/A · Parkett Eiche geölt/);assert.match(await buehne.innerText(),/massiv 16 mm/);
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
  assert.ok(await page.locator('.mm-buehne img.mm-foto-gross').count(),'großes Foto auf der Materialseite');
  await page.locator('textarea[data-mmopt="'+e.id+'|A"]').fill('Eiche natur, geölt; Muster liegt vor.');
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
  assert.doesNotMatch(await page.locator('.mm-buehne').innerText(),/R9/,'die Seite bleibt beim übernommenen Stand');
  await hinweis.locator('button',{hasText:'Übernehmen'}).click();
  await page.locator('.mm-buehne',{hasText:'R9'}).waitFor();
  await gespeichert(page);
  const e=(await zeilen(page,'entscheidungsliste'))[0];
  assert.equal(e.daten.optionen[0].muster_produkt.stand,'2026-11-24T09:00:00.000Z');
  // PDF: A3 quer, alle Seiten, Beleg ja, Fundstelle nein, keine Eingabefelder, keine Unterschrift.
  await page.evaluate(()=>{window.__gedruckt=null;window.print=()=>{window.__gedruckt={html:document.querySelector('.mm-druck').innerHTML,
    klasse:document.documentElement.className,stil:[...document.querySelectorAll('style')].map(s=>s.textContent).join('\n')}}});
  await page.locator('button[data-act="mm-pdf"]').click();
  await page.waitForFunction(()=>window.__gedruckt);
  const g=await page.evaluate(()=>window.__gedruckt);
  assert.match(g.stil,/@page\{size:A3 landscape;margin:0\}/);assert.match(g.klasse,/mm-drucken/);
  assert.equal((g.html.match(/class="mm-blatt"/g)||[]).length,4);
  assert.match(g.html,/Angebot 2025, fortgeschrieben/);assert.match(g.html,/189,69 €\/m²/);
  assert.doesNotMatch(g.html,/T-90|Altbau|Zeile 12/);assert.doesNotMatch(g.html,/<textarea/);assert.doesNotMatch(g.html,/Unterschrift/);
  assert.match(g.html,/<img class="mm-foto/);
  if(FOTOS){
    // Nur zum Ansehen: das PDF so, wie der Druck es setzt (A3 quer).
    await page.pdf({path:path.join(FOTOS,'mappe-druck.pdf'),preferCSSPageSize:true,printBackground:true});
  }
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
  await page.locator('.pd-meldung',{hasText:'Das Bild steht auf der Seite.'}).waitFor({timeout:20000});
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
  // Übersicht: eigene Karte, nicht unter den Entscheidungsvorlagen.
  await page.locator('a.pd-back',{hasText:'Projektstart'}).click();
  const karte=page.locator('.pd-karte',{hasText:'Mustermappen'});
  await karte.waitFor();
  assert.match(await karte.innerText(),/Mustermappe Bodenbeläge · 1 Position · vorgelegt am/);
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
