// Chromium · B2 (27.11.2026, Entwurf von Gari freigegeben): am Desktop stehen Projektwahl und Abschnitte unter «Work» in
// der Seitenleiste, die Reiterzeile und die Projektzeile oben entfallen; auf Symbole reduziert bleiben Projektkürzel
// und Symbole. Der Planner hat Titel, Filter und Knöpfe in einer Leiste. Auf dem iPhone bleibt alles wie bisher.
// Supabase ist die Attrappe der Tests – kein Netz, keine Produktion.
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

const P='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',Q='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function oeffne(breite,ansicht='planner'){
  const page=await browser.newPage({viewport:{width:breite,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/,r=>r.fulfill({contentType:'text/javascript',body:fake}));
  await page.route(/supabase\.co|fonts\.(googleapis|gstatic)/,r=>r.abort());
  await page.addInitScript(([P,Q,ansicht])=>{
    window.__fakeRows={
      office_project_abschnitte:['terminplan','kosten','mustermappe'].map(abschnitt=>({project_id:P,abschnitt})),
      isabella_projects:[{id:P,client_key:P,name:'Beispielhaus',number:'101',archived:false},{id:Q,client_key:Q,name:'Wohnhaus am Lindenweg',number:'102',archived:false}],
      office_projects:[{id:P,number:'101',name:'Beispielhaus',status:'aktiv'},{id:Q,number:'102',name:'Wohnhaus am Lindenweg',status:'aktiv'}],
      minds_work_buckets:[{id:'b0',name:'Entwurf',sort_order:0,archived:false}]};
    try{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('minds-work-project',P);localStorage.setItem('minds-work-view',ansicht)}}catch{}
  },[P,Q,ansicht]);
  await page.goto(`http://localhost:${server.address().port}/app/#section=work`);
  await page.waitForFunction(()=>document.querySelectorAll('.work-tabs [data-work-view]:not([hidden])').length>3,null,{timeout:10000});
  await page.waitForTimeout(300);
  return {page,errors};
}
const sichtbar=(page,sel)=>page.$eval(sel,e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length)).catch(()=>false);

test('Desktop: Projekt und Abschnitte in der Seitenleiste, keine Reiterzeile oben',async()=>{
  const {page,errors}=await oeffne(1440);
  try{
    assert.equal(await sichtbar(page,'#lensWork'),true,'Abschnitte in der Seitenleiste');
    assert.equal(await sichtbar(page,'.work-tabs'),false,'keine Reiterzeile');
    assert.equal(await sichtbar(page,'.work-head'),false,'keine Projektzeile');
    const reiter=await page.$$eval('.work-tabs [data-work-view]:not([hidden])',bs=>bs.map(b=>b.textContent.trim()));
    const leiste=await page.$$eval('#lensWork [data-lens-view]',bs=>bs.map(b=>b.textContent.trim()));
    assert.deepEqual(leiste,reiter,'dieselben Abschnitte in derselben Reihenfolge');
    assert.equal(await page.$eval('#lensWork .lens-work-abschnitt.active',b=>b.dataset.lensView),'planner');
    // Ein Klick wählt den Abschnitt wie der Reiter.
    await page.click('#lensWork [data-lens-view="overview"]');
    await page.waitForFunction(()=>document.querySelector('.work-tabs [data-work-view="overview"]')?.classList.contains('active'));
    await page.waitForFunction(()=>document.querySelector('#lensWork .lens-work-abschnitt.active')?.dataset.lensView==='overview');
    // Projektwahl: beide Projekte, die Wahl geht an work.js.
    await page.click('#lensWork .lens-work-projekt');
    assert.deepEqual(await page.$$eval('.lens-work-menue [data-lens-project]',bs=>bs.map(b=>b.textContent.trim())),['BE101 · Beispielhaus','WL102 · Wohnhaus am Lindenweg']);
    await page.click(`.lens-work-menue [data-lens-project="${Q}"]`);
    await page.waitForFunction(q=>document.querySelector(`.work-project-switch [data-work-project="${q}"]`)?.classList.contains('active'),Q);
    await page.waitForFunction(()=>document.querySelector('#lensWork .lens-work-name')?.textContent==='Wohnhaus am Lindenweg');
    assert.equal(await page.$('.lens-work-menue'),null,'Menü geschlossen');
    // «+ Abschnitt» öffnet das Menü der Abschnitte rechts neben der Seitenleiste.
    await page.click('#lensWork [data-lens-plus]');
    const menue=await page.$eval('#workAbschnitteMenu',m=>Math.round(m.getBoundingClientRect().left));
    const rand=await page.$eval('#desktopLenses',n=>Math.round(n.getBoundingClientRect().right));
    assert.ok(menue>=rand-8,'Menü neben der Seitenleiste ('+menue+' / '+rand+')');
    await page.keyboard.press('Escape');
    // Andere Ansichten zeigen keine Abschnitte.
    await page.click('#desktopLenses [data-nav="calendar"]');
    await page.waitForTimeout(300);
    assert.equal(await sichtbar(page,'#lensWork'),false,'im Kalender keine Abschnitte');
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('Auf Symbole reduziert: Projektkürzel und Symbole, Namen im Tooltip',async()=>{
  const {page,errors}=await oeffne(1440);
  try{
    if(!await page.evaluate(()=>document.body.classList.contains('minds-nav-collapsed')))await page.click('.desk-nav-collapse');
    await page.waitForFunction(()=>document.body.classList.contains('minds-nav-collapsed'));
    assert.equal(await page.$eval('#lensWork .lens-work-chip',e=>e.textContent),'BE');
    assert.equal(await sichtbar(page,'#lensWork .lens-work-label'),false,'keine Namen');
    assert.equal(await sichtbar(page,'#lensWork [data-lens-view="planner"] svg'),true,'Symbol');
    assert.equal(await page.$eval('#lensWork [data-lens-view="planner"]',b=>b.title),'Planner');
    const breite=await page.$eval('#desktopLenses',n=>n.getBoundingClientRect().width);
    assert.ok(breite<=70,'schmale Leiste ('+breite+')');
    assert.equal(await page.evaluate(()=>window.TBA_WORK_LENS.kuerzel('Wohnhaus am Lindenweg')),'WL');
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('Planner: Titel, Filter und Knöpfe in einer Leiste',async()=>{
  const {page,errors}=await oeffne(1440);
  try{
    await page.waitForSelector('.work-planner-toolbar .work-planner-filter');
    const zeilen=await page.evaluate(()=>{
      const leiste=document.querySelector('.work-planner-toolbar');
      const mitte=e=>{const r=e.getBoundingClientRect();return Math.round(r.top+r.height/2)};
      return [leiste.querySelector('strong'),leiste.querySelector('.work-planner-filter'),leiste.querySelector('[data-work-add-bucket]')].map(mitte);
    });
    assert.ok(Math.max(...zeilen)-Math.min(...zeilen)<=8,'eine Zeile: '+zeilen.join(', '));
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});

test('iPhone: Reiter oben wie bisher, keine Abschnitte in einer Seitenleiste',async()=>{
  const {page,errors}=await oeffne(390);
  try{
    assert.equal(await sichtbar(page,'.work-tabs'),true,'Reiter oben');
    assert.equal(await sichtbar(page,'#lensWork'),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'kein Überlauf');
    assert.deepEqual(errors,[]);
  }finally{await page.close()}
});
