// TBA Office · Musterplanner LPH 3 · read-only draft review.
// Master is a versioned JSON asset. Review notes are browser-local ONLY.
// Nothing here writes project tasks, buckets, deadlines or canonical templates.
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s??'').toLocaleLowerCase('de-DE');
const STATUS={open:'Offen',keep:'Behalten',change:'Ändern',remove:'Streichen',conditional:'Bedingt'};
let model=null,allTasks=[],filtered=[],reviews={},active=null,storageKey='';
function loadReviews(){try{const x=JSON.parse(localStorage.getItem(storageKey)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return {}}}
function saveReviews(){try{localStorage.setItem(storageKey,JSON.stringify(reviews))}catch{}}
function isConditional(t){return /^Bedingt/.test(t.scope||'')}
function reviewFor(id){const x=reviews[id]||{};return STATUS[x.status]?x:{status:'open',note:x.note||''}}
function valid(m){return m&&m.phase==='LPH3'&&Array.isArray(m.buckets)&&m.buckets.length>0&&
 m.buckets.every(b=>b.kind==='Abgabe'&&!!b.gate&&Array.isArray(b.tasks))}
function stats(){
 const amount=allTasks.length,checkCount=allTasks.reduce((n,t)=>n+t.checks.length,0);
 const completed=allTasks.filter(t=>reviewFor(t.id).status!=='open').length;
 $('#stats').innerHTML=[
 [''+model.buckets.length,'Buckets'],
 [''+amount,'TBA-Aufgaben'],
 [''+checkCount,'Checklistenpunkte'],
 [''+(model.buckets.find(b=>b.id==='A5')?.tasks.length||0),'Bemusterungs-Aufgaben'],
 [completed+' / '+amount,'lokal bewertet']
 ].map(s=>'<div class="stat"><strong>'+esc(s[0])+'</strong><span>'+esc(s[1])+'</span></div>').join('');
}
function filters(){
 const q=normalize($('#search').value.trim()),scope=$('#scope').value,status=$('#reviewFilter').value;
 filtered=allTasks.filter(t=>{
  const text=normalize([t.id,t.title,t.result,t.scope,t.owner,t.basis,(t.psp||[]).join(' '),...(t.checks||[])].join(' '));
  if(q&&!text.includes(q)&&!normalize(model.buckets.find(b=>b.tasks.some(x=>x.id===t.id))?.title||'').includes(q))return false;
  if(scope==='conditional'&&!isConditional(t))return false;
  if(scope==='standard'&&isConditional(t))return false;
  if(status==='open'&&reviewFor(t.id).status!=='open')return false;
  if(status!=='all'&&status!=='open'&&reviewFor(t.id).status!==status)return false;
  return true;
 });
 return new Set(filtered.map(t=>t.id));
}
function draw(){
 if(!model)return;
 const matching=filters(),board=$('#board');
 $('#bucketNav').innerHTML=model.buckets.map(b=>'<a href="#'+esc(b.id)+'" data-nav="'+esc(b.id)+'">'+
   '<strong>'+esc(b.id)+'</strong> '+esc(b.title)+'</a>').join('');
 board.innerHTML=model.buckets.map(b=>{
  const tasks=b.tasks.filter(t=>matching.has(t.id));
  if(!tasks.length)return '';
  return '<article class="bucket" id="'+esc(b.id)+'">'+
  '<div class="bucket-top"><span class="bucket-count">'+tasks.length+' / '+b.tasks.length+'</span>'+
  '<span class="kicker">'+esc('Abgabe / Planungspaket')+' · '+esc(b.id)+'</span>'+
  '<h2>'+esc(b.title)+'</h2><p>'+esc(b.summary)+'</p><span class="bucket-gate">'+esc(b.gate)+'</span></div>'+
  '<div class="bucket-list">'+tasks.map(t=>{
    const r=reviewFor(t.id).status,conditional=isConditional(t);
    return '<button type="button" class="task-card" data-task="'+esc(t.id)+'">'+
      '<span class="id">'+esc(t.id)+'</span><h3>'+esc(t.title)+'</h3>'+
      '<p class="output">'+esc(t.result)+'</p><div class="chips">'+
      '<span class="chip">'+t.checks.length+' Prüfpunkte</span>'+
      (conditional?'<span class="chip condition">Bedingt</span>':'')+
      (r!=='open'?'<span class="chip review-'+esc(r)+'">'+esc(STATUS[r])+'</span>':'')+
      '</div></button>';
  }).join('')+'</div></article>';
 }).join('')||'<p class="empty">Für diese Filter gibt es keine Aufgaben.</p>';
 board.querySelectorAll('[data-task]').forEach(el=>el.onclick=()=>showTask(el.dataset.task));
 $('#bucketNav').querySelectorAll('[data-nav]').forEach(el=>el.onclick=e=>{
   e.preventDefault();const target=document.getElementById(el.dataset.nav);
   if(target){target.scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'});
     target.classList.add('focus');setTimeout(()=>target.classList.remove('focus'),700);}
 });
 stats();
}
function currentIndex(){return filtered.findIndex(t=>t.id===active)}
function saveNote(){if(!active)return;const note=$('#detailNote').value.trim();const r=reviewFor(active);reviews[active]={...r,note};saveReviews()}
function showTask(id){
 const entry=allTasks.find(t=>t.id===id);if(!entry)return;
 if(active)saveNote();
 active=id;
 const b=model.buckets.find(b=>b.tasks.some(t=>t.id===id));
 $('#detailBucket').textContent=b.id+' · '+b.title;
 $('#detailTitle').textContent=entry.title;
 $('#detailMeta').innerHTML=[
  ['Aufgabe',entry.id],['Verantwortlich',entry.owner],['Prüfung',/Projektleitung|Kostenplanung/.test(entry.owner)?'Büroleitung':'Projektleitung'],
  ['Anwendbarkeit',entry.scope],['Terminplan PSP',(entry.psp||[]).join(' · ')||'–'],
  ['Aufwand','Noch zu kalibrieren']
 ].map((pair,i)=>'<span'+(i===3?' class="important"':'')+'>'+esc(pair[0]+': '+pair[1])+'</span>').join('');
 $('#detailResult').textContent=entry.result;
 $('#detailChecks').innerHTML='<ul class="checklist">'+entry.checks.map(t=>'<li><span class="box" aria-hidden="true"></span><span>'+esc(t)+'</span></li>').join('')+'</ul>';
 $('#detailBasis').textContent=entry.basis+'. Gegenstand der TBA-Arbeit; keine Fachplanerleistung. Detaillierung vor Übernahme anhand des Projektvertrags prüfen.';
 const r=reviewFor(id);
 $('#detailNote').value=r.note||'';
 $('#reviewChoices').querySelectorAll('[data-review]').forEach(button=>{
    button.classList.toggle('active',button.dataset.review===r.status);
    button.setAttribute('aria-pressed',String(button.dataset.review===r.status));
 });
 const index=currentIndex();
 $('#detailPosition').textContent=(index<0?'–':index+1)+' / '+filtered.length;
 $('#prevTask').disabled=index<=0;$('#nextTask').disabled=index<0||index>=filtered.length-1;
 const dlg=$('#detail');if(!dlg.open)dlg.showModal();
}
function next(delta){const i=currentIndex();const next=filtered[i+delta];if(next)showTask(next.id)}
function review(status){
 if(!active||!STATUS[status])return;
 reviews[active]={status,note:$('#detailNote').value.trim()};
 saveReviews();draw();showTask(active);
}
function exportReview(){
 const selections=allTasks.filter(t=>{const r=reviewFor(t.id);return r.status!=='open'||r.note})
   .map(t=>({id:t.id,title:t.title,decision:reviewFor(t.id).status,note:reviewFor(t.id).note||''}));
 const data={template:model.id,version:model.version,exportedAt:new Date().toISOString(),
   notice:'Nur lokale Review-Notizen. Keine Projekt-Aufgaben geändert.',entries:selections};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='TBA-LPH3-Musterplanner-Review-v0.2.1.json';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function start(){
 try{
  const response=await fetch('./app/data/muster-planner-lph3-v0.2.json?v=1',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const m=await response.json();if(!valid(m))throw Error('Ungültige Vorlagenstruktur');
  const ids=m.buckets.flatMap(b=>b.tasks.map(t=>t.id));
  if(ids.length!==new Set(ids).size)throw Error('Doppelte Aufgabenkennungen');
  model=m;storageKey='tba-office-musterplanner-review:'+m.id+':'+m.version;
  reviews=loadReviews();allTasks=m.buckets.flatMap(b=>b.tasks);
  $('#search').addEventListener('input',draw);
  $('#scope').addEventListener('change',draw);
  $('#reviewFilter').addEventListener('change',draw);
  $('#reset').addEventListener('click',()=>{$('#search').value='';$('#scope').value='all';$('#reviewFilter').value='all';draw()});
  $('#export').addEventListener('click',exportReview);
  $('#closeDetail').addEventListener('click',()=>{$('#detail').close()});
  $('#detail').addEventListener('close',()=>{saveNote();active=null;draw()});
  $('#detailNote').addEventListener('change',saveNote);
  $('#reviewChoices').querySelectorAll('[data-review]').forEach(btn=>btn.onclick=()=>review(btn.dataset.review));
  $('#prevTask').onclick=()=>next(-1);$('#nextTask').onclick=()=>next(1);
  document.addEventListener('keydown',e=>{
   if(!$('#detail').open)return;
   if(e.target?.tagName==='TEXTAREA'||e.target?.tagName==='INPUT')return;
   if(e.key==='ArrowLeft')next(-1);
   if(e.key==='ArrowRight')next(1);
  });
  draw();
 }catch(error){
  $('#board').innerHTML='<p class="empty">Der Muster-Planner konnte nicht geladen werden. '+esc(error.message||'Bitte erneut laden.')+'</p>';
 }
}
start();
})();
