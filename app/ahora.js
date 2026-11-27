/* Heute · der eine Tag und der eine Eingang (Office). Gari, 27.11.2026: «una sola bandeja para lo que necesita a una
   persona y una sola vista del día». Eine Spalte, von oben nach unten:
   1. Braucht Sie: was diese Person entscheiden muss, aus allen Projekten (MINDS_BANDEJA). Dieselben Karten und Regeln
      wie «Für dich» im Panorama; die ersten drei, «Alle N anzeigen».
   2. Der Tag: Termine und Fristen, darunter «Heute erledigen» mit den Aufgaben des Tages, «Aufgabe hinzufügen».
   3. Bald fällig: bis zu drei offene Aufgaben der nächsten fünf Tage, die man heute anfangen kann.
   4. Überfällig: zugeklappt. «Aufräumen» zeigt je Aufgabe «Erledigt», «Auf heute» und «Nächste Woche»; Aufgaben aus
      einem Terminplan bekommen ihr Datum nur vom Terminplan (Gari, 27.11.2026).
   5. Demnächst: Fristen und Termine der nächsten fünf Tage.
   Keine zweite Aufgabenliste: Abhaken, Öffnen und Verschieben sind die Aktionen des Kalenders. Blättert man zu einem
   anderen Tag, zeigt Heute nur diesen Tag. */
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=()=>window.MINDS_DESK_MODEL;
const APP=()=>window.ISABELLA_APP;
const SESSION_KIND='task_work_session_v1';
const NEXT_DAYS=5,NEXT_MAX=8,BALD_MAX=3,INBOX_ERST=3;
let offset=0,fristen={rows:[],at:0,loading:null,ok:false},renderQueued=0;
let inboxAlle=false,aufraeumen=false,ueberfaelligOffen=false,meldung='';

const todayKey=()=>M().dayKey(new Date());
const cap=t=>t?t.charAt(0).toUpperCase()+t.slice(1):'';
const shortMonth=d=>d.toLocaleDateString('de-DE',{day:'numeric',month:'short'}).replace('.','');
function dayWord(key,today){
  const n=dayDiff(today,key);
  return n===0?'Heute':n===1?'Morgen':n===-1?'Gestern':'';
}
function dayDiff(from,to){return Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/864e5)}
function dayTitle(key,today){
  const d=M().dateFromKey(key);if(!d)return key;
  const word=dayWord(key,today),rest=d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'short'}).replace(',','').replace('.','');
  return word?word+' · '+rest:cap(rest);
}
function datumKurz(key){
  const d=M().dateFromKey(key);if(!d)return '';
  return d.toLocaleDateString('de-DE',{weekday:'short'}).replace('.','')+' '+String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.';
}
// Der Montag nach heute (an einem Montag: der nächste).
function naechsterMontag(today){
  const d=new Date(today+'T12:00:00Z'),plus=((8-d.getUTCDay())%7)||7;
  d.setUTCDate(d.getUTCDate()+plus);return d.toISOString().slice(0,10);
}
function nameOf(list,id){return (list||[]).find(x=>x.id===id)?.name||''}
function minutesText(min){const n=Number(min);if(!Number.isFinite(n)||n<=0)return '';return n%60===0?(n/60)+' h':n>60?Math.floor(n/60)+' h '+(n%60)+' min':n+' min'}
function isSession(e){return e?.metadata?.kind===SESSION_KIND}
function ausTerminplan(t){return !!t?.metadata?.office_planner?.terminplan?.instance_id}

// Bestätigte Fristen aller Projekte ab heute: die Meilensteine der Terminpläne (office-fristen.js), wie im Kalender.
function loadFristen(force=false){
  const sb=window.MINDS_SUPABASE;
  if(!sb)return Promise.resolve();
  if(fristen.loading)return fristen.loading;
  if(!force&&Date.now()-fristen.at<5*60000)return Promise.resolve();
  const today=todayKey();
  if(window.TBA_OFFICE_FRISTEN){
    fristen.loading=window.TBA_OFFICE_FRISTEN.load(force).then(c=>{
      fristen.at=Date.now();fristen.ok=!!c.ok;
      if(c.ok)fristen.rows=c.rows.filter(r=>r.date>=today).slice(0,24);
    },()=>{fristen.at=Date.now();fristen.ok=false}).finally(()=>{fristen.loading=null});
    return fristen.loading;
  }
  fristen.at=Date.now();fristen.ok=false;
  return Promise.resolve();
}

function fristRow(f,today){
  const n=dayDiff(today,f.date),big=n===0?'Heute':String(n),small=n===0?'':n===1?'Tag':'Tage';
  return '<button type="button" class="ahora-row ahora-next-row" data-ahora-frist="'+esc(f.projectKey)+'">'+
    '<span class="ahora-badge is-frist"><strong>'+esc(big)+'</strong>'+(small?'<span>'+esc(small)+'</span>':'')+'</span>'+
    '<span class="ahora-row-main"><span class="ahora-kind is-frist">Frist</span><strong>'+esc(f.title)+'</strong><small>'+esc([f.project,datumKurz(f.date)].filter(Boolean).join(' · '))+'</small></span></button>';
}
function nextItems(state,today){
  const end=M().addDays(today,NEXT_DAYS),tomorrow=M().addDays(today,1);
  const deadlines=fristen.rows.filter(f=>f.date>=tomorrow&&f.date<=end).map(f=>({kind:'frist',date:f.date,order:0,f}));
  const events=(state.events||[]).filter(e=>e.date>=tomorrow&&e.date<=end&&!isSession(e))
    .map(e=>({kind:'termin',date:e.date,order:1,time:e.allDay?'':String(e.start||''),e}));
  return [...deadlines,...events].sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order||String(a.time||'').localeCompare(String(b.time||''))).slice(0,NEXT_MAX);
}
function nextRow(item,state,today){
  if(item.kind==='frist')return fristRow(item.f,today);
  const n=dayDiff(today,item.date),d=M().dateFromKey(item.date);
  const when=n===1?'morgen':d?d.toLocaleDateString('de-DE',{weekday:'short'}).replace('.',''):'';
  const e=item.e,meta=[e.projectId?nameOf(state.projects,e.projectId):'',e.allDay?'Ganztägig':minutesText(e.duration)].filter(Boolean).join(' · ');
  return '<button type="button" class="ahora-row ahora-next-row" data-ahora-event="'+esc(e.id)+'">'+
    '<span class="ahora-badge is-termin"><strong>'+esc(item.time||'·')+'</strong><span>'+esc(when)+'</span></span>'+
    '<span class="ahora-row-main"><span class="ahora-kind is-termin">Termin</span><strong>'+esc(e.title||'Termin')+'</strong>'+(meta?'<small>'+esc(meta)+'</small>':'')+'</span></button>';
}

function taskMeta(task,state,key){
  // Das Office hat keine Kategorien (alles ist Arbeit): das Projekt sagt, wohin eine Aufgabe gehört.
  const bits=[task.projectId?nameOf(state.projects,task.projectId):''];
  if(M().spansDay(task,key)){const d=M().dateFromKey(task.date);if(d)bits.push('läuft bis '+shortMonth(d))}
  if(task.reminderTime&&task.date===key)bits.push('Erinnerung '+task.reminderTime);
  return bits.filter(Boolean).join(' · ');
}
function taskRow(task,sessions,state,key,today,{overdue=false,label=null,werkzeuge=''}={}){
  const done=!!task.done,span=!done&&M().spansDay(task,key);
  const d=overdue?M().dateFromKey(task.date):null;
  const zustand=label!==null?label:done?'Erledigt':overdue?'Überfällig'+(d?' · '+String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.':''):span?'In Bearbeitung':dayWord(key,today);
  const chips=(sessions||[]).map(s=>'<span class="ahora-session">'+esc([s.start,minutesText(s.duration)?minutesText(s.duration)+' reserviert':''].filter(Boolean).join(' · ')||'Reservierte Zeit')+'</span>').join('');
  return '<div class="ahora-row ahora-task'+(done?' is-done':'')+(overdue?' is-overdue':'')+(werkzeuge?' has-werkzeuge':'')+'">'+
    '<button type="button" class="ahora-check'+(done?' is-checked':'')+'" data-ahora-toggle="'+esc(task.id)+'" aria-pressed="'+String(done)+'" aria-label="'+esc((done?'Wieder öffnen: ':'Erledigen: ')+(task.title||'Aufgabe'))+'">'+(done?'<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</button>'+
    '<button type="button" class="ahora-row-main" data-ahora-task="'+esc(task.id)+'" aria-label="'+esc('Öffnen: '+(task.title||'Aufgabe'))+'"><strong>'+esc(task.title||'Aufgabe ohne Titel')+'</strong>'+
      (taskMeta(task,state,key)?'<small>'+esc(taskMeta(task,state,key))+'</small>':'')+chips+'</button>'+
    (zustand?'<span class="ahora-state">'+esc(zustand)+'</span>':'')+'</div>'+werkzeuge;
}
function eventRow(e,state){
  const meta=[e.projectId?nameOf(state.projects,e.projectId):'',e.allDay?'':minutesText(e.duration)].filter(Boolean).join(' · ');
  return '<button type="button" class="ahora-row ahora-event" data-ahora-event="'+esc(e.id)+'">'+
    '<span class="ahora-badge is-termin"><strong>'+esc(e.allDay?'Tag':String(e.start||'·'))+'</strong></span>'+
    '<span class="ahora-row-main"><strong>'+esc(e.title||'Termin')+'</strong>'+(meta?'<small>'+esc(meta)+'</small>':'')+'</span></button>';
}
const ICON_LINKS='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_RECHTS='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// 1 · Braucht Sie
function projektName(p){return p?String(p.name||''):''}
function inboxKarte(r){
  const W=window.MINDS_WORK,projekt=projektName(r.projekt);
  if(r.memory_type==='decision'&&W?.fuerDich?.karte)return W.fuerDich.karte(r,{projekt});
  const html=W?.akte?.card?W.akte.card(r):'';
  // Die Karte der Akte nennt kein Projekt: es kommt hinter die Art, wie bei den Entscheidungen.
  return projekt?html.replace('</span>',' · '+esc(projekt)+'</span>'):html;
}
function paintInbox(force=false){
  const box=$('#ahoraInbox');if(!box)return;
  // Wer gerade einen Hinweis oder Grund schreibt, verliert ihn nicht, wenn im Hintergrund neu gezeichnet wird.
  if(!force&&(box.querySelector('[data-cockpit-rueck-form]:not([hidden])')||box.contains(document.activeElement)&&document.activeElement!==document.body))return;
  const B=window.MINDS_BANDEJA,items=offset===0?(B?.items?.()||[]):[];
  if(!items.length){box.classList.add('hidden');box.innerHTML='';return}
  box.classList.remove('hidden');
  const zeigen=inboxAlle?items:items.slice(0,INBOX_ERST);
  box.innerHTML='<div class="ahora-section-head"><h2 id="ahoraInboxTitle" class="ahora-label">Braucht Sie</h2><span class="ahora-count">'+esc(items.length===1?'1 Entscheidung':items.length+' Entscheidungen')+'</span></div>'+
    '<div class="cockpit-cards ahora-inbox-cards">'+zeigen.map(inboxKarte).join('')+'</div>'+
    (items.length>INBOX_ERST?'<button type="button" class="ahora-text-button ahora-more" data-ahora-inbox-alle>'+esc(inboxAlle?'Weniger anzeigen':'Alle '+items.length+' anzeigen')+'</button>':'')+
    '<p class="ahora-meldung" role="status" aria-live="polite">'+esc(meldung)+'</p>';
  window.MINDS_WORK?.fuerDich?.binden?.(box,{eintraege:items,projektVon:r=>r.project_id,
    meldung:text=>{meldung=String(text||'');const el=box.querySelector('.ahora-meldung');if(el)el.textContent=meldung},
    nachher:()=>Promise.resolve(B?.load?.(true)).then(()=>{paint();paintInbox(true)})});
}

// 2 · Der Tag
function paintDay(state,today,key){
  const day=$('#ahoraDay');if(!day)return;
  const groups=M().monthAgendaGroups(state,key);
  const termine=groups.events.filter(e=>!isSession(e)).map(e=>eventRow(e,state));
  const fristenTag=fristen.rows.filter(f=>f.date===key).map(f=>fristRow(f,today));
  const aufgaben=groups.tasks.map(g=>taskRow(g.task,g.sessions,state,key,today));
  const leer=!termine.length&&!fristenTag.length&&!aufgaben.length;
  day.innerHTML='<div class="ahora-day-head"><h2 id="ahoraDayTitle" class="ahora-label">'+esc(dayTitle(key,today))+'</h2><div class="ahora-day-nav">'+
      (offset!==0?'<button type="button" class="ahora-text-button" data-ahora-day="today">Heute</button>':'')+
      '<button type="button" class="ahora-round" data-ahora-day="-1" aria-label="Vorheriger Tag">'+ICON_LINKS+'</button>'+
      '<button type="button" class="ahora-round" data-ahora-day="1" aria-label="Nächster Tag">'+ICON_RECHTS+'</button></div></div>'+
    '<div class="ahora-card">'+
      (leer?'<p class="ahora-empty ahora-empty-inline">'+(offset===0?'Heute stehen keine Termine, Fristen oder Aufgaben an.':'An diesem Tag steht nichts im Kalender.')+'</p>':'')+
      fristenTag.join('')+termine.join('')+
      (aufgaben.length?'<p class="ahora-sub-label">'+(offset===0?'Heute erledigen':'Erledigen')+'</p>'+aufgaben.join(''):'')+
      '<button type="button" class="ahora-add" data-ahora-add="'+esc(key)+'"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Aufgabe hinzufügen</button></div>';
}

// 3 · Bald fällig
function paintBald(state,today){
  const box=$('#ahoraBald');if(!box)return;
  const end=M().addDays(today,NEXT_DAYS);
  const bald=offset!==0?[]:(state.tasks||[]).filter(t=>!t.done&&!t.archivedAt&&t.date&&t.date>today&&t.date<=end&&!M().spansDay(t,today))
    .sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.sortOrder||0)-Number(b.sortOrder||0)).slice(0,BALD_MAX);
  if(!bald.length){box.classList.add('hidden');box.innerHTML='';return}
  box.classList.remove('hidden');
  box.innerHTML='<div class="ahora-section-head"><h2 id="ahoraBaldTitle" class="ahora-label">Bald fällig</h2><span class="ahora-count">zum Vorziehen</span></div>'+
    '<div class="ahora-card">'+bald.map(t=>taskRow(t,[],state,t.date,today,{label:'Fällig '+(dayDiff(today,t.date)===1?'morgen':datumKurz(t.date))})).join('')+'</div>';
}

// 4 · Überfällig, mit «Aufräumen»
function aufraeumenWerkzeuge(t,today){
  if(!aufraeumen)return '';
  const erledigt='<button type="button" data-ahora-toggle="'+esc(t.id)+'">Erledigt</button>';
  if(ausTerminplan(t))return '<div class="ahora-aufraeumen">'+erledigt+'<span class="ahora-hinweis">Datum nur im Terminplan</span></div>';
  return '<div class="ahora-aufraeumen">'+erledigt+'<button type="button" data-ahora-verschieben="'+esc(t.id)+'" data-ziel="'+esc(today)+'">Auf heute</button>'+
    '<button type="button" data-ahora-verschieben="'+esc(t.id)+'" data-ziel="'+esc(naechsterMontag(today))+'">Nächste Woche</button></div>';
}
function paintUeberfaellig(state,today){
  const box=$('#ahoraUeberfaellig');if(!box)return;
  const liste=offset!==0?[]:(state.tasks||[]).filter(t=>!t.done&&!t.archivedAt&&t.date&&t.date<today&&!M().spansDay(t,today))
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if(!liste.length){box.classList.add('hidden');box.innerHTML='';aufraeumen=false;return}
  box.classList.remove('hidden');
  box.innerHTML='<details class="ahora-ueberfaellig"'+(ueberfaelligOffen?' open':'')+'><summary><span id="ahoraUeberfaelligTitle" class="ahora-label">Überfällig · '+esc(liste.length)+'</span>'+
      '<span class="ahora-summary-hint">'+(ueberfaelligOffen?'Zuklappen':'Anzeigen')+'</span></summary>'+
    '<div class="ahora-ueberfaellig-kopf"><p>Erledigen, auf heute oder in die nächste Woche legen.</p><button type="button" class="ahora-text-button" data-ahora-aufraeumen>'+(aufraeumen?'Fertig':'Aufräumen')+'</button></div>'+
    '<div class="ahora-card">'+liste.map(t=>taskRow(t,[],state,today,today,{overdue:true,werkzeuge:aufraeumenWerkzeuge(t,today)})).join('')+'</div></details>';
  const details=box.querySelector('details');
  details.addEventListener('toggle',()=>{ueberfaelligOffen=details.open;const hint=details.querySelector('.ahora-summary-hint');if(hint)hint.textContent=details.open?'Zuklappen':'Anzeigen'});
}

// 5 · Demnächst
function paintNext(state,today){
  const next=$('#ahoraNext');if(!next)return;
  if(offset!==0){next.classList.add('hidden');next.innerHTML='';return}
  const upcoming=nextItems(state,today);
  next.classList.remove('hidden');
  next.innerHTML='<div class="ahora-section-head"><h2 id="ahoraNextTitle" class="ahora-label">Demnächst</h2><span class="ahora-count">5 Tage</span></div>'+
    (upcoming.length?'<div class="ahora-card">'+upcoming.map(x=>nextRow(x,state,today)).join('')+'</div>'
      :'<p class="ahora-empty">'+(fristen.ok||!window.MINDS_SUPABASE?'Keine Fristen oder Termine in den nächsten fünf Tagen.':'Keine Termine in den nächsten fünf Tagen. Die Fristen konnten nicht geprüft werden.')+'</p>');
}

function paint(){
  if(!$('#ahoraDay')||!M()||!APP())return;
  // Heute gehört der Person (Gari, 07.11.2026): eigene und zugewiesene Aufgaben, eigene Termine. Der Kalender zeigt das
  // ganze Projekt; Aufgaben und Termine der Kolleginnen und Kollegen tragen mine:false und bleiben hier draußen.
  const full=APP().getState(),today=todayKey(),key=M().addDays(today,offset);
  const state={...full,tasks:(full.tasks||[]).filter(t=>t.mine!==false),events:(full.events||[]).filter(e=>e.mine!==false)};
  const dateEl=$('#ahoraDate');if(dateEl)dateEl.textContent=cap(new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'}));
  paintInbox();
  paintDay(state,today,key);
  paintBald(state,today);
  paintUeberfaellig(state,today);
  paintNext(state,today);
}

async function render(options={}){
  paint();
  if(options.inbox)zumEingang();
  const before=JSON.stringify(fristen.rows);
  await Promise.all([loadFristen(!!options.fresh),Promise.resolve(window.MINDS_BANDEJA?.load?.(!!options.fresh||!!options.inbox)).catch(()=>null)]);
  if(JSON.stringify(fristen.rows)!==before||options.fresh||options.inbox||window.MINDS_BANDEJA){paint();paintInbox(!!options.fresh||!!options.inbox)}
  if(options.inbox)zumEingang();
}
function zumEingang(){
  offset=0;
  const box=$('#ahoraInbox');
  if(box&&!box.classList.contains('hidden'))box.scrollIntoView({block:'start',behavior:'smooth'});
}
function queue(){
  if(document.body?.dataset?.section!=='feed')return;
  clearTimeout(renderQueued);renderQueued=setTimeout(paint,120);
}
async function inboxAkte(button,run){
  const karte=button.closest('.cockpit-card');
  karte?.querySelectorAll('button').forEach(b=>b.disabled=true);
  const result=await run();
  meldung=result?.ok?String(result.message||'Gespeichert.'):String(result?.message||'Das konnte nicht gespeichert werden.');
  if(!result?.ok){karte?.querySelectorAll('button').forEach(b=>b.disabled=false);const el=$('#ahoraInbox .ahora-meldung');if(el)el.textContent=meldung;return}
  await Promise.resolve(window.MINDS_BANDEJA?.load?.(true));
  paint();paintInbox(true);
}
function bind(){
  const screen=$('#feedScreen');if(!screen||screen.dataset.ahoraBound)return;screen.dataset.ahoraBound='1';
  screen.addEventListener('click',e=>{
    const t=e.target.closest?.('[data-ahora-toggle],[data-ahora-task],[data-ahora-event],[data-ahora-frist],[data-ahora-day],[data-ahora-add],[data-ahora-inbox-alle],[data-ahora-aufraeumen],[data-ahora-verschieben],[data-akte-decide],[data-akte-task]');if(!t)return;
    const W=window.MINDS_WORK;
    if(t.dataset.akteDecide&&W?.akte){void inboxAkte(t,()=>W.akte.decide(t.dataset.akteId,t.dataset.akteDecide));return}
    if(t.dataset.akteTask&&W?.akte){void inboxAkte(t,()=>W.akte.toTask(t.dataset.akteTask));return}
    if(t.dataset.ahoraInboxAlle!==undefined){inboxAlle=!inboxAlle;paintInbox(true);return}
    if(t.dataset.ahoraAufraeumen!==undefined){aufraeumen=!aufraeumen;ueberfaelligOffen=true;paint();return}
    if(t.dataset.ahoraVerschieben){APP()?.moveTaskToDate?.(t.dataset.ahoraVerschieben,t.dataset.ziel);paint();return}
    if(t.dataset.ahoraToggle){APP()?.toggleTaskById?.(t.dataset.ahoraToggle);paint();return}
    if(t.dataset.ahoraTask){APP()?.editTaskById?.(t.dataset.ahoraTask);return}
    if(t.dataset.ahoraEvent){APP()?.editEventById?.(t.dataset.ahoraEvent);return}
    if(t.dataset.ahoraFrist!==undefined){if(t.dataset.ahoraFrist)window.MINDS_WORK?.open?.(t.dataset.ahoraFrist,'overview');APP()?.show?.('work');return}
    if(t.dataset.ahoraDay){offset=t.dataset.ahoraDay==='today'?0:Math.max(-30,Math.min(60,offset+Number(t.dataset.ahoraDay)));paint();return}
    if(t.dataset.ahoraAdd){APP()?.openNewItem?.(t.dataset.ahoraAdd);return}
  });
  window.addEventListener('isabella:state',queue);
  window.addEventListener('minds:bandeja-changed',queue);
  window.addEventListener('minds:bandeja-count',queue);
}
window.MINDS_AHORA={render:(options)=>{bind();return render(options||{})},paint};
})();
