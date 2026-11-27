/* Eingang · was eine Person entscheiden muss (Office).
   Portiert aus Window (apps/isabella/bandeja.js) am 15.11.2026. Seit 27.11.2026 (Gari: «una sola bandeja para lo que
   necesita a una persona y una sola vista del día») hat der Eingang keinen eigenen Bildschirm mehr: Heute zeigt ihn oben
   als «Braucht Sie», das Panorama denselben Inhalt je Projekt unter «Für dich». Diese Datei hält nur die Daten und die Zahl.

   Was eine Person braucht: die Vorschläge im Projektwissen, die sie entscheiden darf, also in den Projekten, deren
   Projektleitung sie ist, oder in allen als Admin. Vorgeschlagene Entscheidungen bestätigt oder verwirft sie über die
   Funktion des Wissens (dieselbe Karte wie im Panorama, mit Protokoll); Fristen, Aufgaben und Widersprüche aus der
   nächtlichen Pflege über die Karte der Akte. Die Datenbank prüft die Rechte noch einmal. */
(()=>{
'use strict';
const $$=s=>[...document.querySelectorAll(s)];
const SELECT='id,project_id,memory_type,title,body,status,occurred_at,metadata,created_at,updated_at';
let eintraege=null,fehler='',laden=null,count=null,countAt=0;

async function ich(){
  const sb=window.MINDS_SUPABASE;if(!sb)return null;
  try{const {data}=await sb.auth.getSession();return data?.session?.user?.id||null}catch{return null}
}
// Dieselbe Reihenfolge wie «Für dich»: Widersprüche, dann Fristen und Entscheidungen, dann vorgeschlagene Aufgaben.
function offen(rows){
  const list=Array.isArray(rows)?rows:[];
  return [...list.filter(r=>r.memory_type==='open_question'&&r.metadata?.kind==='widerspruch'),
    ...list.filter(r=>r.memory_type==='decision'||r.memory_type==='deadline'),
    ...list.filter(r=>r.memory_type==='commitment'&&r.metadata?.kind==='aufgabe')];
}
async function holen(){
  const sb=window.MINDS_SUPABASE,uid=await ich();
  if(!sb||!uid)return [];
  const [mem,proj,mitglied]=await Promise.all([
    sb.from('minds_work_memory').select(SELECT).eq('status','proposed')
      .in('memory_type',['deadline','decision','commitment','open_question']).order('created_at',{ascending:false}).limit(200),
    sb.from('office_projects').select('id,number,name,projektleiter_id'),
    sb.from('office_members').select('role').eq('user_id',uid).maybeSingle()
  ]);
  if(mem.error)throw mem.error;
  const admin=mitglied.data?.role==='admin',projekte=new Map((proj.data||[]).map(p=>[p.id,p]));
  return offen(mem.data).filter(r=>{const p=projekte.get(r.project_id);return !!p&&(admin||p.projektleiter_id===uid)})
    .map(r=>({...r,projekt:projekte.get(r.project_id)}));
}
function publish(n){
  count=n;countAt=Date.now();
  $$('[data-bandeja-badge]').forEach(b=>{b.textContent=n>99?'99+':String(n);b.classList.toggle('hidden',!(n>0))});
  try{window.dispatchEvent(new CustomEvent('minds:bandeja-count',{detail:{count:n}}))}catch{}
}
function load(force=false){
  if(laden)return laden;
  if(!force&&eintraege!==null&&Date.now()-countAt<60000)return Promise.resolve(eintraege);
  laden=(async()=>{
    try{eintraege=await holen();fehler='';publish(eintraege.length)}
    catch{eintraege=eintraege||[];fehler='Was auf Sie wartet, konnte gerade nicht gelesen werden.'}
    return eintraege;
  })().finally(()=>{laden=null});
  return laden;
}
window.MINDS_BANDEJA={
  load,
  items:()=>eintraege||[],
  error:()=>fehler,
  refreshCount:(force=false)=>load(force).then(()=>count),
  lastCount:()=>count,
  // Der Eingang lebt in Heute: wer ihn öffnet (alte Links, Mitteilungen), landet dort bei «Braucht Sie».
  show:()=>window.ISABELLA_APP?.show?.('feed',{inbox:true}),
  refresh:()=>load(true),
  // Eine Entscheidung hier oder im Panorama ändert die Liste und die Zahl überall.
  changed:()=>{eintraege=null;countAt=0;void load(true).then(()=>{try{window.dispatchEvent(new CustomEvent('minds:bandeja-changed'))}catch{}})}
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load()});
setTimeout(()=>{void load(true)},1500);
})();
