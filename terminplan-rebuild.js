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
 function convert(original,extraction,sourceName,standDate,mode="rebuild"){
  if(!original||!original.project||!Array.isArray(original.tasks)||!Array.isArray(original.groups))
   throw Error("invalid_current_plan");
  if(!["rebuild","transform"].includes(mode))throw Error("invalid_mode");
  if(!extraction||extraction.complete!==true||!Array.isArray(extraction.uncertainties)||extraction.uncertainties.length)
   throw Error("source_not_completely_verified");
  const groupsInput=extraction.groups,taskInput=extraction.tasks;
  if(!Array.isArray(groupsInput)||groupsInput.length<1||groupsInput.length>80||
     !Array.isArray(taskInput)||taskInput.length<1||taskInput.length>300)
   throw Error("invalid_group_or_task_count");
  const expected=extraction.expected_counts;
  if(!expected||expected.groups!==groupsInput.length||
    expected.activities+expected.milestones!==taskInput.length||
    expected.milestones!==taskInput.filter(t=>t.type==="milestone").length)
   throw Error("count_mismatch");
  const structural=mode==="transform";
  const previousGroups=new Map(original.groups.map(g=>[g.id,g]));
  const previousTasks=new Map(original.tasks.map(t=>[t.id,t]));
  const usedGroupIds=new Set(previousGroups.keys()),usedTaskIds=new Set(previousTasks.keys());
  let newGroupCounter=0,newTaskCounter=0;
  function freshId(prefix,used,counter){
   let number=counter;
   while(used.has(prefix+String(++number).padStart(4,"0"))){}
   const id=prefix+String(number).padStart(4,"0");used.add(id);
   return {id,next:number};
  }
  const codeIndex=new Map(),rowIndex=new Map();
  const groups=groupsInput.map((x,i)=>{
   const code=clean(x.code,90),name=clean(x.name,160),wbs=clean(x.wbs,28);
   if(!code||!name||!wbs||codeIndex.has(code))throw Error("invalid_group_"+(i+1));
   if(!cats.has(x.category))throw Error("invalid_group_category_"+(i+1));
   let id,previous=null;
   if(structural){
    previous=previousGroups.get(code)||null;
    if(!previous&&!/^new[-_:]/i.test(code))throw Error("unrecognized_new_group_code_"+(i+1));
    if(previous)id=previous.id;
    else{
     const allocated=freshId("g-added-",usedGroupIds,newGroupCounter);
     id=allocated.id;newGroupCounter=allocated.next;
    }
   }else id="g-source-"+String(i+1).padStart(3,"0");
   codeIndex.set(code,id);
   return {...(previous||{}),id,wbs,name,category:x.category,collapsed:previous?.collapsed??false};
  });
  const tasks=taskInput.map((x,i)=>{
   const row=clean(x.row_id,90),name=clean(x.name,160),group=codeIndex.get(x.group_code);
   if(!row||rowIndex.has(row)||!name||!group||!validDate(x.start)||!validDate(x.end)||
      x.end<x.start||!["task","milestone"].includes(x.type)||
      (x.type==="milestone"&&x.end!==x.start)||!cats.has(x.category)||
      typeof x.owner!=="string"||x.owner.length>100||
      typeof x.note!=="string"||x.note.length>1000||
      !Array.isArray(x.predecessors)||x.predecessors.length>15)
    throw Error("invalid_task_"+(i+1));
   let id,previous=null;
   if(structural){
    previous=previousTasks.get(row)||null;
    if(!previous&&!/^new[-_:]/i.test(row))throw Error("unrecognized_new_task_row_"+(i+1));
    if(previous)id=previous.id;
    else{
     const allocated=freshId("t-added-",usedTaskIds,newTaskCounter);
     id=allocated.id;newTaskCounter=allocated.next;
    }
   }else id="t-source-"+String(i+1).padStart(4,"0");
   rowIndex.set(row,id);
   return {...(previous||{}),id,group,name,type:x.type,start:x.start,end:x.end,
     owner:x.owner,category:x.category,
     progress:previous?.progress??0,status:previous?.status??"Nicht begonnen",
     critical:previous?.critical??false,
     note:structural&&previous?previous.note||"":clean(x.note,1000),
     pred:"",rel:"EA",dependencies:[]};
  });
  const edges=new Map(tasks.map(x=>[x.id,[]]));
  for(let i=0;i<taskInput.length;i++){
   const item=taskInput[i],seen=new Set();
   const deps=item.predecessors.map(d=>{
    const pred=rowIndex.get(d?.row_id),relation=d?.relation,lag=d?.lag_workdays;
    if(!pred||pred===tasks[i].id||!rels.has(relation)||
       !Number.isInteger(lag)||Math.abs(lag)>260)
      throw Error("invalid_predecessor_"+(i+1));
    const label=pred+":"+relation;
    if(seen.has(label))throw Error("duplicate_predecessor_"+(i+1));
    seen.add(label);edges.get(tasks[i].id).push(pred);
    return {pred,rel:relation,lagDays:lag};
   });
   tasks[i].dependencies=deps;
   tasks[i].pred=deps[0]?.pred||"";
   tasks[i].rel=deps[0]?.rel||"EA";
  }
  const marks=new Map();
  function visit(id){
   const mark=marks.get(id)||0;
   if(mark===1)throw Error("dependency_cycle");
   if(mark===2)return;
   marks.set(id,1);for(const pred of edges.get(id)||[])visit(pred);marks.set(id,2);
  }
  for(const id of edges.keys())visit(id);
  const dates=tasks.flatMap(t=>[t.start,t.end]).sort();
  const out=clone(original);
  out.groups=groups;out.tasks=tasks;
  if(structural){
   const previousStart=validDate(out.project.start)?out.project.start:dates[0];
   const previousEnd=validDate(out.project.end)?out.project.end:dates[dates.length-1];
   out.project={...out.project,
     start:dates[0]<previousStart?dates[0]:previousStart,
     end:dates[dates.length-1]>previousEnd?dates[dates.length-1]:previousEnd,
     standDate:validDate(standDate)?standDate:out.project.standDate,
     standLabel:"Planänderung"};
  }else out.project={...out.project,start:dates[0],end:dates[dates.length-1],
    standDate:validDate(standDate)?standDate:(validDate(out.project.standDate)?out.project.standDate:dates[0]),
    standLabel:"PDF-Abgleich",sourceFileName:clean(sourceName,180),
    sourceVersion:clean(extraction.source_version,160)};
  return out;
 }
 const structuralPropsGroup=["wbs","name","category"];
 const structuralPropsTask=["group","name","type","start","end","owner","category","note","dependencies"];
 function summaryDiff(before,after){
  function changed(beforeRows,afterRows,fields){
   const previous=new Map(beforeRows.map(x=>[x.id,x]));
   const current=new Map(afterRows.map(x=>[x.id,x]));
   const created=afterRows.filter(x=>!previous.has(x.id)).map(x=>x.name);
   const deleted=beforeRows.filter(x=>!current.has(x.id)).map(x=>x.name);
   const canonicalDeps=x=>Array.isArray(x?.dependencies)?x.dependencies:
      x?.pred?[{pred:x.pred,rel:x.rel||"EA",lagDays:0}]:[];
   const edited=afterRows.filter(x=>{
    const old=previous.get(x.id);
    return old&&fields.some(field=>field==="dependencies"
      ?stable(canonicalDeps(old))!==stable(canonicalDeps(x))
      :stable(old[field])!==stable(x[field]));
   }).map(x=>x.name);
   return {created,deleted,edited};
  }
  return {groups:changed(before.groups,after.groups,structuralPropsGroup),
    tasks:changed(before.tasks,after.tasks,structuralPropsTask)};
 }
 function preview({state,result,revision,requestId,sourceName,standDate,mode="rebuild"}){
  if(!Number.isSafeInteger(revision)||revision<1)throw Error("revision_required");
  const candidate=convert(state,result,sourceName,standDate,mode);
  const oldGroups=state.groups.length,oldTasks=state.tasks.length;
  const oldMilestones=state.tasks.filter(t=>t.type==="milestone").length;
  const diff=mode==="transform"?summaryDiff(state,candidate):null;
  const proposal={
   request_id:requestId,kind:"replace_plan",status:"proposed",
   mode,source:mode==="transform"?"office_ai_structural_transformation":"office_ai_pdf_full_reconstruction",
   source_name:clean(sourceName,180),
   base_revision:revision,base_fingerprint:stable(state),candidate_fingerprint:stable(candidate),
   extraction:clone(result),stand_date:standDate,diff,
   counts:{groups:candidate.groups.length,tasks:candidate.tasks.length,
     milestones:candidate.tasks.filter(t=>t.type==="milestone").length,
     previous_groups:oldGroups,previous_tasks:oldTasks,previous_milestones:oldMilestones},
   requires_confirmation:true
  };
  if(mode==="transform"){
   const g=diff.groups,t=diff.tasks;
   const modified=[...g.created,...g.deleted,...g.edited,...t.created,...t.deleted,...t.edited];
   return {kind:"proposal",proposal,preview:{state:candidate},
    text:"Vorschau der strukturellen Planänderung: Gruppen — "+g.created.length+
      " neu, "+g.deleted.length+" entfernt, "+g.edited.length+" bearbeitet. Vorgänge — "+
      t.created.length+" neu, "+t.deleted.length+" entfernt, "+t.edited.length+
      " bearbeitet. "+(modified.length?"Betroffene: "+modified.slice(0,16).join(" · ")+
      (modified.length>16?" (weitere "+(modified.length-16)+")":"")+". ":"")+
      "Unveränderte Aufgaben behalten ihre Identität, ihren Fortschritt, ihren Status, geschützte Termine und weitere Metadaten. "+
      "Die bisherige Version wird vor dem Übernehmen gesichert; erst deine Freigabe schreibt den Entwurf."};
  }
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
     !["rebuild","transform"].includes(proposal.mode)||
     proposal.base_revision!==revision||stable(state)!==proposal.base_fingerprint)
    return {ok:false,reason:"stale_plan"};
  try{
   const candidate=convert(state,proposal.extraction,proposal.source_name,proposal.stand_date,proposal.mode);
   if(stable(candidate)!==proposal.candidate_fingerprint)return {ok:false,reason:"candidate_changed"};
   return {ok:true,state:candidate,preview:{state:candidate}};
  }catch(e){return {ok:false,reason:e.message||"invalid_extraction"}}
 }
 return Object.freeze({convert,preview,review,stable,validDate});
});
