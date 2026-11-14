// Chromium acceptance: in a real project Planner, «Termine aus Terminplan» shows the date changes of
// linked tasks and writes them only after «Übernehmen». Supabase is a local fake – no network, no production.
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
const fixtures={
  isabella_projects:[{id:'p1',client_key:'p1',name:'Testprojekt',number:'0001',archived:false}],
  minds_work_buckets:[{id:'b1',name:'A5 · Bemusterung',description:'',terminplan_ref:'PSP 04.05 / 04.06',sort_order:0,archived:false}],
  isabella_tasks:[
    {id:'t1',client_key:'t1',title:'Qualitäten vorbereiten',work_bucket_id:'b1',work_status:'not_started',priority:'normal',start_date:'2026-11-16',due_date:'2026-12-04',labels:[],checklist:[],attachments:[],links:[],
     metadata:{office_planner:{task_code:'L3.QUA.1',terminplan_psp:'04.05',terminplan:{instance_id:'plan-1',executes:['prep'],waits_for:[],anchor:null}}}},
    {id:'t2',client_key:'t2',title:'Ohne Verknüpfung',work_bucket_id:'b1',work_status:'not_started',priority:'normal',start_date:null,due_date:null,labels:[],checklist:[],attachments:[],links:[],metadata:{}}
  ],
  office_terminplan_instances:[{id:'plan-1',phase:'LPH3',updated_at:'2026-11-14',state:{groups:[{id:'g5',wbs:'04'}],tasks:[
    {id:'x1',group:'g5',start:'2026-11-03',end:'2026-11-09'},{id:'x2',group:'g5',start:'2026-11-09',end:'2026-11-09'},
    {id:'x3',group:'g5',start:'2026-11-10',end:'2026-11-20'},{id:'x4',group:'g5',start:'2026-11-20',end:'2026-11-20'},
    {id:'prep',group:'g5',start:'2026-11-16',end:'2026-12-11'}]}}]
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
    if(st.op!=='select'){window.__writes.push({table,op:st.op,value:st.value,filters:st.filters});return {data:st.single?{id:'new'}:[],error:null}}
    let rows=(FIX[table]||[]).slice();
    for(const [k,c,v] of st.filters){if(k==='eq'&&rows.length&&c in rows[0])rows=rows.filter(r=>r[c]===v);if(k==='in')rows=rows.filter(r=>v.includes(r[c]))}
    return {data:st.single?(rows[0]||null):rows,error:null,count:rows.length};}
  return b;}
window.MINDS_SUPABASE={auth:{getSession:async()=>({data:{session:{user:{id:'u1'}}}})},from:q,rpc:async()=>({data:[],error:null}),
  storage:{from:()=>({createSignedUrl:async()=>({data:null,error:null})})}};
window.MINDS_WORK_TEAM={members:async()=>[],open:async()=>{}};
window.ISABELLA_APP={getState:()=>({}),openModal:(title,html)=>{const e=document.getElementById('modalRoot');e.hidden=false;e.innerHTML='<h1>'+title+'</h1>'+html},
  closeModal:()=>{const e=document.getElementById('modalRoot');e.hidden=true;e.innerHTML=''}};
</script>
<script src="./task-team.js"></script><script src="./task-detail.js"></script><script src="./planner-terminplan-sync.js"></script><script src="./work.js"></script></body></html>`;
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent((req.url||'').split('?')[0]);
 if(pathname==='/app/__planner_sync__.html'){res.writeHead(200,{'content-type':'text/html'});res.end(harness);return;}
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,buf)=>{if(error){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(buf);});
}).listen(0);
const browser=await chromium.launch({headless:true});
test.after(async()=>{await browser.close();server.close()});

test('Termine aus Terminplan: preview of changes, writes only after Übernehmen, keeps the link',async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
   await page.goto(`http://localhost:${server.address().port}/app/__planner_sync__.html#section=work`);
   await page.locator('[data-work-task="t1"]').waitFor({state:'attached'});
   const button=page.locator('[data-work-terminplan-sync]');
   assert.equal(await button.count(),1,'button shown because a task is linked');
   await button.click();
   await page.locator('#workSyncApply').waitFor();
   const text=await page.locator('#modalRoot').innerText();
   assert.match(text,/Qualitäten vorbereiten/);
   assert.match(text,/16\.11\.26 – 04\.12\.26 → 16\.11\.26 – 11\.12\.26/);
   assert.doesNotMatch(text,/Ohne Verknüpfung/);
   assert.deepEqual(await page.evaluate(()=>window.__writes),[],'nothing written before confirmation');
   await page.locator('#workSyncApply').click();
   await page.waitForFunction(()=>window.__writes.length>0);
   const writes=await page.evaluate(()=>window.__writes);
   assert.equal(writes.length,1);
   assert.equal(writes[0].table,'isabella_tasks');
   assert.deepEqual(writes[0].filters,[['eq','id','t1']]);
   assert.equal(writes[0].value.start_date,'2026-11-16');
   assert.equal(writes[0].value.due_date,'2026-12-11');
   assert.equal(writes[0].value.metadata.office_planner.task_code,'L3.QUA.1');
   assert.deepEqual(writes[0].value.metadata.office_planner.terminplan.executes,['prep']);
   assert.deepEqual(errors,[]);
 }finally{await page.close()}
});
