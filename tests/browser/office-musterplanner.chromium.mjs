// Render the actual Office LPH3 Musterplanner in Chromium (no Supabase, no project writes).
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const url=decodeURIComponent((req.url||'').split('?')[0]);
 const file=path.join(root,url);
 if(!file.startsWith(root)){res.writeHead(403);res.end();return}
 fs.readFile(file,(error,buf)=>{
  if(error){res.writeHead(404);res.end();return}
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});
  res.end(buf);
 });
}).listen(0);
const browser=await chromium.launch({headless:true});
test.after(async()=>{await browser.close();server.close()});
const URL_BASE=()=>`http://localhost:${server.address().port}/muster-planner.html`;
test('Eight buckets, 57 real cards and 228 checklist points render without JavaScript errors',async()=>{
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(URL_BASE());
  await page.locator('[data-task="L3-BEM-09"]').waitFor({state:'attached'});
  assert.equal(await page.locator('.bucket').count(),8);
  assert.equal(await page.locator('[data-task]').count(),57);
  assert.match(await page.locator('#stats').innerText(),/228/);
  await page.locator('[data-task="L3-BEM-09"]').click();
  assert.equal(await page.locator('#detail').evaluate(e=>e.open),true);
  assert.match(await page.locator('#detailTitle').innerText(),/Bäderpläne/);
  assert.match(await page.locator('#detailChecks').innerText(),/Wandansichten/);
  assert.match(await page.locator('#detailBasis').innerText(),/LPH5|LPH3|Entwurfs/);
  await page.locator('[data-review="change"]').click();
  await page.locator('#detailNote').fill('Bäder-Anwendbarkeit und Maßstab projektbezogen überprüfen');
  await page.locator('#closeDetail').click();
  await page.reload();await page.locator('[data-task="L3-BEM-09"]').waitFor();
  await page.locator('[data-task="L3-BEM-09"]').click();
  assert.match(await page.locator('#detailNote').inputValue(),/projektbezogen/);
  assert.equal(await page.locator('[data-review="change"]').getAttribute('aria-pressed'),'true');
  await page.locator('#closeDetail').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#export').click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/Musterplanner-Review/);
  assert.deepEqual(errors,[]);
 }finally{await page.close()}
});
test('Narrow mobile board remains readable; conditional filter does not fabricate work',async()=>{
 const page=await browser.newPage({viewport:{width:390,height:760}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(URL_BASE());await page.locator('.bucket').first().waitFor();
  await page.locator('#scope').selectOption('conditional');
  assert.ok(await page.locator('[data-task]').count()>0);
  assert.ok(await page.locator('[data-task]').count()<57);
  await page.locator('#search').fill('Mustermappe');
  assert.equal(await page.locator('[data-task="L3-BEM-12"]').count(),1);
  await page.locator('[data-task="L3-BEM-12"]').click();
  const box=await page.locator('#detail').boundingBox();
  assert.ok(box&&box.width<=390,'dialog stays inside mobile viewport');
  assert.deepEqual(errors,[]);
 }finally{await page.close()}
});
