// Chromium acceptance: canonical Work Planner and native task editor render the
// LPH3 Muster read-only. No duplicate UI and absolutely no Supabase data writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const harness=String.raw`<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="./work-apple.css">
<link rel="stylesheet" href="./work-polish.css">
<link rel="stylesheet" href="./work-buckets.css">
<link rel="stylesheet" href="./task-detail.css">
<link rel="stylesheet" href="./task-team.css">
<style>body{margin:0;background:#fff;font:13px system-ui}#workBody{height:calc(100vh - 86px)}
#modalRoot{position:fixed;inset:8% 10%;overflow:auto;background:#fff;border:1px solid #ddd;border-radius:14px;box-shadow:0 0 0 100vmax #0005;z-index:100;padding:20px}#modalRoot[hidden]{display:none}
@media(max-width:600px){#modalRoot{inset:12px;padding:14px}}</style>
</head><body data-section="work" class="office-app">
<div class="work-project-switch"></div><div id="workProjectTitle"></div>
<nav><button data-work-view="planner">Planner</button><button data-work-view="overview">Panorama</button></nav>
<div id="workStatus"></div><div id="workBody"></div>
<div id="modalRoot" hidden></div>
<script>
window.TBA_OFFICE_CONFIG={};
window.__dbWrites=[];
window.MINDS_SUPABASE={auth:{getSession:async()=>({data:{session:{user:{id:'test-person'}}}})},
  from:table=>{window.__dbWrites.push('from '+table);throw Error('Muster unexpectedly queried '+table)},
  rpc:name=>{window.__dbWrites.push('rpc '+name);throw Error('Muster unexpectedly called '+name)}};
window.ISABELLA_APP={getState:()=>({}),openModal:(title,html)=>{
 const e=document.getElementById('modalRoot');e.hidden=false;
 e.innerHTML='<button type="button" id="testClose">×</button><h1>'+title+'</h1>'+html;
 document.getElementById('testClose').onclick=()=>{e.hidden=true;e.innerHTML=''};
},closeModal:()=>{const e=document.getElementById('modalRoot');e.hidden=true;e.innerHTML=''}};
</script>
<script src="./task-team.js"></script>
<script src="./task-detail.js"></script>
<script src="./work.js"></script></body></html>`;
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent((req.url||'').split('?')[0]);
 if(pathname==='/app/__muster_preview_harness__.html'){
   res.writeHead(200,{'content-type':'text/html'});res.end(harness);return;
 }
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,buf)=>{
   if(error){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(buf);
 });
}).listen(0);
const browser=await chromium.launch({headless:true});
test.after(async()=>{await browser.close();server.close()});
const url=()=>`http://localhost:${server.address().port}/app/__muster_preview_harness__.html#section=work&muster=LPH3`;

test('Desktop Muster uses the real work-bucket + work-task-card + canonical task detail',async()=>{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
   await page.goto(url());
   await page.locator('[data-work-task="L3-BEM-09"]').waitFor({state:'attached'});
   assert.equal(await page.locator('.work-bucket').count(),7);
   assert.equal(await page.locator('.work-task-card').count(),57);
   assert.equal(await page.locator('.work-bucket-explanation').count(),7);
   assert.match(await page.locator('#workProjectTitle').innerText(),/Muster-Planner.*LPH 3/);
   assert.match(await page.locator('.work-bucket').nth(4).innerText(),/Bemusterung/);
   assert.match(await page.locator('.work-bucket').nth(4).innerText(),/04\.03/);
   assert.equal(await page.locator('[data-work-add-bucket],[data-work-add-task]').count(),0);
   await page.locator('[data-work-task="L3-BEM-09"]').click();
   assert.equal(await page.locator('.minds-task-detail.is-muster-readonly').count(),1);
   assert.match(await page.locator('#taskDetailTitle').inputValue(),/Bäderpläne/);
   assert.match(await page.locator('#taskDetailWorkResult').inputValue(),/Badansichten/);
   assert.match(await page.locator('#taskDetailProfessionalContext').inputValue(),/LPH3|Entwurfs/);
   assert.match(await page.locator('#taskDetailPSP').inputValue(),/04\.03/);
   assert.equal(await page.locator('.minds-task-check-row').count(),4);
   assert.equal(await page.locator('#taskDetailComplete').isDisabled(),true);
   assert.equal(await page.locator('#taskDetailWorkResult').isDisabled(),true);
   assert.equal(await page.locator('#taskDetailPropose').isDisabled(),true);
   assert.equal(await page.locator('#taskDetailBook').isDisabled(),true);
   assert.deepEqual(await page.evaluate(()=>window.__dbWrites),[]);
   assert.deepEqual(errors,[]);
 }finally{await page.close()}
});

test('Mobile Muster retains original Planner list switch and read-only detail',async()=>{
 const page=await browser.newPage({viewport:{width:390,height:760}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
   await page.goto(url());
   await page.locator('[data-work-task="L3-ENT-01"]').waitFor();
   await page.locator('[data-work-layout-toggle]').click();
   assert.equal(await page.locator('.work-board.mobile-stack').count(),1);
   await page.locator('[data-work-task="L3-ENT-01"]').click();
   assert.match(await page.locator('#taskDetailWorkResult').inputValue(),/Grundrisssatz/);
   assert.equal(await page.locator('#taskDetailAddCheck').isDisabled(),true);
   assert.equal(await page.locator('#taskDetailAddFile').isDisabled(),true);
   assert.deepEqual(await page.evaluate(()=>window.__dbWrites),[]);
   assert.deepEqual(errors,[]);
 }finally{await page.close()}
});
