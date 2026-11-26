// Chromium: der Reiter «Wissen» zeigt das Projektwissen (Gari, 26.11.2026). Seiten mit Herkunft, früheren Fassungen,
// Verweisen und offenen Hinweisen; Entscheidungen bestätigt nur die Projektleitung; Notizen und Hinweise gehen über
// die Funktionen der Datenbank, nie direkt in eine Tabelle. Wer nicht im Projektteam ist, liest nichts. Supabase ist
// eine lokale Attrappe – kein Netz, keine Produktion.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const index=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const pageCss=[...index.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>'<link rel="stylesheet" href="'+m[1]+'">').join('');
// Die Reiter genau so, wie die App sie zeichnet.
const tabs=fs.readFileSync(path.join(root,'app/shell.js'),'utf8').match(/<div class="work-tabs" role="tablist">[\s\S]*?<\/div>/)[0];

const seite=(id,title,body,updated_at,extra={})=>({id,project_id:'p1',memory_type:'document_state',status:'confirmed',title,body,updated_at,
  created_at:updated_at,user_id:'pa',metadata:{kind:'wissensseite',...extra}});
const flure=['Für die Flure gilt **Feinsteinzeug** in einem hellen Grau.','','## Entscheidung','','- Format 60 × 60 cm','- Fuge 2 mm',
  '  - Farbe der Fuge: zementgrau','','| Bereich | Belag | Stand |','|---|---|---|','| Flur EG | Feinsteinzeug | beschlossen |',
  '| Flur OG | <b>offen</b> | in Prüfung |','','Siehe auch [[Bäder]] und [Hersteller](https://example.com/fliese).','',
  '<script>window.__boese=1</script>','','[Nicht erlaubt](javascript:alert(1))'].join('\n');
const voll=()=>({
  isabella_projects:[{id:'p1',client_key:'p1',name:'Testprojekt',number:'0001',archived:false}],
  office_project_abschnitte:[],
  office_projects:[{id:'p1',projektleiter_id:'pa'}],
  office_members:[{user_id:'pa',display_name:'Gari Beispiel',role:'projektleiter'},{user_id:'pb',display_name:'Ana Muster',role:'member'},
    {user_id:'pc',display_name:'Carla Test',role:'member'}],
  office_project_members:[{project_id:'p1',user_id:'pa'},{project_id:'p1',user_id:'pb'}],
  // Wie die Datenbank: die zuletzt geänderte zuerst.
  minds_work_memory:[
    seite('s1','Bodenbelag Flure',flure,'2026-11-25T10:00:00Z',{kurz:'Was für die Flure gilt',quellen:['b1'],aktualisiert_von:'pa'}),
    seite('s2','Bäder','Wandfliesen bis 2,10 m. Boden wie [[Bodenbelag Flure]], aber rutschhemmend R10.','2026-11-24T10:00:00Z',{kurz:'Fliesen und Ausstattung'}),
    {...seite('s3','Flurbeläge','Alte Seite.','2026-11-23T10:00:00Z',{zusammengefuehrt_in:'Bodenbelag Flure'}),status:'superseded'},
    {...seite('s4','Projektsteckbrief','Kein Wissen, sondern der Steckbrief.','2026-11-22T10:00:00Z'),metadata:{kind:'projektsteckbrief'}},
    {id:'d1',project_id:'p1',memory_type:'decision',status:'proposed',title:'Feinsteinzeug 60 × 60 in den Fluren',body:'Hell grau, Fuge 2 mm.',
      occurred_at:'2026-11-25',confirmed_at:null,created_at:'2026-11-25T10:05:00Z',user_id:'pb',
      metadata:{vorgeschlagen_von:'pb',quelle:'Claude-Chat «Bodenbeläge»',seite:'Bodenbelag Flure',
        korrektur:'Empfehlung an die Bauherrschaft; bleibt vorgeschlagen, bis sie zustimmt.'}},
    {id:'d2',project_id:'p1',memory_type:'decision',status:'confirmed',title:'Keine Teppiche in den Fluren',body:null,
      occurred_at:'2026-11-20',confirmed_at:'2026-11-20T12:00:00Z',created_at:'2026-11-20T11:00:00Z',user_id:'pa',metadata:{entschieden_von:'pa'}},
    {id:'d3',project_id:'p1',memory_type:'decision',status:'superseded',title:'Naturstein in den Fluren',body:null,
      occurred_at:'2026-11-10',confirmed_at:'2026-11-10T12:00:00Z',created_at:'2026-11-10T11:00:00Z',user_id:'pa',metadata:{ersetzt_durch:'d2'}},
    // Eine Arbeitsregel des Teams, die zuerst als Entscheidung festgehalten wurde und jetzt auf ihrer Seite steht.
    {id:'d4',project_id:'p1',memory_type:'decision',status:'superseded',title:'Fliesenmuster nur mit Rückgabedatum anfragen',body:null,
      occurred_at:'2026-11-09',confirmed_at:'2026-11-09T12:00:00Z',created_at:'2026-11-09T11:00:00Z',user_id:'pa',
      metadata:{auf_seite:'Bäder',grund:'Arbeitsweise des Teams, keine Projektentscheidung; steht auf der Seite.'}}
  ],
  office_wissen_beitraege:[
    {id:'b2',project_id:'p1',titel:'Hinweis zu «Bodenbelag Flure»',inhalt:'Im OG ist Linoleum im Gespräch.',art:'korrektur',quelle:null,
      seite:'Bodenbelag Flure',eingearbeitet_am:null,eingearbeitet_in:[],created_at:'2026-11-26T08:00:00Z',user_id:'pb'},
    {id:'b1',project_id:'p1',titel:'Chat: Bodenbeläge mit Claude',inhalt:'Im Chat erarbeitet: **Feinsteinzeug** 60 × 60, Fuge 2 mm.',art:'chat',
      quelle:'Claude-Chat «Bodenbeläge»',seite:null,eingearbeitet_am:'2026-11-25T10:00:00Z',eingearbeitet_in:['Bodenbelag Flure'],
      created_at:'2026-11-25T09:50:00Z',user_id:'pa'}
  ],
  office_wissen_versionen:[{id:'v1',seite_id:'s1',titel:'Bodenbelag Flure',inhalt:'Erste Fassung: Feinsteinzeug, Format offen.',kurz:null,
    stand:'2026-11-20T09:00:00Z',von:'pb',grund:'Format ergänzt',ersetzt_am:'2026-11-25T10:00:00Z'}],
  office_wissen_protokoll:[
    {id:'l3',project_id:'p1',art:'entscheidung_vorgeschlagen',titel:'Feinsteinzeug 60 × 60 in den Fluren',ref_id:'d1',created_at:'2026-11-25T10:05:00Z',user_id:'pa'},
    {id:'l2',project_id:'p1',art:'seite_neu',titel:'Bodenbelag Flure',ref_id:'s1',created_at:'2026-11-25T10:00:00Z',user_id:'pa'},
    {id:'l1',project_id:'p1',art:'beitrag',titel:'Chat: Bodenbeläge mit Claude',ref_id:'b1',created_at:'2026-11-25T09:50:00Z',user_id:'pa'}
  ]
});
const leer=()=>{const f=voll();return {...f,minds_work_memory:[],office_wissen_beitraege:[],office_wissen_versionen:[],office_wissen_protokoll:[]}};

// «<» als \u003c, sonst beendet das </script> aus der Testseite das Skript der Attrappe.
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const harness=(uid,fix)=>`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${pageCss}</head>
<body data-section="work" class="office-app"><div class="app" id="app"><main id="swipeArea" class="swipe-area"><section id="workScreen" class="screen work-screen active" data-screen="work"><div class="work-shell">
<div class="work-head"><div><h1 id="workProjectTitle">Work</h1></div><div class="work-project-switch"></div></div>
${tabs}
<div id="workStatus" class="work-status"></div><div id="workBody" class="work-body"></div><div id="workToolHost" class="work-tool-host" hidden></div></div></section></main></div>
<div id="modalRoot" hidden></div>
<script>
localStorage.setItem('minds-work-project','p1');localStorage.setItem('minds-work-view','knowledge');
window.TBA_OFFICE_CONFIG={};window.__writes=[];window.__rpc=[];
const UID=${json(uid)},FIX=${json(fix)};
const wert=(r,c)=>{if(c.includes('->>')){const [a,f]=c.split('->>');return r[a]?.[f]}return r[c]};
const passt=(r,muster,c)=>String(wert(r,c)??'').toLowerCase().includes(String(muster).replace(/^%|%$/g,'').replace(/\\\\(.)/g,'$1').toLowerCase());
function q(table){const st={table,op:'select',filters:[],single:false};
  const b=new Proxy({}, {get(_,k){
    if(k==='then')return (res,rej)=>Promise.resolve(run()).then(res,rej);
    if(k==='update'||k==='insert'||k==='upsert'||k==='delete')return v=>{st.op=k;st.value=v;return b};
    if(['eq','in','is','ilike'].includes(k))return (c,v)=>{st.filters.push([k,c,v]);return b};
    if(k==='or')return s=>{st.filters.push(['or',s]);return b};
    if(k==='maybeSingle'||k==='single')return ()=>{st.single=true;return b};
    return ()=>b;}});
  function run(){
    if(st.op!=='select'){window.__writes.push({table,op:st.op,value:st.value});return {data:null,error:{message:'direkt geschrieben'}}}
    let rows=(FIX[table]||[]).slice();
    for(const [k,c,v] of st.filters){
      if(k==='eq')rows=rows.filter(r=>wert(r,c)===v);
      else if(k==='in')rows=rows.filter(r=>v.includes(wert(r,c)));
      else if(k==='is')rows=rows.filter(r=>(wert(r,c)??null)===v);
      else if(k==='ilike')rows=rows.filter(r=>passt(r,v,c));
      else if(k==='or'){const teile=c.split(',').map(t=>{const [col,op,...m]=t.split('.');return [col,op,m.join('.')]});
        rows=rows.filter(r=>teile.some(([col,op,m])=>op==='ilike'&&passt(r,m,col)))}
    }
    return {data:st.single?(rows[0]||null):rows,error:null,count:rows.length};}
  return b;}
async function rpc(name,args){
  window.__rpc.push({name,args});
  if(name==='office_wissen_beitrag_teilen'){const id='neu'+window.__rpc.length;
    FIX.office_wissen_beitraege.unshift({id,project_id:args.p_project,titel:args.p_titel,inhalt:args.p_inhalt,art:args.p_art,quelle:args.p_quelle,
      seite:args.p_seite,eingearbeitet_am:null,eingearbeitet_in:[],created_at:new Date().toISOString(),user_id:UID});
    return {data:id,error:null}}
  if(name==='office_wissen_entscheidung_pruefen'){const e=FIX.minds_work_memory.find(r=>r.id===args.p_id);
    if(!e)return {data:null,error:{message:'nicht gefunden'}};e.status=args.p_beschliessen?'confirmed':'rejected';return {data:e.status,error:null}}
  return {data:[],error:null};
}
window.MINDS_SUPABASE={auth:{getSession:async()=>({data:{session:{user:{id:UID}}}})},from:q,rpc,
  storage:{from:()=>({createSignedUrl:async()=>({data:null,error:null})})}};
window.MINDS_WORK_TEAM={members:async()=>[],open:async()=>{}};
window.ISABELLA_APP={getState:()=>({}),openModal:(title,html)=>{const e=document.getElementById('modalRoot');e.hidden=false;e.innerHTML='<h1>'+title+'</h1>'+html},
  closeModal:()=>{const e=document.getElementById('modalRoot');e.hidden=true;e.innerHTML=''}};
</script>
<script src="./task-team.js"></script><script src="./task-detail.js"></script><script src="./planner-terminplan-sync.js"></script>
<script src="./office-wissen.js"></script><script src="./work.js"></script></body></html>`;

const pages=new Map([['gari',harness('pa',voll())],['ana',harness('pb',voll())],['carla',harness('pc',voll())],['leer',harness('pa',leer())]]);
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent((req.url||'').split('?')[0]);
 const m=pathname.match(/^\/app\/__wissen_([a-z]+)__\.html$/);
 if(m&&pages.has(m[1])){res.writeHead(200,{'content-type':'text/html'});res.end(pages.get(m[1]));return;}
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,buf)=>{if(error){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(buf);});
}).listen(0);
const browser=await chromium.launch({headless:true});
test.after(async()=>{await browser.close();server.close()});

async function oeffnen(wer,viewport={width:1280,height:900}){
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/app/__wissen_${wer}__.html#section=work`);
  await page.locator('.wissen, .wissen-leer').first().waitFor();
  return {page,errors};
}
const text=(page,sel)=>page.locator(sel).first().innerText();
const titel=page=>page.locator('.wissen-blatt h3').first().innerText();
const rpcs=page=>page.evaluate(()=>window.__rpc.filter(c=>c.name.startsWith('office_wissen')));

test('Seite: Reiter neben Panorama, Liste ohne alte Seiten, sicheres Markdown, Herkunft, Fassungen, Verweise, Hinweise',async()=>{
  const {page,errors}=await oeffnen('gari');
  try{
    await page.locator('.wissen-blatt .wissen-text').waitFor();
    const reiter=await page.evaluate(()=>{const b=document.querySelector('[data-work-view="knowledge"]');
      return {hidden:b.hidden,active:b.classList.contains('active'),vorher:b.previousElementSibling?.dataset.workView,text:b.textContent}});
    assert.deepEqual(reiter,{hidden:false,active:true,vorher:'overview',text:'Wissen'});
    const liste=await page.locator('.wissen-eintrag strong').allInnerTexts();
    assert.deepEqual(liste,['Bodenbelag Flure','Bäder'],'keine zusammengeführte Seite, kein Steckbrief');
    assert.equal(await page.locator('.wissen-eintrag.is-aktiv').getAttribute('aria-current'),'page');
    assert.equal(await titel(page),'Bodenbelag Flure');
    const meta=await text(page,'.wissen-blatt-kopf .wissen-meta');
    assert.match(meta,/^Stand 25\.11\.2026, \d\d:\d\d · Gari Beispiel · 1 frühere Fassung$/);
    // Markdown: Überschriften verschoben, verschachtelte Liste, Tabelle; HTML im Text bleibt Text.
    const md=await page.evaluate(()=>{const t=document.querySelector('.wissen-text');return {
      h4:t.querySelector('h4')?.textContent,unter:t.querySelector('ul ul li')?.textContent,reihen:t.querySelectorAll('tbody tr').length,
      zelle:t.querySelectorAll('tbody tr')[1]?.children[1]?.textContent,fett:t.querySelector('strong')?.textContent,
      skripte:t.querySelectorAll('script').length,b:t.querySelectorAll('b').length,boese:window.__boese===undefined,
      link:[...t.querySelectorAll('a')].map(a=>[a.getAttribute('href'),a.target,a.rel]),js:/javascript:/.test(t.innerHTML.replace(/\[Nicht erlaubt\]\(javascript:alert\(1\)\)/,''))}});
    assert.deepEqual(md,{h4:'Entscheidung',unter:'Farbe der Fuge: zementgrau',reihen:2,zelle:'<b>offen</b>',fett:'Feinsteinzeug',
      skripte:0,b:0,boese:true,link:[['https://example.com/fliese','_blank','noopener noreferrer']],js:false});
    const teile=await page.locator('.wissen-teil h4').allInnerTexts();
    assert.deepEqual(teile.map(t=>t.replace(/\s+/g,' ')),['OFFENE HINWEISE 1','HERKUNFT','VERWEISE HIERHER']);
    assert.match(await text(page,'.wissen-wartet'),/Hinweis zu «Bodenbelag Flure»\s*· Ana Muster/);
    assert.match(await page.locator('.wissen-teil').nth(1).innerText(),/Chat: Bodenbeläge mit Claude\s*· Aus einem Chat · Gari Beispiel/);
    assert.equal(await page.locator('.wissen-teil').nth(2).locator('button').innerText(),'Bäder');
    // Herkunft öffnet den Beitrag, die frühere Fassung ihren Text.
    await page.locator('.wissen-teil').nth(1).locator('[data-wissen-beitrag="b1"]').click();
    await page.locator('#modalRoot .wissen-modal').waitFor();
    assert.match(await text(page,'#modalRoot'),/Chat: Bodenbeläge mit Claude[\s\S]*Eingearbeitet in: Bodenbelag Flure[\s\S]*Im Chat erarbeitet: Feinsteinzeug 60 × 60/);
    await page.locator('.wissen-verlauf summary').click();
    await page.locator('[data-wissen-fassung="v1"]').click();
    await page.waitForFunction(()=>/Fassung vom 20\.11\.2026/.test(document.getElementById('modalRoot').textContent));
    assert.match(await text(page,'#modalRoot'),/Format ergänzt[\s\S]*Erste Fassung: Feinsteinzeug, Format offen\./);
    // [[Bäder]] führt zur Seite, und Bäder zurück.
    await page.locator('.wissen-text [data-wissen-seite="Bäder"]').click();
    await page.waitForFunction(()=>document.querySelector('.wissen-blatt h3')?.textContent==='Bäder');
    assert.equal(await page.locator('.wissen-eintrag.is-aktiv strong').innerText(),'Bäder');
    await page.locator('.wissen-text [data-wissen-seite="Bodenbelag Flure"]').click();
    await page.waitForFunction(()=>document.querySelector('.wissen-blatt h3')?.textContent==='Bodenbelag Flure');
    // Zweispaltig am Schreibtisch.
    const lage=await page.evaluate(()=>{const l=document.querySelector('.wissen-liste').getBoundingClientRect(),b=document.querySelector('.wissen-blatt').getBoundingClientRect();return l.right<=b.left&&Math.abs(l.top-b.top)<4});
    assert.equal(lage,true);
    assert.deepEqual(await page.evaluate(()=>window.__writes),[],'kein direktes Schreiben');
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('Hinweis und Notiz gehen über die Funktion; die Projektleitung bestätigt eine Entscheidung',async()=>{
  const {page,errors}=await oeffnen('gari');
  try{
    await page.locator('.wissen-blatt .wissen-text').waitFor();
    await page.locator('[data-wissen-hinweis]').click();
    await page.locator('form[data-wissen-formular="korrektur"] textarea').fill('Im EG bleibt es beim Feinsteinzeug, im OG prüfen wir Linoleum.');
    await page.locator('form[data-wissen-formular="korrektur"] [type="submit"]').click();
    await page.waitForFunction(()=>/Danke, Ihr Hinweis ist gespeichert/.test(document.getElementById('workStatus').textContent));
    await page.waitForFunction(()=>/OFFENE HINWEISE\s*2/i.test(document.querySelector('.wissen-wartet h4')?.innerText||''));
    let calls=await rpcs(page);
    assert.deepEqual(calls.at(-1),{name:'office_wissen_beitrag_teilen',args:{p_project:'p1',p_titel:'Hinweis zu «Bodenbelag Flure»',
      p_inhalt:'Im EG bleibt es beim Feinsteinzeug, im OG prüfen wir Linoleum.',p_art:'korrektur',p_quelle:null,p_seite:'Bodenbelag Flure'}});
    // Notiz: mit Titel; leer wird nichts gespeichert.
    await page.locator('[data-wissen-notiz]').click();
    await page.locator('form[data-wissen-formular="notiz"] input[name="titel"]').fill('Termin mit dem Fliesenleger');
    await page.locator('form[data-wissen-formular="notiz"] textarea').fill('Der Fliesenleger kommt am Dienstag zur Bemusterung.');
    await page.locator('form[data-wissen-formular="notiz"] [type="submit"]').click();
    await page.waitForFunction(()=>/Danke, Ihre Notiz ist gespeichert/.test(document.getElementById('workStatus').textContent));
    calls=await rpcs(page);
    assert.deepEqual([calls.length,calls.at(-1).args.p_art,calls.at(-1).args.p_titel,calls.at(-1).args.p_seite],[2,'notiz','Termin mit dem Fliesenleger',null]);
    // «Neu»: was auf die KI wartet, und was zuletzt geschah.
    await page.locator('[data-wissen-ansicht="neu"]').click();
    await page.waitForFunction(()=>document.querySelector('.wissen-blatt h3')?.textContent==='Neu im Projektwissen');
    assert.match(await text(page,'.wissen-wartet h4'),/WARTET AUF EINARBEITUNG\s*3/i);
    assert.match(await text(page,'.wissen-blatt'),/Termin mit dem Fliesenleger\s*· Notiz · Gari Beispiel/);
    assert.match(await text(page,'.wissen-blatt'),/Seite angelegt: Bodenbelag Flure/);
    // Entscheidungen: die offene bestätigen.
    assert.equal(await text(page,'[data-wissen-ansicht="entscheidungen"] .wissen-zahl'),'1 offen');
    await page.locator('[data-wissen-ansicht="entscheidungen"]').click();
    await page.waitForFunction(()=>document.querySelector('.wissen-blatt h3')?.textContent==='Entscheidungen');
    const vorher=await page.locator('.wissen-blatt .wissen-teil > h4, .wissen-blatt .wissen-teil > summary').allInnerTexts();
    assert.deepEqual(vorher.map(t=>t.replace(/\s+/g,' ').toUpperCase()),['ZUR BESTÄTIGUNG 1','BESCHLOSSEN 1','ERSETZT ODER VERWORFEN (2)']);
    assert.match(await text(page,'.wissen-entscheidung[data-status="proposed"]'),/vorgeschlagen von Ana Muster · Herkunft: Claude-Chat «Bodenbeläge» · Seite: Bodenbelag Flure\s*Empfehlung an die Bauherrschaft; bleibt vorgeschlagen, bis sie zustimmt\./);
    // Was aus den alten wurde: ersetzt durch eine neuere, oder als Arbeitsweise auf die Seite gestellt (mit Link).
    await page.locator('.wissen-alt summary').click();
    const alt=await page.locator('.wissen-alt .wissen-entscheidung').allInnerTexts();
    assert.match(alt[0],/Naturstein in den Fluren[\s\S]*Ersetzt durch «Keine Teppiche in den Fluren»/);
    assert.match(alt[1],/Fliesenmuster nur mit Rückgabedatum anfragen[\s\S]*Keine Projektentscheidung, sondern Arbeitsweise des Teams: steht auf der Seite Bäder\./);
    await page.locator('[data-wissen-beschliessen="d1"]').click();
    await page.waitForFunction(()=>document.getElementById('workStatus').textContent==='Entscheidung bestätigt.');
    await page.waitForFunction(()=>!document.querySelector('[data-wissen-beschliessen]'));
    calls=await rpcs(page);
    assert.deepEqual(calls.at(-1),{name:'office_wissen_entscheidung_pruefen',args:{p_id:'d1',p_beschliessen:true}});
    assert.match(await text(page,'.wissen-blatt .wissen-teil > h4'),/BESCHLOSSEN\s*2/i);
    assert.equal(await page.locator('[data-wissen-ansicht="entscheidungen"] .wissen-zahl').count(),0);
    await page.locator('.wissen-alt summary').click();
    await page.locator('.wissen-alt [data-wissen-seite="Bäder"]').click();
    await page.waitForFunction(()=>document.querySelector('.wissen-blatt h3')?.textContent==='Bäder');
    assert.deepEqual(await page.evaluate(()=>window.__writes),[],'kein direktes Schreiben');
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('Suche findet Seiten und Beiträge; leer zurück zur Seite',async()=>{
  const {page,errors}=await oeffnen('gari');
  try{
    await page.locator('.wissen-blatt .wissen-text').waitFor();
    await page.locator('.wissen-suche').fill('feinsteinzeug');
    await page.waitForFunction(()=>/^Suche: «feinsteinzeug»$/.test(document.querySelector('.wissen-blatt h3')?.textContent||''));
    const treffer=await page.locator('.wissen-treffer > li > button').allInnerTexts();
    assert.deepEqual(treffer,['Bodenbelag Flure','Chat: Bodenbeläge mit Claude']);
    await page.locator('.wissen-treffer [data-wissen-id="s1"]').click();
    await page.waitForFunction(()=>document.querySelector('.wissen-blatt h3')?.textContent==='Bodenbelag Flure');
    await page.locator('.wissen-suche').fill('xyz123');
    await page.waitForFunction(()=>/Nichts gefunden/.test(document.querySelector('.wissen-blatt')?.textContent||''));
    await page.locator('.wissen-suche').fill('');
    await page.waitForFunction(()=>document.querySelector('.wissen-blatt h3')?.textContent==='Bodenbelag Flure');
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('Ein Teammitglied ohne Projektleitung sieht Entscheidungen, bestätigt aber nicht',async()=>{
  const {page,errors}=await oeffnen('ana');
  try{
    await page.locator('.wissen-blatt .wissen-text').waitFor();
    await page.locator('[data-wissen-ansicht="entscheidungen"]').click();
    await page.waitForFunction(()=>document.querySelector('.wissen-blatt h3')?.textContent==='Entscheidungen');
    assert.equal(await page.locator('[data-wissen-beschliessen],[data-wissen-verwerfen]').count(),0);
    assert.match(await text(page,'.wissen-entscheidung[data-status="proposed"]'),/Wartet auf die Projektleitung\./);
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('Wer nicht im Projektteam ist, bekommt eine Erklärung statt leerer Seiten',async()=>{
  const {page,errors}=await oeffnen('carla');
  try{
    await page.locator('.wissen-leer h3').waitFor();
    assert.equal(await text(page,'.wissen-leer h3'),'Das Projektwissen sieht das Projektteam');
    assert.match(await text(page,'.wissen-leer'),/Sie gehören nicht zum Team von «Testprojekt»/);
    assert.equal(await page.locator('.wissen-raster').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('Ohne Projektwissen: wie es entsteht',async()=>{
  const {page,errors}=await oeffnen('leer');
  try{
    await page.locator('.wissen-blatt .wissen-leer').waitFor();
    assert.equal(await text(page,'.wissen-leer h3'),'Noch kein Projektwissen');
    assert.match(await text(page,'.wissen-leer'),/«Ins Office übernehmen»/);
    assert.equal(await text(page,'.wissen-liste .wissen-leer-klein'),'Noch keine Seiten.');
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('iPhone: Liste über der Seite, nichts ragt über den Rand',async()=>{
  const {page,errors}=await oeffnen('gari',{width:390,height:844});
  try{
    await page.locator('.wissen-blatt .wissen-text').waitFor();
    const m=await page.evaluate(()=>{const w=document.querySelector('.wissen'),l=document.querySelector('.wissen-liste').getBoundingClientRect(),
      b=document.querySelector('.wissen-blatt').getBoundingClientRect(),t=document.querySelector('.wissen-tabelle');
      return {gestapelt:l.bottom<=b.top+1,breit:w.scrollWidth<=w.clientWidth+1,seite:document.documentElement.scrollWidth<=window.innerWidth+1,
        tabelle:t.clientWidth<=b.width}});
    assert.deepEqual(m,{gestapelt:true,breit:true,seite:true,tabelle:true});
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});
