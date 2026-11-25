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
    await f.locator('h1',{hasText:'Mustermappe Bäder'}).waitFor();
    const url=new URL(rahmen().url());
    assert.equal(url.searchParams.get('projekt'),PID);assert.ok(url.searchParams.get('vorlage'),'die Mappe steht in der Adresse');
    assert.deepEqual(await page.evaluate(()=>window.__nachrichten),[{tbaOfficeTool:'abgebrochen'}],'Anlegen ist kein Abbruch');
    // Kein Rücksprung und keine zweite Projektzeile; die Überschrift der Mappe bleibt.
    assert.deepEqual(await f.locator('.pd-mappe-wrap').evaluate(w=>[getComputedStyle(w.querySelector(':scope>.pd-back')).display,
      getComputedStyle(w.querySelector('.pd-head .kicker')).display,getComputedStyle(w.querySelector('.pd-head h1')).display]),['none','none','block']);
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
