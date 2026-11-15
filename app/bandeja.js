/* Eingang · was Romy vorschlägt, für wenn Gari Zeit hat.
   Portiert aus Window (apps/isabella/bandeja.js) am 15.11.2026. Bis dahin fehlte diese Datei im
   Office: der Bildschirm war da, window.MINDS_BANDEJA nicht, also blieb er auf der Ladezeile
   stehen und der Link «N zu bestätigen» in Heute erschien nie, weil lastCount() undefined war.

   Unterschied zu Window: nur «Zu bestätigen». Die Tabs «Vorschläge» und «Ideen» rufen dort
   isabella-feed und isabella-ideas — Funktionen, die es im Office nicht gibt; sie sind in
   shell.js verborgen, und der Code dafür steht hier nicht. */
(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SELECT='id,project_id,memory_type,title,body,status,occurred_at,metadata,created_at,isabella_projects(name,client_key)';
let entries=null,loadError='',loading=null,count=null,countAt=0,countLoading=null;

function akte(){return window.MINDS_WORK?.akte||null}
async function signedIn(){
  const sb=window.MINDS_SUPABASE;if(!sb)return false;
  try{const {data}=await sb.auth.getSession();return !!data?.session}catch{return false}
}
async function fetchPending(){
  const sb=window.MINDS_SUPABASE;
  const {data,error}=await sb.from('minds_work_memory').select(SELECT).eq('status','proposed')
    .in('memory_type',['deadline','decision','commitment','open_question']).order('created_at',{ascending:false}).limit(200);
  if(error)throw error;
  return akte()?.toConfirm?.(data||[])||[];
}
function publish(n){
  count=n;countAt=Date.now();
  $$('[data-bandeja-badge]').forEach(b=>{b.textContent=n>99?'99+':String(n);b.classList.toggle('hidden',!(n>0))});
  const tab=$('[data-bandeja-view="confirm"]');if(tab)tab.textContent=n>0?'Zu bestätigen · '+n:'Zu bestätigen';
  try{window.dispatchEvent(new CustomEvent('minds:bandeja-count',{detail:{count:n}}))}catch{}
}
// Die Zahl am Tab: höchstens einmal pro Minute neu geholt, außer es hat sich etwas geändert.
function refreshCount(force=false){
  if(countLoading)return countLoading;
  if(!force&&count!==null&&Date.now()-countAt<60000)return Promise.resolve(count);
  countLoading=(async()=>{
    if(!await signedIn())return count;
    try{const list=await fetchPending();entries=list;loadError='';publish(list.length);}catch{}
    return count;
  })().finally(()=>{countLoading=null});
  return countLoading;
}

function groupsOf(list){
  const groups=new Map();
  for(const r of list){
    const name=r.isabella_projects?.name||'Ohne Projekt';
    if(!groups.has(name))groups.set(name,{name,key:r.isabella_projects?.client_key||'',rows:[]});
    groups.get(name).rows.push(r);
  }
  return [...groups.values()];
}
function paintConfirm(){
  const box=$('#bandejaConfirm');if(!box)return;
  if(entries===null){box.innerHTML='<div class="surface-loading">Lese, was auf Bestätigung wartet …</div>';return}
  if(loadError){box.innerHTML='<div class="surface-empty">'+esc(loadError)+'</div>';return}
  if(!entries.length){box.innerHTML='<p class="bandeja-empty">Nichts zu bestätigen. Was Romy in den Projektunterlagen Neues findet, steht hier.</p>';return}
  const card=akte()?.card;
  box.innerHTML=groupsOf(entries).map(g=>'<section class="bandeja-group" aria-label="'+esc(g.name)+'"><div class="bandeja-group-head"><h2 class="ahora-label">'+esc(g.name)+'</h2>'+
    (g.key?'<button type="button" class="ahora-text-button" data-bandeja-project="'+esc(g.key)+'">Panorama</button>':'')+'</div>'+
    '<div class="cockpit-cards">'+g.rows.map(r=>card?card(r):'').join('')+'</div></section>').join('')+
    '<p class="bandeja-note" role="status" aria-live="polite"></p>';
}
async function loadConfirm(force=false){
  if(loading)return loading;
  loading=(async()=>{
    if(!window.MINDS_SUPABASE){entries=[];loadError='Das Office ist gerade nicht erreichbar.';paintConfirm();return}
    if(!await signedIn()){entries=[];loadError='Nicht angemeldet: bitte im Office anmelden, um zu sehen, was auf Bestätigung wartet.';paintConfirm();return}
    if(force||entries===null){
      try{const list=await fetchPending();entries=list;loadError='';publish(list.length)}
      catch{entries=entries||[];loadError='Der Eingang konnte gerade nicht gelesen werden. Zum Aktualisieren nach unten ziehen.'}
    }
    paintConfirm();
  })().finally(()=>{loading=null});
  return loading;
}
function note(text){const el=$('#bandejaConfirm .bandeja-note');if(el)el.textContent=text||''}
async function decide(button,run){
  const card=button.closest('.cockpit-card');
  card?.querySelectorAll('button').forEach(b=>b.disabled=true);
  const result=await run();
  if(!result?.ok){card?.querySelectorAll('button').forEach(b=>b.disabled=false);note(result?.message||'Die Entscheidung konnte nicht gespeichert werden.');return}
  await loadConfirm(true);
  note(result.message||'');
}

function paintTabs(){
  $$('[data-bandeja-view]').forEach(b=>{const on=b.dataset.bandejaView==='confirm';b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))});
  $$('[data-bandeja-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.bandejaPanel!=='confirm'));
}
function openView(_next,{force=false}={}){
  // Das Office hat nur diese eine Ansicht; ein anderer Wert wird ignoriert, nicht angezeigt.
  paintTabs();
  void loadConfirm(force);
}
function bind(){
  const screen=$('#bandejaScreen');if(!screen||screen.dataset.bandejaBound)return;screen.dataset.bandejaBound='1';
  screen.addEventListener('click',e=>{
    const t=e.target.closest?.('[data-bandeja-view],[data-akte-decide],[data-akte-task],[data-bandeja-project]');if(!t)return;
    if(t.dataset.bandejaView){openView(t.dataset.bandejaView);return}
    const a=akte();
    if(t.dataset.akteDecide&&a){void decide(t,()=>a.decide(t.dataset.akteId,t.dataset.akteDecide));return}
    if(t.dataset.akteTask&&a){void decide(t,()=>a.toTask(t.dataset.akteTask));return}
    if(t.dataset.bandejaProject){window.MINDS_WORK?.open?.(t.dataset.bandejaProject,'overview');window.ISABELLA_APP?.show?.('work')}
  });
}
window.MINDS_BANDEJA={
  show:(next)=>{bind();openView(next)},
  refresh:()=>{bind();return Promise.resolve(openView('confirm',{force:true}))},
  refreshCount,
  lastCount:()=>count,
  // Eine anderswo getroffene Entscheidung (Panorama) ändert die Zahl auch hier.
  changed:()=>{entries=null;countAt=0;void refreshCount(true);if(document.body?.dataset?.section==='bandeja')void loadConfirm(true)}
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshCount()});
setTimeout(()=>{void refreshCount(true)},1500);
})();
