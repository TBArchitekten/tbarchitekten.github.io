/* TBA Office · Fristen are the milestones of the office's Terminpläne.
   Window reads confirmed deadlines from each project's Akte; the office keeps its dates in the
   Terminpläne, so Heute and the Kalender show the milestones of every Terminplan that is not
   archived (read only; they are changed in the Terminplan itself). */
(()=>{
'use strict';
const cache={at:0,rows:[],ok:false,loading:null};
const DAY=/^\d{4}-\d{2}-\d{2}/;
function rowsFrom(plans){
  const out=[];
  for(const p of plans||[]){
    if(!p||p.office_projects?.status==='archiviert')continue;
    const tasks=Array.isArray(p.state?.tasks)?p.state.tasks:[];
    for(const t of tasks){
      if(!t||t.type!=='milestone'||typeof t.start!=='string'||!DAY.test(t.start))continue;
      out.push({id:String(p.id)+':'+String(t.id??t.name??''),title:String(t.name||'Meilenstein'),date:t.start.slice(0,10),
        project:String(p.office_projects?.name||p.project_name||''),projectKey:String(p.project_id||''),planId:String(p.id)});
    }
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'de'));
}
function load(force=false){
  const sb=window.MINDS_SUPABASE;
  if(!sb)return Promise.resolve(cache);
  if(cache.loading)return cache.loading;
  if(!force&&cache.at&&Date.now()-cache.at<5*60000)return Promise.resolve(cache);
  cache.loading=Promise.resolve(sb.from('office_terminplan_instances')
      .select('id,project_id,project_name,state,office_projects(name,status)').eq('is_archived',false).limit(200))
    .then(({data,error})=>{cache.at=Date.now();cache.ok=!error;if(!error)cache.rows=rowsFrom(data)},
      ()=>{cache.at=Date.now();cache.ok=false})
    .then(()=>{cache.loading=null;return cache});
  return cache.loading;
}
window.TBA_OFFICE_FRISTEN=Object.freeze({load,rowsFrom});
})();
