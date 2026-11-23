// Chromium: das Planner-Board springt nach einer Änderung nicht mehr an den Anfang (Gari, 23.11.2026).
// Supabase ist eine lokale Attrappe – kein Netz, keine Produktion.
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
// Acht Buckets mit je zwei Aufgaben: das Board ist breiter als der Bildschirm.
const buckets=Array.from({length:8},(_,i)=>({id:'b'+i,name:(i<6?'A'+(i+1)+' · Paket':'Test '+(i-5)),description:'',terminplan_ref:'',sort_order:i*10,archived:false}));
const fixtures={
  isabella_projects:[{id:'p1',client_key:'p1',name:'Testprojekt',number:'0001',archived:false}],
  minds_work_buckets:buckets,
  isabella_tasks:buckets.flatMap((b,i)=>[0,1].map(j=>({id:'t'+i+'-'+j,client_key:'t'+i+'-'+j,title:'Aufgabe '+i+'.'+j,work_bucket_id:b.id,work_status:'not_started',
    priority:'normal',start_date:null,due_date:null,labels:[],checklist:[],attachments:[],links:[],metadata:{},
    completed_at:j===1&&i===7?'2026-11-20T10:00:00Z':null})))
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
 if(pathname==='/app/__planner_board__.html'){res.writeHead(200,{'content-type':'text/html'});res.end(harness);return;}
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,buf)=>{if(error){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(buf);});
}).listen(0);
const browser=await chromium.launch({headless:true});
test.after(async()=>{await browser.close();server.close()});

test('Planner: nach einer Änderung bleibt das Board, wo es war (ganz rechts, Erledigte offen)',async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
   await page.goto(`http://localhost:${server.address().port}/app/__planner_board__.html#section=work`);
   await page.locator('[data-work-task="t7-0"]').waitFor({state:'attached'});
   const breite=await page.evaluate(()=>{const b=document.querySelector('.work-board');return b.scrollWidth-b.clientWidth});
   assert.ok(breite>300,'das Board muss seitlich scrollen ('+breite+')');
   // Ganz nach rechts, «Erledigte Aufgaben» im letzten Bucket öffnen, dann eine Aufgabe dort abhaken.
   await page.evaluate(()=>{const b=document.querySelector('.work-board');b.scrollLeft=b.scrollWidth;b.dataset.alt='1';
     document.querySelector('[data-work-bucket-drop="b7"] details.work-completed').open=true});
   const vorher=await page.evaluate(()=>document.querySelector('.work-board').scrollLeft);
   await page.locator('[data-work-toggle="t7-0"]').click();
   await page.waitForFunction(()=>{const b=document.querySelector('.work-board');return b&&!b.dataset.alt});
   const nachher=await page.evaluate(()=>({left:document.querySelector('.work-board').scrollLeft,
     offen:document.querySelector('[data-work-bucket-drop="b7"] details.work-completed')?.open}));
   assert.ok(Math.abs(nachher.left-vorher)<2,'seitliche Position bleibt: vorher '+vorher+', nachher '+nachher.left);
   assert.equal(nachher.offen,true,'«Erledigte Aufgaben» bleibt offen');
   assert.deepEqual(await page.evaluate(()=>window.__writes.map(w=>w.table)),['isabella_tasks']);
   assert.deepEqual(errors,[]);
 }finally{await page.close()}
});
