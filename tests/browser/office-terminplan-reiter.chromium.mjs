// Chromium: Der Terminplan als Reiter in Work (Gari, 24.11.2026). Die Seite läuft in einem Rahmen der App, leiht die
// Brücke der App (die iPhone-App nimmt nur den Hauptrahmen an), zeigt keinen Rücksprung-Link und meldet Work ihre
// Revision. Ohne gewählten Plan springt sie nicht in die App (das hieße die App in der App). Supabase ist eine lokale
// Attrappe – kein Netz, keine Produktion.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
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
const plan={id:'tp-1',owner_id:UID,project_id:'p-1',project_number:'T-01',project_name:'Testhaus',phase:'LPH3',template_version:'1',
  updated_at:'2026-11-24T10:00:00Z',server_revision:3,
  state:{project:{name:'Testhaus',projectNumber:'T-01',projectName:'Testhaus',phase:'LPH3',start:'2027-01-04',end:'2027-02-26',standDate:'2027-01-04'},
    groups:[{id:'g1',name:'Entwurf',wbs:'01'}],
    tasks:[{id:'t1',group:'g1',name:'Vorentwurf prüfen',start:'2027-01-04',end:'2027-01-08',type:'task'}]}};
// Attrappe für supabase-js: Tabellen der Seite, sonst leer. Die Sitzung kommt nicht von hier, sondern über die Brücke.
const fake=`(function(){
  const rows={office_members:[{user_id:'${UID}',email:'test@fixture.invalid',display_name:'Test Leitung',role:'admin',is_active:true,must_change_password:false}],
    office_terminplan_instances:[${JSON.stringify(plan)}],office_projects:[{id:'p-1',projektleiter_id:'${UID}'}]};
  window.__tabellen=[];
  function builder(table){let single=false;const q={};
    ['select','eq','neq','in','is','lt','lte','gt','gte','order','limit','range','match','not','or','filter','contains','insert','update','upsert','delete']
      .forEach(k=>q[k]=()=>q);
    q.single=()=>{single=true;return q};q.maybeSingle=()=>{single=true;return q};
    q.then=(ok,bad)=>{window.__tabellen.push(table);const r=rows[table]||[];return Promise.resolve({data:single?(r[0]||null):r,error:null}).then(ok,bad)};
    return q}
  const client={auth:{getSession:async()=>({data:{session:null},error:null})},from:builder,rpc:async()=>({data:null,error:null}),
    functions:{invoke:async()=>({data:null,error:null})},
    storage:{from:()=>({upload:async()=>({error:null}),remove:async()=>({error:null}),createSignedUrl:async()=>({data:null,error:null})})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){}};
  window.supabase={createClient:()=>client};
})();`;
const rahmenSeite=src=>`<!doctype html><html lang="de"><body style="margin:0"><script>
window.__bruecke=[];
window.WINDOW_NATIVE={available:true,version:1,call:async(type)=>{window.__bruecke.push(type);
  if(type==='session.get')return {v:1,ok:true,session:{access_token:'fake',expires_at:Math.floor(Date.now()/1000)+3600,
    user:{id:'${UID}',email:'test@fixture.invalid'}}};
  return {v:1,ok:true}}};
</script><iframe id="f" style="width:1300px;height:860px;border:0" src="${src}"></iframe></body></html>`;

async function oeffne(src){
  const ctx=await browser.newContext({viewport:{width:1320,height:900},deviceScaleFactor:1});
  const page=await ctx.newPage();const fehler=[];page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co|fonts\.(googleapis|gstatic)/,r=>r.abort());
  await page.route(/\/__rahmen__\.html$/,r=>r.fulfill({contentType:'text/html',body:rahmenSeite(src)}));
  await page.goto(`http://localhost:${server.address().port}/__rahmen__.html`);
  return {ctx,page,fehler,rahmen:()=>page.frames().find(x=>/terminplan\.html/.test(x.url()))};
}

test('Terminplan im Rahmen: Sitzung über die App, kein Rücksprung-Link, Revision für Work',async()=>{
  const {ctx,page,fehler,rahmen}=await oeffne('/terminplan.html?id=tp-1');
  try{
    const f=page.frameLocator('#f');
    // Im Reiter steht das Projekt schon in Work: die Kopfzeile nennt nur die Phase, und seit B2 (27.11.2026) ist sie
    // ausgeblendet; Stand und Speichern stehen am Ende der einen Werkzeugzeile.
    await f.locator('#officePlanLabel',{hasText:'LPH3'}).waitFor({state:'attached'});
    assert.equal(await f.locator('#officePlanLabel').textContent(),'LPH3');
    assert.equal(await f.locator('.office-plan-head').evaluate(h=>getComputedStyle(h).display),'none');
    await page.waitForFunction(()=>window.__bruecke.includes('session.get'));
    assert.deepEqual(await rahmen().evaluate(()=>[document.documentElement.classList.contains('im-reiter'),!!window.WINDOW_NATIVE?.available]),[true,true]);
    assert.equal(await f.locator('#officeBack').evaluate(a=>getComputedStyle(a).display),'none');
    await rahmen().waitForFunction(()=>window.TBA_OFFICE_TOOL?.revision()===3);
    assert.deepEqual(await rahmen().evaluate(()=>[window.TBA_OFFICE_TOOL.kind,window.TBA_OFFICE_TOOL.pending()]),['terminplan',false]);
    await rahmen().evaluate(()=>window.TBA_OFFICE_TOOL.flush());
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Terminplan im Rahmen ohne gewählten Plan: eine Meldung, nicht die App im Rahmen',async()=>{
  const {ctx,page,fehler,rahmen}=await oeffne('/terminplan.html');
  try{
    await page.frameLocator('#f').locator('.empty',{hasText:'Kein Terminplan gewählt.'}).waitFor();
    assert.match(rahmen().url(),/\/terminplan\.html$/,'der Rahmen bleibt auf der Seite');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Terminplan im Reiter: eine Werkzeugzeile, seltene Befehle unter «•••» (B2, 27.11.2026)',async()=>{
  const {ctx,page,fehler,rahmen}=await oeffne('/terminplan.html?id=tp-1');
  try{
    const f=page.frameLocator('#f');
    await f.locator('.app>.toolbar>.wz-mehr').waitFor();
    // Alles Sichtbare der Leiste steht in einer Zeile.
    const zeilen=await rahmen().evaluate(()=>[...document.querySelector('.app>.toolbar').children]
      .filter(e=>e.offsetWidth&&e.offsetHeight).map(e=>Math.round(e.getBoundingClientRect().top+e.getBoundingClientRect().height/2)));
    assert.ok(Math.max(...zeilen)-Math.min(...zeilen)<=6,'eine Zeile: '+zeilen.join(', '));
    // Seltene Befehle im Menü, die Info und der Speicherstand in der Leiste.
    for(const id of ['exportCsvBtn','exportJsonBtn','importJsonBtn','printBtn','addGroupBtn'])
      assert.equal(await rahmen().evaluate(id=>!!document.querySelector('.wz-menue #'+id),id),true,id+' im Menü');
    assert.equal(await rahmen().evaluate(()=>!!document.querySelector('.app>.toolbar .wz-status #saveState')),true);
    assert.equal(await rahmen().evaluate(()=>!!document.querySelector('.app>.toolbar>.statusbar.wz-info #taskCount')),true);
    // «•••» öffnet das Menü; ein Schalter darin wirkt und lässt es offen; Escape schließt.
    await f.locator('.wz-mehr').click();
    assert.equal(await f.locator('.wz-menue').isVisible(),true);
    const vorher=await f.locator('#weekendToggle').isChecked();
    await f.locator('#weekendToggle').click();
    assert.equal(await f.locator('#weekendToggle').isChecked(),!vorher);
    assert.equal(await f.locator('.wz-menue').isVisible(),true,'Schalter lässt das Menü offen');
    await f.locator('.wz-mehr').press('Escape');
    assert.equal(await f.locator('.wz-menue').isVisible(),false);
    // Die Auswertung, die die Seite später einfügt, landet ebenfalls im Menü; die Anleitung steht als «?» vor «•••».
    await rahmen().waitForFunction(()=>!document.querySelector('.app>.toolbar .tp-feature-actions'));
    await rahmen().waitForFunction(()=>document.querySelector('#tpHelp')?.nextElementSibling?.classList.contains('wz-mehr'));
    assert.deepEqual(await rahmen().evaluate(()=>{const h=document.querySelector('#tpHelp');
      return [h.parentElement.matches('.app>.toolbar'),h.textContent,h.getAttribute('aria-label'),h.getAttribute('href'),!!document.querySelector('.wz-menue #tpOpenAnalysis')]}),
      [true,'?','Anleitung','./terminplan-hilfe.html',true]);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

// Gari, 27.11.2026: die Tabelle links ließ sich nicht schmaler als 853 px ziehen, die Balken waren kaum lesbar. Jetzt bis
// 300 px; je schmaler, desto weniger Spalten (zuerst Fortschritt, zuletzt Anfang und Ende; PSP und Vorgang bleiben).
// Doppelklick auf den Trenner: nur PSP und Vorgang, noch einmal: so breit wie vorher. Die Breite bleibt beim Neuladen.
test('Terminplan: Tabelle schmal ziehen, Spalten fallen weg, Doppelklick schaltet um',async()=>{
  const {ctx,page,fehler,rahmen}=await oeffne('/terminplan.html?id=tp-1');
  try{
    const f=page.frameLocator('#f');
    await f.locator('.left-scroll .row').first().waitFor();
    const lage=()=>rahmen().evaluate(()=>({breite:Math.round(document.querySelector('#leftPanel').getBoundingClientRect().width),
      stufe:document.documentElement.dataset.tpSpalten,
      kopf:[...document.querySelectorAll('.left-head>div')].filter(d=>d.offsetWidth).map(d=>d.textContent.trim()),
      zeile:[...document.querySelector('.left-scroll .row').children].filter(d=>d.offsetWidth).length}));
    const anfang=await lage();
    assert.equal(anfang.stufe,'0');assert.equal(anfang.kopf.length,7);
    // Ziehen: weit nach links, bis zum Minimum von 300 px.
    const trenner=await f.locator('#splitter').boundingBox();
    await page.mouse.move(trenner.x+3,trenner.y+200);await page.mouse.down();
    await page.mouse.move(trenner.x-900,trenner.y+200,{steps:8});await page.mouse.up();
    let jetzt=await lage();
    assert.equal(jetzt.breite,300);assert.equal(jetzt.stufe,'4');
    assert.deepEqual(jetzt.kopf,['PSP','Vorgang']);assert.equal(jetzt.zeile,2,'Zeilen wie der Kopf');
    // Etwas breiter: Anfang und Ende kommen zurück.
    const t2=await f.locator('#splitter').boundingBox();
    await page.mouse.move(t2.x+3,t2.y+200);await page.mouse.down();await page.mouse.move(t2.x+290,t2.y+200,{steps:5});await page.mouse.up();
    jetzt=await lage();
    assert.equal(jetzt.stufe,'3');assert.deepEqual(jetzt.kopf,['PSP','Vorgang','Anfang','Ende']);
    // Doppelklick: nur PSP und Vorgang; noch einmal: wie vorher. Neu laden behält die Breite.
    await f.locator('#splitter').dblclick();
    jetzt=await lage();assert.equal(jetzt.breite,360);assert.deepEqual(jetzt.kopf,['PSP','Vorgang']);
    await f.locator('#splitter').dblclick();
    jetzt=await lage();assert.equal(jetzt.stufe,'3');
    const breite=jetzt.breite;
    await rahmen().goto(rahmen().url());
    await f.locator('.left-scroll .row').first().waitFor();
    jetzt=await lage();assert.equal(jetzt.breite,breite,'nach dem Neuladen');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});
