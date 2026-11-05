/* TBA Office · Complete Terminplan reconstruction: deterministic verification and explicit review. */
(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.TBATerminplanRebuild=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
 "use strict";
 const cats=new Set(["arch","fach","ag","qa","cost"]),rels=new Set(["EA","AA","EE","AE"]);
 const clean=(x,n)=>typeof x==="string"?x.trim().slice(0,n):"";
 const clone=x=>JSON.parse(JSON.stringify(x));
 const stable=x=>Array.isArray(x)?"["+x.map(stable).join(",")+"]":
   x&&typeof x==="object"?"{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+stable(x[k])).join(",")+"}":JSON.stringify(x);
 const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
   !Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
 function convert(original,extraction,sourceName,standDate){
  if(!original||!original.project||!Array.isArray(original.tasks)||!Array.isArray(original.groups))throw Error("invalid_current_plan");
  if(!extraction||extraction.complete!==true||!Array.isArray(extraction.uncertainties)||extraction.uncertainties.length)
    throw Error("source_not_completely_verified");
  const g=extraction.groups,t=extraction.tasks;
  if(!Array.isArray(g)||g.length<1||g.length>80||!Array.isArray(t)||t.length<1||t.length>300)
    throw Error("invalid_group_or_task_count");
  const codeIndex=new Map(),rowIndex=new Map();
  const groups=g.map((x,i)=>{
   const code=clean(x.code,60),name=clean(x.name,160),wbs=clean(x.wbs,28);
   if(!code||!name||!wbs||codeIndex.has(code))throw Error("invalid_group_"+(i+1));
   if(!cats.has(x.category))throw Error("invalid_group_category_"+(i+1));
   const id="g-source-"+String(i+1).padStart(3,"0");
   codeIndex.set(code,id);
   return {id,wbs,name,category:x.category,collapsed:false};
  });
  const tasks=t.map((x,i)=>{
   const row=clean(x.row_id,64),name=clean(x.name,160),group=codeIndex.get(x.group_code);
   if(!row||rowIndex.has(row)||!name||!group||!validDate(x.start)||!validDate(x.end)||
     x.end<x.start||!["task","milestone"].includes(x.type)||
     (x.type==="milestone"&&x.start!==x.end)||!cats.has(x.category)||
     typeof x.owner!=="string"||x.owner.length>100||
     !Array.isArray(x.predecessors)||x.predecessors.length>15)throw Error("invalid_task_"+(i+1));
   const id="t-source-"+String(i+1).padStart(4,"0");
   rowIndex.set(row,id);
   return {id,group,name,type:x.type,start:x.start,end:x.end,owner:x.owner,
     category:x.category,progress:0,status:"Nicht begonnen",critical:false,
     note:clean(x.note,1000),pred:"",rel:"EA",dependencies:[]};
  });
  const edges=new Map(tasks.map(x=>[x.id,[]]));
  for(let i=0;i<t.length;i++){
   const item=t[i],seen=new Set();
   const deps=item.predecessors.map(d=>{
    const pred=rowIndex.get(d?.row_id),relation=d?.relation,lag=d?.lag_workdays;
    if(!pred||pred===tasks[i].id||!rels.has(relation)||!Number.isInteger(lag)||Math.abs(lag)>260)
      throw Error("invalid_predecessor_"+(i+1));
    const label=pred+":"+relation;if(seen.has(label))throw Error("duplicate_predecessor_"+(i+1));
    seen.add(label);
    edges.get(tasks[i].id).push(pred);
    return {pred,rel:relation,lagDays:lag};
   });
   tasks[i].dependencies=deps;tasks[i].pred=deps[0]?.pred||"";tasks[i].rel=deps[0]?.rel||"EA";
  }
  const marks=new Map();
  function visit(id){
   const m=marks.get(id)||0;if(m===1)throw Error("dependency_cycle");if(m===2)return;
   marks.set(id,1);for(const predecessor of edges.get(id)||[])visit(predecessor);marks.set(id,2);
  }
  for(const id of edges.keys())visit(id);
  const dates=tasks.flatMap(x=>[x.start,x.end]).sort();
  const out=clone(original);
  out.groups=groups;out.tasks=tasks;
  out.project={...out.project,start:dates[0],end:dates[dates.length-1],
    standDate:validDate(standDate)?standDate:(validDate(out.project.standDate)?out.project.standDate:dates[0]),
    standLabel:"PDF-Abgleich",sourceFileName:clean(sourceName,180),sourceVersion:clean(extraction.source_version,160)};
  return out;
 }
 function preview({state,result,revision,requestId,sourceName,standDate}){
  if(!Number.isSafeInteger(revision)||revision<1)throw Error("revision_required");
  const candidate=convert(state,result,sourceName,standDate);
  const oldGroups=state.groups.length,oldTasks=state.tasks.length;
  const oldMilestones=state.tasks.filter(t=>t.type==="milestone").length;
  const proposal={
   request_id:requestId,kind:"replace_plan",status:"proposed",
   source:"office_ai_pdf_full_reconstruction",source_name:clean(sourceName,180),
   base_revision:revision,base_fingerprint:stable(state),candidate_fingerprint:stable(candidate),
   extraction:clone(result),stand_date:standDate,
   counts:{groups:candidate.groups.length,tasks:candidate.tasks.length,
     milestones:candidate.tasks.filter(t=>t.type==="milestone").length,
     previous_groups:oldGroups,previous_tasks:oldTasks,previous_milestones:oldMilestones},
   requires_confirmation:true
  };
  return {kind:"proposal",proposal,preview:{state:candidate},
   text:"Vollständiger Terminplan-Entwurf aus „"+proposal.source_name+"“: "+
     candidate.groups.length+" Gruppen, "+(candidate.tasks.length-proposal.counts.milestones)+
     " Vorgänge, "+proposal.counts.milestones+" Meilensteine. "+
     "Der bisherige Plan enthält "+oldGroups+" Gruppen und "+oldTasks+
     " Einträge. Alle Gruppen und Vorgänge werden beim Übernehmen ersetzt. "+
     "Die bisherige Fassung wird vorher als Version gesichert. "+
     "Bitte Namen, Datumsangaben und gezeichnete Abhängigkeiten vor Bestätigung mit dem PDF vergleichen."};
 }
 function review(proposal,state,revision){
  if(!proposal||proposal.kind!=="replace_plan"||proposal.status!=="proposed"||
    proposal.base_revision!==revision||stable(state)!==proposal.base_fingerprint)
    return {ok:false,reason:"stale_plan"};
  try{
    const candidate=convert(state,proposal.extraction,proposal.source_name,proposal.stand_date);
    if(stable(candidate)!==proposal.candidate_fingerprint)return {ok:false,reason:"candidate_changed"};
    return {ok:true,state:candidate,preview:{state:candidate}};
  }catch(e){return {ok:false,reason:e.message||"invalid_extraction"}}
 }
 return Object.freeze({convert,preview,review,stable,validDate});
});
