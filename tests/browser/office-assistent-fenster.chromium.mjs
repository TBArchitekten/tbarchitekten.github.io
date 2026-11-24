// Chromium: Ein Fenster für alle Assistenten des Office (Gari, 24.11.2026: «sí a una sola apariencia para los dos y los
// que vengan … debería de poder moverse también y no estar siempre estable en la esquina»). Terminplan und
// Kostenberechnung zeigen dasselbe Fenster (assistant-surface.css, assistant-window.js): zu ein Reiter unten rechts,
// offen ein schwebendes Fenster; verschiebbar offen und zu, vergrößerbar, Größe an der freien Ecke, je Gerät gemerkt.
// Supabase ist eine lokale Attrappe – kein Netz, keine Produktion. Bildschirmfotos nur mit ASSISTENT_FOTOS=<Ordner>.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const kostenFake=fs.readFileSync(new URL('./fixtures/fake-supabase-kosten.js',import.meta.url),'utf8');
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
const FOTOS=process.env.ASSISTENT_FOTOS||'';
const foto=async(page,name)=>{if(FOTOS)await page.screenshot({path:path.join(FOTOS,name+'.png')})};
const adresse=p=>`http://localhost:${server.address().port}/${p}`;

const UID='11111111-1111-4111-8111-111111111111';
const plan={id:'tp-1',owner_id:UID,project_id:'p-1',project_number:'T-01',project_name:'Testhaus',phase:'LPH3',template_version:'1',
  updated_at:'2026-11-24T10:00:00Z',server_revision:3,
  state:{project:{name:'Testhaus',projectNumber:'T-01',projectName:'Testhaus',phase:'LPH3',start:'2027-01-04',end:'2027-02-26',standDate:'2027-01-04'},
    groups:[{id:'g1',name:'Entwurf',wbs:'01'}],tasks:[{id:'t1',group:'g1',name:'Vorentwurf prüfen',start:'2027-01-04',end:'2027-01-08',type:'task'}]}};
const terminplanFake=`(function(){
  const session={access_token:'fake',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'${UID}',email:'test@fixture.invalid'}};
  const rows={office_members:[{user_id:'${UID}',email:'test@fixture.invalid',display_name:'Test Leitung',role:'admin',is_active:true,must_change_password:false}],
    office_terminplan_instances:[${JSON.stringify(plan)}],office_projects:[{id:'p-1',projektleiter_id:'${UID}'}]};
  function builder(table){let single=false;const q={};
    ['select','eq','neq','in','is','lt','lte','gt','gte','order','limit','range','match','not','or','filter','contains','insert','update','upsert','delete']
      .forEach(k=>q[k]=()=>q);
    q.single=()=>{single=true;return q};q.maybeSingle=()=>{single=true;return q};
    q.then=(ok,bad)=>{const r=rows[table]||[];return Promise.resolve({data:single?(r[0]||null):r,error:null}).then(ok,bad)};
    return q}
  const client={auth:{getSession:async()=>({data:{session},error:null})},from:builder,rpc:async()=>({data:null,error:null}),
    functions:{invoke:async()=>({data:null,error:null})},
    storage:{from:()=>({upload:async()=>({error:null}),remove:async()=>({error:null}),createSignedUrl:async()=>({data:null,error:null})})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){}};
  window.supabase={createClient:()=>client};
})();`;

async function seite(datei,fake,viewport={width:1440,height:900}){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await ctx.newPage();const fehler=[];page.on('pageerror',e=>fehler.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co|fonts\.(googleapis|gstatic)/,r=>r.abort());
  await page.goto(adresse(datei));
  return {ctx,page,fehler};
}
const kasten=(page,sel)=>page.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),
  rechts:Math.round(innerWidth-r.right),unten:Math.round(innerHeight-r.bottom)}});
async function ziehe(page,sel,dx,dy){
  const b=await page.locator(sel).boundingBox();
  const x=b.x+b.width/2,y=b.y+b.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+dx/2,y+dy/2,{steps:6});await page.mouse.move(x+dx,y+dy,{steps:6});
  await page.mouse.up();
}

test('Terminplan: Reiter unten rechts, verschieben zu und offen, öffnet von seiner Ecke aus, gemerkt',async()=>{
  const {ctx,page,fehler}=await seite('terminplan.html?id=tp-1',terminplanFake);
  try{
    await page.locator('#officePlanLabel',{hasText:'Testhaus'}).waitFor();
    const panel='#assistantPanel';
    const anfang=await kasten(page,panel);
    assert.deepEqual([anfang.rechts,anfang.unten,anfang.w,anfang.h],[22,20,242,54],'der Reiter wie bisher unten rechts');
    await foto(page,'tp-1-reiter');
    // Den Reiter nach links oben ziehen: er bleibt zu (Ziehen ist kein Klick) und merkt sich die Ecke links oben.
    await ziehe(page,'#assistantToggle',-1000,-600);
    let k=await kasten(page,panel);
    assert.ok(k.x<200&&k.y<300,'links oben: '+JSON.stringify(k));
    assert.equal(await page.locator('#assistantBody').isHidden(),true,'Ziehen öffnet nicht');
    assert.equal(await page.locator(panel).getAttribute('data-ecke'),'lo');
    const gemerkt=await page.evaluate(()=>JSON.parse(localStorage.getItem('office-assistant-window-v2:terminplan')));
    assert.equal(gemerkt.ecke,'lo');
    // Öffnen: die linke obere Ecke bleibt stehen, das Fenster wächst zur Mitte (passt es nicht ganz, rückt es so wenig
    // wie nötig nach oben).
    await page.click('#assistantToggle');
    await page.locator('#assistantBody').waitFor();
    await page.waitForTimeout(300);
    const offen=await kasten(page,panel);
    assert.equal(offen.x,k.x);
    assert.ok(offen.y<=k.y&&offen.unten>=8&&(offen.y===k.y||offen.unten===8),'oben: '+JSON.stringify([k,offen]));
    assert.ok(offen.w>=440&&offen.h>=500,'offen groß: '+JSON.stringify(offen));
    await foto(page,'tp-2-offen-links-oben');
    // Vergrößern und zurück.
    await page.click('#assistantWide');await page.waitForTimeout(300);
    assert.ok((await kasten(page,panel)).w>=780);
    await page.click('#assistantWide');await page.waitForTimeout(300);
    // Größe an der freien Ecke (rechts unten, weil die Ecke links oben gemerkt ist).
    const vorher=await kasten(page,panel);
    await ziehe(page,`${panel} .assistant-resize`,60,-80);
    const nachher=await kasten(page,panel);
    assert.deepEqual([nachher.x,nachher.y],[vorher.x,vorher.y],'die gemerkte Ecke bleibt stehen');
    assert.ok(Math.abs(nachher.w-vorher.w-60)<=2&&Math.abs(nachher.h-vorher.h+80)<=2,'Größe: '+JSON.stringify([vorher,nachher]));
    // Offen am Kopf nach rechts unten ziehen: die Ecke wechselt; schließen legt den Reiter in diese Ecke.
    await ziehe(page,`${panel} .assistant-head`,2000,2000);
    k=await kasten(page,panel);
    assert.equal(await page.locator(panel).getAttribute('data-ecke'),'ru');
    assert.deepEqual([k.rechts,k.unten],[8,8]);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    k=await kasten(page,panel);
    assert.deepEqual([k.rechts,k.unten,k.w,k.h],[8,8,242,54]);
    // Neu laden: die Stelle bleibt.
    await page.reload();await page.locator('#officePlanLabel',{hasText:'Testhaus'}).waitFor();
    k=await kasten(page,panel);
    assert.deepEqual([k.rechts,k.unten],[8,8]);
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('Kostenberechnung: dasselbe Fenster wie der Terminplan, verschiebbar; Details gehen vor',async()=>{
  const {ctx,page,fehler}=await seite('kostenberechnung.html',kostenFake);
  try{
    await page.locator('h1',{hasText:'Kostenberechnungen'}).waitFor();
    await page.click('[data-act="neu"]');await page.locator('#kbNeu button[type="submit"]').click();
    await page.locator('h1',{hasText:'Testhaus'}).waitFor();
    const panel='#kbAssistent';
    const zu=await kasten(page,panel);
    assert.deepEqual([zu.rechts,zu.unten,zu.w,zu.h],[22,20,242,54],'derselbe Reiter wie beim Terminplan');
    assert.equal((await page.locator(`${panel} .assistant-toggle`).textContent()).trim(),'▸ Kosten Assistent');
    await foto(page,'kb-1-reiter');
    await page.click('#asToggle');
    await page.locator('#asBody').waitFor();
    await page.waitForTimeout(300);
    const offen=await kasten(page,panel);
    assert.deepEqual([offen.rechts,offen.unten],[22,20]);
    assert.ok(offen.w>=440&&offen.h>=500,'offen: '+JSON.stringify(offen));
    // Gleiche Form wie das Terminplan-Gespräch: Kopf, Senden-Knopf, Eingabefeld.
    const stil=await page.evaluate(()=>{const s=e=>getComputedStyle(document.querySelector(e));
      return {kopf:s('#kbAssistent .assistant-head').height,senden:s('#asSenden').backgroundColor,feld:s('#asText').backgroundColor,rand:s('#kbAssistent').borderRadius}});
    assert.deepEqual(stil,{kopf:'53px',senden:'rgb(23, 105, 212)',feld:'rgb(245, 245, 247)',rand:'20px'});
    assert.ok(!(await page.evaluate(()=>document.getElementById('kb').classList.contains('mit-inspektor'))),'die Tabelle rückt nicht');
    await foto(page,'kb-2-offen');
    // Verschieben am Kopf, gemerkt je Werkzeug.
    await ziehe(page,`${panel} .assistant-head`,-700,0);
    const weg=await kasten(page,panel);
    assert.ok(weg.x<offen.x-600,'nach links: '+JSON.stringify(weg));
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('office-assistant-window-v2:kostenberechnung')).ecke),'lu');
    assert.equal(await page.evaluate(()=>localStorage.getItem('office-assistant-window-v2:terminplan')),null,'je Werkzeug');
    // Details einer Kostengruppe gehen vor: das Fenster tritt zurück und kommt danach wieder.
    await page.click('.tab[data-tab="positionen"]');
    await page.click('[data-act="filter"][data-kg="330"]');
    await page.click('.pos.kgz[data-kg="335"]');
    await page.locator('.inspektor:not(.assistent)').waitFor();
    assert.equal(await page.locator(panel).isHidden(),true);
    await page.keyboard.press('Escape');
    await page.locator(panel).waitFor({state:'visible'});
    assert.equal(await page.locator('#asBody').isVisible(),true,'bleibt offen');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});

test('iPhone: der Reiter und das offene Fenster unten über die Breite, ohne Verschieben',async()=>{
  const {ctx,page,fehler}=await seite('terminplan.html?id=tp-1',terminplanFake,{width:390,height:844});
  try{
    await page.locator('#officePlanLabel',{hasText:'Testhaus'}).waitFor();
    await page.evaluate(()=>localStorage.setItem('office-assistant-window-v2:terminplan',JSON.stringify({ecke:'lo',x:20,y:20})));
    await page.reload();await page.locator('#officePlanLabel',{hasText:'Testhaus'}).waitFor();
    const zu=await kasten(page,'#assistantPanel');
    assert.deepEqual([zu.rechts,zu.unten],[10,10],'am Telefon gilt keine gemerkte Stelle');
    await page.click('#assistantToggle');await page.locator('#assistantBody').waitFor();await page.waitForTimeout(300);
    const offen=await kasten(page,'#assistantPanel');
    assert.deepEqual([offen.x,offen.rechts,offen.unten],[10,10,10],'unten über die Breite');
    assert.deepEqual(fehler,[]);
  }finally{await ctx.close()}
});
