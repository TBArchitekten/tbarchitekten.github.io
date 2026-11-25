// Chromium: Planner-Karten zeigen alle Verantwortlichen und den Status; die Checkliste bricht lange Punkte um
// und lässt sich umordnen (Gari, 24.11.2026). Terminplan und Kostenberechnung sind Reiter wie Planner und Desktop,
// und die Beschreibung eines Buckets steht nur noch auf Wunsch da. Supabase ist eine lokale Attrappe – kein Netz,
// keine Produktion.
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
  user_id:'pa',updated_at:'2026-11-24T08:00:00Z',...extra});
// Dates relative to today, as the browser sees it.
const tag=n=>{const d=new Date();d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const people=[['pa','Gari Beispiel'],['pb','Ana Muster'],['pc','Carla Test'],['pd','Dora Probe'],['pe','Emil Beispiel']];
const fixtures={
  isabella_projects:[{id:'p1',client_key:'p1',name:'Testprojekt',number:'0001',archived:false}],
  minds_work_buckets:[{id:'b0',name:'A5 · Paket',description:'Was zu diesem Paket gehört und wann es fertig ist.',terminplan_ref:'PSP 04.03',sort_order:0,archived:false}],
  isabella_tasks:[
    task('zwei',{work_status:'in_progress'}),
    task('fuenf',{work_status:'waiting'}),
    task('liste',{checklist:[{id:'c1',done:false,text:lang},{id:'c2',done:false,text:'Muster angefragt'},{id:'c3',done:true,text:'Termine abgestimmt'}]}),
    task('ueberfaellig',{due_date:tag(-10)}),
    task('kollegin',{user_id:'pb',due_date:tag(0)})
  ],
  minds_work_task_assignees:[
    {task_id:'zwei',person_id:'pa',created_at:'2026-11-24T08:00:00Z'},{task_id:'zwei',person_id:'pb',created_at:'2026-11-24T08:01:00Z'},
    ...people.map(([id],i)=>({task_id:'fuenf',person_id:id,created_at:'2026-11-24T08:0'+i+':00Z'})),
    {task_id:'ueberfaellig',person_id:'pb',created_at:'2026-11-24T08:00:00Z'}
  ],
  // Wie die Datenbank: die zuletzt geänderte zuerst.
  office_terminplan_instances:[
    {id:'tp-lph5',project_id:'p1',phase:'LPH5',updated_at:'2026-11-22T10:00:00Z',server_revision:1,is_archived:false},
    {id:'tp-lph3',project_id:'p1',phase:'LPH3',updated_at:'2026-11-20T10:00:00Z',server_revision:1,is_archived:false}
  ],
  office_kosten_instances:[],
  // Mustermappe: eine Mappe im Projekt (Zeile der Entscheidungsvorlagen, form «mustermappe»).
  office_projektdokumente:[{id:'dok-v',project_id:'p1',art:'entscheidungsvorlagen'}],
  office_projektdokument_zeilen:[{id:'mm-1',dokument_id:'dok-v',nr:1,themenpaket:'Bodenbeläge',titel:'Mustermappe Bodenbeläge',updated_at:'2026-11-24T10:00:00Z',server_revision:1}]
};
const harness=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${pageCss}</head>
<body data-section="work" class="office-app"><div class="app" id="app"><main id="swipeArea" class="swipe-area"><section id="workScreen" class="screen work-screen active" data-screen="work"><div class="work-shell">
<div class="work-head"><div><h1 id="workProjectTitle">Work</h1></div><div class="work-project-switch"></div></div>
<div class="work-tabs"><button data-work-view="overview">Panorama</button><button data-work-view="planner">Planner</button><button data-work-view="terminplan" hidden>Terminplan</button><button data-work-view="kosten" hidden>Kostenberechnung</button><button data-work-view="mustermappe" hidden>Mustermappe</button><button data-work-view="produkte" hidden>Produkte</button><button data-work-view="hersteller" hidden>Hersteller</button></div>
<div id="workStatus" class="work-status"></div><div id="workBody" class="work-body"></div><div id="workToolHost" class="work-tool-host" hidden></div></div></section></main></div>
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
      const tag=c.querySelector('.work-task-chips .work-task-state');
      return {state:c.dataset.workState,avatars:av.map(a=>a.textContent),name:c.querySelector('.work-assignee-name')?.textContent||'',
        cls:[...t.classList].filter(x=>x.startsWith('is-')),label:t.getAttribute('aria-label'),
        tag:tag?[tag.textContent,getComputedStyle(tag).backgroundColor,getComputedStyle(tag).color]:null,
        overlap:av.length>1?av[1].getBoundingClientRect().left<av[0].getBoundingClientRect().right:null};
    },id);
    const zwei=await card('zwei');
    assert.deepEqual(zwei.avatars,['GB','AM'],'beide Personen, nicht nur die erste');
    assert.equal(zwei.name,'Gari Beispiel, Ana Muster');
    assert.equal(zwei.overlap,true,'Kreise überlappen');
    // Vorschlag A (Gari, 24.11.2026): der Status als Etikett neben dem Datum; der Kreis bleibt nur zum Erledigen.
    assert.deepEqual([zwei.state,zwei.cls,zwei.label],['progress',[],'Erledigen: Aufgabe zwei']);
    assert.deepEqual(zwei.tag,['In Bearbeitung','rgb(238, 245, 255)','rgb(0, 74, 158)'],'das Blau der gemeinsamen Gestaltung');
    const fuenf=await card('fuenf');
    assert.deepEqual(fuenf.avatars,['GB','AM','CT','+2'],'ab fünf: drei Kreise und +N');
    assert.deepEqual([fuenf.state,fuenf.cls],['waiting',[]]);
    assert.deepEqual(fuenf.tag,['Wartet','rgb(255, 241, 217)','rgb(148, 89, 10)']);
    const liste=await card('liste');
    assert.deepEqual([liste.state,liste.cls,liste.avatars,liste.tag],['open',[],[],null]);
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

const sichtbar=page=>page.evaluate(()=>[...document.querySelectorAll('[data-work-task]')].filter(c=>!c.hidden&&c.offsetParent).map(c=>c.dataset.workTask).sort());
const waehle=(page,key,value)=>page.locator(`.work-planner-filter [data-work-filter="${key}"]`).selectOption(value);

test('Filter: Nur meine, Person, Status und Fällig; nur für mich, und das Gerät merkt ihn sich',async()=>{
  const {page,errors}=await board();
  try{
    assert.deepEqual(await sichtbar(page),['fuenf','kollegin','liste','ueberfaellig','zwei']);
    assert.equal(await page.locator('[data-work-filter-person="all"]').getAttribute('aria-pressed'),'true');
    // Nur meine: verantwortlich, oder ohne Verantwortliche und von mir angelegt (wie Heute).
    await page.locator('[data-work-filter-person="mine"]').click();
    assert.deepEqual(await sichtbar(page),['fuenf','liste','zwei']);
    assert.equal(await page.locator('[data-work-bucket-drop="b0"] .work-bucket-count').textContent(),'3 / 5');
    assert.equal(await page.locator('[data-work-filter-result]').textContent(),'3 von 5 Aufgaben');
    assert.equal(await page.locator('[data-work-filter-reset]').isVisible(),true);
    assert.deepEqual(await page.evaluate(()=>window.__writes.length),0,'ein Filter schreibt nichts');
    // Neu laden: der Filter bleibt auf diesem Gerät.
    await page.reload();await page.locator('[data-work-task="liste"]').waitFor({state:'attached'});
    assert.equal(await page.locator('[data-work-filter-person="mine"]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(await sichtbar(page),['fuenf','liste','zwei']);
    // Eine Person; dann Ohne Verantwortliche.
    await waehle(page,'person','pb');
    assert.deepEqual(await sichtbar(page),['fuenf','ueberfaellig','zwei']);
    assert.equal(await page.locator('[data-work-filter-person="mine"]').getAttribute('aria-pressed'),'false');
    await waehle(page,'person','none');
    assert.deepEqual(await sichtbar(page),['kollegin','liste']);
    // Zurücksetzen, dann Status und Fällig.
    await page.locator('[data-work-filter-reset]').click();
    assert.deepEqual(await sichtbar(page),['fuenf','kollegin','liste','ueberfaellig','zwei']);
    assert.equal(await page.locator('[data-work-bucket-drop="b0"] .work-bucket-count').textContent(),'5');
    assert.equal(await page.locator('[data-work-filter-reset]').isVisible(),false);
    await waehle(page,'status','in_progress');
    assert.deepEqual(await sichtbar(page),['zwei']);
    await waehle(page,'status','all');
    await waehle(page,'due','overdue');
    assert.deepEqual(await sichtbar(page),['ueberfaellig']);
    await waehle(page,'due','week');
    assert.deepEqual(await sichtbar(page),['kollegin']);
    await waehle(page,'due','none');
    assert.deepEqual(await sichtbar(page),['fuenf','liste','zwei']);
    // Nichts passt: der Bucket sagt es.
    await waehle(page,'status','waiting');await waehle(page,'person','none');
    assert.deepEqual(await sichtbar(page),[]);
    const leer=await page.evaluate(()=>getComputedStyle(document.querySelector('[data-work-bucket-drop="b0"] [data-work-task-list="open"]'),'::after').content);
    assert.equal(leer,'"Keine passenden Aufgaben"');
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

// Werkzeugseiten als Attrappe: sie melden Revision und offene Speicherung wie terminplan.html und kostenberechnung.js.
const werkzeug=`<!doctype html><html><body><p>Werkzeug</p><script>
window.__pending=false;
window.TBA_OFFICE_TOOL={revision:()=>1,pending:()=>window.__pending,
  flush:async()=>{(parent.__flushes=parent.__flushes||[]).push(location.pathname+location.search);window.__pending=false}};
</script></body></html>`;
const rahmen=(page,kind)=>page.evaluate(k=>{const f=document.querySelector('[data-work-tool-pane="'+k+'"] iframe');
  return f?{src:f.getAttribute('src'),ziel:f.dataset.toolId,url:f.contentWindow?.location.pathname+f.contentWindow?.location.search,marke:f.contentWindow?.__marke??null}:null},kind);
const bereit=(page,kind)=>page.waitForFunction(k=>document.querySelector('[data-work-tool-pane="'+k+'"] iframe')?.contentWindow?.TBA_OFFICE_TOOL,kind);
const markiere=(page,kind,wert)=>page.evaluate(([k,w])=>{document.querySelector('[data-work-tool-pane="'+k+'"] iframe').contentWindow.__marke=w},[kind,wert]);

test('Reiter Terminplan und Kostenberechnung: wechseln wie Planner und Desktop, die Seite bleibt offen',async()=>{
  const {page,errors}=await board();
  await page.route(/\/(terminplan|kostenberechnung)\.html/,r=>r.fulfill({contentType:'text/html',body:werkzeug}));
  try{
    assert.equal(await page.locator('[data-work-view="terminplan"]').isVisible(),true);
    assert.equal(await page.locator('[data-work-view="kosten"]').isVisible(),true);
    await page.locator('[data-work-view="terminplan"]').click();
    await bereit(page,'terminplan');
    assert.equal(await page.locator('#workBody').isVisible(),false,'das Board ist ausgeblendet, nicht verlassen');
    assert.equal(await page.locator('[data-work-view="terminplan"]').evaluate(b=>b.classList.contains('active')),true);
    // Zwei Fassungen: die Wahl steht über der Seite; die zuletzt geänderte ist offen.
    const wahl=()=>page.locator('[data-work-tool-pane="terminplan"] [data-work-tool-pick]').evaluateAll(b=>b.map(x=>[x.textContent,x.getAttribute('aria-selected')]));
    assert.deepEqual(await wahl(),[['LPH 5','true'],['LPH 3','false']]);
    assert.deepEqual(await rahmen(page,'terminplan'),{src:'../terminplan.html?id=tp-lph5',ziel:'tp-lph5',url:'/terminplan.html?id=tp-lph5',marke:null});
    // Zum Planner und zurück: dieselbe Seite, nicht neu geladen.
    await markiere(page,'terminplan','A');
    await page.locator('[data-work-view="planner"]').click();
    await page.locator('[data-work-task="liste"]').waitFor();
    assert.equal(await page.locator('#workToolHost').isVisible(),false);
    await page.locator('[data-work-view="terminplan"]').click();
    await page.locator('[data-work-tool-pane="terminplan"]').waitFor();
    assert.equal((await rahmen(page,'terminplan')).marke,'A');
    // Andere Fassung: was noch aussteht, wird vorher gespeichert; die Wahl merkt sich das Gerät.
    await page.evaluate(()=>{document.querySelector('[data-work-tool-pane="terminplan"] iframe').contentWindow.__pending=true});
    await page.locator('[data-work-tool-pick="tp-lph3"]').click();
    await page.waitForFunction(()=>/id=tp-lph3/.test(document.querySelector('[data-work-tool-pane="terminplan"] iframe').contentWindow.location.search));
    assert.deepEqual(await page.evaluate(()=>window.__flushes),['/terminplan.html?id=tp-lph5']);
    assert.deepEqual(await wahl(),[['LPH 5','false'],['LPH 3','true']]);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tba-office-work-tool-v1')).p1.terminplan),'tp-lph3');
    // Hat inzwischen jemand anderes gespeichert, lädt der Reiter beim nächsten Öffnen neu; sonst nicht.
    await bereit(page,'terminplan');await markiere(page,'terminplan','B');
    await page.locator('[data-work-view="planner"]').click();await page.locator('[data-work-task="liste"]').waitFor();
    await page.evaluate(()=>{FIX.office_terminplan_instances.find(r=>r.id==='tp-lph3').server_revision=4});
    await page.locator('[data-work-view="terminplan"]').click();
    await page.waitForFunction(()=>{const w=document.querySelector('[data-work-tool-pane="terminplan"] iframe').contentWindow;return w.TBA_OFFICE_TOOL&&w.__marke===undefined});
    assert.equal((await rahmen(page,'terminplan')).url,'/terminplan.html?id=tp-lph3');

    // Kostenberechnung: keine im Projekt → anlegen im Reiter; Abbrechen führt zurück.
    await page.locator('[data-work-view="kosten"]').click();
    const anlegen=page.locator('[data-work-tool-pane="kosten"] [data-work-tool-create]');
    assert.equal(await anlegen.textContent(),'Kostenberechnung anlegen');
    assert.equal(await page.locator('[data-work-tool-pane="terminplan"]').isVisible(),false);
    await anlegen.click();
    await bereit(page,'kosten');
    assert.equal((await rahmen(page,'kosten')).url,'/kostenberechnung.html?neu=p1');
    await page.frames().find(f=>/kostenberechnung/.test(f.url())).evaluate(()=>parent.postMessage({tbaOfficeTool:'abgebrochen'},location.origin));
    await anlegen.waitFor();
    assert.equal(await rahmen(page,'kosten'),null);
    // Angelegt: die Seite öffnet die neue Kostenberechnung, Work übernimmt sie.
    await anlegen.click();await bereit(page,'kosten');
    await page.evaluate(()=>{FIX.office_kosten_instances.push({id:'kb-1',project_id:'p1',phase:'LPH3',updated_at:'2026-11-24T12:00:00Z',server_revision:1,is_archived:false})});
    await page.frames().find(f=>/kostenberechnung/.test(f.url())).evaluate(()=>location.assign('/kostenberechnung.html?id=kb-1'));
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tba-office-work-tool-v1')||'{}').p1?.kosten==='kb-1');
    await bereit(page,'kosten');
    assert.equal((await rahmen(page,'kosten')).ziel,'kb-1');
    assert.equal(await page.locator('[data-work-tool-pane="kosten"] .work-tool-bar').isVisible(),false,'eine Fassung: keine Wahl');
    assert.equal(await anlegen.count(),0);
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('Bucket: Beschreibung nur beim Zeigen auf den Titel oder über «Info» im Menü',async()=>{
  const {page,errors}=await board();
  try{
    const info=page.locator('[data-work-bucket-drop="b0"] .work-bucket-explanation-body');
    const ersteKarte=()=>page.locator('[data-work-bucket-drop="b0"] [data-work-task]').first().evaluate(c=>Math.round(c.getBoundingClientRect().top));
    assert.equal(await info.isVisible(),false,'nicht mehr unter jedem Titel');
    const oben=await ersteKarte();
    await page.locator('[data-work-bucket-drop="b0"] .work-bucket-grab strong').hover();
    await info.waitFor({state:'visible'});
    assert.equal(await info.evaluate(e=>getComputedStyle(e).position),'absolute','schwebt über den Karten');
    assert.equal(await ersteKarte(),oben,'die Karten bleiben stehen');
    assert.match(await info.textContent(),/Was zu diesem Paket gehört.*PSP 04\.03/);
    await page.mouse.move(5,5);
    await info.waitFor({state:'hidden'});
    // «Info» im Menü: bleibt offen, auch nach dem Neuzeichnen, bis man es ausblendet.
    await page.locator('[data-work-edit-bucket="b0"]').click();
    await page.locator('[data-work-bucket-info="b0"]').click();
    assert.equal(await info.isVisible(),true);
    assert.equal(await info.evaluate(e=>getComputedStyle(e).position),'static');
    assert.ok(await ersteKarte()>oben,'fest unter dem Titel');
    await page.evaluate(()=>window.MINDS_WORK.render());
    await page.locator('[data-work-bucket-drop="b0"].is-info-open').waitFor();
    await page.locator('[data-work-edit-bucket="b0"]').click();
    assert.equal(await page.locator('[data-work-bucket-info="b0"]').textContent(),'Info ausblenden');
    await page.locator('[data-work-bucket-info="b0"]').click();
    assert.equal(await info.isVisible(),false);
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

// Gari, 25.11.2026: die Mustermappe des Projekts als Reiter wie Terminplan und Kostenberechnung; Produkte und Hersteller
// als Seite je Projekt, gefiltert auf das Projekt.
test('Reiter Mustermappe, Produkte und Hersteller: Mappen wählen, weitere anlegen, Seiten des Projekts',async()=>{
  const {page,errors}=await board();
  await page.route(/\/(projektdokumente|produktbibliothek|herstellerkatalog)\.html/,r=>r.fulfill({contentType:'text/html',body:werkzeug}));
  try{
    for(const v of ['mustermappe','produkte','hersteller'])assert.equal(await page.locator('[data-work-view="'+v+'"]').isVisible(),true,v);
    await page.locator('[data-work-view="mustermappe"]').click();
    await bereit(page,'mustermappe');
    assert.deepEqual(await rahmen(page,'mustermappe'),{src:'../projektdokumente.html?projekt=p1&vorlage=mm-1',ziel:'mm-1',url:'/projektdokumente.html?projekt=p1&vorlage=mm-1',marke:null});
    // Schon bei einer Mappe steht die Wahl da, mit «Neue Mustermappe» daneben.
    const wahl=()=>page.locator('[data-work-tool-pane="mustermappe"] [data-work-tool-pick]').evaluateAll(b=>b.map(x=>[x.textContent,x.getAttribute('aria-selected')]));
    assert.deepEqual(await wahl(),[['Bodenbeläge','true']]);
    const neu=page.locator('[data-work-tool-pane="mustermappe"] .work-tool-add');
    assert.equal(await neu.textContent(),'Neue Mustermappe');
    // Eine weitere Mappe: was aussteht, wird vorher gespeichert; die Seite öffnet den Dialog (?neu=1).
    await page.evaluate(()=>{document.querySelector('[data-work-tool-pane="mustermappe"] iframe').contentWindow.__pending=true});
    await neu.click();
    await page.waitForFunction(()=>/neu=1/.test(document.querySelector('[data-work-tool-pane="mustermappe"] iframe').contentWindow.location.search));
    assert.deepEqual(await page.evaluate(()=>window.__flushes),['/projektdokumente.html?projekt=p1&vorlage=mm-1']);
    assert.equal((await rahmen(page,'mustermappe')).url,'/projektdokumente.html?projekt=p1&werkzeug=mustermappe&neu=1');
    // Zum Planner und zurück: der Dialog bleibt, Work lädt nicht die alte Mappe.
    await bereit(page,'mustermappe');await markiere(page,'mustermappe','N');
    await page.locator('[data-work-view="planner"]').click();await page.locator('[data-work-task="liste"]').waitFor();
    await page.locator('[data-work-view="mustermappe"]').click();
    await page.locator('[data-work-tool-pane="mustermappe"] [data-work-tool-pick]').first().waitFor();
    assert.equal((await rahmen(page,'mustermappe')).marke,'N');
    // Abgebrochen: zurück zur gewählten Mappe.
    await page.frames().find(f=>/projektdokumente/.test(f.url())).evaluate(()=>parent.postMessage({tbaOfficeTool:'abgebrochen'},location.origin));
    await page.waitForFunction(()=>/vorlage=mm-1/.test(document.querySelector('[data-work-tool-pane="mustermappe"] iframe')?.contentWindow?.location.search||''));
    // Angelegt: die Seite öffnet die neue Mappe über ihre Adresse; Work wählt sie.
    await neu.click();await bereit(page,'mustermappe');
    await page.evaluate(()=>{FIX.office_projektdokument_zeilen.push({id:'mm-2',dokument_id:'dok-v',nr:2,themenpaket:'Bäder',titel:'Mustermappe Bäder',updated_at:'2026-11-25T08:00:00Z',server_revision:1})});
    await page.frames().find(f=>/projektdokumente/.test(f.url())).evaluate(()=>location.assign('/projektdokumente.html?projekt=p1&vorlage=mm-2'));
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tba-office-work-tool-v1')||'{}').p1?.mustermappe==='mm-2');
    await page.locator('[data-work-tool-pick="mm-2"][aria-selected="true"]').waitFor();
    assert.deepEqual(await wahl(),[['Bodenbeläge','false'],['Bäder','true']]);
    assert.equal((await rahmen(page,'mustermappe')).ziel,'mm-2');
    // Bildschirmfoto nur, wenn WORK_FOTOS auf einen Ordner zeigt.
    if(process.env.WORK_FOTOS)await page.screenshot({path:path.join(process.env.WORK_FOTOS,'work-mustermappe.png')});

    // Produkte und Hersteller: eine Seite je Projekt, ohne Wahl; was man in der Seite öffnet, bleibt offen.
    await page.locator('[data-work-view="produkte"]').click();
    await bereit(page,'produkte');
    assert.equal((await rahmen(page,'produkte')).src,'../produktbibliothek.html?projekt=p1');
    assert.equal(await page.locator('[data-work-tool-pane="produkte"] .work-tool-bar').isVisible(),false);
    assert.equal(await page.locator('[data-work-tool-pane="mustermappe"]').isVisible(),false);
    await page.frames().find(f=>/produktbibliothek/.test(f.url())).evaluate(()=>location.assign('/produktbibliothek.html?id=pr-1&projekt=p1'));
    await page.waitForFunction(()=>/id=pr-1/.test(document.querySelector('[data-work-tool-pane="produkte"] iframe').contentWindow.location.search));
    await bereit(page,'produkte');
    await page.locator('[data-work-view="hersteller"]').click();
    await bereit(page,'hersteller');
    assert.equal((await rahmen(page,'hersteller')).src,'../herstellerkatalog.html?projekt=p1');
    await page.locator('[data-work-view="produkte"]').click();
    await page.locator('[data-work-tool-pane="produkte"]').waitFor();
    assert.equal((await rahmen(page,'produkte')).url,'/produktbibliothek.html?id=pr-1&projekt=p1');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tba-office-work-tool-v1')||'{}').p1?.produkte??null),null,'keine Fassung gemerkt');
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});
