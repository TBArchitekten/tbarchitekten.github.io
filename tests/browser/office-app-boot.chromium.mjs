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

// A task deleted on the server leaves the local copy (Gari, 24.11.2026): from the Kalender of the team, and from
// the copy of its author, which would otherwise push it back. What was never on the server stays until pushed.
test('Sync drops what the server no longer returns and keeps what was never there',async()=>{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co|fonts\.(googleapis|gstatic)/,r=>r.abort());
  const me='11111111-1111-4111-8111-111111111111',colleague='22222222-2222-4222-8222-222222222222';
  await page.addInitScript(([me,colleague])=>{try{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');
    const task=(id,extra)=>({id,title:id,date:'2026-11-27',done:false,categoryId:'arbeit',projectId:null,...extra});
    localStorage.setItem('tba-office-window-v1',JSON.stringify({officeOwner:me,deletedTaskIds:[],deletedEventIds:[],
      tasks:[task('t1',{ownerId:me}),task('geloescht-eigen',{ownerId:me}),task('geloescht-kollegin',{ownerId:colleague}),task('neu-lokal',{})],
      events:[{id:'termin-geloescht',title:'Termin',date:'2026-11-27',start:'09:00',duration:60,ownerId:colleague}]}))}}catch{}},[me,colleague]);
  await page.goto(`http://localhost:${server.address().port}/app/`);
  try{
    await page.waitForFunction(()=>/Synchronisiert/.test(document.getElementById('syncStatus')?.textContent||''),null,{timeout:10000});
    const left=await page.evaluate(()=>{const s=window.ISABELLA_APP.getState();return {tasks:s.tasks.map(t=>t.id).sort(),events:s.events.map(e=>e.id)}});
    assert.deepEqual(left,{tasks:['neu-lokal','t1'],events:[]});
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

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

// Termin doppelt (Gari, 25.11.2026): Romy legte den Termin selbst an (client_key «direct:<request_id>»), die Karte
// desselben Zugs bot trotzdem «Vorschlag prüfen» an; Bestätigen legte eine zweite Kopie unter «Persönlich» an.
// Eine solche Karte ist erledigt: kein Knopf, keine zweite Anlage, auch wenn der Dialog schon offen war; was in
// der Office von Hand bestätigt wird, steht unter «Arbeit», und die Quittung ist deutsch.
test('Romy legte den Termin schon an: keine zweite Kopie, kein «Vorschlag prüfen», Arbeit statt Persönlich',async()=>{
  const {page,errors}=await boot('');
  try{
    await page.waitForFunction(()=>/Synchronisiert/.test(document.getElementById('syncStatus')?.textContent||''),null,{timeout:10000});
    const R1='aaaaaaaa-0000-4000-8000-000000000001',R2='aaaaaaaa-0000-4000-8000-000000000002',R3='aaaaaaaa-0000-4000-8000-000000000003';
    const direkt=(req,title)=>({id:'direct:'+req,title,date:'2026-11-26',start:'11:00',duration:60,allDay:false,categoryId:'arbeit',projectId:null,
      metadata:{source:'isabella',direct_request_id:req}});
    await page.evaluate(([e])=>{const S=window.ISABELLA_APP,st=S.getState();st.events=[...st.events,e];S.replaceState(st)},[direkt(R1,'Termin Eins')]);
    await page.evaluate(([R1,R2,R3])=>{
      const karte=(id,req,title)=>({id,role:'assistant',content:'Anlage freigegeben, Bestätigung steht noch aus.',created_at:new Date().toISOString(),
        metadata:{review_proposals:[{kind:'event',action:'create',request_id:req,title,date:'2026-11-26',time:'11:00',duration_minutes:60}]}});
      window.ISABELLA_APP.setOfficeMessages([karte('m1',R1,'Termin Eins'),karte('m2',R2,'Termin Zwei'),karte('m3',R3,'Termin Drei')]);
    },[R1,R2,R3]);
    await page.evaluate(()=>window.ISABELLA_APP.show('assistant'));
    const knopf=id=>page.locator('.message[data-message-id="'+id+'"] [data-review-message]');
    assert.equal(await knopf('m1').count(),0,'schon angelegt: kein «Vorschlag prüfen»');
    assert.equal((await page.locator('.message[data-message-id="m1"] .message-text').textContent()).trim(),'Eingetragen.');
    assert.equal(await knopf('m2').count(),1);
    // Der Dialog ist schon offen, als Romys Anlage ankommt: Bestätigen schreibt nichts mehr.
    await knopf('m2').click();
    await page.locator('#proposalConfirm').waitFor();
    await page.evaluate(([e])=>{const S=window.ISABELLA_APP,st=S.getState();st.events=[...st.events,e];S.replaceState(st)},[direkt(R2,'Termin Zwei')]);
    await page.locator('#proposalConfirm').click();
    await page.locator('.message .message-text',{hasText:'Steht schon im Kalender.'}).waitFor();
    const zwei=await page.evaluate(()=>window.ISABELLA_APP.getState().events.filter(e=>e.title==='Termin Zwei').length);
    assert.equal(zwei,1,'keine zweite Kopie');
    assert.equal(await knopf('m2').count(),0);
    // Ohne Romys Anlage legt Bestätigen den Termin an: unter «Arbeit», Quittung auf Deutsch.
    await knopf('m3').click();
    await page.locator('#proposalConfirm').click();
    await page.locator('.message .message-text',{hasText:'Eingetragen.'}).nth(1).waitFor();
    const drei=await page.evaluate(()=>window.ISABELLA_APP.getState().events.filter(e=>e.title==='Termin Drei').map(e=>e.categoryId));
    assert.deepEqual(drei,['arbeit']);
    assert.equal(await page.locator('.message .message-text',{hasText:'Agregado.'}).count(),0);
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

// Projekte (Gari, 25.11.2026): Nummer und Name eines Projekts ändern, als Admin oder Projektleitung.
test('Projekte: Nummer und Name bearbeiten',async()=>{
  const {page,errors}=await boot('');
  try{
    await page.evaluate(()=>{window.ISABELLA_APP.show('projects');history.replaceState(null,'','#section=projects')});
    await page.evaluate(()=>document.getElementById('officeToolsManage')?.click());
    const karte=page.locator('#projectsScreen .office-project-card',{hasText:'Beispielhaus'});
    await karte.waitFor();
    await karte.locator('button',{hasText:'Bearbeiten'}).click();
    const form=page.locator('#officeEditProjectForm');
    await form.waitFor();
    assert.deepEqual([await form.locator('input[name="number"]').inputValue(),await form.locator('input[name="name"]').inputValue()],['101','Beispielhaus']);
    await form.locator('input[name="number"]').fill('2601');
    await form.locator('input[name="name"]').fill('Beispielhaus Nord');
    await form.locator('button[type="submit"]').click();
    await form.waitFor({state:'hidden'});
    const writes=await page.evaluate(()=>window.__writes.filter(w=>w.table==='office_projects'));
    assert.deepEqual(writes,[{table:'office_projects',op:'update',value:{number:'2601',name:'Beispielhaus Nord'}}]);
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});
