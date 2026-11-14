/*
 * TBA Office · Planner ↔ Terminplan.
 * Pure and deterministic: computes the dates of Planner tasks from the project Terminplan.
 * Nothing is written here; the Planner shows the changes and saves them only after confirmation.
 *
 * Link stored in task.metadata.office_planner.terminplan:
 *   { instance_id, executes:[Vorgang-ID], waits_for:[Vorgang-ID], anchor:{id, field:'start'|'end'} | null }
 * Rule: a task that executes Vorgänge starts with the earliest of them and is due with the latest;
 * a task without own Vorgang but with an anchor is due on the anchor date (its start stays).
 * Links use Vorgang-IDs, never PSP or titles; the PSP text is derived from the current order.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.TBAPlannerTerminplanSync=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const iso=/^\d{4}-\d{2}-\d{2}$/;
  function linkOf(task){
    const link=task?.metadata?.office_planner?.terminplan;
    return link&&typeof link==='object'?link:null;
  }
  function pspMap(state){
    const wbs=new Map((state?.groups||[]).map(g=>[g.id,String(g.wbs??'')]));
    const count=new Map(),out=new Map();
    for(const t of state?.tasks||[]){
      const n=(count.get(t.group)||0)+1;count.set(t.group,n);
      if(wbs.has(t.group))out.set(t.id,wbs.get(t.group)+'.'+String(n).padStart(2,'0'));
    }
    return out;
  }
  function target(link,state,psp=pspMap(state)){
    const byId=new Map((state?.tasks||[]).map(t=>[t.id,t]));
    const ids=[...(link?.executes||[])];
    const missing=[...ids,...(link?.anchor?.id?[link.anchor.id]:[])].filter(id=>!byId.has(id));
    const ex=ids.map(id=>byId.get(id)).filter(t=>t&&iso.test(t.start)&&iso.test(t.end));
    let start,due;
    if(ex.length){
      start=ex.map(t=>t.start).sort()[0];
      due=ex.map(t=>t.end).sort().at(-1);
    }else if(link?.anchor?.id&&byId.has(link.anchor.id)){
      const a=byId.get(link.anchor.id);
      due=link.anchor.field==='start'?a.start:a.end;
    }
    const refs=[...new Set([...ids,...(link?.anchor?.id?[link.anchor.id]:[])])].filter(id=>psp.has(id)).map(id=>psp.get(id));
    return {start_date:start,due_date:due,terminplan_psp:refs.join(', '),missing};
  }
  // tasks: [{id,title,start_date,due_date,completed_at,metadata}]; instance: {id,state}
  function plan(tasks,instance){
    const psp=pspMap(instance?.state);
    const changes=[],missing=[];let linked=0,unchanged=0,done=0;
    for(const task of tasks||[]){
      const link=linkOf(task);
      if(!link||link.instance_id!==instance?.id)continue;
      linked++;
      if(task.completed_at){done++;continue}
      const next=target(link,instance.state,psp);
      if(next.missing.length){missing.push({id:task.id,title:task.title,vorgaenge:next.missing});continue}
      const before={start_date:task.start_date||null,due_date:task.due_date||null,terminplan_psp:task.metadata?.office_planner?.terminplan_psp||''};
      const after={
        start_date:next.start_date===undefined?before.start_date:next.start_date,
        due_date:next.due_date===undefined?before.due_date:next.due_date,
        terminplan_psp:next.terminplan_psp||before.terminplan_psp
      };
      if(after.start_date&&after.due_date&&after.start_date>after.due_date)after.start_date=after.due_date;
      if(before.start_date===after.start_date&&before.due_date===after.due_date&&before.terminplan_psp===after.terminplan_psp){unchanged++;continue}
      changes.push({id:task.id,title:task.title,before,after});
    }
    return {changes,missing,linked,unchanged,done};
  }
  // Metadata patch that keeps every other field of the task.
  function metadataWith(task,psp){
    const meta=task?.metadata||{},office=meta.office_planner||{};
    return {...meta,office_planner:{...office,terminplan_psp:psp}};
  }
  return {linkOf,pspMap,target,plan,metadataWith};
});
