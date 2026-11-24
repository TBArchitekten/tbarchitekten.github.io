// Chromium: Planner-Karten zeigen alle Verantwortlichen und den Status; die Checkliste bricht lange Punkte um
// und lässt sich umordnen (Gari, 24.11.2026). Supabase ist eine lokale Attrappe – kein Netz, keine Produktion.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const pageCss=[...fs.readFileSync(path.join(root,'app/index.html'),'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]
  .map(m=>'<link rel="stylesheet" href="'+m[1]+'">').join('');
const lang='Entscheidungsfelder festgelegt: kostenrelevante Qualitäten je Bauteil und Raumgruppe (Fassade, Fenster, Dach, Böden, '+
  'Wände, Decken, Türen, Sanitär- und Elektrostandard), abgestimmt mit der Projektleitung und mit Verweis auf die Qualitäts- '+
  'und Ausstattungsliste, damit jedes Feld genau einem Paket zugeordnet werden kann';
const task=(id,extra)=>({id,client_key:id,title:'Aufgabe '+id,work_bucket_id:'b0',work_status:'not_started',priority:'normal',
  start_date:null,due_date:null,labels:[],checklist:[],attachments:[],links:[],metadata:{},completed_at:null,project_id:'p1',
  updated_at:'2026-11-24T08:00:00Z',...extra});
const people=[['pa','Gari Beispiel'],['pb','Ana Muster'],['pc','Carla Test'],['pd','Dora Probe'],['pe','Emil Beispiel']];
const fixtures={
  isabella_projects:[{id:'p1',client_key:'p1',name:'Testprojekt',number:'0001',archived:false}],
  minds_work_buckets:[{id:'b0',name:'A5 · Paket',description:'',terminplan_ref:'',sort_order:0,archived:false}],
  isabella_tasks:[
    task('zwei',{work_status:'in_progress'}),
    task('fuenf',{work_status:'waiting'}),
    task('liste',{checklist:[{id:'c1',done:false,text:lang},{id:'c2',done:false,text:'Muster angefragt'},{id:'c3',done:true,text:'Termine abgestimmt'}]})
  ],
  minds_work_task_assignees:[
    {task_id:'zwei',person_id:'pa',created_at:'2026-11-24T08:00:00Z'},{task_id:'zwei',person_id:'pb',created_at:'2026-11-24T08:01:00Z'},
    ...people.map(([id],i)=>({task_id:'fuenf',person_id:id,created_at:'2026-11-24T08:0'+i+':00Z'}))
  ]
};
const harness=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${pageCss}</head>
<body data-section="work" class="office-app"><div class="app" id="app"><main id="swipeArea" class="swipe-area"><section id="workScreen" class="screen work-screen active" data-screen="work"><div class="work-shell">
<div class="work-head"><div><h1 id="workProjectTitle">Work</h1></div><div class="work-project-switch"></div></div>
<div class="work-tabs"><button data-work-view="overview">Panorama</button><button data-work-view="planner">Planner</button></div>
<div id="workStatus" class="work-status"></div><div id="workBody" class="work-body"></div></div></section></main></div>
<div id="modalRoot" hidden></div>
<script>
localStorage.setItem('minds-work-project','p1');localStorage.setItem('minds-work-view','planner');
window.TBA_OFFICE_CONFIG={};window.__writes=[];
const FIX=${JSON.stringify(fixtures)};
function q(table){const st={table,op:'select',filters:[],single:false};
  const b=new Proxy({}, {get(_,k){
    if(k==='then')return (res,rej)=>Promise.resolve(run()).then(res,rej);
    if(k==='update'||k==='insert'||k==='upsert'||k==='delete')return v=>{st.op=k;st.value=v;return b};
    if(k==='eq'||k==='in'||k==='is')return (c,v)=>{st.filters.push([k,c,v]);return b};
    if(k==='maybeSingle'||k==='single')return ()=>{st.single=true;return b};
    return ()=>b;}});
  function run(){
    if(st.op!=='select'){window.__writes.push({table,op:st.op,value:st.value,filters:st.filters});
      const row=FIX[table]?.find(r=>st.filters.some(([k,c,v])=>k==='eq'&&c==='id'&&r.id===v));
      return {data:st.single?{...(row||{id:'neu'}),...(st.value||{})}:[],error:null}}
    let rows=(FIX[table]||[]).slice();
    for(const [k,c,v] of st.filters){if(k==='eq'&&rows.length&&c in rows[0])rows=rows.filter(r=>r[c]===v);if(k==='in')rows=rows.filter(r=>v.includes(r[c]))}
    return {data:st.single?(rows[0]||null):rows,error:null,count:rows.length};}
  return b;}
window.MINDS_SUPABASE={auth:{getSession:async()=>({data:{session:{user:{id:'pa'}}}})},from:q,rpc:async()=>({data:[],error:null}),
  storage:{from:()=>({createSignedUrl:async()=>({data:null,error:null})})}};
window.MINDS_WORK_TEAM={members:async()=>${JSON.stringify(people.map(([id,name])=>({id,name})))},open:async()=>{}};
window.ISABELLA_APP={getState:()=>({}),openModal:(title,html)=>{const e=document.getElementById('modalRoot');e.hidden=false;e.innerHTML='<h1>'+title+'</h1>'+html},
  closeModal:()=>{const e=document.getElementById('modalRoot');e.hidden=true;e.innerHTML=''}};
</script>
<script src="./task-team.js"></script><script src="./task-detail.js"></script><script src="./planner-terminplan-sync.js"></script><script src="./work.js"></script></body></html>`;
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent((req.url||'').split('?')[0]);
 if(pathname==='/app/__planner_karten__.html'){res.writeHead(200,{'content-type':'text/html'});res.end(harness);return;}
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,buf)=>{if(error){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(buf);});
}).listen(0);
const browser=await chromium.launch({headless:true});
test.after(async()=>{await browser.close();server.close()});

async function board(){
  const page=await browser.newPage({viewport:{width:820,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/app/__planner_karten__.html#section=work`);
  await page.locator('[data-work-task="liste"]').waitFor({state:'attached'});
  return {page,errors};
}
const order=page=>page.evaluate(()=>[...document.querySelectorAll('#taskDetailChecks [data-task-check-id]')].map(r=>r.dataset.taskCheckId));
const savedOrders=page=>page.evaluate(()=>window.__writes.filter(w=>w.table==='isabella_tasks'&&w.value?.checklist).map(w=>w.value.checklist.map(c=>c.id).join('')));

test('Karte: jede verantwortliche Person als Kreis, Status sichtbar',async()=>{
  const {page,errors}=await board();
  try{
    const card=id=>page.evaluate(id=>{
      const c=document.querySelector(`[data-work-task="${id}"]`),t=c.querySelector('[data-work-toggle]');
      const av=[...c.querySelectorAll('.work-assignee-avatars .work-assignee-avatar')];
      return {state:c.dataset.workState,avatars:av.map(a=>a.textContent),name:c.querySelector('.work-assignee-name')?.textContent||'',
        cls:[...t.classList].filter(x=>x.startsWith('is-')),label:t.getAttribute('aria-label'),bg:getComputedStyle(t).backgroundImage,
        overlap:av.length>1?av[1].getBoundingClientRect().left<av[0].getBoundingClientRect().right:null};
    },id);
    const zwei=await card('zwei');
    assert.deepEqual(zwei.avatars,['GB','AM'],'beide Personen, nicht nur die erste');
    assert.equal(zwei.name,'Gari Beispiel, Ana Muster');
    assert.equal(zwei.overlap,true,'Kreise überlappen');
    assert.deepEqual([zwei.state,zwei.cls],['progress',['is-progress']]);
    assert.match(zwei.label,/^In Bearbeitung · erledigen: Aufgabe zwei$/);
    assert.match(zwei.bg,/linear-gradient/,'halb gefüllter Kreis');
    const fuenf=await card('fuenf');
    assert.deepEqual(fuenf.avatars,['GB','AM','CT','+2'],'ab fünf: drei Kreise und +N');
    assert.deepEqual([fuenf.state,fuenf.cls],['waiting',['is-waiting']]);
    const liste=await card('liste');
    assert.deepEqual([liste.state,liste.cls,liste.avatars],['open',[],[]]);
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('Checkliste: lange Punkte brechen um; verschieben mit Alt+Pfeil und am Griff; Enter legt den nächsten Schritt an',async()=>{
  const {page,errors}=await board();
  try{
    await page.locator('[data-work-task="liste"] strong').click();
    await page.locator('#taskDetailChecks [data-task-check-text]').nth(2).waitFor();
    const field=await page.evaluate(()=>{const t=document.querySelector('#taskDetailChecks [data-task-check-id="c1"] textarea');
      const lh=parseFloat(getComputedStyle(t).lineHeight);return {h:t.clientHeight,sh:t.scrollHeight,lh,text:t.value}});
    assert.equal(field.text,lang,'der ganze Text steht im Feld');
    assert.ok(field.h>=field.lh*2,'mehrzeilig ('+field.h+' px bei '+field.lh+' px Zeilenhöhe)');
    assert.ok(field.sh<=field.h+1,'nichts abgeschnitten ('+field.sh+' / '+field.h+')');

    // Alt + Pfeil nach unten: der erste Schritt rutscht eine Stelle nach unten, der Fokus bleibt.
    await page.locator('#taskDetailChecks [data-task-check-id="c1"] textarea').focus();
    await page.keyboard.press('Alt+ArrowDown');
    assert.deepEqual(await order(page),['c2','c1','c3']);
    assert.equal(await page.evaluate(()=>document.activeElement?.closest('[data-task-check-id]')?.dataset.taskCheckId),'c1');
    await page.waitForFunction(()=>window.__writes.some(w=>w.value?.checklist));
    assert.deepEqual(await savedOrders(page),['c2c1c3']);

    // Am Griff ziehen: der letzte Schritt nach ganz oben.
    await page.locator('#taskDetailChecks').scrollIntoViewIfNeeded();
    const grip=await page.locator('#taskDetailChecks [data-task-check-id="c3"] [data-task-check-grip]').boundingBox();
    const top=await page.locator('#taskDetailChecks [data-task-check-id="c2"]').boundingBox();
    await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);
    await page.mouse.down();
    await page.mouse.move(grip.x+grip.width/2,top.y+4,{steps:12});
    await page.mouse.up();
    assert.deepEqual(await order(page),['c3','c2','c1']);
    await page.waitForFunction(()=>window.__writes.filter(w=>w.value?.checklist).length>=2);
    assert.deepEqual(await savedOrders(page),['c2c1c3','c3c2c1']);
    const saved=await page.evaluate(()=>window.__writes.filter(w=>w.value?.checklist).at(-1).value.checklist);
    assert.deepEqual(saved.map(c=>[c.id,c.done]),[['c3',true],['c2',false],['c1',false]],'erledigt bleibt erledigt');
    assert.equal(saved[2].text,lang);

    // Enter: kein Zeilenumbruch im Punkt, sondern ein neuer leerer Schritt darunter mit dem Fokus.
    await page.locator('#taskDetailChecks [data-task-check-id="c2"] textarea').focus();
    await page.keyboard.press('Enter');
    const nachEnter=await page.evaluate(()=>{const rows=[...document.querySelectorAll('#taskDetailChecks [data-task-check-id]')];
      const a=document.activeElement;return {n:rows.length,pos:rows.indexOf(a?.closest('[data-task-check-id]')),leer:a?.value===''}});
    assert.deepEqual(nachEnter,{n:4,pos:2,leer:true});
    assert.equal(await page.locator('#taskDetailChecks [data-task-check-id="c2"] textarea').inputValue(),'Muster angefragt');
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});
