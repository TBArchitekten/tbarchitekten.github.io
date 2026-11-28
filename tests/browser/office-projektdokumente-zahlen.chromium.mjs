// Projektstart · Zahlen der Varianten im echten Chromium mit synthetischem Supabase (24.11.2026). Kein Netz, keine Produktion.
// Ablauf wie im Büro: Entscheidung mit zwei Varianten → «Zahlen aus dem Office»: Produkt aus der Produktbibliothek, Preis als
// Kennwert (mit Baupreisindex fortgeschrieben), Menge aus der Kostenberechnung des Projekts, Musterliste → Romy «Zahlen holen»
// für B (nur echte Verweise gelten) → Vorlage mit Mehrkosten, Datenblatt am Bildschirm, im Dokument nur Belege → entschieden →
// in der Produktbibliothek freigeben. Die Kostenberechnungen werden nur gelesen.
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
test.after(async()=>{await browser.close();server.close()});
const FOTOS=process.env.DOKUMENTE_FOTOS||'';
const foto=async(page,name)=>{if(FOTOS)await page.screenshot({path:path.join(FOTOS,name+'.png'),fullPage:true})};
const adresse=p=>`http://localhost:${server.address().port}/${p}`;
const PID='22222222-2222-4222-8222-222222222222';
const gespeichert=page=>page.waitForFunction(()=>document.querySelector('[data-speicher]')?.textContent==='gespeichert');
const zeile=async page=>{const d=await page.evaluate(()=>window.__fake.db);const dok=d.office_projektdokumente.find(x=>x.art==='entscheidungsliste');
  return d.office_projektdokument_zeilen.find(z=>z.dokument_id===dok.id)};

test('Zahlen aus dem Office, Romy «Zahlen holen», Vorlage mit Belegen und Freigabe in der Produktbibliothek',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await ctx.newPage();
  const fehler=[];page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co/,r=>r.abort());
  try{
    // Eine Entscheidung mit zwei Varianten.
    await page.goto(adresse('projektdokumente.html?projekt='+PID+'&liste=entscheidungsliste'));
    await page.locator('h1',{hasText:'Entscheidungsliste'}).waitFor();
    await page.locator('[data-neu]').fill('Bodenbelag Wohnräume');
    await page.locator('[data-neu]').press('Enter');
    await page.locator('[data-edit]').first().waitFor();
    await page.keyboard.press('Escape');
    await page.locator('td[data-k="nr"]').first().click();
    await page.locator('.pd-detail').waitFor();
    await page.locator('#o-0-text').fill('Parkett Eiche, geölt');
    await page.locator('#o-1-text').fill('Naturstein Platten');
    await page.locator('#o-1-text').press('Tab');
    await gespeichert(page);

    // A: Produkt, Preis als Kennwert (fortgeschrieben), Menge aus der Kostenberechnung, Musterliste.
    await page.locator('[data-act="zahlen"][data-i="0"]').click();
    const dlg=page.locator('dialog[open]');
    await dlg.locator('h2',{hasText:'Zahlen für Variante A'}).waitFor();
    await dlg.locator('.pd-zliste li',{hasText:'Parkett Eiche geölt'}).first().waitFor();
    await dlg.locator('.pd-zliste li',{hasText:'Parkett Eiche geölt'}).locator('[data-z-act="produkt"]').first().click();
    await dlg.locator('.pd-zwahl',{hasText:'Datenblatt geprüft'}).waitFor();
    const preis=dlg.locator('.pd-zliste li',{hasText:'Angebot eingebaut'});
    assert.match(await preis.innerText(),/189,69 €\/m²/,'185 € von 11/2025 auf 4. Quartal 2026 fortgeschrieben');
    assert.match(await dlg.locator('.pd-zliste li',{hasText:'Listenpreis Material'}).innerText(),/Materialpreis/,'ein Listenpreis ist kein eingebauter Preis');
    await preis.locator('[data-z-act="preis"]').click();
    await dlg.locator('.pd-zliste li',{hasText:'Parkett Wohnräume'}).locator('[data-z-act="menge"]').click();
    await dlg.locator('.pd-zwahl',{hasText:'39.834,90 €'}).waitFor();
    assert.match(await dlg.locator('.pd-zwahl').innerText(),/Kostenberechnung T-01, KG 352, Parkett Wohnräume, Archicad/);
    assert.match(await dlg.locator('section',{hasText:'Kennwert aus dem Datenpool'}).innerText(),/214,52 €\/m²/,'Datenpool: 180 € von 2022 fortgeschrieben');
    await dlg.locator('[data-z-act="muster"]').click();
    await dlg.locator('.pd-zwahl',{hasText:'BO-01 · Parkett Eiche geölt · Holz AG'}).waitFor();
    await foto(page,'z1-zahlen-dialog');
    await dlg.locator('[data-dlg="zu"]').click();
    await gespeichert(page);
    let z=await zeile(page);
    const a=z.daten.optionen.find(o=>o.id==='A');
    assert.deepEqual([a.produkt,a.kennwert,a.menge,a.betrag,a.kobe_ref],['BO-01 · Parkett Eiche geölt · Holz AG','189,69 €/m²','210 m²','','66666666-6666-4666-8666-6666666666a1:a']);
    assert.equal(a.kennwert_beleg,'Angebot eingebaut, Stand 11/2025, fortgeschrieben auf 4. Quartal 2026');
    assert.match(a.kennwert_quelle,/T-90 Altbau/,'die Fundstelle für das Büro nennt die Herkunft');
    assert.equal(z.daten.kostenbezug,'Kostenstand 4. Quartal 2026','beim ersten Kennwert vorgeschlagen');
    const verw=await page.evaluate(()=>window.__fake.db.office_produkt_verwendungen);
    assert.deepEqual(verw.map(v=>[v.code,v.status,v.projekt_id]),[['BO-01','vorgeschlagen',PID]]);
    assert.match(await page.locator('.pd-detail .pd-herkunft').first().innerText(),/Datenblatt geprüft/);

    // B: Romy holt Zahlen; nur echte Verweise gelten, nichts ändert sich vor «Übernehmen».
    await page.locator('[data-act="romy-zahlen"]').click();
    await page.locator('.pd-meldung',{hasText:'Die KI schlägt Zahlen für 1 Variante vor'}).waitFor();
    const anfrage=(await page.evaluate(()=>window.__fake.anfragen)).find(x=>x.body.action==='zahlen');
    assert.equal(anfrage.body.kostenstand,'2026-Q4');
    assert.ok(anfrage.body.kandidaten.pool.some(x=>/Naturstein/.test(x.bezeichnung))&&anfrage.body.kandidaten.kobe.length>0);
    assert.ok(!JSON.stringify(anfrage.body.kandidaten).includes('Altbau'),'an Romy gehen keine Namen anderer Projekte');
    const vs=(await page.evaluate(()=>window.__fake.db.office_projektdokument_vorschlaege)).filter(v=>v.status==='offen');
    assert.equal(vs.length,1);
    assert.deepEqual(vs[0].daten.optionen.map(o=>o.id),['B'],'der erfundene Verweis für A fällt weg');
    z=await zeile(page);
    assert.equal(z.daten.optionen.find(o=>o.id==='B').kennwert||'','','vor «Übernehmen» unverändert');
    await page.locator('[data-act="detail-zu"]').click();
    await page.locator('.pd-vs-aenderung',{hasText:'B: Kennwert – → 238,35 €/m², Menge – → 210 m²'}).waitFor();
    await page.locator('.pd-vs-aenderung [data-act="vs-ja"]').click();
    await page.locator('.pd-meldung',{hasText:'Übernommen.'}).waitFor();
    z=await zeile(page);
    const b=z.daten.optionen.find(o=>o.id==='B');
    assert.deepEqual([b.text,b.kennwert,b.menge],['Naturstein Platten','238,35 €/m²','210 m²']);
    assert.equal(z.daten.optionen.find(o=>o.id==='A').kennwert,'189,69 €/m²','die Zahlen von A bleiben');
    assert.match(b.kennwert_beleg,/^Kennwert aus Kostenberechnungen des Büros/);

    // Vorlage: Mehrkosten, Datenblatt am Bildschirm, im Dokument nur Belege.
    await page.locator('[data-act="vorlage-anlegen"]').first().click();
    await page.locator('h1',{hasText:'Entscheidungsvorlage 01'}).waitFor();
    await page.locator('#v-'+z.id+'-empfehlung').selectOption('A');
    await page.locator('h1').click();
    await gespeichert(page);
    const papier=page.locator('.pd-papier');
    await papier.locator('text=Mehrkosten B gegenüber A: 10.218,60 € netto (12.160,13 € brutto), Kostenstand 4. Quartal 2026.').waitFor();
    await papier.locator('.dv-tabelle .chip',{hasText:'Datenblatt geprüft'}).waitFor();
    const druck=await page.locator('.pd-druck').innerText();
    assert.match(druck,/Quellen: A: Kennwert: Angebot eingebaut, Stand 11\/2025, fortgeschrieben auf 4\. Quartal 2026; Menge: Kostenberechnung, KG 352/);
    assert.doesNotMatch(druck,/Altbau|Musterhof|T-90|T-91|Schreinerei|Datenblatt/,'das Dokument nennt keine anderen Projekte und keinen internen Stand');
    assert.match(await page.locator('.pd-quellen').innerText(),/Datenpool: 200,00 €\/m²/,'die Fundstellen stehen in der Seitenleiste');
    await foto(page,'z2-vorlage');

    // Entschieden → in der Produktbibliothek freigeben.
    await page.locator('[data-act="punkt-details"]').first().click();
    await page.locator('.pd-detail [data-act="entscheiden"]').click();
    await page.locator('dialog[open] [data-wahl]').first().click();
    await page.locator('dialog input[name="wer"]').fill('Auftraggeber, Besprechung M04');
    await page.locator('dialog button[type="submit"]').click();
    await page.locator('.pd-detail [data-act="freigeben"]').click();
    await page.locator('dialog[open] h2',{hasText:'In der Produktbibliothek freigeben'}).waitFor();
    assert.equal(await page.locator('dialog select[name="wahl"]').inputValue(),'A','die gewählte Variante aus der Entscheidung');
    await page.locator('dialog button[type="submit"]').click();
    await page.locator('.pd-meldung',{hasText:'In der Produktbibliothek freigegeben.'}).waitFor();
    const nachher=await page.evaluate(()=>window.__fake.db.office_produkt_verwendungen);
    assert.deepEqual(nachher.map(v=>[v.code,v.status]),[['BO-01','freigegeben']]);
    const aufrufe=await page.evaluate(()=>window.__fake.aufrufe);
    assert.ok(!aufrufe.some(x=>/^office_kosten_/.test(x.table)&&x.op!=='select'),'Kostenberechnungen werden nur gelesen');
    assert.ok(!aufrufe.some(x=>x.table==='office_produkte'&&x.op!=='select'),'Produkte werden nicht verändert');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});
