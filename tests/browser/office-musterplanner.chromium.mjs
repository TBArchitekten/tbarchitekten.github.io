// Chromium acceptance: canonical Work Planner and native task editor render the
// LPH3 Muster read-only. No duplicate UI and absolutely no Supabase data writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
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
// Second harness: EVERY stylesheet of the real page in its real order and the real shell frame.
// The small harness above cannot see conflicts between Window and Office rules (e.g. list mode).
const pageCss=[...fs.readFileSync(path.join(root,'app/index.html'),'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]
  .map(m=>'<link rel="stylesheet" href="'+m[1]+'">').join('');
const fullHarness=harness
  .replace(/<link rel="stylesheet"[^>]*>\s*/g,'').replace('<meta name="viewport" content="width=device-width,initial-scale=1">','<meta name="viewport" content="width=device-width,initial-scale=1">'+pageCss)
  .replace(/<style>[\s\S]*?<\/style>/,'<style>#modalRoot[hidden]{display:none}</style>')
  .replace('<body data-section="work" class="office-app">\n<div class="work-project-switch"></div><div id="workProjectTitle"></div>\n<nav><button data-work-view="planner">Planner</button><button data-work-view="overview">Panorama</button></nav>\n<div id="workStatus"></div><div id="workBody"></div>',
    '<body data-section="work" class="office-app"><div class="app" id="app"><main id="swipeArea" class="swipe-area"><section id="workScreen" class="screen work-screen active" data-screen="work"><div class="work-shell">'+
    '<div class="work-head"><div><h1 id="workProjectTitle">Work</h1></div><div class="work-project-switch"></div></div>'+
    '<div class="work-tabs"><button data-work-view="overview">Panorama</button><button data-work-view="planner" class="active">Planner</button></div>'+
    '<div id="workStatus" class="work-status"></div><div id="workBody" class="work-body"></div></div></section></main></div>');
if(fullHarness===harness||!fullHarness.includes('office.css')||!fullHarness.includes('class="work-body"'))throw Error('full-CSS harness not built');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent((req.url||'').split('?')[0]);
 if(pathname==='/app/__muster_full_css__.html'){res.writeHead(200,{'content-type':'text/html'});res.end(fullHarness);return;}
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
   await page.locator('[data-work-task="L3.BAD.1"]').waitFor({state:'attached'});
   assert.equal(await page.locator('.work-bucket').count(),7);
   assert.equal(await page.locator('.work-task-card').count(),52);
   assert.equal(await page.locator('.work-bucket-explanation').count(),7);
   assert.match(await page.locator('#workProjectTitle').innerText(),/Muster-Planner.*LPH 3/);
   assert.match(await page.locator('.work-bucket').nth(4).innerText(),/Bemusterung/);
   assert.match(await page.locator('.work-bucket').nth(4).innerText(),/04\.04.*M06/);
   assert.equal(await page.locator('[data-work-add-bucket],[data-work-add-task]').count(),0);
   await page.locator('[data-work-task="L3.BAD.1"]').click();
   assert.equal(await page.locator('.minds-task-detail.is-muster-readonly').count(),1);
   assert.match(await page.locator('#taskDetailTitle').inputValue(),/Themenpaket Bäder/);
   assert.match(await page.locator('#taskDetailWorkResult').inputValue(),/Wandansichten/);
   assert.match(await page.locator('#taskDetailProfessionalContext').inputValue(),/HOAI Anlage 10 LPH 3/);
   assert.match(await page.locator('#taskDetailPSP').inputValue(),/04\.03/);
   assert.equal(await page.locator('.minds-task-check-row').count(),7);
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
   await page.locator('[data-work-task="L3.GRU.1"]').waitFor();
   await page.locator('[data-work-layout-toggle]').click();
   assert.equal(await page.locator('.work-board.mobile-stack').count(),1);
   await page.locator('[data-work-task="L3.GRU.1"]').click();
   assert.match(await page.locator('#taskDetailWorkResult').inputValue(),/Grundrisse aller Geschosse/);
   assert.equal(await page.locator('#taskDetailAddCheck').isDisabled(),true);
   assert.equal(await page.locator('#taskDetailAddFile').isDisabled(),true);
   assert.deepEqual(await page.evaluate(()=>window.__dbWrites),[]);
   assert.deepEqual(errors,[]);
 }finally{await page.close()}
});

const fullUrl=()=>`http://localhost:${server.address().port}/app/__muster_full_css__.html#section=work&muster=LPH3`;
const bucketBoxes=page=>page.evaluate(()=>[...document.querySelectorAll('.work-bucket')].map(b=>{
  const r=b.getBoundingClientRect(),s=b.querySelector('.work-bucket-scroll');
  return {top:r.top,bottom:r.bottom,height:r.height,content:b.scrollHeight,scrollClient:s?.clientHeight??0,scrollContent:s?.scrollHeight??0};
}));

test('Phone list mode stacks Buckets without overlap with all Office stylesheets (Muster and projects)',async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
   await page.addInitScript(()=>localStorage.setItem('minds-work-mobile-planner-layout-v1','list'));
   await page.goto(fullUrl());
   await page.locator('[data-work-task="L3.GRU.1"]').waitFor({state:'attached'});
   assert.equal(await page.locator('.work-board.mobile-stack').count(),1);
   const boxes=await bucketBoxes(page);
   assert.equal(boxes.length,7);
   boxes.forEach((b,i)=>{
     assert.ok(b.height+2>=b.content,'Bucket '+(i+1)+' grows with its cards ('+Math.round(b.height)+' < '+b.content+')');
     if(i)assert.ok(boxes[i-1].bottom<=b.top+0.5,'Bucket '+(i+1)+' starts below Bucket '+i);
   });
   assert.deepEqual(errors,[]);
 }finally{await page.close()}
});

test('Phone landscape shows every card: no tiny inner card area per Bucket',async()=>{
 const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
   await page.goto(fullUrl());
   await page.locator('[data-work-task="L3.GRU.1"]').waitFor({state:'attached'});
   for(const [i,b] of (await bucketBoxes(page)).entries())
     assert.ok(b.scrollClient+1>=b.scrollContent,'Bucket '+(i+1)+' hides cards ('+b.scrollClient+' of '+b.scrollContent+' px visible)');
   const last=page.locator('[data-work-task="L3.A7.ABS"]');
   await last.scrollIntoViewIfNeeded();
   assert.ok(await last.isVisible());
   assert.deepEqual(errors,[]);
 }finally{await page.close()}
});

test('Desktop keeps Buckets side by side with all Office stylesheets',async()=>{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 try{
   await page.goto(fullUrl());
   await page.locator('[data-work-task="L3.GRU.1"]').waitFor({state:'attached'});
   const boxes=await bucketBoxes(page);
   assert.ok(boxes.every(b=>Math.abs(b.top-boxes[0].top)<1),'all Buckets in one row');
 }finally{await page.close()}
});
