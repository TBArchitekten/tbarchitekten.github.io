// Boots the whole Office app in real Chromium with a synthetic Supabase (09.11.2026).
// A null element in bind() once aborted init(): the first screen stayed blank until the user
// navigated. This test fails on any page error during start and checks the first screen renders.
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

async function boot(runtime){
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co|fonts\.(googleapis|gstatic)/,r=>r.abort());
  // Seeded once per tab (init scripts also run in frames and on later navigations).
  if(runtime)await page.addInitScript(v=>{try{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('tba_office_chat_backend',v)}}catch{}},runtime);
  await page.goto(`http://localhost:${server.address().port}/app/`);
  await page.waitForTimeout(1500);
  return {page,errors};
}

// A browser that still carries the former choice «legacy» starts the shared engine and forgets the choice
// (Gari, 23.11.2026: the former Romy version is no longer offered).
for(const runtime of ['', 'legacy']){
  test(`Office app starts without errors and shows the first screen (${runtime?'stale legacy choice':'shared engine'})`,async()=>{
    const {page,errors}=await boot(runtime);
    try{
      assert.deepEqual(errors,[],'no page error during start');
      assert.deepEqual(await page.evaluate(()=>[window.APP_CHAT_RUNTIME,localStorage.getItem('tba_office_chat_backend')]),['window',null]);
      await page.evaluate(()=>document.getElementById('drawer')?.classList.remove('hidden'));
      const menu=await page.evaluate(()=>[...document.querySelectorAll('#drawer button,#drawer a')].map(b=>b.textContent.trim()).filter(Boolean));
      for(const gone of ['Neues Gespräch','Meine Gespräche','Vorherige Romy-Version','Terminplan-Muster'])
        assert.ok(!menu.includes(gone),'menu still offers '+gone);
      const visible=await page.evaluate(()=>[...document.querySelectorAll('[id$="Screen"]')].some(e=>e.offsetParent&&e.textContent.trim().length>20));
      assert.ok(visible,'a screen with content is visible right after start');
    }finally{await page.close()}
  });
}

test('Composer matches Isabella: no extra Live button; Live sits in the dictation overlay',async()=>{
  const {page,errors}=await boot('');
  try{
    await page.click('[data-nav="assistant"]');
    const ui=await page.evaluate(()=>({composerLive:!!document.querySelector('.composer-wrap a[href="./live/"]'),
      focusLive:document.getElementById('focusLiveLink')?.getAttribute('href'),speak:!!document.getElementById('focusSpeakReply')}));
    assert.deepEqual(ui,{composerLive:false,focusLive:'./live/',speak:true});
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});
