// Leitfaden «Was darf auf den Desktop?» mit «Gelesen» (Gari, 25.11.2026), im echten Chromium mit einem erfundenen
// Supabase: freigeschaltet und noch nicht bestätigt öffnet das Office ihn einmal, «Weiter» erst nach «Gelesen»,
// Escape schließt ihn nicht, die Bestätigung trägt nur Person, Leitfaden und Stand; bestätigt, ausgeschaltet oder mit
// unbekanntem Stand bleibt er zu; zum Nachlesen öffnet er mit «Schließen»; am Telefon über die ganze Fläche.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const fake=fs.readFileSync(new URL('./fixtures/fake-supabase.js',import.meta.url),'utf8');
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
const UID='11111111-1111-4111-8111-111111111111';

async function boot(extra,viewport={width:1400,height:900}){
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co|fonts\.(googleapis|gstatic)/,r=>r.abort());
  await page.addInitScript(rows=>{window.__fakeRows=rows},extra);
  await page.goto(`http://localhost:${server.address().port}/app/`);
  await page.waitForFunction(()=>/Synchronisiert/.test(document.getElementById('syncStatus')?.textContent||''),null,{timeout:10000});
  await page.waitForTimeout(300);
  return {page,errors};
}
const aktiv={office_leitfaeden:[{version:'2026-11-26',aktiv:true}]};

test('Freigeschaltet und nicht bestätigt: einmal lesen, «Gelesen», «Weiter»; Escape schließt nicht',async()=>{
  const {page,errors}=await boot(aktiv);
  try{
    const d=page.locator('dialog#officeLeitfaden[open]');
    await d.waitFor();
    assert.equal(await d.getAttribute('data-pflicht'),'1');
    assert.equal((await d.locator('h2').textContent()).trim(),'Was darf ins TBA Office?');
    for(const h of ['Grün: hochladen','Gelb: nur das Nötige, vorher prüfen','Rot: nicht hochladen'])
      assert.equal(await d.locator('h3',{hasText:h}).count(),1,h);
    assert.equal(await d.locator('[data-leitfaden-schliessen]').count(),0,'kein Schließen ohne Bestätigung');
    const weiter=d.locator('[data-leitfaden-weiter]');
    assert.equal(await weiter.isDisabled(),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog#officeLeitfaden[open]').count(),1,'Escape schließt nicht');
    await d.locator('[data-leitfaden-gelesen]').check();
    assert.equal(await weiter.isDisabled(),false);
    await weiter.click();
    await page.locator('dialog#officeLeitfaden').waitFor({state:'detached'});
    const writes=await page.evaluate(()=>window.__writes.filter(w=>w.table==='office_leitfaden_bestaetigungen'));
    assert.deepEqual(writes,[{table:'office_leitfaden_bestaetigungen',op:'insert',value:{user_id:'11111111-1111-4111-8111-111111111111',leitfaden:'desktop',version:'2026-11-26'}}]);
    assert.equal(await page.evaluate(()=>window.TBA_OFFICE_LEITFADEN.verfuegbar()),true);
    // Zum Nachlesen (wie aus dem Desktop): mit «Schließen» und dem Tag der Bestätigung.
    await page.evaluate(()=>window.TBA_OFFICE_LEITFADEN.oeffnen());
    const lesen=page.locator('dialog#officeLeitfaden[open]');
    await lesen.waitFor();
    assert.equal(await lesen.getAttribute('data-pflicht'),'0');
    assert.match(await lesen.locator('.office-leitfaden-hinweis').textContent(),/^Gelesen am \d{2}\.\d{2}\.\d{4}\.$/);
    await lesen.locator('footer [data-leitfaden-schliessen]').click();
    await page.locator('dialog#officeLeitfaden').waitFor({state:'detached'});
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

for(const [fall,rows] of [
  ['schon bestätigt',{...aktiv,office_leitfaden_bestaetigungen:[{bestaetigt_am:'2026-11-26T08:00:00Z'}]}],
  ['ausgeschaltet',{office_leitfaeden:[{version:'2026-11-26',aktiv:false}]}],
  ['unbekannter Stand',{office_leitfaeden:[{version:'2099-01-01',aktiv:true}]}],
  ['ohne Tabelle',{}]]){
  test(`Bleibt zu: ${fall}`,async()=>{
    const {page,errors}=await boot(rows);
    try{
      assert.equal(await page.locator('dialog#officeLeitfaden').count(),0);
      assert.equal(await page.evaluate(()=>window.__writes.some(w=>w.table==='office_leitfaden_bestaetigungen')),false);
      const verfuegbar=await page.evaluate(()=>window.TBA_OFFICE_LEITFADEN.verfuegbar());
      assert.equal(verfuegbar,fall==='schon bestätigt');
      assert.deepEqual(errors,[]);
    }finally{await page.close()}
  });
}

test('Am Telefon über die ganze Fläche, Tabellen als Karten, «Weiter» erreichbar',async()=>{
  const {page,errors}=await boot(aktiv,{width:390,height:844});
  try{
    const d=page.locator('dialog#officeLeitfaden[open]');
    await d.waitFor();
    const box=await d.boundingBox();
    assert.ok(Math.abs(box.width-390)<=1&&Math.abs(box.height-844)<=1,'ganze Fläche: '+JSON.stringify(box));
    const kopf=await d.locator('thead').first().evaluate(e=>getComputedStyle(e).display);
    assert.equal(kopf,'none');
    const fuss=await d.locator('[data-leitfaden-weiter]').boundingBox();
    assert.ok(fuss.y+fuss.height<=844,'«Weiter» sichtbar');
    if(process.env.LEITFADEN_SHOT)await page.screenshot({path:process.env.LEITFADEN_SHOT});
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});
